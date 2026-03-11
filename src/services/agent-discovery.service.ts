import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { Config } from '../config';

/**
 * Search filters for agent discovery
 */
interface AgentSearchFilters {
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: {
    min: number;
    max?: number;
  };
  features?: string[];
  languages?: string[];
  availability?: 'online' | 'offline' | 'both';
}

/**
 * User context for personalized recommendations
 */
interface UserContext {
  recentSearches?: string[];
  preferredCategories?: string[];
  budgetRange?: {
    min: number;
    max: number;
  };
  industryFocus?: string[];
  usagePatterns?: {
    frequency: 'low' | 'medium' | 'high';
    timeOfDay?: string[];
    sessionDuration?: number;
  };
}

/**
 * Agent data structure for indexing
 */
interface AgentData {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  category: string;
  subcategories?: string[];
  price: number;
  rating: number;
  features: string[];
  languages: string[];
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Search result with relevance scoring
 */
interface AgentSearchResult {
  agent: AgentData;
  relevanceScore: number;
  capabilityMatch: number;
  personalizedScore: number;
  reasons: string[];
}

/**
 * User interaction data for preference learning
 */
interface UserInteraction {
  userId: string;
  agentId: string;
  action: 'view' | 'click' | 'bookmark' | 'purchase' | 'rate';
  searchQuery?: string;
  timestamp: Date;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Recommendation result
 */
interface RecommendationResult {
  agents: AgentSearchResult[];
  reasoning: {
    personalizedFactors: string[];
    trendingFactors: string[];
    similarUserFactors: string[];
  };
  confidence: number;
}

/**
 * Vector embedding result
 */
interface VectorEmbedding {
  vector: number[];
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Advanced Agent Discovery Service
 * 
 * Provides intelligent search and recommendation capabilities using vector embeddings,
 * semantic search, and personalized matching algorithms for the AI agent marketplace.
 */
export class AgentDiscoveryService {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private redis: Redis;
  private logger: Logger;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string,
    redisUrl?: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.redis = new Redis(redisUrl || Config.redis.url);
    this.logger = new Logger('AgentDiscoveryService');
  }

  /**
   * Search for agents using semantic similarity and advanced filtering
   */
  async searchAgents(
    query: string,
    filters: AgentSearchFilters = {},
    userId?: string,
    limit: number = 20
  ): Promise<AgentSearchResult[]> {
    try {
      this.logger.info('Executing agent search', { query, filters, userId, limit });

      // Check cache first
      const cacheKey = this.generateCacheKey('search', query, filters, userId);
      const cachedResults = await this.getCachedResults(cacheKey);
      if (cachedResults) {
        this.logger.debug('Returning cached search results');
        return cachedResults;
      }

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Perform vector similarity search with filters
      const searchResults = await this.performVectorSearch(
        queryEmbedding,
        filters,
        limit * 2 // Get more results for better filtering
      );

      // Apply capability matching
      const capabilityMatched = await this.applyCapabilityMatching(
        searchResults,
        query,
        filters
      );

      // Apply personalization if user provided
      let personalizedResults = capabilityMatched;
      if (userId) {
        personalizedResults = await this.applyPersonalization(
          capabilityMatched,
          userId,
          query
        );
      }

      // Rank and optimize results
      const rankedResults = await this.rankResults(personalizedResults, query, userId);
      const optimizedResults = rankedResults.slice(0, limit);

      // Cache results
      await this.cacheResults(cacheKey, optimizedResults);

      // Track search for analytics
      await this.trackSearchEvent(query, filters, userId, optimizedResults.length);

      this.logger.info('Agent search completed', { 
        resultsCount: optimizedResults.length,
        query 
      });

      return optimizedResults;

    } catch (error) {
      this.logger.error('Error in agent search', { error, query, filters });
      throw new Error(`Agent search failed: ${error.message}`);
    }
  }

