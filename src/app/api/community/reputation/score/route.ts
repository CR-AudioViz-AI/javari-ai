```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

// Validation schemas
const scoreRequestSchema = z.object({
  userId: z.string().uuid(),
  timeframe: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  weightingConfig: z.object({
    contributionQuality: z.number().min(0).max(1).default(0.4),
    helpfulness: z.number().min(0).max(1).default(0.3),
    engagement: z.number().min(0).max(1).default(0.3)
  }).refine(config => 
    Math.abs((config.contributionQuality + config.helpfulness + config.engagement) - 1) < 0.001,
    { message: "Weights must sum to 1.0" }
  ).default({
    contributionQuality: 0.4,
    helpfulness: 0.3,
    engagement: 0.3
  }),
  includeHistory: z.boolean().default(false),
  detectBias: z.boolean().default(true)
});

const batchScoreRequestSchema = z.object({
  userIds: z.array(z.string().uuid()).max(100),
  timeframe: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  weightingConfig: scoreRequestSchema.shape.weightingConfig,
  detectBias: z.boolean().default(true)
});

// Types
interface ReputationMetrics {
  contributionQuality: number;
  helpfulness: number;
  engagement: number;
  totalContributions: number;
  qualityScore: number;
  helpfulnessRatio: number;
  engagementLevel: number;
}

interface BiasDetectionResult {
  hasBias: boolean;
  biasType?: 'temporal' | 'volume' | 'gaming' | 'anomalous';
  confidence: number;
  details?: string;
}

interface ReputationScore {
  userId: string;
  overallScore: number;
  dimensionScores: {
    contributionQuality: number;
    helpfulness: number;
    engagement: number;
  };
  rawMetrics: ReputationMetrics;
  biasDetection?: BiasDetectionResult;
  calculatedAt: string;
  timeframe: string;
  rank?: number;
}

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
  retryDelayOnFailure: 100,
  maxRetriesPerRequest: 3,
});

class ReputationMetricsCollector {
  private timeframeDays: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
    'all': 9999
  };

  async collectMetrics(userId: string, timeframe: string): Promise<ReputationMetrics> {
    const days = this.timeframeDays[timeframe];
    const cutoffDate = days === 9999 ? '1900-01-01' : 
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Collect contribution metrics
    const { data: contributions } = await supabase
      .from('contribution_metrics')
      .select(`
        quality_score,
        helpfulness_votes,
        total_votes,
        engagement_score,
        created_at
      `)
      .eq('user_id', userId)
      .gte('created_at', cutoffDate);

    if (!contributions?.length) {
      return {
        contributionQuality: 0,
        helpfulness: 0,
        engagement: 0,
        totalContributions: 0,
        qualityScore: 0,
        helpfulnessRatio: 0,
        engagementLevel: 0
      };
    }

    // Calculate metrics
    const totalContributions = contributions.length;
    const avgQualityScore = contributions.reduce((sum, c) => sum + (c.quality_score || 0), 0) / totalContributions;
    
    const totalVotes = contributions.reduce((sum, c) => sum + (c.total_votes || 0), 0);
    const helpfulVotes = contributions.reduce((sum, c) => sum + (c.helpfulness_votes || 0), 0);
    const helpfulnessRatio = totalVotes > 0 ? helpfulVotes / totalVotes : 0;
    
    const avgEngagement = contributions.reduce((sum, c) => sum + (c.engagement_score || 0), 0) / totalContributions;

    return {
      contributionQuality: Math.min(avgQualityScore / 10, 1), // Normalize to 0-1
      helpfulness: helpfulnessRatio,
      engagement: Math.min(avgEngagement / 100, 1), // Normalize to 0-1
      totalContributions,
      qualityScore: avgQualityScore,
      helpfulnessRatio,
      engagementLevel: avgEngagement
    };
  }
}

class BiasDetectionEngine {
  async detectBias(userId: string, metrics: ReputationMetrics, timeframe: string): Promise<BiasDetectionResult> {
    // Check for temporal bias (activity clustering)
    const temporalBias = await this.detectTemporalBias(userId, timeframe);
    if (temporalBias.hasBias) return temporalBias;

    // Check for volume gaming (suspicious activity patterns)
    const volumeBias = this.detectVolumeBias(metrics);
    if (volumeBias.hasBias) return volumeBias;

    // Check for anomalous patterns
    const anomalyBias = await this.detectAnomalies(userId, metrics);
    if (anomalyBias.hasBias) return anomalyBias;

    return { hasBias: false, confidence: 0.95 };
  }

  private async detectTemporalBias(userId: string, timeframe: string): Promise<BiasDetectionResult> {
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: contributions } = await supabase
      .from('contribution_metrics')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', cutoffDate)
      .order('created_at', { ascending: true });

    if (!contributions?.length || contributions.length < 10) {
      return { hasBias: false, confidence: 0.8 };
    }

    // Check for clustering (more than 50% of contributions in 20% of timeframe)
    const timeSpan = Date.now() - new Date(contributions[0].created_at).getTime();
    const clusterThreshold = timeSpan * 0.2;
    
    let clusteredCount = 0;
    const firstContribTime = new Date(contributions[0].created_at).getTime();
    
    for (const contrib of contributions) {
      if (new Date(contrib.created_at).getTime() - firstContribTime < clusterThreshold) {
        clusteredCount++;
      }
    }

    const clusterRatio = clusteredCount / contributions.length;
    if (clusterRatio > 0.5) {
      return {
        hasBias: true,
        biasType: 'temporal',
        confidence: Math.min(clusterRatio, 0.95),
        details: `${Math.round(clusterRatio * 100)}% of contributions clustered in short timespan`
      };
    }

    return { hasBias: false, confidence: 0.9 };
  }

  private detectVolumeBias(metrics: ReputationMetrics): BiasDetectionResult {
    // Detect suspiciously high volume with low quality
    if (metrics.totalContributions > 100 && metrics.qualityScore < 3) {
      return {
        hasBias: true,
        biasType: 'volume',
        confidence: 0.85,
        details: `High volume (${metrics.totalContributions}) with low quality (${metrics.qualityScore.toFixed(2)})`
      };
    }

    // Detect gaming patterns (perfect scores with high volume)
    if (metrics.totalContributions > 50 && metrics.contributionQuality > 0.95 && metrics.helpfulness > 0.95) {
      return {
        hasBias: true,
        biasType: 'gaming',
        confidence: 0.8,
        details: 'Suspiciously perfect scores with high volume'
      };
    }

    return { hasBias: false, confidence: 0.9 };
  }

  private async detectAnomalies(userId: string, metrics: ReputationMetrics): Promise<BiasDetectionResult> {
    // Get community averages for comparison
    const { data: communityStats } = await supabase
      .from('user_reputation_scores')
      .select('overall_score, contribution_quality_score, helpfulness_score, engagement_score')
      .neq('user_id', userId)
      .limit(1000);

    if (!communityStats?.length) {
      return { hasBias: false, confidence: 0.7 };
    }

    const avgQuality = communityStats.reduce((sum, s) => sum + (s.contribution_quality_score || 0), 0) / communityStats.length;
    const avgHelpfulness = communityStats.reduce((sum, s) => sum + (s.helpfulness_score || 0), 0) / communityStats.length;
    const avgEngagement = communityStats.reduce((sum, s) => sum + (s.engagement_score || 0), 0) / communityStats.length;

    // Check for extreme deviations (>3 standard deviations)
    const qualityDeviation = Math.abs(metrics.contributionQuality - avgQuality);
    const helpfulnessDeviation = Math.abs(metrics.helpfulness - avgHelpfulness);
    const engagementDeviation = Math.abs(metrics.engagement - avgEngagement);

    const maxDeviation = Math.max(qualityDeviation, helpfulnessDeviation, engagementDeviation);
    
    if (maxDeviation > 0.3 && metrics.totalContributions > 20) {
      return {
        hasBias: true,
        biasType: 'anomalous',
        confidence: Math.min(maxDeviation * 2, 0.95),
        details: `Extreme deviation from community averages (${maxDeviation.toFixed(3)})`
      };
    }

    return { hasBias: false, confidence: 0.85 };
  }
}

class WeightedScoreAggregator {
  calculateWeightedScore(metrics: ReputationMetrics, weights: { contributionQuality: number; helpfulness: number; engagement: number }): number {
    const normalizedMetrics = this.normalizeMetrics(metrics);
    
    return (
      normalizedMetrics.contributionQuality * weights.contributionQuality +
      normalizedMetrics.helpfulness * weights.helpfulness +
      normalizedMetrics.engagement * weights.engagement
    ) * 100; // Scale to 0-100
  }

  private normalizeMetrics(metrics: ReputationMetrics) {
    return {
      contributionQuality: Math.min(Math.max(metrics.contributionQuality, 0), 1),
      helpfulness: Math.min(Math.max(metrics.helpfulness, 0), 1),
      engagement: Math.min(Math.max(metrics.engagement, 0), 1)
    };
  }
}

class ScoreValidationService {
  validateScore(score: ReputationScore): boolean {
    // Check score bounds
    if (score.overallScore < 0 || score.overallScore > 100) return false;
    
    // Check dimension scores
    const { dimensionScores } = score;
    if (dimensionScores.contributionQuality < 0 || dimensionScores.contributionQuality > 100) return false;
    if (dimensionScores.helpfulness < 0 || dimensionScores.helpfulness > 100) return false;
    if (dimensionScores.engagement < 0 || dimensionScores.engagement > 100) return false;
    
    // Check for NaN values
    if (isNaN(score.overallScore) || 
        isNaN(dimensionScores.contributionQuality) ||
        isNaN(dimensionScores.helpfulness) ||
        isNaN(dimensionScores.engagement)) {
      return false;
    }

    return true;
  }

  sanitizeScore(score: ReputationScore): ReputationScore {
    return {
      ...score,
      overallScore: Math.min(Math.max(score.overallScore || 0, 0), 100),
      dimensionScores: {
        contributionQuality: Math.min(Math.max(score.dimensionScores.contributionQuality || 0, 0), 100),
        helpfulness: Math.min(Math.max(score.dimensionScores.helpfulness || 0, 0), 100),
        engagement: Math.min(Math.max(score.dimensionScores.engagement || 0, 0), 100)
      }
    };
  }
}

class ReputationCalculator {
  private metricsCollector = new ReputationMetricsCollector();
  private biasDetector = new BiasDetectionEngine();
  private scoreAggregator = new WeightedScoreAggregator();
  private validator = new ScoreValidationService();

  async calculateScore(
    userId: string, 
    timeframe: string, 
    weights: { contributionQuality: number; helpfulness: number; engagement: number },
    detectBias: boolean = true
  ): Promise<ReputationScore> {
    // Collect raw metrics
    const metrics = await this.metricsCollector.collectMetrics(userId, timeframe);
    
    // Calculate weighted score
    const overallScore = this.scoreAggregator.calculateWeightedScore(metrics, weights);
    
    // Calculate dimension scores (scaled to 0-100)
    const dimensionScores = {
      contributionQuality: metrics.contributionQuality * 100,
      helpfulness: metrics.helpfulness * 100,
      engagement: metrics.engagement * 100
    };

    // Detect bias if requested
    let biasDetection: BiasDetectionResult | undefined;
    if (detectBias) {
      biasDetection = await this.biasDetector.detectBias(userId, metrics, timeframe);
    }

    const score: ReputationScore = {
      userId,
      overallScore,
      dimensionScores,
      rawMetrics: metrics,
      biasDetection,
      calculatedAt: new Date().toISOString(),
      timeframe
    };

    // Validate and sanitize
    const sanitizedScore = this.validator.sanitizeScore(score);
    if (!this.validator.validateScore(sanitizedScore)) {
      throw new Error('Invalid reputation score calculated');
    }

    return sanitizedScore;
  }

  async calculateBatchScores(
    userIds: string[],
    timeframe: string,
    weights: { contributionQuality: number; helpfulness: number; engagement: number },
    detectBias: boolean = true
  ): Promise<ReputationScore[]> {
    const scores = await Promise.allSettled(
      userIds.map(userId => this.calculateScore(userId, timeframe, weights, detectBias))
    );

    return scores
      .filter((result): result is PromiseFulfilledResult<ReputationScore> => result.status === 'fulfilled')
      .map(result => result.value);
  }
}

async function saveScore(score: ReputationScore): Promise<void> {
  const { error } = await supabase
    .from('user_reputation_scores')
    .upsert({
      user_id: score.userId,
      overall_score: score.overallScore,
      contribution_quality_score: score.dimensionScores.contributionQuality,
      helpfulness_score: score.dimensionScores.helpfulness,
      engagement_score: score.dimensionScores.engagement,
      timeframe: score.timeframe,
      calculated_at: score.calculatedAt,
      bias_detected: score.biasDetection?.hasBias || false,
      bias_type: score.biasDetection?.biasType,
      bias_confidence: score.biasDetection?.confidence,
      total_contributions: score.rawMetrics.totalContributions,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

async function updateCache(scores: ReputationScore[], timeframe: string): Promise<void> {
  const pipeline = redis.pipeline();
  
  for (const score of scores) {
    const cacheKey = `reputation:${score.userId}:${timeframe}`;
    pipeline.setex(cacheKey, 3600, JSON.stringify(score)); // Cache for 1 hour
    
    // Update leaderboard
    pipeline.zadd(
      `leaderboard:${timeframe}`, 
      score.overallScore, 
      score.userId
    );
  }
  
  await pipeline.exec();
}

// API Routes
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip || 'anonymous';
    const rateLimitResult = await rateLimit(identifier, 20, 60000); // 20 requests per minute
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Check if it's a batch request
    const isBatch = Array.isArray(body.userIds);
    
    if (isBatch) {
      const validation = batchScoreRequestSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { userIds, timeframe, weightingConfig, detectBias } = validation.data;
      const calculator = new ReputationCalculator();
      
      const scores = await calculator.calculateBatchScores(
        userIds,
        timeframe,
        weightingConfig,
        detectBias
      );

      // Save scores and update cache
      await Promise.all([
        Promise.allSettled(scores.map(score => saveScore(score))),
        updateCache(scores, timeframe)
      ]);

      return NextResponse.json({
        success: true,
        data: {
          scores,
          processedCount: scores.length,
          requestedCount: userIds.length,
          timeframe
        }
      });

    } else {
      const validation = scoreRequestSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { userId, timeframe, weightingConfig, includeHistory, detectBias } = validation.data;
      
      // Check cache first
      const cacheKey = `reputation:${userId}:${timeframe}`;
      const cached = await redis.get(cacheKey);
      if (cached && !includeHistory) {
        return NextResponse.json({
          success: true,
          data: JSON.parse(cached),
          source: 'cache'
        });
      }

      const calculator = new ReputationCalculator();
      const score = await calculator.calculateScore(userId, timeframe, weightingConfig, detectBias);
      
      // Get historical data if requested
      let history: ReputationScore[] = [];
      if (includeHistory) {
        const { data: historicalScores } = await supabase
          .from('user_reputation_scores')
          .select('*')
          .eq('user_id', userId)
          .eq('timeframe', timeframe)
          .order('calculated_at', { ascending: false })
          .limit(30);

        history = historicalScores?.map(record => ({
          userId: record.user_id,
          overallScore: record.overall_score,
          dimensionScores: {
            contributionQuality: record.contribution_quality_score,
            helpfulness: record.helpfulness_score,
            engagement: record.engagement_score
          },
          rawMetrics: {
            contributionQuality: record.contribution_quality_score / 100,
            helpfulness: record.helpfulness_score / 100,
            engagement: record.engagement_score / 100,
            totalContributions: record.total_contributions,
            qualityScore: 0,
            helpfulnessRatio: 0,
            engagementLevel: 0
          },
          calculatedAt: record.calculated_at,
          timeframe: record.timeframe,
          biasDetection: record.bias_detected ? {
            hasBias: true,
            biasType: record.bias_type as any,
            confidence: record.bias_confidence
          } : undefined
        })) || [];
      }

      // Save score and update cache
      await Promise.all([
        saveScore(score),
        updateCache([score], timeframe)
      ]);

      return NextResponse.json({
        success: true,
        data: {
          current: score,
          history: includeHistory ? history : undefined
        },
        source: 'calculated'
      });
    }

  } catch (error) {
    console.error('Reputation scoring error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to calculate reputation score' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const timeframe = searchParams.get('timeframe') || '30d';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `reputation:${userId}:${timeframe}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        success: true,
        data: JSON.parse(cached),
        source: 'cache'