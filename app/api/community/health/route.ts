```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

// Validation schemas
const healthQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d', '90d']).default('24h'),
  metrics: z.array(z.enum(['engagement', 'sentiment', 'warnings', 'trends'])).default(['engagement']),
  granularity: z.enum(['hour', 'day', 'week']).default('hour'),
  threshold: z.number().min(0).max(1).default(0.7),
});

const alertConfigSchema = z.object({
  metric: z.enum(['engagement_drop', 'negative_sentiment', 'spam_detection', 'user_exodus']),
  threshold: z.number(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean(),
  notification_channels: z.array(z.enum(['email', 'sms', 'webhook'])),
});

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Types
interface EngagementMetrics {
  total_interactions: number;
  unique_users: number;
  posts_created: number;
  comments_count: number;
  reactions_count: number;
  engagement_rate: number;
  active_user_ratio: number;
}

interface SentimentData {
  positive_ratio: number;
  negative_ratio: number;
  neutral_ratio: number;
  average_sentiment: number;
  sentiment_trend: number;
  toxic_content_ratio: number;
}

interface WarningSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_users: number;
  confidence: number;
  timestamp: string;
}

interface HealthMetrics {
  overall_score: number;
  engagement: EngagementMetrics;
  sentiment: SentimentData;
  warnings: WarningSignal[];
  trends: Record<string, number>;
  last_updated: string;
}

class CommunityHealthService {
  private async getEngagementMetrics(timeframe: string): Promise<EngagementMetrics> {
    const timeframeHours = this.parseTimeframe(timeframe);
    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

    const [interactions, users, posts, comments, reactions] = await Promise.all([
      // Total interactions
      supabase
        .from('user_interactions')
        .select('*', { count: 'exact' })
        .gte('created_at', cutoffTime),
      
      // Unique active users
      supabase
        .from('user_interactions')
        .select('user_id', { count: 'exact' })
        .gte('created_at', cutoffTime)
        .distinct(),
      
      // Posts created
      supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .gte('created_at', cutoffTime),
      
      // Comments
      supabase
        .from('comments')
        .select('*', { count: 'exact' })
        .gte('created_at', cutoffTime),
      
      // Reactions
      supabase
        .from('reactions')
        .select('*', { count: 'exact' })
        .gte('created_at', cutoffTime)
    ]);

    const totalUsers = await supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    const totalInteractions = (interactions.count || 0);
    const uniqueUsers = (users.count || 0);
    const totalUsersCount = (totalUsers.count || 1);

    return {
      total_interactions: totalInteractions,
      unique_users: uniqueUsers,
      posts_created: posts.count || 0,
      comments_count: comments.count || 0,
      reactions_count: reactions.count || 0,
      engagement_rate: totalInteractions / Math.max(uniqueUsers, 1),
      active_user_ratio: uniqueUsers / totalUsersCount,
    };
  }

  private async getSentimentAnalysis(timeframe: string): Promise<SentimentData> {
    const timeframeHours = this.parseTimeframe(timeframe);
    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

    // Get posts and comments for sentiment analysis
    const { data: content } = await supabase
      .from('posts')
      .select('content, sentiment_score')
      .gte('created_at', cutoffTime)
      .not('sentiment_score', 'is', null);

    const { data: commentContent } = await supabase
      .from('comments')
      .select('content, sentiment_score')
      .gte('created_at', cutoffTime)
      .not('sentiment_score', 'is', null);

    const allContent = [...(content || []), ...(commentContent || [])];
    
    if (allContent.length === 0) {
      return {
        positive_ratio: 0.33,
        negative_ratio: 0.33,
        neutral_ratio: 0.34,
        average_sentiment: 0,
        sentiment_trend: 0,
        toxic_content_ratio: 0,
      };
    }

    const sentimentScores = allContent.map(item => item.sentiment_score);
    const positive = sentimentScores.filter(score => score > 0.1).length;
    const negative = sentimentScores.filter(score => score < -0.1).length;
    const neutral = sentimentScores.filter(score => score >= -0.1 && score <= 0.1).length;
    const toxic = sentimentScores.filter(score => score < -0.7).length;

    const avgSentiment = sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length;

    // Calculate trend by comparing with previous period
    const previousCutoff = new Date(Date.now() - timeframeHours * 2 * 60 * 60 * 1000).toISOString();
    const { data: previousContent } = await supabase
      .from('posts')
      .select('sentiment_score')
      .gte('created_at', previousCutoff)
      .lt('created_at', cutoffTime)
      .not('sentiment_score', 'is', null);

    const previousAvg = previousContent?.length 
      ? previousContent.reduce((sum, item) => sum + item.sentiment_score, 0) / previousContent.length
      : avgSentiment;

    return {
      positive_ratio: positive / allContent.length,
      negative_ratio: negative / allContent.length,
      neutral_ratio: neutral / allContent.length,
      average_sentiment: avgSentiment,
      sentiment_trend: avgSentiment - previousAvg,
      toxic_content_ratio: toxic / allContent.length,
    };
  }

  private async detectWarnings(engagement: EngagementMetrics, sentiment: SentimentData): Promise<WarningSignal[]> {
    const warnings: WarningSignal[] = [];
    const now = new Date().toISOString();

    // Engagement drop warning
    if (engagement.engagement_rate < 0.1) {
      warnings.push({
        type: 'engagement_drop',
        severity: engagement.engagement_rate < 0.05 ? 'critical' : 'high',
        description: 'Significant drop in community engagement detected',
        affected_users: engagement.unique_users,
        confidence: 0.85,
        timestamp: now,
      });
    }

    // Negative sentiment warning
    if (sentiment.negative_ratio > 0.6) {
      warnings.push({
        type: 'negative_sentiment',
        severity: sentiment.negative_ratio > 0.8 ? 'critical' : 'high',
        description: 'High levels of negative sentiment in community',
        affected_users: Math.floor(engagement.unique_users * sentiment.negative_ratio),
        confidence: 0.78,
        timestamp: now,
      });
    }

    // Toxic content warning
    if (sentiment.toxic_content_ratio > 0.15) {
      warnings.push({
        type: 'toxic_content',
        severity: 'high',
        description: 'Increased toxic content detected in community',
        affected_users: Math.floor(engagement.unique_users * 0.3),
        confidence: 0.72,
        timestamp: now,
      });
    }

    // User activity drop
    if (engagement.active_user_ratio < 0.05) {
      warnings.push({
        type: 'user_exodus',
        severity: 'critical',
        description: 'Significant decrease in active user participation',
        affected_users: engagement.unique_users,
        confidence: 0.90,
        timestamp: now,
      });
    }

    return warnings;
  }

  private async calculateTrends(timeframe: string): Promise<Record<string, number>> {
    const timeframeHours = this.parseTimeframe(timeframe);
    const intervals = Math.min(24, timeframeHours); // Max 24 data points
    const intervalSize = timeframeHours / intervals;

    const trends: Record<string, number> = {};
    const dataPoints: { engagement: number[]; sentiment: number[] } = {
      engagement: [],
      sentiment: [],
    };

    // Collect data points for trend analysis
    for (let i = 0; i < intervals; i++) {
      const endTime = new Date(Date.now() - i * intervalSize * 60 * 60 * 1000);
      const startTime = new Date(endTime.getTime() - intervalSize * 60 * 60 * 1000);

      const [interactions, content] = await Promise.all([
        supabase
          .from('user_interactions')
          .select('*', { count: 'exact' })
          .gte('created_at', startTime.toISOString())
          .lt('created_at', endTime.toISOString()),
        
        supabase
          .from('posts')
          .select('sentiment_score')
          .gte('created_at', startTime.toISOString())
          .lt('created_at', endTime.toISOString())
          .not('sentiment_score', 'is', null)
      ]);

      dataPoints.engagement.push(interactions.count || 0);
      const avgSentiment = content.data?.length 
        ? content.data.reduce((sum, item) => sum + item.sentiment_score, 0) / content.data.length
        : 0;
      dataPoints.sentiment.push(avgSentiment);
    }

    // Calculate trend slopes
    trends.engagement_trend = this.calculateSlope(dataPoints.engagement);
    trends.sentiment_trend = this.calculateSlope(dataPoints.sentiment);

    return trends;
  }

  private calculateSlope(data: number[]): number {
    if (data.length < 2) return 0;
    
    const n = data.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, val) => sum + val, 0);
    const sumXY = data.reduce((sum, val, index) => sum + index * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateOverallScore(engagement: EngagementMetrics, sentiment: SentimentData, warnings: WarningSignal[]): number {
    let score = 100;

    // Engagement impact (30% weight)
    const engagementScore = Math.min(engagement.engagement_rate * 10, 10) * 3;
    
    // Sentiment impact (40% weight)
    const sentimentScore = ((sentiment.average_sentiment + 1) / 2) * 40;
    
    // Warning penalties (30% weight)
    const warningPenalty = warnings.reduce((penalty, warning) => {
      const severityPenalty = {
        low: 2,
        medium: 5,
        high: 10,
        critical: 20
      };
      return penalty + severityPenalty[warning.severity];
    }, 0);

    score = engagementScore + sentimentScore - warningPenalty;
    return Math.max(0, Math.min(100, score));
  }

  private parseTimeframe(timeframe: string): number {
    const timeframes: Record<string, number> = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
      '30d': 720,
      '90d': 2160,
    };
    return timeframes[timeframe] || 24;
  }

  async getHealthMetrics(timeframe: string, requestedMetrics: string[]): Promise<HealthMetrics> {
    const cacheKey = `health:${timeframe}:${requestedMetrics.join(',')}`;
    
    // Try to get from cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached as HealthMetrics;
    }

    // Calculate metrics
    const [engagement, sentiment] = await Promise.all([
      requestedMetrics.includes('engagement') ? this.getEngagementMetrics(timeframe) : {} as EngagementMetrics,
      requestedMetrics.includes('sentiment') ? this.getSentimentAnalysis(timeframe) : {} as SentimentData,
    ]);

    const warnings = requestedMetrics.includes('warnings') 
      ? await this.detectWarnings(engagement, sentiment)
      : [];

    const trends = requestedMetrics.includes('trends')
      ? await this.calculateTrends(timeframe)
      : {};

    const healthMetrics: HealthMetrics = {
      overall_score: this.calculateOverallScore(engagement, sentiment, warnings),
      engagement,
      sentiment,
      warnings,
      trends,
      last_updated: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(healthMetrics));

    return healthMetrics;
  }

  async configureAlert(config: z.infer<typeof alertConfigSchema>): Promise<void> {
    const { data, error } = await supabase
      .from('alert_configurations')
      .upsert({
        metric: config.metric,
        threshold: config.threshold,
        severity: config.severity,
        enabled: config.enabled,
        notification_channels: config.notification_channels,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  }
}

const healthService = new CommunityHealthService();

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await rateLimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      timeframe: searchParams.get('timeframe') || '24h',
      metrics: searchParams.get('metrics')?.split(',') || ['engagement'],
      granularity: searchParams.get('granularity') || 'hour',
      threshold: parseFloat(searchParams.get('threshold') || '0.7'),
    };

    const validatedQuery = healthQuerySchema.parse(queryParams);

    // Get health metrics
    const healthMetrics = await healthService.getHealthMetrics(
      validatedQuery.timeframe,
      validatedQuery.metrics
    );

    return NextResponse.json({
      success: true,
      data: healthMetrics,
      metadata: {
        timeframe: validatedQuery.timeframe,
        metrics: validatedQuery.metrics,
        cached: true,
      },
    });

  } catch (error) {
    console.error('Community health API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await rateLimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Validate alert configuration
    const validatedConfig = alertConfigSchema.parse(body);

    // Configure alert
    await healthService.configureAlert(validatedConfig);

    // Clear related cache
    const cachePattern = 'health:*';
    // Note: In a real implementation, you'd use a more sophisticated cache invalidation
    
    return NextResponse.json({
      success: true,
      message: 'Alert configuration updated successfully',
      data: validatedConfig,
    });

  } catch (error) {
    console.error('Alert configuration error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid alert configuration',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```