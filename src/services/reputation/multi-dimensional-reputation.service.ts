import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

/**
 * Reputation dimensions with their respective weight multipliers
 */
export enum ReputationDimension {
  HELPFULNESS = 'helpfulness',
  EXPERTISE = 'expertise',
  COMMUNITY_ENGAGEMENT = 'community_engagement',
  CONTENT_QUALITY = 'content_quality',
  MENTORSHIP = 'mentorship',
  INNOVATION = 'innovation'
}

/**
 * Types of events that can affect reputation
 */
export enum ReputationEventType {
  // Helpfulness events
  ANSWER_UPVOTED = 'answer_upvoted',
  ANSWER_ACCEPTED = 'answer_accepted',
  HELPFUL_COMMENT = 'helpful_comment',
  
  // Expertise events
  TECHNICAL_CONTRIBUTION = 'technical_contribution',
  CODE_REVIEW_APPROVED = 'code_review_approved',
  KNOWLEDGE_SHARED = 'knowledge_shared',
  
  // Community engagement events
  DISCUSSION_STARTED = 'discussion_started',
  ACTIVE_PARTICIPATION = 'active_participation',
  NEWCOMER_WELCOMED = 'newcomer_welcomed',
  
  // Quality events
  HIGH_QUALITY_POST = 'high_quality_post',
  CONTENT_CURATED = 'content_curated',
  
  // Mentorship events
  MENTORING_SESSION = 'mentoring_session',
  STUDENT_SUCCESS = 'student_success',
  
  // Innovation events
  CREATIVE_SOLUTION = 'creative_solution',
  FEATURE_SUGGESTED = 'feature_suggested'
}

/**
 * Configuration for reputation calculation
 */
export interface ReputationConfig {
  /** Base decay rate per day (0-1) */
  dailyDecayRate: number;
  /** Maximum reputation score per dimension */
  maxDimensionScore: number;
  /** Minimum reputation score per dimension */
  minDimensionScore: number;
  /** Weight multipliers for each dimension */
  dimensionWeights: Record<ReputationDimension, number>;
  /** Event score mappings */
  eventScores: Record<ReputationEventType, ReputationEventScore>;
}

/**
 * Score configuration for reputation events
 */
export interface ReputationEventScore {
  /** Primary dimension affected */
  primaryDimension: ReputationDimension;
  /** Base score value */
  baseScore: number;
  /** Secondary dimensions affected (with multipliers) */
  secondaryDimensions?: Record<ReputationDimension, number>;
  /** Maximum occurrences per day for this event type */
  dailyLimit?: number;
}

/**
 * Reputation metrics for all dimensions
 */
export interface ReputationMetrics {
  userId: string;
  helpfulness: number;
  expertise: number;
  communityEngagement: number;
  contentQuality: number;
  mentorship: number;
  innovation: number;
  overallScore: number;
  lastUpdated: Date;
  rank?: number;
}

/**
 * Individual reputation event record
 */
export interface ReputationEvent {
  id: string;
  userId: string;
  eventType: ReputationEventType;
  primaryDimension: ReputationDimension;
  scoreChange: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  processed: boolean;
}

/**
 * Historical reputation data point
 */
export interface ReputationHistoryEntry {
  userId: string;
  timestamp: Date;
  dimensionScores: Record<ReputationDimension, number>;
  overallScore: number;
  rankPosition?: number;
}

/**
 * Reputation trend analysis
 */
export interface ReputationTrend {
  userId: string;
  dimension: ReputationDimension;
  timeframe: 'daily' | 'weekly' | 'monthly';
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  dataPoints: Array<{ timestamp: Date; score: number }>;
}

/**
 * Reputation-based privilege levels
 */
export enum PrivilegeLevel {
  NEWCOMER = 0,
  CONTRIBUTOR = 100,
  TRUSTED = 500,
  EXPERT = 1000,
  MODERATOR = 2500,
  LEADER = 5000
}

/**
 * Default reputation configuration
 */