  /**
   * Get personalized agent recommendations for a user
   */
  async getRecommendations(
    userId: string,
    context: UserContext = {},
    limit: number = 10
  ): Promise<RecommendationResult> {
    try {
      this.logger.info('Generating personalized recommendations', { userId, context, limit });

      // Check cache
      const cacheKey = this.generateCacheKey('recommendations', userId, context);
      const cachedRecommendations = await this.getCachedResults(cacheKey);
      if (cachedRecommendations) {
        return cachedRecommendations;
      }

      // Get user preferences and interaction history
      const userProfile = await this.getUserProfile(userId);
      const interactionHistory = await this.getUserInteractionHistory(userId, 100);

      // Generate recommendation vectors based on user profile
      const recommendationVectors = await this.generateRecommendationVectors(
        userProfile,
        context,
        interactionHistory
      );

      // Find similar agents using multiple strategies
      const [
        personalizedAgents,
        trendingAgents,
        similarUserAgents
      ] = await Promise.all([
        this.findPersonalizedAgents(recommendationVectors, userProfile, limit),
        this.findTrendingAgents(userProfile, limit / 2),
        this.findSimilarUserAgents(userId, userProfile, limit / 2)
      ]);

      // Combine and deduplicate results
      const combinedAgents = this.combineRecommendations([
        personalizedAgents,
        trendingAgents,
        similarUserAgents
      ]);

      // Score and rank recommendations
      const rankedRecommendations = await this.rankRecommendations(
        combinedAgents,
        userProfile,
        context
      );

      const finalRecommendations = rankedRecommendations.slice(0, limit);

      // Generate reasoning
      const reasoning = this.generateRecommendationReasoning(
        finalRecommendations,
        userProfile,
        context
      );

      const result: RecommendationResult = {
        agents: finalRecommendations,
        reasoning,
        confidence: this.calculateRecommendationConfidence(finalRecommendations, userProfile)
      };

      // Cache recommendations
      await this.cacheResults(cacheKey, result, 300); // 5 minute cache

      this.logger.info('Recommendations generated', { 
        userId,
        count: finalRecommendations.length,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      this.logger.error('Error generating recommendations', { error, userId });
      throw new Error(`Recommendation generation failed: ${error.message}`);
    }
  }

  /**
   * Index an agent for discovery with vector embeddings
   */
  async indexAgent(agentData: AgentData): Promise<void> {
    try {
      this.logger.info('Indexing agent for discovery', { agentId: agentData.id });

      // Generate embeddings for searchable content
      const searchableText = this.createSearchableText(agentData);
      const embedding = await this.generateEmbedding(searchableText);

      // Prepare agent data for storage
      const agentRecord = {
        id: agentData.id,
        name: agentData.name,
        description: agentData.description,
        capabilities: agentData.capabilities,
        category: agentData.category,
        subcategories: agentData.subcategories || [],
        price: agentData.price,
        rating: agentData.rating,
        features: agentData.features,
        languages: agentData.languages,
        tags: agentData.tags,
        metadata: agentData.metadata,
        embedding: embedding.vector,
        searchable_text: searchableText,
        created_at: agentData.createdAt,
        updated_at: agentData.updatedAt,
        indexed_at: new Date()
      };

      // Store in Supabase with vector index
      const { error } = await this.supabase
        .from('agent_embeddings')
        .upsert(agentRecord);

      if (error) {
        throw new Error(`Failed to store agent embedding: ${error.message}`);
      }

      // Update search cache invalidation
      await this.invalidateSearchCache(agentData.category);

      this.logger.info('Agent successfully indexed', { agentId: agentData.id });

    } catch (error) {
      this.logger.error('Error indexing agent', { error, agentId: agentData.id });
      throw new Error(`Agent indexing failed: ${error.message}`);
    }
  }

  /**
   * Update user preferences based on interactions
   */
  async updateUserPreferences(
    userId: string,
    interactions: UserInteraction[]
  ): Promise<void> {
    try {
      this.logger.info('Updating user preferences', { userId, interactionCount: interactions.length });

      // Store interactions
      await this.storeUserInteractions(interactions);

      // Analyze interaction patterns
      const preferenceUpdates = await this.analyzeInteractionPatterns(userId, interactions);

      // Update user profile
      await this.updateUserProfile(userId, preferenceUpdates);

      // Invalidate recommendation cache
      await this.invalidateUserCache(userId);

      this.logger.info('User preferences updated', { userId });

    } catch (error) {
      this.logger.error('Error updating user preferences', { error, userId });
      throw new Error(`Preference update failed: ${error.message}`);
    }
  }

  /**
   * Generate text embedding using OpenAI
   */
  private async generateEmbedding(text: string): Promise<VectorEmbedding> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      });

