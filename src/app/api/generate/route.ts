```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ratelimit } from '@/lib/upstash';
import { supabase } from '@/lib/supabase';
import { QuestGenerator } from '@/lib/generators/quest-generator';
import { EnvironmentGenerator } from '@/lib/generators/environment-generator';
import { StorylineGenerator } from '@/lib/generators/storyline-generator';
import { CharacterGenerator } from '@/lib/generators/character-generator';
import { GenreModelManager } from '@/lib/ai/genre-model-manager';
import { ContentContextAnalyzer } from '@/lib/ai/content-context-analyzer';
import { ContentCache } from '@/lib/cache/content-cache';
import { GenerationHistory } from '@/lib/database/generation-history';
import { validateApiKey, sanitizeInput, logSecurityEvent } from '@/lib/security';
import { 
  GeneratedQuest, 
  GeneratedEnvironment, 
  GeneratedStoryline, 
  GeneratedCharacter,
  GenerationRequest,
  GenerationResponse,
  ContentType,
  Genre
} from '@/types/generated-content';

const GenerationRequestSchema = z.object({
  contentType: z.enum(['quest', 'environment', 'storyline', 'character']),
  genre: z.enum(['fantasy', 'scifi', 'horror', 'mystery', 'adventure', 'historical']),
  context: z.object({
    setting: z.string().optional(),
    theme: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    previousContent: z.array(z.string()).optional()
  }).optional(),
  userPreferences: z.object({
    favoriteElements: z.array(z.string()).optional(),
    avoidedTopics: z.array(z.string()).optional(),
    complexityPreference: z.number().min(1).max(10).optional()
  }).optional(),
  constraints: z.object({
    maxWords: z.number().positive().optional(),
    requiredElements: z.array(z.string()).optional(),
    excludedElements: z.array(z.string()).optional(),
    ageRating: z.enum(['G', 'PG', 'PG13', 'R']).optional()
  }).optional(),
  sessionId: z.string().optional(),
  userId: z.string().uuid().optional()
});

interface GenerationContext {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let context: GenerationContext = {};

  try {
    // Extract context information
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    context = { userAgent, ipAddress };

    // Validate API key
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey || !await validateApiKey(apiKey)) {
      await logSecurityEvent({
        type: 'invalid_api_key',
        ipAddress,
        userAgent,
        endpoint: '/api/generate'
      });
      
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Rate limiting
    const identifier = apiKey;
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          limit,
          reset,
          remaining: 0
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString()
          }
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const sanitizedBody = sanitizeInput(body);
    
    const validationResult = GenerationRequestSchema.safeParse(sanitizedBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }

    const generationRequest: GenerationRequest = validationResult.data;
    context.userId = generationRequest.userId;
    context.sessionId = generationRequest.sessionId;

    // Check cache first
    const cacheKey = await ContentCache.generateCacheKey(generationRequest);
    const cachedContent = await ContentCache.get(cacheKey);
    
    if (cachedContent) {
      await GenerationHistory.logRequest({
        ...generationRequest,
        result: 'cache_hit',
        duration: Date.now() - startTime,
        ...context
      });

      return NextResponse.json({
        success: true,
        content: cachedContent,
        cached: true,
        generationTime: 0
      });
    }

    // Analyze context for better generation
    const contextAnalyzer = new ContentContextAnalyzer();
    const analyzedContext = await contextAnalyzer.analyze({
      request: generationRequest,
      userHistory: generationRequest.userId ? 
        await GenerationHistory.getUserHistory(generationRequest.userId, 10) : [],
      sessionHistory: generationRequest.sessionId ?
        await GenerationHistory.getSessionHistory(generationRequest.sessionId, 5) : []
    });

    // Select appropriate AI model based on genre and content type
    const modelManager = new GenreModelManager();
    const selectedModel = await modelManager.selectModel(
      generationRequest.genre,
      generationRequest.contentType,
      analyzedContext
    );

    // Generate content based on type
    let generatedContent: GeneratedQuest | GeneratedEnvironment | GeneratedStoryline | GeneratedCharacter;
    const generationStartTime = Date.now();

    try {
      switch (generationRequest.contentType) {
        case 'quest':
          const questGenerator = new QuestGenerator(selectedModel);
          generatedContent = await questGenerator.generate({
            ...generationRequest,
            analyzedContext,
            model: selectedModel
          });
          break;

        case 'environment':
          const environmentGenerator = new EnvironmentGenerator(selectedModel);
          generatedContent = await environmentGenerator.generate({
            ...generationRequest,
            analyzedContext,
            model: selectedModel
          });
          break;

        case 'storyline':
          const storylineGenerator = new StorylineGenerator(selectedModel);
          generatedContent = await storylineGenerator.generate({
            ...generationRequest,
            analyzedContext,
            model: selectedModel
          });
          break;

        case 'character':
          const characterGenerator = new CharacterGenerator(selectedModel);
          generatedContent = await characterGenerator.generate({
            ...generationRequest,
            analyzedContext,
            model: selectedModel
          });
          break;

        default:
          throw new Error(`Unsupported content type: ${generationRequest.contentType}`);
      }
    } catch (modelError) {
      await logSecurityEvent({
        type: 'generation_error',
        error: modelError.message,
        contentType: generationRequest.contentType,
        genre: generationRequest.genre,
        ...context
      });

      return NextResponse.json(
        { error: 'Content generation failed', details: 'AI model error' },
        { status: 500 }
      );
    }

    const generationTime = Date.now() - generationStartTime;

    // Apply content moderation
    const moderationResult = await moderateContent(generatedContent);
    if (!moderationResult.approved) {
      await logSecurityEvent({
        type: 'content_moderation_failed',
        reason: moderationResult.reason,
        contentType: generationRequest.contentType,
        ...context
      });

      return NextResponse.json(
        { error: 'Generated content violates guidelines' },
        { status: 400 }
      );
    }

    // Cache the generated content
    await ContentCache.set(cacheKey, generatedContent, {
      ttl: 3600, // 1 hour
      tags: [generationRequest.genre, generationRequest.contentType]
    });

    // Store in generation history
    await GenerationHistory.logRequest({
      ...generationRequest,
      result: 'success',
      duration: Date.now() - startTime,
      generationTime,
      contentId: generatedContent.id,
      modelUsed: selectedModel.id,
      ...context
    });

    // Update user preferences if authenticated
    if (generationRequest.userId) {
      await updateUserPreferences(generationRequest.userId, generationRequest, generatedContent);
    }

    const response: GenerationResponse = {
      success: true,
      content: generatedContent,
      cached: false,
      generationTime,
      metadata: {
        modelUsed: selectedModel.name,
        contextScore: analyzedContext.relevanceScore,
        totalProcessingTime: Date.now() - startTime
      }
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'X-Content-Type': generationRequest.contentType,
        'X-Generation-Time': generationTime.toString()
      }
    });

  } catch (error) {
    await logSecurityEvent({
      type: 'api_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: '/api/generate',
      ...context
    });

    console.error('Generation API error:', error);

    return NextResponse.json(
      { 
        error: 'Internal server error',
        requestId: generateRequestId()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get supported content types and genres
    const supportedTypes: ContentType[] = ['quest', 'environment', 'storyline', 'character'];
    const supportedGenres: Genre[] = ['fantasy', 'scifi', 'horror', 'mystery', 'adventure', 'historical'];

    // Get model availability
    const modelManager = new GenreModelManager();
    const availableModels = await modelManager.getAvailableModels();

    return NextResponse.json({
      supportedContentTypes: supportedTypes,
      supportedGenres: supportedGenres,
      availableModels: availableModels.map(model => ({
        id: model.id,
        name: model.name,
        genres: model.supportedGenres,
        contentTypes: model.supportedContentTypes,
        status: model.status
      })),
      rateLimits: {
        requests: 100,
        window: '1h',
        burstLimit: 10
      }
    });

  } catch (error) {
    console.error('GET generation API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API information' },
      { status: 500 }
    );
  }
}

async function moderateContent(content: any): Promise<{ approved: boolean; reason?: string }> {
  try {
    // Implement content moderation logic
    // This could integrate with OpenAI Moderation API or custom filters
    
    const contentText = JSON.stringify(content);
    
    // Basic content checks
    const forbiddenPatterns = [
      /\b(suicide|self-harm)\b/i,
      /\b(explicit sexual content)\b/i,
      /\b(hate speech)\b/i
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(contentText)) {
        return {
          approved: false,
          reason: 'Content violates community guidelines'
        };
      }
    }

    return { approved: true };
  } catch (error) {
    console.error('Content moderation error:', error);
    return {
      approved: false,
      reason: 'Moderation service unavailable'
    };
  }
}

async function updateUserPreferences(
  userId: string, 
  request: GenerationRequest, 
  content: any
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferred_genres: [request.genre],
        preferred_content_types: [request.contentType],
        last_generation: new Date().toISOString(),
        generation_count: 1
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Failed to update user preferences:', error);
    }
  } catch (error) {
    console.error('User preferences update error:', error);
  }
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```