const DEFAULT_CONFIG: ReputationConfig = {
  dailyDecayRate: 0.001,
  maxDimensionScore: 10000,
  minDimensionScore: 0,
  dimensionWeights: {
    [ReputationDimension.HELPFULNESS]: 1.2,
    [ReputationDimension.EXPERTISE]: 1.5,
    [ReputationDimension.COMMUNITY_ENGAGEMENT]: 1.0,
    [ReputationDimension.CONTENT_QUALITY]: 1.3,
    [ReputationDimension.MENTORSHIP]: 1.4,
    [ReputationDimension.INNOVATION]: 1.6
  },
  eventScores: {
    [ReputationEventType.ANSWER_UPVOTED]: {
      primaryDimension: ReputationDimension.HELPFULNESS,
      baseScore: 10,
      secondaryDimensions: { [ReputationDimension.CONTENT_QUALITY]: 0.3 },
      dailyLimit: 50
    },
    [ReputationEventType.ANSWER_ACCEPTED]: {
      primaryDimension: ReputationDimension.HELPFULNESS,
      baseScore: 25,
      secondaryDimensions: { 
        [ReputationDimension.EXPERTISE]: 0.4,
        [ReputationDimension.CONTENT_QUALITY]: 0.2
      }
    },
    [ReputationEventType.TECHNICAL_CONTRIBUTION]: {
      primaryDimension: ReputationDimension.EXPERTISE,
      baseScore: 20,
      secondaryDimensions: { [ReputationDimension.INNOVATION]: 0.3 }
    },
    [ReputationEventType.DISCUSSION_STARTED]: {
      primaryDimension: ReputationDimension.COMMUNITY_ENGAGEMENT,
      baseScore: 5,
      dailyLimit: 10
    },
    [ReputationEventType.HIGH_QUALITY_POST]: {
      primaryDimension: ReputationDimension.CONTENT_QUALITY,
      baseScore: 15,
      secondaryDimensions: { [ReputationDimension.HELPFULNESS]: 0.2 }
    },
    [ReputationEventType.MENTORING_SESSION]: {
      primaryDimension: ReputationDimension.MENTORSHIP,
      baseScore: 30,
      secondaryDimensions: { [ReputationDimension.COMMUNITY_ENGAGEMENT]: 0.3 }
    },
    [ReputationEventType.CREATIVE_SOLUTION]: {
      primaryDimension: ReputationDimension.INNOVATION,
      baseScore: 35,
      secondaryDimensions: { 
        [ReputationDimension.EXPERTISE]: 0.4,
        [ReputationDimension.CONTENT_QUALITY]: 0.2
      }
    },
    [ReputationEventType.HELPFUL_COMMENT]: {
      primaryDimension: ReputationDimension.HELPFULNESS,
      baseScore: 3,
      dailyLimit: 100
    },
    [ReputationEventType.CODE_REVIEW_APPROVED]: {
      primaryDimension: ReputationDimension.EXPERTISE,
      baseScore: 8,
      dailyLimit: 20
    },
    [ReputationEventType.ACTIVE_PARTICIPATION]: {
      primaryDimension: ReputationDimension.COMMUNITY_ENGAGEMENT,
      baseScore: 2,
      dailyLimit: 200
    },
    [ReputationEventType.KNOWLEDGE_SHARED]: {
      primaryDimension: ReputationDimension.EXPERTISE,
      baseScore: 12,
      secondaryDimensions: { [ReputationDimension.HELPFULNESS]: 0.3 }
    },
    [ReputationEventType.NEWCOMER_WELCOMED]: {
      primaryDimension: ReputationDimension.COMMUNITY_ENGAGEMENT,
      baseScore: 8,
      secondaryDimensions: { [ReputationDimension.MENTORSHIP]: 0.5 }
    },
    [ReputationEventType.CONTENT_CURATED]: {
      primaryDimension: ReputationDimension.CONTENT_QUALITY,
      baseScore: 10,
      dailyLimit: 30
    },
    [ReputationEventType.STUDENT_SUCCESS]: {
      primaryDimension: ReputationDimension.MENTORSHIP,
      baseScore: 50,
      secondaryDimensions: { [ReputationDimension.HELPFULNESS]: 0.4 }
    },
    [ReputationEventType.FEATURE_SUGGESTED]: {
      primaryDimension: ReputationDimension.INNOVATION,
      baseScore: 15,
      secondaryDimensions: { [ReputationDimension.COMMUNITY_ENGAGEMENT]: 0.2 }
    }
  }
};

/**
 * Manages time-based reputation decay mechanisms
 */
class DecayManager {
  constructor(private config: ReputationConfig) {}

  /**
   * Calculate decay factor based on time elapsed
   */
  calculateDecayFactor(lastUpdate: Date, currentTime: Date = new Date()): number {
    const daysElapsed = (currentTime.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.pow(1 - this.config.dailyDecayRate, daysElapsed);
  }

  /**
   * Apply decay to reputation scores
   */
  applyDecay(metrics: ReputationMetrics, currentTime: Date = new Date()): ReputationMetrics {
    const decayFactor = this.calculateDecayFactor(metrics.lastUpdated, currentTime);
    
    const decayedMetrics: ReputationMetrics = {
      ...metrics,
      helpfulness: Math.max(this.config.minDimensionScore, metrics.helpfulness * decayFactor),
      expertise: Math.max(this.config.minDimensionScore, metrics.expertise * decayFactor),
      communityEngagement: Math.max(this.config.minDimensionScore, metrics.communityEngagement * decayFactor),
      contentQuality: Math.max(this.config.minDimensionScore, metrics.contentQuality * decayFactor),
      mentorship: Math.max(this.config.minDimensionScore, metrics.mentorship * decayFactor),
      innovation: Math.max(this.config.minDimensionScore, metrics.innovation * decayFactor),
      overallScore: 0,
      lastUpdated: currentTime
    };

    // Recalculate overall score
    decayedMetrics.overallScore = this.calculateOverallScore(decayedMetrics);
    
    return decayedMetrics;
  }

  private calculateOverallScore(metrics: ReputationMetrics): number {
    const weights = this.config.dimensionWeights;
    return Math.round(
      (metrics.helpfulness * weights[ReputationDimension.HELPFULNESS] +
       metrics.expertise * weights[ReputationDimension.EXPERTISE] +
       metrics.communityEngagement * weights[ReputationDimension.COMMUNITY_ENGAGEMENT] +
       metrics.contentQuality * weights[ReputationDimension.CONTENT_QUALITY] +
       metrics.mentorship * weights[ReputationDimension.MENTORSHIP] +
       metrics.innovation * weights[ReputationDimension.INNOVATION]) /
      Object.values(weights).reduce((sum, weight) => sum + weight, 0)
    );
  }
}

/**
 * Calculates reputation scores based on events and dimensions
 */
class ReputationCalculator {
  constructor(private config: ReputationConfig) {}

  /**
   * Calculate score changes for a reputation event
   */
  calculateEventScore(
    eventType: ReputationEventType,
    existingMetrics: ReputationMetrics,
    eventCount: number = 1,
    dailyEventCounts: Record<ReputationEventType, number> = {}
  ): Record<ReputationDimension, number> {
    const eventConfig = this.config.eventScores[eventType];
    if (!eventConfig) {
      throw new Error(`Unknown event type: ${eventType}`);
    }

    // Check daily limits
    const currentDailyCount = dailyEventCounts[eventType] || 0;
    if (eventConfig.dailyLimit && currentDailyCount >= eventConfig.dailyLimit) {
      return this.createEmptyScoreChange();
    }

    const effectiveCount = eventConfig.dailyLimit 
      ? Math.min(eventCount, eventConfig.dailyLimit - currentDailyCount)
      : eventCount;

    const scoreChanges: Record<ReputationDimension, number> = this.createEmptyScoreChange();

    // Apply primary dimension score
    const primaryScore = eventConfig.baseScore * effectiveCount;
    scoreChanges[eventConfig.primaryDimension] += primaryScore;

    // Apply secondary dimension scores
    if (eventConfig.secondaryDimensions) {
      Object.entries(eventConfig.secondaryDimensions).forEach(([dimension, multiplier]) => {
        const secondaryScore = primaryScore * multiplier;
        scoreChanges[dimension as ReputationDimension] += secondaryScore;
      });
    }

    // Apply diminishing returns for high scores
    Object.keys(scoreChanges).forEach(dimension => {
      const dim = dimension as ReputationDimension;
      const currentScore = existingMetrics[this.getDimensionKey(dim)];
      const diminishingFactor = this.calculateDiminishingFactor(currentScore);
      scoreChanges[dim] *= diminishingFactor;
    });

    return scoreChanges;
  }

  private createEmptyScoreChange(): Record<ReputationDimension, number> {
    return {
      [ReputationDimension.HELPFULNESS]: 0,
      [ReputationDimension.EXPERTISE]: 0,
      [ReputationDimension.COMMUNITY_ENGAGEMENT]: 0,
      [ReputationDimension.CONTENT_QUALITY]: 0,
      [ReputationDimension.MENTORSHIP]: 0,
      [ReputationDimension.INNOVATION]: 0
    };
  }

  private getDimensionKey(dimension: ReputationDimension): keyof ReputationMetrics {
    const mapping: Record<ReputationDimension, keyof ReputationMetrics> = {
      [ReputationDimension.HELPFULNESS]: 'helpfulness',
      [ReputationDimension.EXPERTISE]: 'expertise',
      [ReputationDimension.COMMUNITY_ENGAGEMENT]: 'communityEngagement',
      [ReputationDimension.CONTENT_QUALITY]: 'contentQuality',
      [ReputationDimension.MENTORSHIP]: 'mentorship',
      [ReputationDimension.INNOVATION]: 'innovation'
    };
    return mapping[dimension];
  }

  private calculateDiminishingFactor(currentScore: number): number {
    // Diminishing returns kick in after 1000 points
    if (currentScore < 1000) return 1.0;
    if (currentScore < 2500) return 0.8;
    if (currentScore < 5000) return 0.6;
    if (currentScore < 7500) return 0.4;
    return 0.2;
  }
}

/**
 * Aggregates reputation scores across multiple dimensions
 */
class ReputationAggregator {
  constructor(private config: ReputationConfig) {}

  /**
   * Apply score changes to existing metrics
   */
  applyScoreChanges(
    metrics: ReputationMetrics,
    scoreChanges: Record<ReputationDimension, number>
  ): ReputationMetrics {
    const updatedMetrics: ReputationMetrics = {
      ...metrics,
      helpfulness: this.clampScore(metrics.helpfulness + scoreChanges[ReputationDimension.HELPFULNESS]),
      expertise: this.clampScore(metrics.expertise + scoreChanges[ReputationDimension.EXPERTISE]),
      communityEngagement: this.clampScore(metrics.communityEngagement + scoreChanges[ReputationDimension.COMMUNITY_ENGAGEMENT]),
      contentQuality: this.clampScore(metrics.contentQuality + scoreChanges[ReputationDimension.CONTENT_QUALITY]),
      mentorship: this.clampScore(metrics.mentorship + scoreChanges[ReputationDimension.MENTORSHIP]),
      innovation: this.clampScore(metrics.innovation + scoreChanges[ReputationDimension.INNOVATION]),
      lastUpdated: new Date()
    };

    // Recalculate overall score
    updatedMetrics.overallScore = this.calculateOverallScore(updatedMetrics);
    
    return updatedMetrics;
  }

  private clampScore(score: number): number {
    return Math.max(
      this.config.minDimensionScore,
      Math.min(this.config.maxDimensionScore, Math.round(score))
    );
  }