      return {
        vector: response.data[0].embedding,
        text,
        metadata: {
          model: 'text-embedding-3-small',
          tokens: response.usage?.total_tokens
        }
      };

    } catch (error) {
      this.logger.error('Error generating embedding', { error, text: text.substring(0, 100) });
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Perform vector similarity search using pgvector
   */
  private async performVectorSearch(
    queryEmbedding: VectorEmbedding,
    filters: AgentSearchFilters,
    limit: number
  ): Promise<AgentData[]> {
    try {
      let query = this.supabase
        .from('agent_embeddings')
        .select('*')
        .order('embedding <-> $1', { ascending: true })
        .limit(limit);

      // Apply filters
      if (filters.categories?.length) {
        query = query.in('category', filters.categories);
      }

      if (filters.priceRange) {
        query = query.gte('price', filters.priceRange.min);
        if (filters.priceRange.max) {
          query = query.lte('price', filters.priceRange.max);
        }
      }

      if (filters.rating?.min) {
        query = query.gte('rating', filters.rating.min);
      }

      if (filters.features?.length) {
        query = query.overlaps('features', filters.features);
      }

      if (filters.languages?.length) {
        query = query.overlaps('languages', filters.languages);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Vector search failed: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      this.logger.error('Error in vector search', { error });
      throw error;
    }
  }

  /**
   * Apply capability matching to search results
   */
  private async applyCapabilityMatching(
    searchResults: AgentData[],
    query: string,
    filters: AgentSearchFilters
  ): Promise<AgentSearchResult[]> {
    try {
      const results: AgentSearchResult[] = [];

      for (const agent of searchResults) {
        const capabilityMatch = await this.calculateCapabilityMatch(agent, query, filters);
        
        results.push({
          agent,
          relevanceScore: 0, // Will be calculated in ranking
          capabilityMatch,
          personalizedScore: 0, // Will be calculated in personalization
          reasons: this.generateMatchReasons(agent, query, capabilityMatch)
        });
      }

      return results;

    } catch (error) {
      this.logger.error('Error in capability matching', { error });
      throw error;
    }
  }

  /**
   * Apply personalization scoring to search results
   */
  private async applyPersonalization(
    results: AgentSearchResult[],
    userId: string,
    query: string
  ): Promise<AgentSearchResult[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const interactionHistory = await this.getUserInteractionHistory(userId, 50);

      for (const result of results) {
        result.personalizedScore = await this.calculatePersonalizedScore(
          result.agent,
          userProfile,
          interactionHistory,
          query
        );
      }

      return results;

    } catch (error) {
      this.logger.error('Error in personalization', { error, userId });
      return results; // Return unpersonalized results on error
    }
  }

  /**
   * Rank search results using combined scoring algorithm
   */
  private async rankResults(
    results: AgentSearchResult[],
    query: string,
    userId?: string
  ): Promise<AgentSearchResult[]> {
    try {
      // Calculate relevance scores
      for (const result of results) {
        result.relevanceScore = await this.calculateRelevanceScore(result.agent, query);
      }

      // Sort by combined score
      return results.sort((a, b) => {
        const scoreA = this.calculateCombinedScore(a);
        const scoreB = this.calculateCombinedScore(b);
        return scoreB - scoreA;
      });

    } catch (error) {
      this.logger.error('Error ranking results', { error });
      return results; // Return unranked results on error
    }
  }

  /**
   * Calculate combined relevance score
   */
  private calculateCombinedScore(result: AgentSearchResult): number {
    const weights = {
      relevance: 0.4,
      capability: 0.3,
      personalized: 0.2,
      quality: 0.1
    };

    const qualityScore = result.agent.rating / 5.0; // Normalize to 0-1

    return (
      result.relevanceScore * weights.relevance +
      result.capabilityMatch * weights.capability +
      result.personalizedScore * weights.personalized +
      qualityScore * weights.quality
    );
  }

  /**
   * Create searchable text from agent data
   */
  private createSearchableText(agentData: AgentData): string {
    return [
      agentData.name,
      agentData.description,
      agentData.capabilities.join(' '),
      agentData.category,
      ...(agentData.subcategories || []),
      agentData.features.join(' '),
      agentData.tags.join(' ')
    ].join(' ');
  }

  /**
   * Calculate capability match score
   */
  private async calculateCapabilityMatch(
    agent: AgentData,
    query: string,
    filters: AgentSearchFilters
  ): Promise<number> {
    // Simple keyword matching for now - could be enhanced with NLP
    const queryLower = query.toLowerCase();
    const agentText = this.createSearchableText(agent).toLowerCase();
    
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const matches = queryWords.filter(word => agentText.includes(word));
    
    return queryWords.length > 0 ? matches.length / queryWords.length : 0;
  }

  /**
   * Calculate relevance score based on query match
   */
  private async calculateRelevanceScore(agent: AgentData, query: string): Promise<number> {
    // Enhanced relevance calculation
    const queryLower = query.toLowerCase();
    const nameMatch = agent.name.toLowerCase().includes(queryLower) ? 1.0 : 0.0;
    const descriptionMatch = agent.description.toLowerCase().includes(queryLower) ? 0.7 : 0.0;
    const capabilityMatch = agent.capabilities.some(cap => 
      cap.toLowerCase().includes(queryLower)
    ) ? 0.8 : 0.0;

    return Math.max(nameMatch, descriptionMatch, capabilityMatch);
  }

  /**
   * Generate match reasons for transparency
   */
  private generateMatchReasons(
    agent: AgentData,
    query: string,
    capabilityMatch: number
  ): string[] {
    const reasons: string[] = [];

    if (capabilityMatch > 0.7) {
      reasons.push('Strong capability match');
    }

    if (agent.rating >= 4.5) {
      reasons.push('Highly rated agent');
    }

    if (agent.capabilities.length > 5) {
      reasons.push('Versatile capabilities');
    }

    return reasons;
  }

  /**
   * Generate cache key for results
   */
  private generateCacheKey(type: string, ...params: any[]): string {
    const key = `agent_discovery:${type}:${JSON.stringify(params)}`;
    return Buffer.from(key).toString('base64').substring(0, 200);
  }

  /**
   * Cache search results
   */
  private async cacheResults(key: string, results: any, ttl: number = 600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(results));
    } catch (error) {
      this.logger.warn('Failed to cache results', { error, key });
    }
  }

