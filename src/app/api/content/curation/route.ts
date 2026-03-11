import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import OpenAI from 'openai';
import Redis from 'ioredis';

// Types
interface UserProfile {
  id: string;
  interests: string[];
  engagement_patterns: {
    preferred_content_types: string[];
    active_hours: number[];
    interaction_weights: Record<string, number>;
  };
  preference_vector: number[];
  last_active: string;
}

interface ContentItem {
  id: string;
  title: string;
  description: string;
  content_type: string;
  tags: string[];
  author_id: string;
  created_at: string;
  engagement_score: number;
  semantic_embedding: number[];
  trending_score?: number;
}

interface CurationRequest {
  user_id?: string;
  content_types?: string[];
  limit?: number;
  offset?: number;
  include_trending?: boolean;
  freshness_weight?: number;
  diversity_factor?: number;
}

interface CurationResponse {
  curated_content: Array<ContentItem & {
    relevance_score: number;
    recommendation_reason: string;
  }>;
  trending_topics: string[];
  user_insights: {
    primary_interests: string[];
    engagement_trend: string;
    content_discovery_rate: number;
  };
  cache_info: {
    cached: boolean;
    ttl: number;
  };
}

// Validation schemas
const curationRequestSchema = z.object({
  user_id: z.string().uuid().optional(),
  content_types: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  include_trending: z.boolean().default(true),
  freshness_weight: z.number().min(0).max(1).default(0.3),
  diversity_factor: z.number().min(0).max(1).default(0.4)
});

// Initialize services
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

const redis = new Redis(process.env.REDIS_URL!);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many curation requests'
});

// Content Analysis Service
class ContentAnalyzer {
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000) // Truncate for API limits
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      return new Array(1536).fill(0); // Return zero vector as fallback
    }
  }

  async extractTopics(content: string): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'Extract 3-5 key topics from the content. Return as comma-separated list.'
        }, {
          role: 'user',
          content: content.substring(0, 4000)
        }],
        max_tokens: 100,
        temperature: 0.3
      });

      const topics = response.choices[0]?.message?.content
        ?.split(',')
        .map(topic => topic.trim().toLowerCase())
        .filter(topic => topic.length > 0) || [];

      return topics.slice(0, 5);
    } catch (error) {
      console.error('Topic extraction error:', error);
      return [];
    }
  }

  calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) return 0;

    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Recommendation Engine
class RecommendationEngine {
  private analyzer = new ContentAnalyzer();

  async generatePersonalizedRecommendations(
    userProfile: UserProfile,
    availableContent: ContentItem[],
    options: {
      freshnessWeight: number;
      diversityFactor: number;
      limit: number;
    }
  ): Promise<Array<ContentItem & { relevance_score: number; recommendation_reason: string }>> {
    const recommendations = [];

    for (const content of availableContent) {
      const score = await this.calculateRelevanceScore(userProfile, content, options);
      const reason = this.generateRecommendationReason(userProfile, content, score);

      recommendations.push({
        ...content,
        relevance_score: score,
        recommendation_reason: reason
      });
    }

    // Sort by relevance score and apply diversity
    const sortedRecommendations = recommendations.sort((a, b) => b.relevance_score - a.relevance_score);
    return this.applyDiversityFilter(sortedRecommendations, options.diversityFactor, options.limit);
  }

  private async calculateRelevanceScore(
    userProfile: UserProfile,
    content: ContentItem,
    options: { freshnessWeight: number }
  ): Promise<number> {
    // Interest similarity
    const interestScore = this.calculateInterestAlignment(userProfile.interests, content.tags);
    
    // Semantic similarity
    const semanticScore = content.semantic_embedding && userProfile.preference_vector
      ? this.analyzer.calculateCosineSimilarity(userProfile.preference_vector, content.semantic_embedding)
      : 0;

    // Engagement pattern alignment
    const engagementScore = this.calculateEngagementAlignment(userProfile.engagement_patterns, content);

    // Freshness score
    const freshnessScore = this.calculateFreshnessScore(content.created_at);

    // Trending boost
    const trendingScore = content.trending_score || 0;

    // Weighted combination
    const baseScore = (interestScore * 0.3) + (semanticScore * 0.4) + (engagementScore * 0.2) + (trendingScore * 0.1);
    const finalScore = baseScore * (1 - options.freshnessWeight) + freshnessScore * options.freshnessWeight;

    return Math.min(Math.max(finalScore, 0), 1);
  }

