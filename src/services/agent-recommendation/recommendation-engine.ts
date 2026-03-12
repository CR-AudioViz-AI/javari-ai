```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * User interaction data structure
 */
interface UserInteraction {
  userId: string;
  agentId: string;
  interactionType: 'view' | 'use' | 'rate' | 'bookmark' | 'share';
  rating?: number;
  duration?: number;
  timestamp: Date;
  sessionId: string;
  context?: Record<string, any>;
}

/**
 * Agent metadata and features
 */
interface AgentMetadata {
  id: string;
  name: string;
  category: string;
  tags: string[];
  description: string;
  capabilities: string[];
  complexity: 'low' | 'medium' | 'high';
  targetAudience: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent performance metrics
 */
interface AgentPerformance {
  agentId: string;
  successRate: number;
  avgExecutionTime: number;
  userSatisfactionScore: number;
  totalUsage: number;
  errorRate: number;
  lastUpdated: Date;
  trendingScore: number;
}

/**
 * User behavior pattern analysis
 */
interface UserBehaviorPattern {
  userId: string;
  preferredCategories: Array<{ category: string; weight: number }>;
  complexityPreference: 'low' | 'medium' | 'high';
  usageFrequency: number;
  avgSessionDuration: number;
  interactionTypes: Record<string, number>;
  timeOfDayPreference: number[];
  recentInterests: string[];
}

/**
 * Recommendation result structure
 */
interface RecommendationResult {
  agentId: string;
  score: number;
  confidence: number;
  explanation: string;
  reasoning: {
    collaborativeScore: number;
    contentScore: number;
    performanceScore: number;
    recencyScore: number;
  };
  metadata: AgentMetadata;
}

/**
 * Recommendation request parameters
 */
interface RecommendationRequest {
  userId: string;
  limit?: number;
  excludeAgentIds?: string[];
  contextTags?: string[];
  minConfidence?: number;
  includeExplanations?: boolean;
}

/**
 * Collaborative filtering matrix
 */
interface CollaborativeMatrix {
  userSimilarities: Map<string, Map<string, number>>;
  itemSimilarities: Map<string, Map<string, number>>;
  userItemMatrix: Map<string, Map<string, number>>;
  lastUpdated: Date;
}

/**
 * Content-based feature vector
 */
interface FeatureVector {
  agentId: string;
  features: Map<string, number>;
  normalized: boolean;
}

/**
 * User behavior analyzer for interaction pattern analysis
 */
class UserBehaviorAnalyzer {
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Analyze user behavior patterns from interaction history
   */
  async analyzeUserBehavior(userId: string): Promise<UserBehaviorPattern> {
    const cacheKey = `user_behavior:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const { data: interactions } = await this.supabase
      .from('user_interactions')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .order('timestamp', { ascending: false });

    if (!interactions || interactions.length === 0) {
      return this.getDefaultBehaviorPattern(userId);
    }

    const pattern = this.computeBehaviorPattern(interactions);
    await this.redis.setex(cacheKey, 3600, JSON.stringify(pattern)); // Cache for 1 hour
    
    return pattern;
  }

  /**
   * Compute behavior pattern from interactions
   */
  private computeBehaviorPattern(interactions: any[]): UserBehaviorPattern {
    const categoryWeights = new Map<string, number>();
    const interactionTypeCounts = new Map<string, number>();
    const hourCounts = new Array(24).fill(0);
    let totalDuration = 0;
    const recentTags = new Set<string>();

    for (const interaction of interactions) {
      // Category preferences
      if (interaction.agent_category) {
        const current = categoryWeights.get(interaction.agent_category) || 0;
        const weight = this.getInteractionWeight(interaction.interaction_type);
        categoryWeights.set(interaction.agent_category, current + weight);
      }

      // Interaction type analysis
      const typeCount = interactionTypeCounts.get(interaction.interaction_type) || 0;
      interactionTypeCounts.set(interaction.interaction_type, typeCount + 1);

      // Time of day preference
      const hour = new Date(interaction.timestamp).getHours();
      hourCounts[hour]++;

      // Duration tracking
      if (interaction.duration) {
        totalDuration += interaction.duration;
      }

      // Recent interests (tags from last 7 days)
      if (interaction.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) {
        if (interaction.agent_tags) {
          interaction.agent_tags.forEach((tag: string) => recentTags.add(tag));
        }
      }
    }

    return {
      userId: interactions[0]?.user_id || '',
      preferredCategories: Array.from(categoryWeights.entries())
        .map(([category, weight]) => ({ category, weight: weight / interactions.length }))
        .sort((a, b) => b.weight - a.weight),
      complexityPreference: this.inferComplexityPreference(interactions),
      usageFrequency: interactions.length / 30, // Interactions per day
      avgSessionDuration: totalDuration / interactions.length,
      interactionTypes: Object.fromEntries(interactionTypeCounts),
      timeOfDayPreference: hourCounts,
      recentInterests: Array.from(recentTags)
    };
  }

  /**
   * Get interaction weight for different types
   */
  private getInteractionWeight(type: string): number {
    const weights = {
      'rate': 3.0,
      'bookmark': 2.5,
      'use': 2.0,
      'share': 1.5,
      'view': 1.0
    };
    return weights[type as keyof typeof weights] || 1.0;
  }

  /**
   * Infer complexity preference from interaction history
   */
  private inferComplexityPreference(interactions: any[]): 'low' | 'medium' | 'high' {
    const complexityCounts = { low: 0, medium: 0, high: 0 };
    
    for (const interaction of interactions) {
      if (interaction.agent_complexity) {
        complexityCounts[interaction.agent_complexity as keyof typeof complexityCounts]++;
      }
    }

    const maxComplexity = Object.entries(complexityCounts)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    return maxComplexity as 'low' | 'medium' | 'high';
  }

  /**
   * Get default behavior pattern for new users
   */
  private getDefaultBehaviorPattern(userId: string): UserBehaviorPattern {
    return {
      userId,
      preferredCategories: [],
      complexityPreference: 'medium',
      usageFrequency: 0,
      avgSessionDuration: 0,
      interactionTypes: {},
      timeOfDayPreference: new Array(24).fill(1), // Uniform distribution
      recentInterests: []
    };
  }
}

/**
 * Agent performance tracker for success metrics collection
 */
class AgentPerformanceTracker {
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(agentId: string): Promise<AgentPerformance> {
    const cacheKey = `agent_performance:${agentId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const performance = await this.computePerformanceMetrics(agentId);
    await this.redis.setex(cacheKey, 1800, JSON.stringify(performance)); // Cache for 30 minutes
    
    return performance;
  }

  /**
   * Compute performance metrics for an agent
   */
  private async computePerformanceMetrics(agentId: string): Promise<AgentPerformance> {
    const [executionData, interactionData] = await Promise.all([
      this.getExecutionMetrics(agentId),
      this.getInteractionMetrics(agentId)
    ]);

    const trendingScore = await this.computeTrendingScore(agentId);

    return {
      agentId,
      successRate: executionData.successRate,
      avgExecutionTime: executionData.avgExecutionTime,
      userSatisfactionScore: interactionData.satisfactionScore,
      totalUsage: interactionData.totalUsage,
      errorRate: executionData.errorRate,
      lastUpdated: new Date(),
      trendingScore
    };
  }

  /**
   * Get execution metrics from agent service
   */
  private async getExecutionMetrics(agentId: string) {
    const { data } = await this.supabase
      .from('agent_executions')
      .select('success, execution_time, error')
      .eq('agent_id', agentId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // Last 7 days

    if (!data || data.length === 0) {
      return { successRate: 0, avgExecutionTime: 0, errorRate: 0 };
    }

    const successes = data.filter(d => d.success).length;
    const totalTime = data.reduce((sum, d) => sum + (d.execution_time || 0), 0);
    const errors = data.filter(d => d.error).length;

    return {
      successRate: successes / data.length,
      avgExecutionTime: totalTime / data.length,
      errorRate: errors / data.length
    };
  }

  /**
   * Get interaction metrics from user interactions
   */
  private async getInteractionMetrics(agentId: string) {
    const { data } = await this.supabase
      .from('user_interactions')
      .select('interaction_type, rating')
      .eq('agent_id', agentId)
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    if (!data || data.length === 0) {
      return { satisfactionScore: 0, totalUsage: 0 };
    }

    const ratings = data.filter(d => d.rating).map(d => d.rating);
    const satisfactionScore = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0;

    return {
      satisfactionScore,
      totalUsage: data.length
    };
  }

  /**
   * Compute trending score based on recent usage patterns
   */
  private async computeTrendingScore(agentId: string): Promise<number> {
    const { data } = await this.supabase
      .from('user_interactions')
      .select('timestamp')
      .eq('agent_id', agentId)
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .order('timestamp', { ascending: false });

    if (!data || data.length === 0) return 0;

    // Weight recent interactions more heavily
    const now = Date.now();
    const weightedScore = data.reduce((score, interaction) => {
      const hoursAgo = (now - new Date(interaction.timestamp).getTime()) / (1000 * 60 * 60);
      const weight = Math.exp(-hoursAgo / 12); // Exponential decay over 12 hours
      return score + weight;
    }, 0);

    return Math.min(weightedScore / 10, 1); // Normalize to 0-1
  }
}

/**
 * Content-based recommender for feature-based matching
 */
class ContentBasedRecommender {
  private featureVectors: Map<string, FeatureVector> = new Map();
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Build feature vectors for all agents
   */
  async buildFeatureVectors(): Promise<void> {
    const { data: agents } = await this.supabase
      .from('agents')
      .select('*');

    if (!agents) return;

    for (const agent of agents) {
      const features = this.extractFeatures(agent);
      const normalized = this.normalizeFeatures(features);
      
      this.featureVectors.set(agent.id, {
        agentId: agent.id,
        features: normalized,
        normalized: true
      });
    }
  }

  /**
   * Get content-based recommendations for user preferences
   */
  async getContentRecommendations(
    userBehavior: UserBehaviorPattern,
    candidateAgents: string[]
  ): Promise<Array<{ agentId: string; score: number }>> {
    const userProfile = this.buildUserProfile(userBehavior);
    const recommendations: Array<{ agentId: string; score: number }> = [];

    for (const agentId of candidateAgents) {
      const agentVector = this.featureVectors.get(agentId);
      if (!agentVector) continue;

      const similarity = this.computeCosineSimilarity(userProfile, agentVector.features);
      recommendations.push({ agentId, score: similarity });
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Extract features from agent metadata
   */
  private extractFeatures(agent: any): Map<string, number> {
    const features = new Map<string, number>();

    // Category features
    if (agent.category) {
      features.set(`category_${agent.category}`, 1);
    }

    // Tag features
    if (agent.tags) {
      for (const tag of agent.tags) {
        features.set(`tag_${tag}`, 1);
      }
    }

    // Capability features
    if (agent.capabilities) {
      for (const capability of agent.capabilities) {
        features.set(`capability_${capability}`, 1);
      }
    }

    // Complexity feature
    const complexityMap = { low: 1, medium: 2, high: 3 };
    features.set('complexity', complexityMap[agent.complexity as keyof typeof complexityMap] || 2);

    // Target audience features
    if (agent.target_audience) {
      for (const audience of agent.target_audience) {
        features.set(`audience_${audience}`, 1);
      }
    }

    return features;
  }

  /**
   * Build user profile from behavior patterns
   */
  private buildUserProfile(behavior: UserBehaviorPattern): Map<string, number> {
    const profile = new Map<string, number>();

    // Category preferences
    for (const { category, weight } of behavior.preferredCategories) {
      profile.set(`category_${category}`, weight);
    }

    // Recent interests (tags)
    for (const tag of behavior.recentInterests) {
      profile.set(`tag_${tag}`, 1);
    }

    // Complexity preference
    const complexityMap = { low: 1, medium: 2, high: 3 };
    profile.set('complexity', complexityMap[behavior.complexityPreference]);

    return this.normalizeFeatures(profile);
  }

  /**
   * Normalize feature vector using L2 norm
   */
  private normalizeFeatures(features: Map<string, number>): Map<string, number> {
    const values = Array.from(features.values());
    const magnitude = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) return features;

    const normalized = new Map<string, number>();
    for (const [key, value] of features.entries()) {
      normalized.set(key, value / magnitude);
    }

    return normalized;
  }

  /**
   * Compute cosine similarity between two feature vectors
   */
  private computeCosineSimilarity(
    vec1: Map<string, number>,
    vec2: Map<string, number>
  ): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    const allKeys = new Set([...vec1.keys(), ...vec2.keys()]);

    for (const key of allKeys) {
      const val1 = vec1.get(key) || 0;
      const val2 = vec2.get(key) || 0;

      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}

/**
 * Main recommendation engine with collaborative filtering implementation
 */
export class RecommendationEngine extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private behaviorAnalyzer: UserBehaviorAnalyzer;
  private performanceTracker: AgentPerformanceTracker;
  private contentRecommender: ContentBasedRecommender;
  private collaborativeMatrix: CollaborativeMatrix;
  private isInitialized = false;

  constructor(supabaseUrl: string, supabaseKey: string, redisConfig: any) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisConfig);
    this.behaviorAnalyzer = new UserBehaviorAnalyzer(this.supabase, this.redis);
    this.performanceTracker = new AgentPerformanceTracker(this.supabase, this.redis);
    this.contentRecommender = new ContentBasedRecommender(this.supabase);
    this.collaborativeMatrix = {
      userSimilarities: new Map(),
      itemSimilarities: new Map(),
      userItemMatrix: new Map(),
      lastUpdated: new Date(0)
    };
  }

  /**
   * Initialize the recommendation engine
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.buildCollaborativeMatrix(),
        this.contentRecommender.buildFeatureVectors()
      ]);
      
      this.isInitialized = true;
      this.emit('initialized');
      
      // Schedule periodic updates
      this.scheduleMatrixUpdates();
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize recommendation engine: ${error}`));
      throw error;
    }
  }

  /**
   * Get personalized agent recommendations
   */
  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResult[]> {
    if (!this.isInitialized) {
      throw new Error('Recommendation engine not initialized');
    }

    const {
      userId,
      limit = 10,
      excludeAgentIds = [],
      contextTags = [],
      minConfidence = 0.1,
      includeExplanations = true
    } = request;

    try {
      // Get user behavior pattern
      const userBehavior = await this.behaviorAnalyzer.analyzeUserBehavior(userId);
      
      // Get candidate agents
      const candidateAgents = await this.getCandidateAgents(excludeAgentIds, contextTags);
      
      // Generate recommendations using hybrid approach
      const recommendations = await this.generateHybridRecommendations(
        userId,
        userBehavior,
        candidateAgents,
        minConfidence
      );

      // Add explanations if requested
      const results = includeExplanations
        ? await this.addExplanations(recommendations, userBehavior)
        : recommendations.map(r => ({ ...r, explanation: '' }));

      this.emit('recommendations_generated', { userId, count: results.length });
      
      return results.slice(0, limit);
    } catch (error) {
      this.emit('error', new Error(`Failed to generate recommendations: ${error}`));
      throw error;
    }
  }

  /**
   * Record user interaction for learning
   */
  async recordInteraction(interaction: UserInteraction): Promise<void> {
    try {
      // Store interaction in database
      await this.supabase
        .from('user_interactions')
        .insert({
          user_id: interaction.userId,
          agent_id: interaction.agentId,
          interaction_type: interaction.interactionType,
          rating: interaction.rating,
          duration: interaction.duration,
          timestamp: interaction.timestamp.toISOString(),
          session_id: interaction.sessionId,
          context: interaction.context
        });

      // Invalidate relevant caches
      await this.invalidateCaches(interaction.userId, interaction.agentId);
      
      // Update real-time recommendations if significant interaction
      if (['rate', 'bookmark', 'use'].includes(interaction.interactionType)) {
        this.emit('significant_interaction', interaction);
        this.updateRealtimeRecommendations(interaction.userId);
      }

    } catch (error) {
      this.emit('error', new Error(`Failed to record interaction: ${error}`));
      throw error;
    }
  }

  /**
   * Build collaborative filtering matrix
   */
  private async buildCollaborativeMatrix(): Promise<void> {
    const { data: interactions } = await this.supabase
      .from('user_interactions')
      .select('user_id, agent_id, rating, interaction_type')
      .gte('timestamp', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)); // Last 90 days

    if (!interactions || interactions.length === 0) return;

    // Build user-item matrix
    const userItemMatrix = new Map<string, Map<string, number>>();
    
    for (const interaction of interactions)