  /**
   * Get cached results
   */
  private async getCachedResults(key: string): Promise<any> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn('Failed to get cached results', { error, key });
      return null;
    }
  }

  /**
   * Get user profile for personalization
   */
  private async getUserProfile(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error;
      }

      return data || { user_id: userId, preferences: {} };

    } catch (error) {
      this.logger.warn('Error getting user profile', { error, userId });
      return { user_id: userId, preferences: {} };
    }
  }

  /**
   * Get user interaction history
   */
  private async getUserInteractionHistory(
    userId: string,
    limit: number = 100
  ): Promise<UserInteraction[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_interactions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      this.logger.warn('Error getting user interaction history', { error, userId });
      return [];
    }
  }

  /**
   * Store user interactions
   */
  private async storeUserInteractions(interactions: UserInteraction[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_interactions')
        .insert(interactions);

      if (error) {
        throw error;
      }

    } catch (error) {
      this.logger.error('Error storing user interactions', { error });
      throw error;
    }
  }

  /**
   * Track search event for analytics
   */
  private async trackSearchEvent(
    query: string,
    filters: AgentSearchFilters,
    userId?: string,
    resultCount: number = 0
  ): Promise<void> {
    try {
      const event = {
        event_type: 'agent_search',
        user_id: userId,
        query,
        filters,
        result_count: resultCount,
        timestamp: new Date()
      };

      await this.supabase
        .from('search_analytics')
        .insert(event);

    } catch (error) {
      this.logger.warn('Failed to track search event', { error, query });
    }
  }

  /**
   * Invalidate search cache for category
   */
  private async invalidateSearchCache(category: string): Promise<void> {
    try {
      const pattern = `agent_discovery:search:*${category}*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

    } catch (error) {
      this.logger.warn('Failed to invalidate search cache', { error, category });
    }
  }

  /**
   * Invalidate user-specific cache
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      const patterns = [
        `agent_discovery:recommendations:*${userId}*`,
        `agent_discovery: