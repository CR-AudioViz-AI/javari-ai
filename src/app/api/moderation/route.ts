```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';

// Environment validation
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_CLOUD_API_KEY',
  'MODERATION_WEBHOOK_SECRET'
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Validation schemas
const moderationRequestSchema = z.object({
  content: z.object({
    type: z.enum(['text', 'image', 'video', 'audio']),
    data: z.string().min(1).max(50000000), // Base64 or text content
    metadata: z.object({
      userId: z.string().uuid(),
      contentId: z.string().uuid().optional(),
      source: z.string().optional(),
      timestamp: z.string().datetime().optional()
    })
  }),
  options: z.object({
    strictMode: z.boolean().default(false),
    customRules: z.array(z.string()).optional(),
    skipCache: z.boolean().default(false)
  }).optional()
});

const reviewDecisionSchema = z.object({
  moderationId: z.string().uuid(),
  decision: z.enum(['approve', 'reject', 'escalate']),
  reason: z.string().min(10).max(500),
  moderatorId: z.string().uuid(),
  customActions: z.array(z.string()).optional()
});

const appealSchema = z.object({
  moderationId: z.string().uuid(),
  appealReason: z.string().min(20).max(1000),
  userId: z.string().uuid(),
  evidence: z.array(z.string()).optional()
});

// Types
interface ModerationResult {
  id: string;
  status: 'approved' | 'flagged' | 'rejected' | 'pending_review';
  confidence: number;
  categories: string[];
  reasons: string[];
  aiAnalysis: {
    toxicity: number;
    harassment: number;
    hate_speech: number;
    violence: number;
    nsfw: number;
    spam: number;
  };
  actions: string[];
  reviewRequired: boolean;
  estimatedReviewTime?: number;
}

interface ModerationContext {
  userId: string;
  userHistory: any[];
  contentHistory: any[];
  riskProfile: 'low' | 'medium' | 'high';
}

// Content analyzers
class TextAnalyzer {
  static async analyze(text: string, context: ModerationContext): Promise<Partial<ModerationResult>> {
    try {
      // OpenAI moderation
      const moderation = await openai.moderations.create({
        input: text,
      });

      const result = moderation.results[0];
      
      // Custom analysis for context-aware detection
      const customAnalysis = await this.customTextAnalysis(text, context);
      
      const confidence = Math.max(
        result.category_scores.harassment,
        result.category_scores.hate,
        result.category_scores.violence,
        result.category_scores['self-harm'],
        result.category_scores.sexual,
        result.category_scores['hate/threatening'],
        result.category_scores['violence/graphic'],
        customAnalysis.spamScore
      );

      const categories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category, _]) => category);

      if (customAnalysis.isSpam) {
        categories.push('spam');
      }

      return {
        status: confidence > 0.8 ? 'rejected' : confidence > 0.5 ? 'flagged' : 'approved',
        confidence: Math.round(confidence * 100) / 100,
        categories,
        reasons: this.generateReasons(result.categories, customAnalysis),
        aiAnalysis: {
          toxicity: result.category_scores.harassment,
          harassment: result.category_scores.harassment,
          hate_speech: result.category_scores.hate,
          violence: result.category_scores.violence,
          nsfw: result.category_scores.sexual,
          spam: customAnalysis.spamScore
        },
        reviewRequired: confidence > 0.3 && confidence < 0.8
      };
    } catch (error) {
      console.error('Text analysis failed:', error);
      throw new Error('Text moderation analysis failed');
    }
  }

  private static async customTextAnalysis(text: string, context: ModerationContext) {
    // Implement custom spam detection, context analysis, etc.
    const spamIndicators = [
      /https?:\/\/[^\s]+/gi, // URLs
      /\b(?:buy|sale|discount|offer|free|click|now)\b/gi, // Spam keywords
      /(.)\1{4,}/g, // Repeated characters
    ];

    let spamScore = 0;
    spamIndicators.forEach(regex => {
      const matches = text.match(regex);
      if (matches) {
        spamScore += matches.length * 0.2;
      }
    });

    // User history analysis
    if (context.riskProfile === 'high') {
      spamScore += 0.3;
    }

    return {
      spamScore: Math.min(spamScore, 1),
      isSpam: spamScore > 0.6
    };
  }

  private static generateReasons(categories: any, customAnalysis: any): string[] {
    const reasons: string[] = [];
    
    Object.entries(categories).forEach(([category, flagged]) => {
      if (flagged) {
        reasons.push(`Content flagged for: ${category.replace(/[/_]/g, ' ')}`);
      }
    });

    if (customAnalysis.isSpam) {
      reasons.push('Content detected as potential spam');
    }

    return reasons;
  }
}

class ImageAnalyzer {
  static async analyze(imageData: string, context: ModerationContext): Promise<Partial<ModerationResult>> {
    try {
      // Google Vision API Safe Search
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_CLOUD_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: imageData },
              features: [
                { type: 'SAFE_SEARCH_DETECTION' },
                { type: 'TEXT_DETECTION' },
                { type: 'LABEL_DETECTION' }
              ]
            }]
          })
        }
      );

      const visionData = await visionResponse.json();
      const safeSearch = visionData.responses[0].safeSearchAnnotation;
      const textDetection = visionData.responses[0].textAnnotations;
      const labels = visionData.responses[0].labelAnnotations;

      // Convert likelihood to scores
      const likelihoodToScore = (likelihood: string): number => {
        const scoreMap = {
          'VERY_UNLIKELY': 0.1,
          'UNLIKELY': 0.3,
          'POSSIBLE': 0.5,
          'LIKELY': 0.7,
          'VERY_LIKELY': 0.9
        };
        return scoreMap[likelihood as keyof typeof scoreMap] || 0;
      };

      const adultScore = likelihoodToScore(safeSearch.adult);
      const violenceScore = likelihoodToScore(safeSearch.violence);
      const racyScore = likelihoodToScore(safeSearch.racy);

      // Analyze detected text if any
      let textAnalysis = null;
      if (textDetection && textDetection.length > 0) {
        const detectedText = textDetection[0].description;
        textAnalysis = await TextAnalyzer.analyze(detectedText, context);
      }

      const maxScore = Math.max(adultScore, violenceScore, racyScore);
      const confidence = textAnalysis ? Math.max(maxScore, textAnalysis.confidence || 0) : maxScore;

      const categories: string[] = [];
      const reasons: string[] = [];

      if (adultScore > 0.5) {
        categories.push('nsfw');
        reasons.push('Adult content detected in image');
      }
      if (violenceScore > 0.5) {
        categories.push('violence');
        reasons.push('Violent content detected in image');
      }
      if (racyScore > 0.5) {
        categories.push('suggestive');
        reasons.push('Suggestive content detected in image');
      }

      // Include text analysis results
      if (textAnalysis) {
        categories.push(...(textAnalysis.categories || []));
        reasons.push(...(textAnalysis.reasons || []));
      }

      return {
        status: confidence > 0.8 ? 'rejected' : confidence > 0.5 ? 'flagged' : 'approved',
        confidence: Math.round(confidence * 100) / 100,
        categories,
        reasons,
        aiAnalysis: {
          toxicity: textAnalysis?.aiAnalysis?.toxicity || 0,
          harassment: textAnalysis?.aiAnalysis?.harassment || 0,
          hate_speech: textAnalysis?.aiAnalysis?.hate_speech || 0,
          violence: violenceScore,
          nsfw: Math.max(adultScore, racyScore),
          spam: textAnalysis?.aiAnalysis?.spam || 0
        },
        reviewRequired: confidence > 0.3 && confidence < 0.8
      };
    } catch (error) {
      console.error('Image analysis failed:', error);
      throw new Error('Image moderation analysis failed');
    }
  }
}

class VideoAnalyzer {
  static async analyze(videoData: string, context: ModerationContext): Promise<Partial<ModerationResult>> {
    // For video analysis, we'll implement a simplified version
    // In production, you'd use services like Sightengine or Hive AI
    try {
      // Placeholder for video analysis - extract frames and analyze
      // This would typically involve:
      // 1. Extract key frames from video
      // 2. Analyze each frame with image analyzer
      // 3. Extract audio and analyze with audio analyzer
      // 4. Combine results with temporal analysis

      return {
        status: 'pending_review', // Videos typically require human review
        confidence: 0.5,
        categories: ['video'],
        reasons: ['Video content requires manual review'],
        aiAnalysis: {
          toxicity: 0,
          harassment: 0,
          hate_speech: 0,
          violence: 0,
          nsfw: 0,
          spam: 0
        },
        reviewRequired: true,
        estimatedReviewTime: 300000 // 5 minutes
      };
    } catch (error) {
      console.error('Video analysis failed:', error);
      throw new Error('Video moderation analysis failed');
    }
  }
}

// Moderation workflow manager
class ModerationWorkflow {
  static async processContent(content: any, options: any = {}): Promise<ModerationResult> {
    const moderationId = crypto.randomUUID();
    
    try {
      // Get user context
      const context = await this.getUserContext(content.metadata.userId);
      
      // Check cache unless skip requested
      if (!options.skipCache) {
        const cached = await this.getCachedResult(content);
        if (cached) return cached;
      }

      let result: Partial<ModerationResult>;

      // Route to appropriate analyzer
      switch (content.type) {
        case 'text':
          result = await TextAnalyzer.analyze(content.data, context);
          break;
        case 'image':
          result = await ImageAnalyzer.analyze(content.data, context);
          break;
        case 'video':
          result = await VideoAnalyzer.analyze(content.data, context);
          break;
        case 'audio':
          result = await this.analyzeAudio(content.data, context);
          break;
        default:
          throw new Error(`Unsupported content type: ${content.type}`);
      }

      // Create complete result
      const fullResult: ModerationResult = {
        id: moderationId,
        status: result.status || 'pending_review',
        confidence: result.confidence || 0.5,
        categories: result.categories || [],
        reasons: result.reasons || [],
        aiAnalysis: result.aiAnalysis || {
          toxicity: 0, harassment: 0, hate_speech: 0,
          violence: 0, nsfw: 0, spam: 0
        },
        actions: this.determineActions(result),
        reviewRequired: result.reviewRequired || false,
        estimatedReviewTime: result.estimatedReviewTime
      };

      // Store in database
      await this.storeModerationResult(moderationId, content, fullResult, context);
      
      // Cache result
      await this.cacheResult(content, fullResult);
      
      // Queue for review if needed
      if (fullResult.reviewRequired) {
        await this.queueForReview(moderationId, fullResult);
      }

      // Trigger webhooks
      await this.triggerWebhooks(fullResult, content);

      return fullResult;
    } catch (error) {
      console.error('Moderation workflow failed:', error);
      
      // Fallback to manual review
      const fallbackResult: ModerationResult = {
        id: moderationId,
        status: 'pending_review',
        confidence: 0.5,
        categories: ['analysis_failed'],
        reasons: ['Automatic analysis failed - requires manual review'],
        aiAnalysis: { toxicity: 0, harassment: 0, hate_speech: 0, violence: 0, nsfw: 0, spam: 0 },
        actions: ['manual_review'],
        reviewRequired: true
      };

      await this.storeModerationResult(moderationId, content, fallbackResult, await this.getUserContext(content.metadata.userId));
      return fallbackResult;
    }
  }

  private static async getUserContext(userId: string): Promise<ModerationContext> {
    const { data: user } = await supabase
      .from('user_moderation_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: history } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      userId,
      userHistory: history || [],
      contentHistory: [],
      riskProfile: user?.risk_profile || 'low'
    };
  }

  private static async getCachedResult(content: any): Promise<ModerationResult | null> {
    // Redis cache implementation would go here
    return null;
  }

  private static async cacheResult(content: any, result: ModerationResult): Promise<void> {
    // Redis cache implementation would go here
  }

  private static determineActions(result: Partial<ModerationResult>): string[] {
    const actions: string[] = [];
    
    if (result.status === 'rejected') {
      actions.push('block_content', 'notify_user');
    } else if (result.status === 'flagged') {
      actions.push('restrict_visibility', 'queue_review');
    } else if (result.reviewRequired) {
      actions.push('queue_review');
    }

    return actions;
  }

  private static async storeModerationResult(
    id: string,
    content: any,
    result: ModerationResult,
    context: ModerationContext
  ): Promise<void> {
    await supabase.from('moderation_logs').insert({
      id,
      user_id: content.metadata.userId,
      content_type: content.type,
      content_id: content.metadata.contentId,
      status: result.status,
      confidence: result.confidence,
      categories: result.categories,
      reasons: result.reasons,
      ai_analysis: result.aiAnalysis,
      actions: result.actions,
      review_required: result.reviewRequired,
      estimated_review_time: result.estimatedReviewTime,
      created_at: new Date().toISOString()
    });
  }

  private static async queueForReview(moderationId: string, result: ModerationResult): Promise<void> {
    await supabase.from('review_queue').insert({
      moderation_id: moderationId,
      priority: this.calculatePriority(result),
      estimated_time: result.estimatedReviewTime || 180000, // 3 minutes default
      status: 'pending',
      created_at: new Date().toISOString()
    });
  }

  private static calculatePriority(result: ModerationResult): number {
    let priority = 5; // Medium priority
    
    if (result.confidence > 0.8) priority = 9; // High confidence issues
    if (result.categories.includes('violence') || result.categories.includes('hate_speech')) priority = 10;
    if (result.aiAnalysis.toxicity > 0.8) priority = 9;
    
    return Math.min(priority, 10);
  }

  private static async triggerWebhooks(result: ModerationResult, content: any): Promise<void> {
    // Webhook implementation for real-time notifications
    const webhookData = {
      event: 'content_moderated',
      moderation_id: result.id,
      status: result.status,
      content_type: content.type,
      user_id: content.metadata.userId,
      timestamp: new Date().toISOString()
    };

    // Send to configured webhook endpoints
    // Implementation would depend on your webhook configuration
  }

  private static async analyzeAudio(audioData: string, context: ModerationContext): Promise<Partial<ModerationResult>> {
    // Audio analysis implementation
    return {
      status: 'pending_review',
      confidence: 0.5,
      categories: ['audio'],
      reasons: ['Audio content requires manual review'],
      aiAnalysis: { toxicity: 0, harassment: 0, hate_speech: 0, violence: 0, nsfw: 0, spam: 0 },
      reviewRequired: true
    };
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0] || realIp || 'unknown';

    // Rate limiting
    const rateLimitResult = await rateLimit(clientIp, 100, 3600); // 100 requests per hour
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = moderationRequestSchema.parse(body);

    const result = await ModerationWorkflow.processContent(
      validatedData.content,
      validatedData.options
    );

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Moderation API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moderationId = searchParams.get('id');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    let query = supabase
      .from('moderation_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (moderationId) {
      query = query.eq('id', moderationId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .range((page - 1) * limit, page * limit - 1)
      .select('*', { count: 'exact' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Get moderation logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = reviewDecisionSchema.parse(body);

    // Update moderation decision
    const { error } = await supabase
      .from('moderation_logs')
      .update({
        status: validatedData.decision === 'approve' ? 'approved' : 
               validatedData.decision === 'reject' ? 'rejected' : 'escalated',
        moderator_decision: validatedData.decision,
        moderator_reason: validatedData.reason,
        moderator_id: validatedData.moderatorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', validatedData.moderationId);

    if (error) throw error;

    // Remove from review queue
    await supabase
      .from('review_queue')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('moderation_id', validatedData.moderationId);

    return NextResponse.json({
      success: true,
      message: 'Review decision recorded successfully'
    });

  } catch (error) {
    console.error('Review decision error:', error);

    if (error instanceof z.ZodError) {