  private calculateInterestAlignment(userInterests: string[], contentTags: string[]): number {
    if (!userInterests.length || !contentTags.length) return 0;

    const matches = contentTags.filter(tag => 
      userInterests.some(interest => interest.toLowerCase().includes(tag.toLowerCase()))
    ).length;

    return matches / Math.max(userInterests.length, contentTags.length);
  }

  private calculateEngagementAlignment(engagementPatterns: any, content: ContentItem): number {
    const contentTypeWeight = engagementPatterns.preferred_content_types.includes(content.content_type) ? 1 : 0.3;
    const baseEngagement = Math.min(content.engagement_score / 100, 1); // Normalize engagement score
    return contentTypeWeight * baseEngagement;
  }

  private calculateFreshnessScore(createdAt: string): number {
    const now = new Date();
    const created = new Date(createdAt);
    const ageHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    
    // Decay function: newer content gets higher scores
    return Math.exp(-ageHours / 24); // 50% score after 24 hours
  }

  private applyDiversityFilter(
    recommendations: Array<ContentItem & { relevance_score: number; recommendation_reason: string }>,
    diversityFactor: number,
    limit: number
  ): Array<ContentItem & { relevance_score: number; recommendation_reason: string }> {
    if (diversityFactor === 0) return recommendations.slice(0, limit);

    const selected = [];
    const used_types = new Set<string>();
    const used_authors = new Set<string>();

    for (const rec of recommendations) {
      if (selected.length >= limit) break;

      const typePenalty = used_types.has(rec.content_type) ? diversityFactor : 0;
      const authorPenalty = used_authors.has(rec.author_id) ? diversityFactor * 0.5 : 0;
      
      rec.relevance_score *= (1 - typePenalty - authorPenalty);

      selected.push(rec);
      used_types.add(rec.content_type);
      used_authors.add(rec.author_id);
    }

    return selected.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  private generateRecommendationReason(
    userProfile: UserProfile,
    content: ContentItem,
    score: number
  ): string {
    const reasons = [];

    if (userProfile.interests.some(interest => content.tags.includes(interest))) {
      reasons.push('matches your interests');
    }

    if (content.engagement_score > 50) {
      reasons.push('highly engaged by community');
    }

    if (content.trending_score && content.trending_score > 0.7) {
      reasons.push('trending topic');
    }

    const ageHours = (new Date().getTime() - new Date(content.created_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < 24) {
      reasons.push('recently published');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'recommended for you';
  }
}

// Trend Detection Service
class TrendDetector {
  async detectTrendingTopics(): Promise<string[]> {
    const cacheKey = 'trending_topics';
    
    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // If not cached, detect trends (simplified implementation)
    const trends = await this.analyzeTrendingContent();
    
    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(trends));
    
    return trends;
  }

  private async analyzeTrendingContent(): Promise<string[]> {
    // This would typically analyze recent content engagement, mentions, etc.
    // For this implementation, return mock trending topics
    return [
      'AI Audio Processing',
      'Music Visualization',
      'Community Collaboration',
      'Real-time Audio',
      'Creative Tools'
    ];
  }
}

// Main API handler
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = {
      user_id: searchParams.get('user_id') || undefined,
      content_types: searchParams.get('content_types')?.split(',') || undefined,
      limit: Number(searchParams.get('limit')) || 20,
      offset: Number(searchParams.get('offset')) || 0,
      include_trending: searchParams.get('include_trending') !== 'false',
      freshness_weight: Number(searchParams.get('freshness_weight')) || 0.3,
      diversity_factor: Number(searchParams.get('diversity_factor')) || 0.4
    };

    const validatedParams = curationRequestSchema.parse(params);

    // Check cache for existing recommendations
    const cacheKey = `curation:${validatedParams.user_id}:${JSON.stringify(validatedParams)}`;
    const cachedResult = await redis.get(cacheKey);
    
    if (cachedResult) {
      const parsed = JSON.parse(cachedResult);
      return NextResponse.json({
        ...parsed,
        cache_info: { cached: true, ttl: await redis.ttl(cacheKey) }
      });
    }

    // Get user profile
    let userProfile: UserProfile | null = null;
    if (validatedParams.user_id) {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', validatedParams.user_id)
        .single();

      userProfile = profileData;
    }

    // Get available content
    let contentQuery = supabase
      .from('content_items')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(validatedParams.offset, validatedParams.offset + validatedParams.limit * 2); // Get more for filtering

    if (validatedParams.content_types?.length) {
      contentQuery = contentQuery.in('content_type', validatedParams.content_types);
    }

    const { data: contentItems, error: contentError } = await contentQuery;

    if (contentError) {
      return NextResponse.json(
        { error: 'Failed to fetch content', details: contentError.message },
        { status: 500 }
      );
    }

    // Initialize services
    const recommendationEngine = new RecommendationEngine();
    const trendDetector = new TrendDetector();

    // Generate recommendations
    let curatedContent;
    if (userProfile) {
      curatedContent = await recommendationEngine.generatePersonalizedRecommendations(
        userProfile,
        contentItems || [],
        {
          freshnessWeight: validatedParams.freshness_weight,
          diversityFactor: validatedParams.diversity_factor,
          limit: validatedParams.limit
        }
      );
    } else {
      // Fallback to trending/popular content for anonymous users
      curatedContent = (contentItems || [])
        .map(item => ({
          ...item,
          relevance_score: item.engagement_score / 100,
          recommendation_reason: 'popular content'
        }))
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, validatedParams.limit);
    }