  private calculateOverallScore(metrics: ReputationMetrics): number {
    const weights = this.config.dimensionWeights;
    return Math.round(
      (metrics.helpfulness * weights[ReputationDimension.HELPFULNESS] +
       metrics.expertise * weights[ReputationDimension.EXPERTISE] +
       metrics.communityEngagement * weights[ReputationDimension.COMMUNITY_ENGAGEMENT] +
       metrics.contentQuality * weights[ReputationDimension.CONTENT_QUALITY] +
       metrics.mentorship * weights[ReputationDimension.MENTORSHIP] +
       metrics.innovation * weights[ReputationDimension.INNOVATION]) /
      Object.values(weights).reduce((sum, weight) => sum + weight, 0)
    );
  }
}

/**
 * Manages historical reputation data and trends
 */
class ReputationHistory {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Record reputation snapshot for historical tracking
   */
  async recordSnapshot(metrics: ReputationMetrics): Promise<void> {
    const { error } = await this.supabase
      .from('reputation_history')
      .insert({
        user_id: metrics.userId,
        timestamp: metrics.lastUpdated.toISOString(),
        helpfulness: metrics.helpfulness,
        expertise: metrics.expertise,
        community_engagement: metrics.communityEngagement,
        content_quality: metrics.contentQuality,
        mentorship: metrics.mentorship,
        innovation: metrics.innovation,
        overall_score: metrics.overallScore,
        rank_position: metrics.rank
      });

    if (error) {
      throw new Error(`Failed to record reputation snapshot: ${error.message}`);
    }
  }

  /**
   * Get historical reputation data for trend analysis
   */
  async getTimeSeries(
    userId: string,
    dimension: ReputationDimension | 'overall',
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ timestamp: Date; score: number }>> {
    const columnName = dimension === 'overall' ? 'overall_score' : 
      dimension.replace(/([A-Z])/g, '_$1').toLowerCase();

    const { data, error } = await this.supabase
      .from('reputation_history')
      .select(`timestamp, ${columnName}`)
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch reputation time series: ${error.message}`);
    }

    return (data || []).map(row => ({
      timestamp: new Date(row.timestamp),
      score: row[columnName]
    }));
  }

  /**
   * Analyze reputation trend for a user and dimension
   */
  async analyzeTrend(
    userId: string,
    dimension: ReputationDimension,
    timeframe: 'daily' | 'weekly' | 'monthly'
  ): Promise<ReputationTrend> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case 'daily':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'weekly':
        startDate.setDate(endDate.getDate() - 84); // 12 weeks
        break;
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - 12);
        break;
    }

    const dataPoints = await this.getTimeSeries(userId, dimension, startDate, endDate);
    
    if (dataPoints.length < 2) {
      return {
        userId,
        dimension,
        timeframe,
        trend: 'stable',
        changeRate: 0,
        dataPoints
      };
    }

    // Calculate linear regression to determine trend
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, _, i) => sum + i, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.score, 0);
    const sumXY = dataPoints.reduce((sum, point, i) => sum + (i * point.score), 0);
    const sumX2 = dataPoints.reduce((sum, _, i) => sum + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.1) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      userId,
      dimension,
      timeframe,
      trend,
      changeRate: slope,
      dataPoints
    };
  }
}

/**
 * Multi-dimensional reputation service for tracking user contributions
 * across various aspects of community participation
 */
export class MultiDimensionalReputationService extends EventEmitter {
  private supabase: SupabaseClient;
  private config: ReputationConfig;
  private calculator: ReputationCalculator;
  private aggregator: ReputationAggregator;
  private decayManager: DecayManager;
  private history: ReputationHistory;
  private userMetricsCache: Map<string, { metrics: ReputationMetrics; timestamp: number }>;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    customConfig?: Partial<ReputationConfig>
  ) {
    super();
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
    this.calculator = new ReputationCalculator(this.config);
    this.aggregator = new ReputationAggregator(this.config);