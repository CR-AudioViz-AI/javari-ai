```typescript
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import Redis from 'ioredis';
import { EmbeddingsService } from './embeddings';
import { VectorStore } from './vector-store';
import { RankingService } from './ranking';
import { MultiLanguageService } from './multilang';
import { SearchEngine } from './search-engine';
import { CacheService } from './cache';
import { 
  SemanticSearchRequest,
  SemanticSearchResponse,
  SearchResult,
  AgentMetadata,
  SearchFilters,
  SearchContext,
  RankingWeights,
  LanguageCode
} from '../../types/semantic-search';

/**
 * Semantic Agent Search Microservice
 * 
 * Provides vector-based semantic search for agent discovery using OpenAI embeddings
 * with multi-language support and context-aware ranking algorithms.
 * 
 * Features:
 * - Vector similarity search using pgvector
 * - Multi-language query processing
 * - Context-aware ranking with hybrid scoring
 * - Redis caching for embeddings and results
 * - Real-time agent metadata enrichment
 * 
 * @example
 * ```typescript
 * const searchService = new SemanticAgentSearchService();
 * const results = await searchService.search({
 *   query: "AI agent for data analysis",
 *   language: "en",
 *   filters: { category: "analytics" },
 *   limit: 10
 * });
 * ```
 */
export class SemanticAgentSearchService {
  private openai: OpenAI;
  private supabase: ReturnType<typeof createClient>;
  private redis: Redis;
  private embeddings: EmbeddingsService;
  private vectorStore: VectorStore;
  private ranking: RankingService;
  private multiLang: MultiLanguageService;
  private searchEngine: SearchEngine;
  private cache: CacheService;

  constructor(config: {
    openaiApiKey: string;
    supabaseUrl: string;
    supabaseKey: string;
    redisUrl: string;
  }) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.redis = new Redis(config.redisUrl);

    this.embeddings = new EmbeddingsService(this.openai);
    this.vectorStore = new VectorStore(this.supabase);
    this.ranking = new RankingService();
    this.multiLang = new MultiLanguageService();
    this.searchEngine = new SearchEngine({
      vectorStore: this.vectorStore,
      ranking: this.ranking,
      embeddings: this.embeddings
    });
    this.cache = new CacheService(this.redis);
  }

  /**
   * Perform semantic search for agents
   * 
   * @param request - Search request parameters
   * @returns Promise<SemanticSearchResponse> - Search results with metadata
   */
  async search(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
    try {
      const startTime = Date.now();
      
      // Validate input
      this.validateSearchRequest(request);

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedResults = await this.cache.get<SemanticSearchResponse>(cacheKey);
      if (cachedResults && !request.bypassCache) {
        return { ...cachedResults, fromCache: true };
      }

      // Detect and process language
      const detectedLanguage = await this.multiLang.detectLanguage(request.query);
      const processedQuery = await this.multiLang.preprocessQuery(
        request.query, 
        request.language || detectedLanguage
      );

      // Generate query embedding
      const queryEmbedding = await this.embeddings.generateQueryEmbedding(
        processedQuery,
        request.language || detectedLanguage
      );

      // Create search context
      const searchContext: SearchContext = {
        userId: request.userId,
        language: request.language || detectedLanguage,
        filters: request.filters || {},
        preferences: request.userPreferences,
        sessionId: request.sessionId
      };

      // Perform vector search
      const vectorResults = await this.vectorStore.similaritySearch({
        embedding: queryEmbedding,
        limit: Math.min(request.limit * 3, 100), // Over-fetch for ranking
        threshold: request.similarityThreshold || 0.7,
        filters: request.filters
      });

      // Apply context-aware ranking
      const rankedResults = await this.ranking.rankResults({
        results: vectorResults,
        query: processedQuery,
        context: searchContext,
        weights: request.rankingWeights
      });

      // Limit and enrich results
      const finalResults = rankedResults
        .slice(0, request.limit || 10)
        .map(result => this.enrichSearchResult(result));

      const response: SemanticSearchResponse = {
        results: await Promise.all(finalResults),
        totalFound: vectorResults.length,
        searchTime: Date.now() - startTime,
        language: detectedLanguage,
        query: processedQuery,
        filters: request.filters || {},
        fromCache: false
      };

      // Cache results
      await this.cache.set(cacheKey, response, 300); // 5 minutes

      return response;

    } catch (error) {
      throw new SemanticSearchError(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_FAILED',
        { request }
      );
    }
  }

  /**
   * Search for similar agents based on an existing agent
   * 
   * @param agentId - ID of the reference agent
   * @param options - Search options
   * @returns Promise<SemanticSearchResponse> - Similar agents
   */
  async findSimilarAgents(
    agentId: string,
    options: {
      limit?: number;
      excludeSelf?: boolean;
      filters?: SearchFilters;
    } = {}
  ): Promise<SemanticSearchResponse> {
    try {
      // Get agent embedding
      const agentEmbedding = await this.vectorStore.getAgentEmbedding(agentId);
      if (!agentEmbedding) {
        throw new SemanticSearchError(
          `Agent embedding not found: ${agentId}`,
          'AGENT_NOT_FOUND'
        );
      }

      // Perform similarity search
      const results = await this.vectorStore.similaritySearch({
        embedding: agentEmbedding,
        limit: options.limit || 10,
        filters: options.filters,
        excludeIds: options.excludeSelf ? [agentId] : []
      });

      return {
        results: results.map(result => this.enrichSearchResult(result)),
        totalFound: results.length,
        searchTime: Date.now(),
        language: 'en',
        query: `Similar to agent ${agentId}`,
        filters: options.filters || {},
        fromCache: false
      };

    } catch (error) {
      throw new SemanticSearchError(
        `Similar agents search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SIMILAR_SEARCH_FAILED',
        { agentId, options }
      );
    }
  }

  /**
   * Index a new agent for semantic search
   * 
   * @param agent - Agent metadata to index
   * @returns Promise<void>
   */
  async indexAgent(agent: AgentMetadata): Promise<void> {
    try {
      // Generate searchable text
      const searchText = this.generateSearchableText(agent);
      
      // Create embedding
      const embedding = await this.embeddings.generateAgentEmbedding(
        searchText,
        agent.language || 'en'
      );

      // Store in vector database
      await this.vectorStore.upsertAgent({
        id: agent.id,
        embedding,
        metadata: agent,
        searchText
      });

      // Update cache
      await this.cache.invalidateAgentCache(agent.id);

    } catch (error) {
      throw new SemanticSearchError(
        `Agent indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INDEXING_FAILED',
        { agentId: agent.id }
      );
    }
  }

  /**
   * Update agent index
   * 
   * @param agentId - Agent ID to update
   * @param updates - Partial agent metadata updates
   * @returns Promise<void>
   */
  async updateAgentIndex(agentId: string, updates: Partial<AgentMetadata>): Promise<void> {
    try {
      // Get current agent data
      const currentAgent = await this.vectorStore.getAgent(agentId);
      if (!currentAgent) {
        throw new SemanticSearchError(
          `Agent not found for update: ${agentId}`,
          'AGENT_NOT_FOUND'
        );
      }

      // Merge updates
      const updatedAgent = { ...currentAgent.metadata, ...updates };
      
      // Re-index if searchable content changed
      const searchableFields = ['name', 'description', 'tags', 'category', 'capabilities'];
      const needsReindex = searchableFields.some(field => 
        updates[field as keyof AgentMetadata] !== undefined
      );

      if (needsReindex) {
        await this.indexAgent(updatedAgent);
      } else {
        // Just update metadata
        await this.vectorStore.updateAgentMetadata(agentId, updatedAgent);
      }

      // Invalidate cache
      await this.cache.invalidateAgentCache(agentId);

    } catch (error) {
      throw new SemanticSearchError(
        `Agent update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_FAILED',
        { agentId, updates }
      );
    }
  }

  /**
   * Remove agent from search index
   * 
   * @param agentId - Agent ID to remove
   * @returns Promise<void>
   */
  async removeAgentFromIndex(agentId: string): Promise<void> {
    try {
      await this.vectorStore.deleteAgent(agentId);
      await this.cache.invalidateAgentCache(agentId);
    } catch (error) {
      throw new SemanticSearchError(
        `Agent removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REMOVAL_FAILED',
        { agentId }
      );
    }
  }

  /**
   * Get search analytics and insights
   * 
   * @param timeRange - Time range for analytics
   * @returns Promise<SearchAnalytics> - Analytics data
   */
  async getSearchAnalytics(timeRange?: { start: Date; end: Date }) {
    try {
      return await this.cache.getSearchAnalytics(timeRange);
    } catch (error) {
      throw new SemanticSearchError(
        `Analytics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ANALYTICS_FAILED'
      );
    }
  }

  /**
   * Health check for the search service
   * 
   * @returns Promise<HealthStatus> - Service health status
   */
  async healthCheck() {
    try {
      const checks = await Promise.allSettled([
        this.supabase.from('agents').select('count').limit(1),
        this.redis.ping(),
        this.openai.models.list()
      ]);

      return {
        status: checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'degraded',
        database: checks[0].status === 'fulfilled' ? 'connected' : 'disconnected',
        cache: checks[1].status === 'fulfilled' ? 'connected' : 'disconnected',
        embeddings: checks[2].status === 'fulfilled' ? 'connected' : 'disconnected',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate search request parameters
   */
  private validateSearchRequest(request: SemanticSearchRequest): void {
    if (!request.query || request.query.trim().length === 0) {
      throw new SemanticSearchError('Query is required', 'INVALID_QUERY');
    }

    if (request.query.length > 1000) {
      throw new SemanticSearchError('Query too long (max 1000 characters)', 'QUERY_TOO_LONG');
    }

    if (request.limit && (request.limit < 1 || request.limit > 100)) {
      throw new SemanticSearchError('Limit must be between 1 and 100', 'INVALID_LIMIT');
    }

    if (request.similarityThreshold && 
        (request.similarityThreshold < 0 || request.similarityThreshold > 1)) {
      throw new SemanticSearchError(
        'Similarity threshold must be between 0 and 1', 
        'INVALID_THRESHOLD'
      );
    }
  }

  /**
   * Generate cache key for search request
   */
  private generateCacheKey(request: SemanticSearchRequest): string {
    const keyData = {
      query: request.query,
      language: request.language,
      filters: request.filters,
      limit: request.limit,
      threshold: request.similarityThreshold
    };
    
    return `search:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Generate searchable text from agent metadata
   */
  private generateSearchableText(agent: AgentMetadata): string {
    const parts = [
      agent.name,
      agent.description,
      agent.tags?.join(' '),
      agent.category,
      agent.capabilities?.join(' '),
      agent.useCase
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * Enrich search result with additional metadata
   */
  private async enrichSearchResult(result: SearchResult): Promise<SearchResult> {
    // Add real-time metrics, ratings, etc.
    return {
      ...result,
      enrichedAt: new Date()
    };
  }
}

/**
 * Custom error class for semantic search operations
 */
export class SemanticSearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'SemanticSearchError';
  }
}

/**
 * Factory function to create semantic search service instance
 */
export function createSemanticSearchService(config: {
  openaiApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
}): SemanticAgentSearchService {
  return new SemanticAgentSearchService(config);
}

export default SemanticAgentSearchService;

// Export types for external use
export type {
  SemanticSearchRequest,
  SemanticSearchResponse,
  SearchResult,
  AgentMetadata,
  SearchFilters,
  SearchContext,
  RankingWeights,
  LanguageCode
};
```