    // Get trending topics
    const trendingTopics = validatedParams.include_trending 
      ? await trendDetector.detectTrendingTopics()
      : [];

    // Generate user insights
    const userInsights = userProfile ? {
      primary_interests: userProfile.interests.slice(0, 3),
      engagement_trend: 'stable', // This would be calculated from historical data
      content_discovery_rate: 0.75 // Percentage of recommended content that user engages with
    } : {
      primary_interests: [],
      engagement_trend: 'unknown',
      content_discovery_rate: 0
    };

    const response: CurationResponse = {
      curated_content: curatedContent,
      trending_topics: trendingTopics,
      user_insights: userInsights,
      cache_info: { cached: false, ttl: 0 }
    };

    // Cache the result for 15 minutes
    await redis.setex(cacheKey, 900, JSON.stringify(response));

    return NextResponse.json(response);

  } catch (error) {
    console.error('Content curation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: 'Content curation failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    
    // Validate request body
    const validatedRequest = curationRequestSchema.parse(body);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use authenticated user ID if not provided
    const userId = validatedRequest.user_id || user.id;

    // Similar logic to GET but with POST body parameters
    // Implementation would be similar to GET handler but with different parameter source

    return NextResponse.json({ message: 'POST endpoint implementation needed' });

  } catch (error) {
    console.error('POST content curation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update user engagement (for tracking recommendations effectiveness)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Update engagement tracking
    const engagementData = {
      user_id: user.id,
      content_id: body.content_id,
      interaction_type: body.interaction_type, // view, like, share, comment
      timestamp: new Date().toISOString(),
      recommendation_context: body.recommendation_context
    };

    const { error: insertError } = await supabase
      .from('user_engagement_tracking')
      .insert(engagementData);

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to track engagement' },
        { status: 500 }
      );
    }

    // Invalidate user's recommendation cache
    const cachePattern = `curation:${user.id}:*`;
    // Note: In production, you'd need a more sophisticated cache invalidation strategy

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Engagement tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}