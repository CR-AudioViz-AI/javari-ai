```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * User behavior data interface
 */
interface UserBehavior {
  userId: string;
  agentId: string;
  action: 'view' | 'download' | 'rate' | 'purchase' | 'share';
  timestamp: Date;
  duration?: number;
  rating?: number;
  projectType?: string;
  context?: Record<string, any>;
}

/**
 * Agent metadata interface
 */
interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  features: Record<string, number>;
  rating: number;
  downloads: number;
  price: number;
  createdBy: string;
  lastUpdated: Date;
}

/**
 * User profile interface
 */
interface UserProfile {
  userId: string;
  preferences: Record<string, number>;
  projectHistory: string[];
  behaviorVector: number[];
  lastActivity: Date;
  experience_level: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Recommendation result interface
 */
interface RecommendationResult {
  agentId: string;
  score: number;
  confidence: number;
  reasoning: string[];
  algorithm: 'collaborative' | 'content' | 'hybrid';
  metadata: {
    rating: number;
    downloads: number;
    category: string;
    price: number;
  };
}

/**
 * Recommendation request interface
 */
interface RecommendationRequest {
  userId: string;
  projectType?: string;
  budget?: number;
  categories?: string[];
  excludeOwned?: boolean;
  limit?: number;
  includeRecentlyViewed?: boolean;
}

/**
 * Similarity matrix interface
 */
interface SimilarityMatrix {
  [userId: string]: {
    [otherUserId: string]: number;
  };
}

/**
 * Content-based filter for agent feature matching
 */
class ContentBasedFilter {
  private agents: Map<string, Agent> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();

  /**
   * Update agent data
   */
  updateAgents(agents: Agent[]): void {
    agents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });
  }

  /**
   * Update user profiles
   */
  updateUserProfiles(profiles: UserProfile[]): void {
    profiles.forEach(profile => {
      this.userProfiles.set(profile.userId, profile);
    });
  }

  /**
   * Calculate content-based recommendations
   */
  getRecommendations(userId: string, options: {
    projectType?: string;
    categories?: string[];
    limit?: number;
  } = {}): RecommendationResult[] {
    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      return [];
    }

    const recommendations: RecommendationResult[] = [];
    
    for (const [agentId, agent] of this.agents) {
      // Skip if category filter doesn't match
      if (options.categories && !options.categories.includes(agent.category)) {
        continue;
      }

      const score = this.calculateContentScore(userProfile, agent, options.projectType);
      const confidence = this.calculateContentConfidence(userProfile, agent);

      if (score > 0.1) {
        recommendations.push({
          agentId,
          score,
          confidence,
          reasoning: this.generateContentReasoning(userProfile, agent),
          algorithm: 'content',
          metadata: {
            rating: agent.rating,
            downloads: agent.downloads,
            category: agent.category,
            price: agent.price
          }
        });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);
  }

  /**
   * Calculate content-based similarity score
   */
  private calculateContentScore(profile: UserProfile, agent: Agent, projectType?: string): number {
    let score = 0;

    // Feature similarity
    const featureSimilarity = this.calculateFeatureSimilarity(profile.preferences, agent.features);
    score += featureSimilarity * 0.4;

    // Category preference
    const categoryWeight = profile.preferences[agent.category] || 0;
    score += categoryWeight * 0.3;

    // Project type relevance
    if (projectType && agent.tags.includes(projectType)) {
      score += 0.2;
    }

    // Quality metrics
    const qualityScore = (agent.rating / 5) * 0.1;
    score += qualityScore;

    return Math.min(score, 1);
  }

  /**
   * Calculate feature similarity using cosine similarity
   */
  private calculateFeatureSimilarity(preferences: Record<string, number>, features: Record<string, number>): number {
    const prefKeys = Object.keys(preferences);
    const featKeys = Object.keys(features);
    const commonKeys = prefKeys.filter(key => featKeys.includes(key));

    if (commonKeys.length === 0) return 0;

    let dotProduct = 0;
    let prefMagnitude = 0;
    let featMagnitude = 0;

    commonKeys.forEach(key => {
      dotProduct += preferences[key] * features[key];
      prefMagnitude += preferences[key] ** 2;
      featMagnitude += features[key] ** 2;
    });

    if (prefMagnitude === 0 || featMagnitude === 0) return 0;

    return dotProduct / (Math.sqrt(prefMagnitude) * Math.sqrt(featMagnitude));
  }

  /**
   * Calculate confidence for content-based recommendation
   */
  private calculateContentConfidence(profile: UserProfile, agent: Agent): number {
    const dataPoints = Object.keys(profile.preferences).length;
    const agentFeatures = Object.keys(agent.features).length;
    const overlap = Object.keys(profile.preferences)
      .filter(key => Object.keys(agent.features).includes(key)).length;

    return Math.min((overlap / Math.min(dataPoints, agentFeatures)) * 0.8 + 0.2, 1);
  }

  /**
   * Generate reasoning for content-based recommendations
   */
  private generateContentReasoning(profile: UserProfile, agent: Agent): string[] {
    const reasoning: string[] = [];

    // Category match
    if (profile.preferences[agent.category] > 0.5) {
      reasoning.push(`Strong preference for ${agent.category} category`);
    }

    // Feature matches
    const matchingFeatures = Object.keys(profile.preferences)
      .filter(key => agent.features[key] > 0.5)
      .slice(0, 3);
    
    if (matchingFeatures.length > 0) {
      reasoning.push(`Matches your interests: ${matchingFeatures.join(', ')}`);
    }

    // Quality indicators
    if (agent.rating > 4.5) {
      reasoning.push('Highly rated by users');
    }

    if (agent.downloads > 10000) {
      reasoning.push('Popular choice among users');
    }

    return reasoning;
  }
}

/**
 * Collaborative filter for user similarity recommendations
 */
class CollaborativeFilter {
  private userBehaviors: Map<string, UserBehavior[]> = new Map();
  private similarityMatrix: SimilarityMatrix = {};
  private agentPopularity: Map<string, number> = new Map();

  /**
   * Update user behaviors
   */
  updateBehaviors(behaviors: UserBehavior[]): void {
    behaviors.forEach(behavior => {
      if (!this.userBehaviors.has(behavior.userId)) {
        this.userBehaviors.set(behavior.userId, []);
      }
      this.userBehaviors.get(behavior.userId)!.push(behavior);
    });

    this.calculateSimilarityMatrix();
    this.calculateAgentPopularity();
  }

  /**
   * Get collaborative filtering recommendations
   */
  getRecommendations(userId: string, options: {
    excludeOwned?: boolean;
    limit?: number;
  } = {}): RecommendationResult[] {
    const similarUsers = this.findSimilarUsers(userId, 50);
    const recommendations: Map<string, { score: number; reasons: string[] }> = new Map();

    similarUsers.forEach(({ userId: similarUserId, similarity }) => {
      const behaviors = this.userBehaviors.get(similarUserId) || [];
      
      behaviors.forEach(behavior => {
        if (behavior.action === 'rate' && behavior.rating && behavior.rating >= 4) {
          const currentScore = recommendations.get(behavior.agentId)?.score || 0;
          const weightedScore = similarity * (behavior.rating / 5);
          
          recommendations.set(behavior.agentId, {
            score: currentScore + weightedScore,
            reasons: [
              ...(recommendations.get(behavior.agentId)?.reasons || []),
              `Similar user rated ${behavior.rating}/5`
            ]
          });
        }
      });
    });

    const results: RecommendationResult[] = [];
    
    for (const [agentId, { score, reasons }] of recommendations) {
      const confidence = this.calculateCollaborativeConfidence(userId, agentId, similarUsers.length);
      const popularity = this.agentPopularity.get(agentId) || 0;
      
      results.push({
        agentId,
        score: score * 0.8 + popularity * 0.2, // Blend with popularity
        confidence,
        reasoning: reasons.slice(0, 3),
        algorithm: 'collaborative',
        metadata: {
          rating: 0, // Will be filled by the main service
          downloads: 0,
          category: '',
          price: 0
        }
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);
  }

  /**
   * Find similar users based on behavior patterns
   */
  findSimilarUsers(userId: string, limit: number = 20): Array<{ userId: string; similarity: number }> {
    const similarities = this.similarityMatrix[userId] || {};
    
    return Object.entries(similarities)
      .map(([otherUserId, similarity]) => ({ userId: otherUserId, similarity }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Calculate user similarity matrix using Jaccard similarity
   */
  private calculateSimilarityMatrix(): void {
    const users = Array.from(this.userBehaviors.keys());
    
    users.forEach(userId1 => {
      this.similarityMatrix[userId1] = {};
      
      users.forEach(userId2 => {
        if (userId1 !== userId2) {
          this.similarityMatrix[userId1][userId2] = this.calculateUserSimilarity(userId1, userId2);
        }
      });
    });
  }

  /**
   * Calculate similarity between two users
   */
  private calculateUserSimilarity(userId1: string, userId2: string): number {
    const behaviors1 = this.userBehaviors.get(userId1) || [];
    const behaviors2 = this.userBehaviors.get(userId2) || [];

    const agents1 = new Set(behaviors1.map(b => b.agentId));
    const agents2 = new Set(behaviors2.map(b => b.agentId));

    const intersection = new Set([...agents1].filter(x => agents2.has(x)));
    const union = new Set([...agents1, ...agents2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate agent popularity scores
   */
  private calculateAgentPopularity(): void {
    const agentCounts: Map<string, number> = new Map();
    
    for (const behaviors of this.userBehaviors.values()) {
      behaviors.forEach(behavior => {
        agentCounts.set(behavior.agentId, (agentCounts.get(behavior.agentId) || 0) + 1);
      });
    }

    const maxCount = Math.max(...agentCounts.values());
    
    for (const [agentId, count] of agentCounts) {
      this.agentPopularity.set(agentId, count / maxCount);
    }
  }

  /**
   * Calculate confidence for collaborative recommendations
   */
  private calculateCollaborativeConfidence(userId: string, agentId: string, similarUserCount: number): number {
    const userBehaviors = this.userBehaviors.get(userId)?.length || 0;
    const agentPopularity = this.agentPopularity.get(agentId) || 0;
    
    const dataConfidence = Math.min(userBehaviors / 10, 1) * 0.4;
    const similarityConfidence = Math.min(similarUserCount / 20, 1) * 0.4;
    const popularityConfidence = agentPopularity * 0.2;
    
    return dataConfidence + similarityConfidence + popularityConfidence;
  }
}

/**
 * User behavior analyzer for tracking and analyzing interactions
 */
class UserBehaviorAnalyzer {
  private supabase: SupabaseClient;
  private behaviorCache: Map<string, UserBehavior[]> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Track user behavior event
   */
  async trackBehavior(behavior: UserBehavior): Promise<void> {
    try {
      // Store in database
      await this.supabase
        .from('user_behaviors')
        .insert({
          user_id: behavior.userId,
          agent_id: behavior.agentId,
          action: behavior.action,
          timestamp: behavior.timestamp.toISOString(),
          duration: behavior.duration,
          rating: behavior.rating,
          project_type: behavior.projectType,
          context: behavior.context
        });

      // Update cache
      if (!this.behaviorCache.has(behavior.userId)) {
        this.behaviorCache.set(behavior.userId, []);
      }
      this.behaviorCache.get(behavior.userId)!.push(behavior);

    } catch (error) {
      console.error('Error tracking behavior:', error);
      throw new Error('Failed to track user behavior');
    }
  }

  /**
   * Get user behaviors from cache or database
   */
  async getUserBehaviors(userId: string, limit: number = 1000): Promise<UserBehavior[]> {
    try {
      // Check cache first
      const cached = this.behaviorCache.get(userId);
      if (cached && cached.length > 0) {
        return cached.slice(-limit);
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('user_behaviors')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const behaviors = data.map(row => ({
        userId: row.user_id,
        agentId: row.agent_id,
        action: row.action,
        timestamp: new Date(row.timestamp),
        duration: row.duration,
        rating: row.rating,
        projectType: row.project_type,
        context: row.context
      }));

      this.behaviorCache.set(userId, behaviors);
      return behaviors;

    } catch (error) {
      console.error('Error fetching user behaviors:', error);
      return [];
    }
  }

  /**
   * Analyze user behavior patterns
   */
  async analyzeUserPatterns(userId: string): Promise<UserProfile> {
    const behaviors = await this.getUserBehaviors(userId);
    
    const preferences: Record<string, number> = {};
    const projectHistory: string[] = [];
    const behaviorVector: number[] = new Array(10).fill(0);

    behaviors.forEach((behavior, index) => {
      // Calculate recency weight
      const recencyWeight = Math.exp(-index * 0.1);

      // Update category preferences
      if (behavior.action === 'rate' && behavior.rating) {
        preferences[`rating_${behavior.rating}`] = 
          (preferences[`rating_${behavior.rating}`] || 0) + recencyWeight;
      }

      // Track project types
      if (behavior.projectType && !projectHistory.includes(behavior.projectType)) {
        projectHistory.push(behavior.projectType);
      }

      // Build behavior vector
      const actionIndex = ['view', 'download', 'rate', 'purchase', 'share'].indexOf(behavior.action);
      if (actionIndex !== -1) {
        behaviorVector[actionIndex] += recencyWeight;
      }
    });

    // Determine experience level
    const experience_level = this.determineExperienceLevel(behaviors);

    return {
      userId,
      preferences,
      projectHistory,
      behaviorVector,
      lastActivity: behaviors.length > 0 ? behaviors[0].timestamp : new Date(),
      experience_level
    };
  }

  /**
   * Determine user experience level based on behavior patterns
   */
  private determineExperienceLevel(behaviors: UserBehavior[]): 'beginner' | 'intermediate' | 'advanced' {
    const totalActions = behaviors.length;
    const uniqueAgents = new Set(behaviors.map(b => b.agentId)).size;
    const ratings = behaviors.filter(b => b.rating).length;
    
    if (totalActions < 10 || uniqueAgents < 3) return 'beginner';
    if (totalActions < 50 || uniqueAgents < 10 || ratings < 5) return 'intermediate';
    return 'advanced';
  }
}

/**
 * Agent scorer for ranking and confidence calculation
 */
class AgentScorer {
  /**
   * Score and rank agents using hybrid algorithm
   */
  scoreAgents(
    contentResults: RecommendationResult[],
    collaborativeResults: RecommendationResult[],
    weights: { content: number; collaborative: number } = { content: 0.6, collaborative: 0.4 }
  ): RecommendationResult[] {
    const agentScores: Map<string, RecommendationResult> = new Map();

    // Process content-based results
    contentResults.forEach(result => {
      agentScores.set(result.agentId, {
        ...result,
        score: result.score * weights.content,
        algorithm: 'hybrid'
      });
    });

    // Merge collaborative results
    collaborativeResults.forEach(collabResult => {
      const existing = agentScores.get(collabResult.agentId);
      
      if (existing) {
        // Combine scores
        existing.score += collabResult.score * weights.collaborative;
        existing.confidence = Math.max(existing.confidence, collabResult.confidence);
        existing.reasoning = [...existing.reasoning, ...collabResult.reasoning];
      } else {
        // Add new collaborative-only result
        agentScores.set(collabResult.agentId, {
          ...collabResult,
          score: collabResult.score * weights.collaborative,
          algorithm: 'hybrid'
        });
      }
    });

    return Array.from(agentScores.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Apply business rules and filters
   */
  applyBusinessRules(
    results: RecommendationResult[],
    request: RecommendationRequest,
    ownedAgents: string[] = []
  ): RecommendationResult[] {
    return results
      .filter(result => {
        // Exclude owned agents if requested
        if (request.excludeOwned && ownedAgents.includes(result.agentId)) {
          return false;
        }

        // Budget filter
        if (request.budget && result.metadata.price > request.budget) {
          return false;
        }

        // Minimum confidence threshold
        if (result.confidence < 0.3) {
          return false;
        }

        return true;
      })
      .slice(0, request.limit || 10);
  }
}

/**
 * Recommendation cache with Redis integration
 */
class RecommendationCache {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 hour

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get cached recommendations
   */
  async getRecommendations(userId: string, requestHash: string): Promise<RecommendationResult[] | null> {
    try {
      const key = `recommendations:${userId}:${requestHash}`;
      const cached = await this.redis.get(key);
      
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache recommendations
   */
  async setRecommendations(
    userId: string, 
    requestHash: string, 
    recommendations: RecommendationResult[],
    ttl?: number
  ): Promise<void> {
    try {
      const key = `recommendations:${userId}:${requestHash}`;
      await this.redis.setex(key, ttl || this.defaultTTL, JSON.stringify(recommendations));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate user recommendations
   */
  async invalidateUserRecommendations(userId: string): Promise<void> {
    try {
      const pattern = `recommendations:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Generate request hash for caching
   */
  generateRequestHash(request: RecommendationRequest): string {
    const hashInput = JSON.stringify({
      projectType: request.projectType,
      budget: request.budget,
      categories: request.categories?.sort(),
      excludeOwned: request.excludeOwned,
      limit: request.limit
    });
    
    return Buffer.from(hashInput).toString('base64');
  }
}

/**
 * Main recommendation engine with hybrid algorithm implementation
 */
class RecommendationEngine {
  private supabase: SupabaseClient;
  private redis: Redis;
  private contentFilter: ContentBasedFilter;
  private collaborativeFilter: CollaborativeFilter;
  private behaviorAnalyzer: UserBehaviorAnalyzer;
  private agentScorer: AgentScorer;
  private cache: RecommendationCache;

  constructor(supabaseUrl: string, supabaseKey: string, redisUrl: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey