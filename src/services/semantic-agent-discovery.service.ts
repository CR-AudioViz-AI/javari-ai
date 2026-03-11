```typescript
import { createClient } from '@supabase/supabase-js';
import { Configuration, OpenAIApi } from 'openai';
import { Agent, AgentCapability, SearchQuery, SearchResult, UserProfile } from '../types';
import { CacheService } from './cache.service';
import { AnalyticsService } from './analytics.service';
import { RateLimitService } from './rate-limit.service';
import { Logger } from '../utils/logger';

/**
 * Interface for semantic search configuration
 */
export interface SemanticSearchConfig {
  openaiApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  vectorDimensions: number;
  similarityThreshold: number;
  maxResults: number;
  cacheTtl: number;
}

/**
 * Interface for search query parameters
 */
export interface SearchQueryParams {
  query: string;
  userId?: string;
  capabilities?: string[];
  tags?: string[];
  maxResults?: number;
  minSimilarity?: number;
  includeInactive?: boolean;
}

/**
 * Interface for agent search result with scoring
 */
export interface AgentSearchResult {
  agent: Agent;
  similarity: number;
  capabilityMatch: number;
  contextualScore: number;
  finalScore: number;
  matchedCapabilities: string[];
  reasoning: string;
}

/**
 * Interface for search analytics data
 */
export interface SearchAnalytics {
  queryId: string;
  userId?: string;
  query: string;
  resultsCount: number;
  executionTime: number;
  similarityScores: number[];
  clickThroughRate?: number;
  timestamp: Date;
}

/**
 * Interface for agent capability metadata
 */
export interface AgentMetadata {
  agentId: string;
  capabilities: AgentCapability[];
  description: string;
  tags: string[];
  embedding: number[];
  lastUpdated: Date;
}

/**
 * Advanced semantic search service for AI agent discovery
 * Uses vector embeddings and contextual analysis for intelligent agent matching
 */
export class SemanticAgentDiscoveryService {
  private readonly supabase: any;
  private readonly openai: OpenAIApi;
  private readonly config: SemanticSearchConfig;
  private readonly logger: Logger;

  constructor(
    config: SemanticSearchConfig,
    private readonly cacheService: CacheService,
    private readonly analyticsService: AnalyticsService,
    private readonly rateLimitService: RateLimitService
  ) {
    this.config = config;
    this.logger = new Logger('SemanticAgentDiscoveryService');
    
    // Initialize Supabase client
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    
    // Initialize OpenAI client
    const openaiConfig = new Configuration({
      apiKey: config.openaiApiKey,
    });
    this.openai = new OpenAIApi(openaiConfig);
  }

  /**
   * Performs semantic search for agents based on natural language query
   */
  async searchAgents(params: SearchQueryParams): Promise<AgentSearchResult[]> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();

    try {
      // Rate limiting check
      if (params.userId) {
        await this.rateLimitService.checkLimit(`semantic_search:${params.userId}`, 100, 3600);
      }

      // Process natural language query
      const processedQuery = await this.processNaturalLanguageQuery(params.query);
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(processedQuery.enhancedQuery);
      
      // Perform vector similarity search
      const similarAgents = await this.vectorSimilaritySearch(
        queryEmbedding,
        params.maxResults || this.config.maxResults,
        params.minSimilarity || this.config.similarityThreshold
      );

      // Apply capability filtering
      const capabilityFiltered = await this.filterByCapabilities(
        similarAgents,
        params.capabilities,
        processedQuery.extractedCapabilities
      );

      // Apply contextual scoring
      const contextualResults = await this.applyContextualScoring(
        capabilityFiltered,
        params.userId,
        processedQuery
      );

      // Rank and filter results
      const rankedResults = await this.rankSearchResults(contextualResults, params);

      // Track analytics
      const executionTime = Date.now() - startTime;
      await this.trackSearchAnalytics({
        queryId,
        userId: params.userId,
        query: params.query,
        resultsCount: rankedResults.length,
        executionTime,
        similarityScores: rankedResults.map(r => r.similarity),
        timestamp: new Date()
      });

      this.logger.info('Semantic search completed', {
        queryId,
        resultsCount: rankedResults.length,
        executionTime
      });

      return rankedResults;
    } catch (error) {
      this.logger.error('Semantic search failed', { queryId, error });
      throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Processes natural language query to extract intent and capabilities
   */
  private async processNaturalLanguageQuery(query: string): Promise<{
    enhancedQuery: string;
    extractedCapabilities: string[];
    intent: string;
    entities: string[];
  }> {
    const cacheKey = `nlp_query:${Buffer.from(query).toString('base64')}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const prompt = `
        Analyze this search query for AI agent discovery:
        "${query}"
        
        Extract:
        1. Enhanced query (expanded with synonyms and technical terms)
        2. Specific capabilities mentioned
        3. User intent (find, compare, recommend, etc.)
        4. Named entities (technologies, domains, etc.)
        
        Return JSON format.
      `;

      const response = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.data.choices[0]?.message?.content || '{}');
      
      const result = {
        enhancedQuery: analysis.enhancedQuery || query,
        extractedCapabilities: analysis.capabilities || [],
        intent: analysis.intent || 'find',
        entities: analysis.entities || []
      };

      await this.cacheService.set(cacheKey, result, this.config.cacheTtl);
      return result;
    } catch (error) {
      this.logger.warn('NLP processing failed, using original query', { error });
      return {
        enhancedQuery: query,
        extractedCapabilities: [],
        intent: 'find',
        entities: []
      };
    }
  }

  /**
   * Generates embedding vector for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${Buffer.from(text).toString('base64')}`;
    const cached = await this.cacheService.get<number[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: text
      });

      const embedding = response.data.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI');
      }

      await this.cacheService.set(cacheKey, embedding, this.config.cacheTtl * 24); // Cache embeddings longer
      return embedding;
    } catch (error) {
      this.logger.error('Embedding generation failed', { error, text: text.substring(0, 100) });
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Performs vector similarity search using Supabase pgvector
   */
  private async vectorSimilaritySearch(
    queryEmbedding: number[],
    maxResults: number,
    minSimilarity: number
  ): Promise<{ agent: Agent; similarity: number }[]> {
    try {
      const { data, error } = await this.supabase.rpc('search_agents_by_similarity', {
        query_embedding: queryEmbedding,
        similarity_threshold: minSimilarity,
        match_count: maxResults
      });

      if (error) {
        throw new Error(`Supabase vector search error: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error('Vector similarity search failed', { error });
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filters results based on capability matching
   */
  private async filterByCapabilities(
    results: { agent: Agent; similarity: number }[],
    requestedCapabilities?: string[],
    extractedCapabilities: string[] = []
  ): Promise<{ agent: Agent; similarity: number; capabilityMatch: number }[]> {
    const allCapabilities = [...(requestedCapabilities || []), ...extractedCapabilities];
    
    if (allCapabilities.length === 0) {
      return results.map(r => ({ ...r, capabilityMatch: 0.5 }));
    }

    return results.map(result => {
      const agentCapabilities = result.agent.capabilities?.map(cap => cap.name.toLowerCase()) || [];
      const requestedCapsLower = allCapabilities.map(cap => cap.toLowerCase());
      
      const matches = requestedCapsLower.filter(cap => 
        agentCapabilities.some(agentCap => 
          agentCap.includes(cap) || cap.includes(agentCap)
        )
      );

      const capabilityMatch = matches.length / Math.max(requestedCapsLower.length, 1);
      
      return {
        ...result,
        capabilityMatch
      };
    });
  }

  /**
   * Applies contextual scoring based on user profile and behavior
   */
  private async applyContextualScoring(
    results: { agent: Agent; similarity: number; capabilityMatch: number }[],
    userId?: string,
    queryContext?: any
  ): Promise<{ agent: Agent; similarity: number; capabilityMatch: number; contextualScore: number }[]> {
    if (!userId) {
      return results.map(r => ({ ...r, contextualScore: 0.5 }));
    }

    try {
      // Get user profile and interaction history
      const userProfile = await this.getUserProfile(userId);
      const interactionHistory = await this.getUserAgentInteractions(userId);

      return results.map(result => {
        let contextualScore = 0.5;

        // User preference alignment
        if (userProfile?.preferences?.domains) {
          const domainMatch = userProfile.preferences.domains.some(domain =>
            result.agent.tags?.includes(domain) || 
            result.agent.description?.toLowerCase().includes(domain.toLowerCase())
          );
          if (domainMatch) contextualScore += 0.2;
        }

        // Previous interaction success
        const pastInteraction = interactionHistory.find(h => h.agentId === result.agent.id);
        if (pastInteraction) {
          contextualScore += (pastInteraction.rating - 3) * 0.1; // Scale rating to -0.2 to +0.2
        }

        // Query context alignment
        if (queryContext?.intent === 'recommend' && result.agent.metadata?.recommended) {
          contextualScore += 0.15;
        }

        return {
          ...result,
          contextualScore: Math.max(0, Math.min(1, contextualScore))
        };
      });
    } catch (error) {
      this.logger.warn('Contextual scoring failed', { error, userId });
      return results.map(r => ({ ...r, contextualScore: 0.5 }));
    }
  }

  /**
   * Ranks search results using multi-factor scoring
   */
  private async rankSearchResults(
    results: { agent: Agent; similarity: number; capabilityMatch: number; contextualScore: number }[],
    params: SearchQueryParams
  ): Promise<AgentSearchResult[]> {
    const rankedResults = results.map(result => {
      // Multi-factor scoring weights
      const weights = {
        similarity: 0.4,
        capability: 0.35,
        contextual: 0.25
      };

      const finalScore = 
        (result.similarity * weights.similarity) +
        (result.capabilityMatch * weights.capability) +
        (result.contextualScore * weights.contextual);

      // Generate reasoning
      const reasoning = this.generateSearchReasoning(result, finalScore);

      // Find matched capabilities
      const matchedCapabilities = this.findMatchedCapabilities(
        result.agent,
        params.capabilities || []
      );

      return {
        agent: result.agent,
        similarity: result.similarity,
        capabilityMatch: result.capabilityMatch,
        contextualScore: result.contextualScore,
        finalScore,
        matchedCapabilities,
        reasoning
      };
    });

    // Sort by final score (descending)
    rankedResults.sort((a, b) => b.finalScore - a.finalScore);

    // Apply additional filters
    return this.applyFinalFilters(rankedResults, params);
  }

  /**
   * Generates human-readable reasoning for search result ranking
   */
  private generateSearchReasoning(
    result: { agent: Agent; similarity: number; capabilityMatch: number; contextualScore: number },
    finalScore: number
  ): string {
    const reasons = [];

    if (result.similarity > 0.8) {
      reasons.push('High semantic similarity to query');
    } else if (result.similarity > 0.6) {
      reasons.push('Good semantic match');
    }

    if (result.capabilityMatch > 0.7) {
      reasons.push('Strong capability alignment');
    } else if (result.capabilityMatch > 0.4) {
      reasons.push('Partial capability match');
    }

    if (result.contextualScore > 0.6) {
      reasons.push('Matches user preferences');
    }

    if (finalScore > 0.8) {
      reasons.push('Highly recommended');
    }

    return reasons.join(', ') || 'Basic relevance match';
  }

  /**
   * Finds capabilities that match the search criteria
   */
  private findMatchedCapabilities(agent: Agent, requestedCapabilities: string[]): string[] {
    if (!agent.capabilities || requestedCapabilities.length === 0) {
      return [];
    }

    const agentCapNames = agent.capabilities.map(cap => cap.name.toLowerCase());
    return requestedCapabilities.filter(reqCap =>
      agentCapNames.some(agentCap =>
        agentCap.includes(reqCap.toLowerCase()) || reqCap.toLowerCase().includes(agentCap)
      )
    );
  }

  /**
   * Applies final filters to search results
   */
  private applyFinalFilters(
    results: AgentSearchResult[],
    params: SearchQueryParams
  ): AgentSearchResult[] {
    let filtered = results;

    // Filter by activity status
    if (!params.includeInactive) {
      filtered = filtered.filter(result => result.agent.status === 'active');
    }

    // Apply minimum similarity threshold
    const minSimilarity = params.minSimilarity || this.config.similarityThreshold;
    filtered = filtered.filter(result => result.similarity >= minSimilarity);

    // Limit results
    const maxResults = params.maxResults || this.config.maxResults;
    return filtered.slice(0, maxResults);
  }

  /**
   * Indexes agent metadata for semantic search
   */
  async indexAgent(agent: Agent): Promise<void> {
    try {
      // Extract agent metadata
      const metadata = await this.extractAgentMetadata(agent);
      
      // Generate embedding for agent description and capabilities
      const text = this.createAgentSearchText(agent);
      const embedding = await this.generateEmbedding(text);

      // Store in vector database
      const { error } = await this.supabase
        .from('agent_embeddings')
        .upsert({
          agent_id: agent.id,
          embedding,
          metadata,
          search_text: text,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to index agent: ${error.message}`);
      }

      this.logger.info('Agent indexed successfully', { agentId: agent.id });
    } catch (error) {
      this.logger.error('Agent indexing failed', { agentId: agent.id, error });
      throw new Error(`Agent indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Removes agent from search index
   */
  async removeAgentFromIndex(agentId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('agent_embeddings')
        .delete()
        .eq('agent_id', agentId);

      if (error) {
        throw new Error(`Failed to remove agent from index: ${error.message}`);
      }

      this.logger.info('Agent removed from index', { agentId });
    } catch (error) {
      this.logger.error('Agent index removal failed', { agentId, error });
      throw new Error(`Agent index removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets recommendations based on user behavior and preferences
   */
  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 10
  ): Promise<AgentSearchResult[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const interactionHistory = await this.getUserAgentInteractions(userId);

      // Generate recommendation query based on user profile
      const recommendationQuery = this.generateRecommendationQuery(userProfile, interactionHistory);
      
      // Perform semantic search with recommendation context
      return await this.searchAgents({
        query: recommendationQuery,
        userId,
        maxResults: limit,
        minSimilarity: 0.3 // Lower threshold for recommendations
      });
    } catch (error) {
      this.logger.error('Personalized recommendations failed', { userId, error });
      throw new Error(`Recommendations failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Tracks search analytics
   */
  private async trackSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
    try {
      await this.analyticsService.track('semantic_search', {
        queryId: analytics.queryId,
        userId: analytics.userId,
        query: analytics.query,
        resultsCount: analytics.resultsCount,
        executionTime: analytics.executionTime,
        avgSimilarity: analytics.similarityScores.reduce((a, b) => a + b, 0) / analytics.similarityScores.length,
        timestamp: analytics.timestamp
      });
    } catch (error) {
      this.logger.warn('Analytics tracking failed', { error });
    }
  }

  // Helper methods
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async extractAgentMetadata(agent: Agent): Promise<AgentMetadata> {
    return {
      agentId: agent.id,
      capabilities: agent.capabilities || [],
      description: agent.description || '',
      tags: agent.tags || [],
      embedding: [], // Will be filled by indexing process
      lastUpdated: new Date()
    };
  }

  private createAgentSearchText(agent: Agent): string {
    const parts = [
      agent.name,
      agent.description,
      agent.capabilities?.map(c => `${c.name}: ${c.description}`).join(' '),
      agent.tags?.join(' ')
    ].filter(Boolean);

    return parts.join(' ');
  }

  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      return error ? null : data;
    } catch {
      return null;
    }
  }

  private async getUserAgentInteractions(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_agent_interactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      return error ? [] : data;
    } catch {
      return [];
    }
  }

  private generateRecommendationQuery(
    userProfile: UserProfile | null,
    interactions: any[]
  ): string {
    const preferences = userProfile?.preferences;
    const recentInteractions = interactions.slice(0, 10);

    let query = 'AI agent recommendation';

    if (preferences?.domains?.length) {
      query += ` for ${preferences.domains.join(', ')}`;
    }

    if (recentInteractions.length > 0) {
      const topRatedAgents = recentInteractions
        .filter(i => i.rating >= 4)
        .map(i => i.agent_name)
        .slice(0, 3);
      
      if (topRatedAgents.length > 0) {
        query += ` similar to ${topRatedAgents.join(', ')}`;
      }
    }

    return query;
  }
}

export default SemanticAgentDiscoveryService;
```