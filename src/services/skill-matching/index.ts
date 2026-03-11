```typescript
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { MLEngine } from './ml-engine';
import { MatchingAlgorithms } from './matching-algorithms';
import { SkillVectorStore } from './skill-vector-store';
import { RecommendationEngine } from './recommendation-engine';
import type {
  UserSkillProfile,
  MatchRequest,
  MatchResult,
  MatchingConfig,
  SkillMatchingError,
  MatchFeedback,
  RealtimeMatchEvent
} from './types';

/**
 * Skill-Based User Matching Service
 * 
 * ML-powered microservice that connects community members based on:
 * - Complementary skills and expertise levels
 * - Shared interests and project goals
 * - Collaborative potential and compatibility scores
 * 
 * Features:
 * - Real-time semantic skill matching using vector embeddings
 * - Collaborative filtering for enhanced recommendations
 * - Adaptive learning from user feedback and interaction patterns
 * - Multi-dimensional compatibility scoring (technical, cultural, availability)
 */
export class SkillMatchingService {
  private supabase: ReturnType<typeof createClient>;
  private openai: OpenAI;
  private redis: Redis;
  private mlEngine: MLEngine;
  private matchingAlgorithms: MatchingAlgorithms;
  private vectorStore: SkillVectorStore;
  private recommendationEngine: RecommendationEngine;
  private config: MatchingConfig;

  constructor(config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    openaiApiKey: string;
    redisUrl: string;
    matchingConfig?: Partial<MatchingConfig>;
  }) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.redis = new Redis(config.redisUrl);
    
    this.config = {
      maxMatches: 10,
      minConfidenceScore: 0.6,
      skillWeightDecay: 0.8,
      interestWeight: 0.3,
      availabilityWeight: 0.2,
      cacheExpiry: 3600,
      realtimeEnabled: true,
      ...config.matchingConfig
    };

    this.mlEngine = new MLEngine(this.openai, this.config);
    this.vectorStore = new SkillVectorStore(this.supabase, this.redis);
    this.matchingAlgorithms = new MatchingAlgorithms(this.vectorStore, this.config);
    this.recommendationEngine = new RecommendationEngine(
      this.mlEngine,
      this.matchingAlgorithms,
      this.config
    );
  }

  /**
   * Initialize the skill matching service
   * Sets up vector databases, ML models, and real-time subscriptions
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.vectorStore.initialize(),
        this.mlEngine.loadModels(),
        this.setupRealtimeSubscriptions()
      ]);

      console.log('✅ Skill Matching Service initialized successfully');
    } catch (error) {
      throw this.createError('SERVICE_INITIALIZATION_FAILED', 'Failed to initialize skill matching service', error);
    }
  }

  /**
   * Create or update a user's skill profile
   * Generates skill embeddings and stores in vector database
   */
  async createSkillProfile(userId: string, profile: Omit<UserSkillProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<UserSkillProfile> {
    try {
      // Generate skill embeddings using OpenAI
      const skillEmbeddings = await this.mlEngine.generateSkillEmbeddings(profile.skills);
      const interestEmbeddings = await this.mlEngine.generateInterestEmbeddings(profile.interests);

      const skillProfile: UserSkillProfile = {
        id: crypto.randomUUID(),
        userId,
        ...profile,
        skillEmbeddings,
        interestEmbeddings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store in database and vector store
      await Promise.all([
        this.supabase
          .from('user_skill_profiles')
          .upsert(skillProfile, { onConflict: 'user_id' }),
        this.vectorStore.storeSkillProfile(skillProfile)
      ]);

      // Clear user's cached matches
      await this.redis.del(`matches:${userId}`);

      // Trigger real-time matching for active users
      if (this.config.realtimeEnabled) {
        await this.triggerRealtimeMatching(userId);
      }

      return skillProfile;
    } catch (error) {
      throw this.createError('SKILL_PROFILE_CREATION_FAILED', 'Failed to create skill profile', error);
    }
  }

  /**
   * Find matching users based on skill complementarity and interests
   * Uses hybrid approach: semantic similarity + collaborative filtering
   */
  async findMatches(request: MatchRequest): Promise<MatchResult[]> {
    try {
      // Check cache first
      const cacheKey = `matches:${request.userId}:${JSON.stringify(request.filters)}`;
      const cachedMatches = await this.redis.get(cacheKey);
      
      if (cachedMatches && !request.forceRefresh) {
        return JSON.parse(cachedMatches);
      }

      // Get user's skill profile
      const userProfile = await this.getUserSkillProfile(request.userId);
      if (!userProfile) {
        throw this.createError('USER_PROFILE_NOT_FOUND', 'User skill profile not found');
      }

      // Generate candidate matches using multiple algorithms
      const [
        semanticMatches,
        collaborativeMatches,
        complementaryMatches
      ] = await Promise.all([
        this.matchingAlgorithms.findSemanticMatches(userProfile, request),
        this.matchingAlgorithms.findCollaborativeMatches(userProfile, request),
        this.matchingAlgorithms.findComplementarySkillMatches(userProfile, request)
      ]);

      // Combine and rank matches using ML ensemble
      const combinedMatches = await this.recommendationEngine.combineAndRankMatches(
        userProfile,
        [semanticMatches, collaborativeMatches, complementaryMatches],
        request
      );

      // Filter by confidence threshold and apply business rules
      const filteredMatches = combinedMatches
        .filter(match => match.confidenceScore >= this.config.minConfidenceScore)
        .slice(0, request.maxResults || this.config.maxMatches);

      // Enhance matches with additional metadata
      const enhancedMatches = await this.enhanceMatchResults(filteredMatches, userProfile);

      // Cache results
      await this.redis.setex(cacheKey, this.config.cacheExpiry, JSON.stringify(enhancedMatches));

      // Track analytics
      await this.trackMatchingEvent('MATCHES_GENERATED', {
        userId: request.userId,
        matchCount: enhancedMatches.length,
        algorithms: ['semantic', 'collaborative', 'complementary']
      });

      return enhancedMatches;
    } catch (error) {
      throw this.createError('MATCH_GENERATION_FAILED', 'Failed to generate matches', error);
    }
  }

  /**
   * Get detailed match explanation and compatibility analysis
   */
  async getMatchDetails(userId: string, targetUserId: string): Promise<{
    compatibilityAnalysis: any;
    skillGaps: string[];
    collaborationPotential: number;
    recommendedProjects: string[];
  }> {
    try {
      const [userProfile, targetProfile] = await Promise.all([
        this.getUserSkillProfile(userId),
        this.getUserSkillProfile(targetUserId)
      ]);

      if (!userProfile || !targetProfile) {
        throw this.createError('PROFILE_NOT_FOUND', 'One or both user profiles not found');
      }

      return await this.recommendationEngine.generateCompatibilityAnalysis(
        userProfile,
        targetProfile
      );
    } catch (error) {
      throw this.createError('MATCH_DETAILS_FAILED', 'Failed to get match details', error);
    }
  }

  /**
   * Submit feedback on a match to improve ML algorithms
   */
  async submitMatchFeedback(feedback: MatchFeedback): Promise<void> {
    try {
      // Store feedback in database
      await this.supabase
        .from('match_feedback')
        .insert({
          ...feedback,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        });

      // Update ML model with feedback
      await this.mlEngine.updateFromFeedback(feedback);

      // Clear affected user caches
      await Promise.all([
        this.redis.del(`matches:${feedback.userId}`),
        this.redis.del(`matches:${feedback.targetUserId}`)
      ]);

      // Track feedback analytics
      await this.trackMatchingEvent('FEEDBACK_SUBMITTED', {
        userId: feedback.userId,
        targetUserId: feedback.targetUserId,
        rating: feedback.rating,
        feedbackType: feedback.type
      });
    } catch (error) {
      throw this.createError('FEEDBACK_SUBMISSION_FAILED', 'Failed to submit match feedback', error);
    }
  }

  /**
   * Get matching statistics and insights for a user
   */
  async getMatchingInsights(userId: string): Promise<{
    totalMatches: number;
    averageConfidence: number;
    topSkillMatches: string[];
    improvementSuggestions: string[];
    matchingTrends: any[];
  }> {
    try {
      const cacheKey = `insights:${userId}`;
      const cachedInsights = await this.redis.get(cacheKey);
      
      if (cachedInsights) {
        return JSON.parse(cachedInsights);
      }

      const insights = await this.recommendationEngine.generateUserInsights(userId);
      
      // Cache insights for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(insights));
      
      return insights;
    } catch (error) {
      throw this.createError('INSIGHTS_GENERATION_FAILED', 'Failed to generate matching insights', error);
    }
  }

  /**
   * Set up real-time matching subscriptions for immediate notifications
   */
  private async setupRealtimeSubscriptions(): Promise<void> {
    if (!this.config.realtimeEnabled) return;

    // Subscribe to skill profile changes
    this.supabase
      .channel('skill-profile-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_skill_profiles' 
        },
        async (payload) => {
          await this.handleSkillProfileChange(payload);
        }
      )
      .subscribe();

    // Subscribe to user presence changes
    this.supabase
      .channel('user-presence')
      .on('presence', { event: 'sync' }, async () => {
        await this.handlePresenceSync();
      })
      .subscribe();
  }

  /**
   * Handle skill profile changes for real-time matching
   */
  private async handleSkillProfileChange(payload: any): Promise<void> {
    try {
      const userId = payload.new?.user_id || payload.old?.user_id;
      if (!userId) return;

      // Clear user's cached matches
      await this.redis.del(`matches:${userId}`);

      // Trigger new matches for recently active users
      await this.triggerRealtimeMatching(userId);
    } catch (error) {
      console.error('Error handling skill profile change:', error);
    }
  }

  /**
   * Handle user presence changes
   */
  private async handlePresenceSync(): Promise<void> {
    try {
      // Implementation for handling user presence changes
      // This could trigger matching for newly online users
    } catch (error) {
      console.error('Error handling presence sync:', error);
    }
  }

  /**
   * Trigger real-time matching for active users
   */
  private async triggerRealtimeMatching(userId: string): Promise<void> {
    try {
      // Check if user is currently active
      const isActive = await this.redis.get(`user:active:${userId}`);
      if (!isActive) return;

      // Generate fresh matches
      const matches = await this.findMatches({ 
        userId, 
        maxResults: 5,
        forceRefresh: true 
      });

      // Send real-time notification if matches found
      if (matches.length > 0) {
        const event: RealtimeMatchEvent = {
          type: 'NEW_MATCHES',
          userId,
          matches: matches.slice(0, 3), // Send top 3 matches
          timestamp: new Date().toISOString()
        };

        await this.supabase
          .channel(`user:${userId}`)
          .send({
            type: 'broadcast',
            event: 'new_matches',
            payload: event
          });
      }
    } catch (error) {
      console.error('Error triggering real-time matching:', error);
    }
  }

  /**
   * Get user skill profile from database
   */
  private async getUserSkillProfile(userId: string): Promise<UserSkillProfile | null> {
    const { data, error } = await this.supabase
      .from('user_skill_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data as UserSkillProfile;
  }

  /**
   * Enhance match results with additional metadata
   */
  private async enhanceMatchResults(
    matches: MatchResult[], 
    userProfile: UserSkillProfile
  ): Promise<MatchResult[]> {
    return Promise.all(
      matches.map(async (match) => {
        // Add real-time availability status
        const isOnline = await this.redis.get(`user:active:${match.targetUserId}`);
        
        // Calculate project compatibility
        const projectCompatibility = await this.calculateProjectCompatibility(
          userProfile,
          match.targetUserId
        );

        return {
          ...match,
          isOnline: Boolean(isOnline),
          projectCompatibility,
          lastActive: await this.redis.get(`user:last_active:${match.targetUserId}`)
        };
      })
    );
  }

  /**
   * Calculate project compatibility between users
   */
  private async calculateProjectCompatibility(
    userProfile: UserSkillProfile,
    targetUserId: string
  ): Promise<number> {
    // Implementation for calculating project compatibility
    // This could analyze past projects, preferences, etc.
    return 0.8; // Placeholder
  }

  /**
   * Track matching events for analytics
   */
  private async trackMatchingEvent(event: string, data: any): Promise<void> {
    try {
      // Store analytics event
      await this.supabase
        .from('matching_analytics')
        .insert({
          event,
          data,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      // Don't throw for analytics failures
      console.error('Analytics tracking failed:', error);
    }
  }

  /**
   * Create standardized error objects
   */
  private createError(
    code: string, 
    message: string, 
    originalError?: any
  ): SkillMatchingError {
    return {
      code,
      message,
      originalError: originalError?.message || originalError,
      timestamp: new Date().toISOString(),
      service: 'SkillMatchingService'
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.redis.disconnect(),
        this.supabase.removeAllChannels()
      ]);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

/**
 * Factory function to create skill matching service instance
 */
export function createSkillMatchingService(config: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  openaiApiKey: string;
  redisUrl: string;
  matchingConfig?: Partial<MatchingConfig>;
}): SkillMatchingService {
  return new SkillMatchingService(config);
}

/**
 * Default export
 */
export default SkillMatchingService;

/**
 * Re-export types for external usage
 */
export type {
  UserSkillProfile,
  MatchRequest,
  MatchResult,
  MatchingConfig,
  SkillMatchingError,
  MatchFeedback,
  RealtimeMatchEvent
} from './types';
```