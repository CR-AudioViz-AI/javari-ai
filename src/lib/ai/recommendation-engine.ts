```typescript
import * as tf from '@tensorflow/tfjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

/**
 * User behavior data structure
 */
interface UserBehavior {
  userId: string;
  agentId: string;
  interactionType: 'view' | 'use' | 'rate' | 'favorite' | 'share';
  timestamp: Date;
  duration?: number;
  rating?: number;
  context?: string;
}

/**
 * Agent metadata structure
 */
interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  capabilities: string[];
  complexity: number;
  rating: number;
  usageCount: number;
  features: Record<string, number>;
}

/**
 * Project requirements structure
 */
interface ProjectRequirements {
  id: string;
  userId: string;
  type: string;
  complexity: number;
  requiredCapabilities: string[];
  preferredCategories: string[];
  budget?: number;
  timeline?: string;
}

/**
 * Recommendation result structure
 */
interface Recommendation {
  agentId: string;
  score: number;
  reason: string;
  confidence: number;
  metadata: AgentMetadata;
}

/**
 * User profile with preferences
 */
interface UserProfile {
  id: string;
  preferences: {
    categories: Record<string, number>;
    capabilities: Record<string, number>;
    complexityLevel: number;
    priceRange: [number, number];
  };
  behaviorVector: number[];
  similarUsers: string[];
}

/**
 * Recommendation configuration
 */
interface RecommendationConfig {
  collaborativeWeight: number;
  contentWeight: number;
  popularityWeight: number;
  maxRecommendations: number;
  minConfidence: number;
  cacheTTL: number;
}

/**
 * AI-powered agent recommendation engine with hybrid filtering
 */
export class RecommendationEngine {
  private supabase: SupabaseClient;
  private redis: Redis;
  private config: RecommendationConfig;
  private behaviorAnalyzer: UserBehaviorAnalyzer;
  private requirementMatcher: ProjectRequirementMatcher;
  private collaborativeFilter: CollaborativeFilter;
  private contentFilter: ContentBasedFilter;
  private scorer: RecommendationScorer;
  private cache: RecommendationCache;
  private mlModel: tf.LayersModel | null = null;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    redisUrl: string,
    config: Partial<RecommendationConfig> = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis({ url: redisUrl });
    
    this.config = {
      collaborativeWeight: 0.4,
      contentWeight: 0.4,
      popularityWeight: 0.2,
      maxRecommendations: 10,
      minConfidence: 0.3,
      cacheTTL: 3600,
      ...config
    };

    this.behaviorAnalyzer = new UserBehaviorAnalyzer(this.supabase);
    this.requirementMatcher = new ProjectRequirementMatcher();
    this.collaborativeFilter = new CollaborativeFilter();
    this.contentFilter = new ContentBasedFilter();
    this.scorer = new RecommendationScorer(this.config);
    this.cache = new RecommendationCache(this.redis, this.config.cacheTTL);

    this.initializeMLModel();
  }

  /**
   * Initialize TensorFlow.js model for recommendation inference
   */
  private async initializeMLModel(): Promise<void> {
    try {
      // Load pre-trained model or create simple neural network
      this.mlModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [50], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });

      this.mlModel.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
    } catch (error) {
      console.error('Failed to initialize ML model:', error);
      this.mlModel = null;
    }
  }

  /**
   * Get personalized agent recommendations for a user
   */
  async getRecommendations(
    userId: string,
    projectId?: string,
    options: Partial<RecommendationConfig> = {}
  ): Promise<Recommendation[]> {
    try {
      const cacheKey = `recommendations:${userId}:${projectId || 'general'}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Analyze user behavior and build profile
      const userProfile = await this.buildUserProfile(userId);
      
      // Get project requirements if provided
      let projectRequirements: ProjectRequirements | null = null;
      if (projectId) {
        projectRequirements = await this.getProjectRequirements(projectId);
      }

      // Get all available agents
      const agents = await this.getAllAgents();

      // Generate recommendations using hybrid approach
      const recommendations = await this.generateHybridRecommendations(
        userProfile,
        agents,
        projectRequirements,
        { ...this.config, ...options }
      );

      // Cache results
      await this.cache.set(cacheKey, recommendations);

      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw new Error(`Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate hybrid recommendations combining multiple approaches
   */
  private async generateHybridRecommendations(
    userProfile: UserProfile,
    agents: AgentMetadata[],
    projectRequirements: ProjectRequirements | null,
    config: RecommendationConfig
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const agent of agents) {
      // Content-based filtering score
      const contentScore = this.contentFilter.calculateSimilarity(
        userProfile,
        agent,
        projectRequirements
      );

      // Collaborative filtering score
      const collaborativeScore = await this.collaborativeFilter.calculateScore(
        userProfile.id,
        agent.id,
        userProfile.similarUsers
      );

      // Popularity score
      const popularityScore = this.calculatePopularityScore(agent);

      // ML model prediction if available
      let mlScore = 0.5;
      if (this.mlModel) {
        mlScore = await this.predictWithML(userProfile, agent);
      }

      // Combined hybrid score
      const hybridScore = this.scorer.calculateHybridScore({
        content: contentScore,
        collaborative: collaborativeScore,
        popularity: popularityScore,
        ml: mlScore
      });

      // Calculate confidence based on data availability
      const confidence = this.calculateConfidence(
        userProfile,
        agent,
        contentScore,
        collaborativeScore
      );

      if (hybridScore > 0 && confidence >= config.minConfidence) {
        recommendations.push({
          agentId: agent.id,
          score: hybridScore,
          reason: this.generateRecommendationReason(
            contentScore,
            collaborativeScore,
            popularityScore,
            projectRequirements
          ),
          confidence,
          metadata: agent
        });
      }
    }

    // Sort by score and limit results
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, config.maxRecommendations);
  }

  /**
   * Build comprehensive user profile from behavior data
   */
  private async buildUserProfile(userId: string): Promise<UserProfile> {
    const behaviors = await this.behaviorAnalyzer.getUserBehaviors(userId);
    const preferences = await this.behaviorAnalyzer.extractPreferences(behaviors);
    const behaviorVector = await this.behaviorAnalyzer.createBehaviorVector(behaviors);
    const similarUsers = await this.collaborativeFilter.findSimilarUsers(userId);

    return {
      id: userId,
      preferences,
      behaviorVector,
      similarUsers
    };
  }

  /**
   * Get project requirements from database
   */
  private async getProjectRequirements(projectId: string): Promise<ProjectRequirements | null> {
    try {
      const { data, error } = await this.supabase
        .from('project_requirements')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching project requirements:', error);
      return null;
    }
  }

  /**
   * Get all available agents with metadata
   */
  private async getAllAgents(): Promise<AgentMetadata[]> {
    try {
      const { data, error } = await this.supabase
        .from('agents')
        .select(`
          *,
          agent_ratings(rating),
          agent_usage(count)
        `);

      if (error) throw error;

      return data.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        tags: agent.tags || [],
        capabilities: agent.capabilities || [],
        complexity: agent.complexity || 1,
        rating: this.calculateAverageRating(agent.agent_ratings),
        usageCount: this.calculateUsageCount(agent.agent_usage),
        features: this.extractFeatures(agent)
      }));
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  /**
   * Predict recommendation score using ML model
   */
  private async predictWithML(
    userProfile: UserProfile,
    agent: AgentMetadata
  ): Promise<number> {
    if (!this.mlModel) return 0.5;

    try {
      // Combine user and agent features into input vector
      const inputFeatures = [
        ...userProfile.behaviorVector.slice(0, 25),
        ...Object.values(agent.features).slice(0, 25)
      ];

      // Ensure exactly 50 features
      while (inputFeatures.length < 50) {
        inputFeatures.push(0);
      }

      const prediction = this.mlModel.predict(
        tf.tensor2d([inputFeatures])
      ) as tf.Tensor;

      const score = await prediction.data();
      prediction.dispose();

      return score[0];
    } catch (error) {
      console.error('ML prediction error:', error);
      return 0.5;
    }
  }

  /**
   * Calculate popularity score based on usage and ratings
   */
  private calculatePopularityScore(agent: AgentMetadata): number {
    const normalizedUsage = Math.log(agent.usageCount + 1) / 10;
    const normalizedRating = agent.rating / 5;
    return (normalizedUsage + normalizedRating) / 2;
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateConfidence(
    userProfile: UserProfile,
    agent: AgentMetadata,
    contentScore: number,
    collaborativeScore: number
  ): number {
    const dataPoints = [
      userProfile.behaviorVector.filter(v => v > 0).length / userProfile.behaviorVector.length,
      userProfile.similarUsers.length / 10,
      agent.usageCount / 100,
      Math.min(contentScore, 1),
      Math.min(collaborativeScore, 1)
    ];

    return dataPoints.reduce((sum, point) => sum + point, 0) / dataPoints.length;
  }

  /**
   * Generate human-readable recommendation reason
   */
  private generateRecommendationReason(
    contentScore: number,
    collaborativeScore: number,
    popularityScore: number,
    projectRequirements: ProjectRequirements | null
  ): string {
    const reasons: string[] = [];

    if (contentScore > 0.7) {
      reasons.push('matches your interests and preferences');
    }

    if (collaborativeScore > 0.7) {
      reasons.push('highly rated by similar users');
    }

    if (popularityScore > 0.7) {
      reasons.push('popular and well-rated');
    }

    if (projectRequirements && contentScore > 0.5) {
      reasons.push('fits your project requirements');
    }

    return reasons.length > 0 
      ? `Recommended because it ${reasons.join(' and ')}`
      : 'Good match based on overall analysis';
  }

  /**
   * Calculate average rating from rating data
   */
  private calculateAverageRating(ratings: any[]): number {
    if (!ratings || ratings.length === 0) return 0;
    const sum = ratings.reduce((total, r) => total + (r.rating || 0), 0);
    return sum / ratings.length;
  }

  /**
   * Calculate total usage count
   */
  private calculateUsageCount(usage: any[]): number {
    if (!usage || usage.length === 0) return 0;
    return usage.reduce((total, u) => total + (u.count || 0), 0);
  }

  /**
   * Extract numerical features from agent metadata
   */
  private extractFeatures(agent: any): Record<string, number> {
    return {
      complexity: agent.complexity || 1,
      tagCount: (agent.tags || []).length,
      capabilityCount: (agent.capabilities || []).length,
      descriptionLength: (agent.description || '').length,
      nameLength: (agent.name || '').length
    };
  }

  /**
   * Record user interaction for future recommendations
   */
  async recordInteraction(behavior: UserBehavior): Promise<void> {
    try {
      await this.behaviorAnalyzer.recordBehavior(behavior);
      
      // Invalidate cache for this user
      const pattern = `recommendations:${behavior.userId}:*`;
      await this.cache.invalidatePattern(pattern);
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  }

  /**
   * Update recommendation model with new training data
   */
  async updateModel(trainingData: any[]): Promise<void> {
    if (!this.mlModel || trainingData.length === 0) return;

    try {
      const features = trainingData.map(d => d.features);
      const labels = trainingData.map(d => d.label);

      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels.map(l => [l]));

      await this.mlModel.fit(xs, ys, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.1
      });

      xs.dispose();
      ys.dispose();
    } catch (error) {
      console.error('Error updating model:', error);
    }
  }
}

/**
 * Analyzes user behavior patterns and preferences
 */
class UserBehaviorAnalyzer {
  constructor(private supabase: SupabaseClient) {}

  async getUserBehaviors(userId: string): Promise<UserBehavior[]> {
    const { data, error } = await this.supabase
      .from('user_behaviors')
      .select('*')
      .eq('userId', userId)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  }

  async extractPreferences(behaviors: UserBehavior[]): Promise<UserProfile['preferences']> {
    const categories: Record<string, number> = {};
    const capabilities: Record<string, number> = {};
    let totalComplexity = 0;
    let complexityCount = 0;

    for (const behavior of behaviors) {
      const weight = this.getInteractionWeight(behavior.interactionType);
      
      // Extract category preferences
      if (behavior.context) {
        const contextData = JSON.parse(behavior.context);
        if (contextData.category) {
          categories[contextData.category] = (categories[contextData.category] || 0) + weight;
        }
        if (contextData.capabilities) {
          for (const capability of contextData.capabilities) {
            capabilities[capability] = (capabilities[capability] || 0) + weight;
          }
        }
        if (contextData.complexity) {
          totalComplexity += contextData.complexity * weight;
          complexityCount += weight;
        }
      }
    }

    return {
      categories,
      capabilities,
      complexityLevel: complexityCount > 0 ? totalComplexity / complexityCount : 2,
      priceRange: [0, 1000] // Default range
    };
  }

  async createBehaviorVector(behaviors: UserBehavior[]): Promise<number[]> {
    const vector = new Array(50).fill(0);
    
    // Time-based features
    const now = new Date();
    let recentInteractions = 0;
    let totalDuration = 0;
    let avgRating = 0;
    let ratingCount = 0;

    for (const behavior of behaviors) {
      const daysSince = (now.getTime() - behavior.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.exp(-daysSince / 30); // Exponential decay

      recentInteractions += recencyWeight;
      
      if (behavior.duration) {
        totalDuration += behavior.duration * recencyWeight;
      }
      
      if (behavior.rating) {
        avgRating += behavior.rating * recencyWeight;
        ratingCount += recencyWeight;
      }
    }

    // Fill vector with computed features
    vector[0] = Math.min(recentInteractions / 10, 1);
    vector[1] = Math.min(totalDuration / 3600, 1);
    vector[2] = ratingCount > 0 ? avgRating / (ratingCount * 5) : 0;
    vector[3] = behaviors.length / 100;

    // Interaction type distribution
    const typeCount = { view: 0, use: 0, rate: 0, favorite: 0, share: 0 };
    behaviors.forEach(b => typeCount[b.interactionType]++);
    
    vector[4] = typeCount.view / behaviors.length;
    vector[5] = typeCount.use / behaviors.length;
    vector[6] = typeCount.rate / behaviors.length;
    vector[7] = typeCount.favorite / behaviors.length;
    vector[8] = typeCount.share / behaviors.length;

    return vector;
  }

  async recordBehavior(behavior: UserBehavior): Promise<void> {
    const { error } = await this.supabase
      .from('user_behaviors')
      .insert(behavior);

    if (error) throw error;
  }

  private getInteractionWeight(type: UserBehavior['interactionType']): number {
    const weights = {
      view: 1,
      use: 3,
      rate: 2,
      favorite: 4,
      share: 5
    };
    return weights[type];
  }
}

/**
 * Matches project requirements with agent capabilities
 */
class ProjectRequirementMatcher {
  calculateRequirementScore(
    requirements: ProjectRequirements,
    agent: AgentMetadata
  ): number {
    let score = 0;
    let maxScore = 0;

    // Category match
    if (requirements.preferredCategories.includes(agent.category)) {
      score += 0.3;
    }
    maxScore += 0.3;

    // Capability match
    const capabilityMatch = this.calculateCapabilityMatch(
      requirements.requiredCapabilities,
      agent.capabilities
    );
    score += capabilityMatch * 0.4;
    maxScore += 0.4;

    // Complexity match
    const complexityDiff = Math.abs(requirements.complexity - agent.complexity);
    const complexityScore = Math.max(0, 1 - complexityDiff / 5);
    score += complexityScore * 0.3;
    maxScore += 0.3;

    return maxScore > 0 ? score / maxScore : 0;
  }

  private calculateCapabilityMatch(required: string[], available: string[]): number {
    if (required.length === 0) return 1;
    
    const matches = required.filter(cap => 
      available.some(avail => 
        avail.toLowerCase().includes(cap.toLowerCase()) ||
        cap.toLowerCase().includes(avail.toLowerCase())
      )
    );
    
    return matches.length / required.length;
  }
}

/**
 * Collaborative filtering implementation
 */
class CollaborativeFilter {
  async calculateScore(
    userId: string,
    agentId: string,
    similarUsers: string[]
  ): Promise<number> {
    if (similarUsers.length === 0) return 0.5;

    // This would typically query a user-agent interaction matrix
    // For now, return a simulated score based on similar users
    return Math.random() * 0.5 + 0.25;
  }

  async findSimilarUsers(userId: string): Promise<string[]> {
    // This would implement user similarity calculation
    // For now, return empty array
    return [];
  }
}

/**
 * Content-based filtering implementation
 */
class ContentBasedFilter {
  calculateSimilarity(
    userProfile: UserProfile,
    agent: AgentMetadata,
    projectRequirements: ProjectRequirements | null
  ): number {
    let similarity = 0;
    let weights = 0;

    // Category preference similarity
    const categoryScore = userProfile.preferences.categories[agent.category] || 0;
    similarity += categoryScore * 0.3;
    weights += 0.3;

    // Capability preference similarity
    let capabilityScore = 0;
    for (const capability of agent.capabilities) {
      capabilityScore += userProfile.preferences.capabilities[capability] || 0;
    }
    capabilityScore = agent.capabilities.length > 0 ? capabilityScore / agent.capabilities.length : 0;
    similarity += capabilityScore * 0.4;
    weights += 0.4;

    // Complexity preference similarity
    const complexityDiff = Math.abs(userProfile.preferences.complexityLevel - agent.complexity);
    const complexityScore = Math.max(0, 1 - complexityDiff / 5);
    similarity += complexityScore * 0.3;
    weights += 0.3;

    return weights > 0 ? similarity / weights : 0;
  }
}

/**
 * Recommendation scoring and ranking
 */
class RecommendationScorer {
  constructor(private config: RecommendationConfig) {}

  calculateHybridScore(scores: {
    content