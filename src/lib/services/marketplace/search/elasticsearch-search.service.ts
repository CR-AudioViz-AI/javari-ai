```typescript
/**
 * @fileoverview Advanced Elasticsearch-based marketplace search service with semantic search,
 * autocomplete, capability filtering, and personalized recommendations for AI agent discovery.
 * 
 * Features:
 * - Semantic search using vector embeddings
 * - Real-time autocomplete with debouncing
 * - Multi-dimensional capability filtering
 * - Personalized recommendations based on user behavior
 * - Relevance scoring and analytics
 * 
 * @version 1.0.0
 * @author CR AudioViz AI Platform
 */

import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import OpenAI from 'openai';

/**
 * Agent data structure for search operations
 */
export interface AgentSearchData {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  category: string;
  tags: string[];
  creator_id: string;
  rating: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  price_model: 'free' | 'premium' | 'pay_per_use';
  embedding_vector?: number[];
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sort?: SearchSort;
  pagination?: SearchPagination;
  user_id?: string;
  include_personalized?: boolean;
}

/**
 * Advanced search filters
 */
export interface SearchFilters {
  capabilities?: string[];
  categories?: string[];
  price_models?: string[];
  rating_min?: number;
  creator_ids?: string[];
  tags?: string[];
  date_range?: {
    from?: string;
    to?: string;
  };
}

/**
 * Search sorting options
 */
export interface SearchSort {
  field: 'relevance' | 'rating' | 'usage_count' | 'created_at' | 'updated_at';
  direction: 'asc' | 'desc';
}

/**
 * Search pagination parameters
 */
export interface SearchPagination {
  page: number;
  size: number;
}

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  agent: AgentSearchData;
  relevance_score: number;
  semantic_score?: number;
  popularity_score?: number;
  personalization_score?: number;
  explanation?: string;
}

/**
 * Complete search response
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  size: number;
  took: number;
  aggregations?: SearchAggregations;
  suggestions?: AutocompleteSuggestion[];
  personalized_recommendations?: SearchResult[];
}

/**
 * Search result aggregations for faceted search
 */
export interface SearchAggregations {
  capabilities: { [key: string]: number };
  categories: { [key: string]: number };
  price_models: { [key: string]: number };
  rating_ranges: { [key: string]: number };
}

/**
 * Autocomplete suggestion structure
 */
export interface AutocompleteSuggestion {
  text: string;
  type: 'agent' | 'capability' | 'category' | 'tag';
  score: number;
  metadata?: Record<string, any>;
}

/**
 * User behavior data for personalization
 */
export interface UserBehaviorData {
  user_id: string;
  viewed_agents: string[];
  used_agents: string[];
  preferred_capabilities: string[];
  search_history: string[];
  interaction_weights: { [agent_id: string]: number };
}

/**
 * Search analytics event
 */
export interface SearchAnalyticsEvent {
  query: string;
  user_id?: string;
  results_count: number;
  clicked_results: string[];
  search_time: number;
  filters_applied: SearchFilters;
  timestamp: string;
}

/**
 * Configuration for Elasticsearch search service
 */
interface ElasticsearchConfig {
  node: string;
  auth: {
    username: string;
    password: string;
  };
  indices: {
    agents: string;
    user_behavior: string;
    search_analytics: string;
  };
}

/**
 * Advanced Elasticsearch-based marketplace search service
 * Provides semantic search, autocomplete, filtering, and personalized recommendations
 */
export class ElasticsearchSearchService {
  private client: ElasticsearchClient;
  private supabase: any;
  private redis: Redis;
  private openai: OpenAI;
  private config: ElasticsearchConfig;
  private searchQueryBuilder: SearchQueryBuilder;
  private autocompleteProvider: AutocompleteProvider;
  private personalizedRecommendations: PersonalizedRecommendations;
  private searchAnalytics: SearchAnalytics;

  /**
   * Initialize the Elasticsearch search service
   */
  constructor(config: ElasticsearchConfig) {
    this.config = config;
    
    // Initialize Elasticsearch client
    this.client = new ElasticsearchClient({
      node: config.node,
      auth: config.auth,
      requestTimeout: 10000,
    });

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize Redis for caching
    this.redis = new Redis(process.env.REDIS_URL!);

    // Initialize OpenAI for embeddings
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Initialize helper classes
    this.searchQueryBuilder = new SearchQueryBuilder();
    this.autocompleteProvider = new AutocompleteProvider(this.client, this.redis);
    this.personalizedRecommendations = new PersonalizedRecommendations(
      this.client,
      this.supabase,
      this.redis
    );
    this.searchAnalytics = new SearchAnalytics(this.client, this.supabase);
  }

  /**
   * Perform advanced search with semantic capabilities
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Generate embedding for semantic search if query has text
      let queryEmbedding: number[] | null = null;
      if (query.query.trim()) {
        queryEmbedding = await this.generateEmbedding(query.query);
      }

      // Build Elasticsearch query
      const esQuery = this.searchQueryBuilder.build(query, queryEmbedding);

      // Execute search
      const searchResponse = await this.client.search({
        index: this.config.indices.agents,
        body: esQuery,
        size: query.pagination?.size || 20,
        from: ((query.pagination?.page || 1) - 1) * (query.pagination?.size || 20),
      });

      // Process results with scoring
      const results = this.processSearchResults(searchResponse, queryEmbedding);

      // Get personalized recommendations if requested
      let personalizedRecommendations: SearchResult[] = [];
      if (query.include_personalized && query.user_id) {
        personalizedRecommendations = await this.personalizedRecommendations
          .getRecommendations(query.user_id, 5);
      }

      // Get autocomplete suggestions
      const suggestions = await this.autocompleteProvider
        .getSuggestions(query.query, 10);

      const response: SearchResponse = {
        results,
        total: searchResponse.body.hits.total.value,
        page: query.pagination?.page || 1,
        size: query.pagination?.size || 20,
        took: Date.now() - startTime,
        aggregations: this.processAggregations(searchResponse.body.aggregations),
        suggestions,
        personalized_recommendations: personalizedRecommendations,
      };

      // Track search analytics
      await this.searchAnalytics.trackSearch({
        query: query.query,
        user_id: query.user_id,
        results_count: results.length,
        clicked_results: [],
        search_time: response.took,
        filters_applied: query.filters || {},
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get autocomplete suggestions with debouncing
   */
  async getAutocompleteSuggestions(
    partialQuery: string,
    limit: number = 10
  ): Promise<AutocompleteSuggestion[]> {
    return this.autocompleteProvider.getSuggestions(partialQuery, limit);
  }

  /**
   * Get personalized agent recommendations
   */
  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    return this.personalizedRecommendations.getRecommendations(userId, limit);
  }

  /**
   * Index an agent for search
   */
  async indexAgent(agent: AgentSearchData): Promise<void> {
    try {
      // Generate embedding for the agent
      const embedding = await this.generateEmbedding(
        `${agent.name} ${agent.description} ${agent.capabilities.join(' ')}`
      );

      const agentWithEmbedding = {
        ...agent,
        embedding_vector: embedding,
      };

      await this.client.index({
        index: this.config.indices.agents,
        id: agent.id,
        body: agentWithEmbedding,
      });

      // Update autocomplete index
      await this.autocompleteProvider.updateAutocomplete(agent);
    } catch (error) {
      console.error('Agent indexing error:', error);
      throw new Error(`Failed to index agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove an agent from search index
   */
  async removeAgent(agentId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.config.indices.agents,
        id: agentId,
      });

      await this.autocompleteProvider.removeFromAutocomplete(agentId);
    } catch (error) {
      console.error('Agent removal error:', error);
      throw new Error(`Failed to remove agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user behavior for personalization
   */
  async updateUserBehavior(
    userId: string,
    behaviorData: Partial<UserBehaviorData>
  ): Promise<void> {
    await this.personalizedRecommendations.updateUserBehavior(userId, behaviorData);
  }

  /**
   * Track search result interaction
   */
  async trackInteraction(
    userId: string,
    agentId: string,
    interactionType: 'view' | 'click' | 'use'
  ): Promise<void> {
    await this.searchAnalytics.trackInteraction(userId, agentId, interactionType);
    await this.personalizedRecommendations.trackInteraction(userId, agentId, interactionType);
  }

  /**
   * Generate semantic embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${Buffer.from(text).toString('base64')}`;
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;
      
      // Cache for 24 hours
      await this.redis.setex(cacheKey, 86400, JSON.stringify(embedding));
      
      return embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error('Failed to generate text embedding');
    }
  }

  /**
   * Process Elasticsearch search results with relevance scoring
   */
  private processSearchResults(
    searchResponse: any,
    queryEmbedding?: number[] | null
  ): SearchResult[] {
    return searchResponse.body.hits.hits.map((hit: any) => {
      const agent: AgentSearchData = hit._source;
      const elasticsearchScore = hit._score;
      
      // Calculate semantic similarity if embeddings available
      let semanticScore = 0;
      if (queryEmbedding && agent.embedding_vector) {
        semanticScore = this.calculateCosineSimilarity(queryEmbedding, agent.embedding_vector);
      }

      // Calculate popularity score
      const popularityScore = this.calculatePopularityScore(agent);

      // Combined relevance score
      const relevanceScore = this.calculateCombinedScore(
        elasticsearchScore,
        semanticScore,
        popularityScore
      );

      return {
        agent,
        relevance_score: relevanceScore,
        semantic_score: semanticScore,
        popularity_score: popularityScore,
        explanation: `Combined score from text relevance (${elasticsearchScore.toFixed(2)}), semantic similarity (${semanticScore.toFixed(2)}), and popularity (${popularityScore.toFixed(2)})`,
      };
    });
  }

  /**
   * Process search aggregations for faceted search
   */
  private processAggregations(aggregations: any): SearchAggregations | undefined {
    if (!aggregations) return undefined;

    return {
      capabilities: this.processBucketAggregation(aggregations.capabilities),
      categories: this.processBucketAggregation(aggregations.categories),
      price_models: this.processBucketAggregation(aggregations.price_models),
      rating_ranges: this.processBucketAggregation(aggregations.rating_ranges),
    };
  }

  /**
   * Process bucket aggregation results
   */
  private processBucketAggregation(aggregation: any): { [key: string]: number } {
    const result: { [key: string]: number } = {};
    
    if (aggregation?.buckets) {
      aggregation.buckets.forEach((bucket: any) => {
        result[bucket.key] = bucket.doc_count;
      });
    }
    
    return result;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate popularity score based on usage metrics
   */
  private calculatePopularityScore(agent: AgentSearchData): number {
    const usageWeight = Math.log(agent.usage_count + 1) * 0.3;
    const ratingWeight = agent.rating * 0.5;
    const recencyWeight = this.calculateRecencyScore(agent.created_at) * 0.2;
    
    return Math.min(usageWeight + ratingWeight + recencyWeight, 10);
  }

  /**
   * Calculate recency score for time-based ranking
   */
  private calculateRecencyScore(createdAt: string): number {
    const daysSinceCreation = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 10 - daysSinceCreation * 0.1);
  }

  /**
   * Calculate combined relevance score
   */
  private calculateCombinedScore(
    textScore: number,
    semanticScore: number,
    popularityScore: number
  ): number {
    return (textScore * 0.4) + (semanticScore * 0.4) + (popularityScore * 0.2);
  }
}

/**
 * Query builder for complex Elasticsearch queries
 */
class SearchQueryBuilder {
  /**
   * Build comprehensive Elasticsearch query
   */
  build(query: SearchQuery, embedding?: number[] | null): any {
    const must: any[] = [];
    const filter: any[] = [];

    // Text search with multi-field matching
    if (query.query.trim()) {
      must.push({
        multi_match: {
          query: query.query,
          fields: [
            'name^3',
            'description^2',
            'capabilities^2',
            'tags',
            'category',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Semantic vector search
    if (embedding) {
      must.push({
        script_score: {
          query: { match_all: {} },
          script: {
            source: "cosineSimilarity(params.queryVector, 'embedding_vector') + 1.0",
            params: { queryVector: embedding },
          },
        },
      });
    }

    // Apply filters
    if (query.filters) {
      this.addFilters(filter, query.filters);
    }

    // Build aggregations for faceted search
    const aggs = this.buildAggregations();

    // Build sort criteria
    const sort = this.buildSort(query.sort);

    return {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      aggs,
      sort,
    };
  }

  /**
   * Add various filters to the query
   */
  private addFilters(filter: any[], filters: SearchFilters): void {
    if (filters.capabilities?.length) {
      filter.push({
        terms: { 'capabilities.keyword': filters.capabilities },
      });
    }

    if (filters.categories?.length) {
      filter.push({
        terms: { 'category.keyword': filters.categories },
      });
    }

    if (filters.price_models?.length) {
      filter.push({
        terms: { 'price_model.keyword': filters.price_models },
      });
    }

    if (filters.rating_min !== undefined) {
      filter.push({
        range: { rating: { gte: filters.rating_min } },
      });
    }

    if (filters.creator_ids?.length) {
      filter.push({
        terms: { 'creator_id.keyword': filters.creator_ids },
      });
    }

    if (filters.tags?.length) {
      filter.push({
        terms: { 'tags.keyword': filters.tags },
      });
    }

    if (filters.date_range) {
      const dateRange: any = {};
      if (filters.date_range.from) dateRange.gte = filters.date_range.from;
      if (filters.date_range.to) dateRange.lte = filters.date_range.to;
      
      filter.push({
        range: { created_at: dateRange },
      });
    }

    // Only show public agents
    filter.push({
      term: { is_public: true },
    });
  }

  /**
   * Build aggregations for faceted search
   */
  private buildAggregations(): any {
    return {
      capabilities: {
        terms: { field: 'capabilities.keyword', size: 20 },
      },
      categories: {
        terms: { field: 'category.keyword', size: 10 },
      },
      price_models: {
        terms: { field: 'price_model.keyword', size: 5 },
      },
      rating_ranges: {
        range: {
          field: 'rating',
          ranges: [
            { from: 4.5, to: 5.0, key: '4.5-5.0' },
            { from: 4.0, to: 4.5, key: '4.0-4.5' },
            { from: 3.5, to: 4.0, key: '3.5-4.0' },
            { from: 3.0, to: 3.5, key: '3.0-3.5' },
            { from: 0, to: 3.0, key: '0-3.0' },
          ],
        },
      },
    };
  }

  /**
   * Build sort criteria
   */
  private buildSort(sort?: SearchSort): any[] {
    if (!sort) {
      return [{ _score: { order: 'desc' } }];
    }

    const sortField = sort.field === 'relevance' ? '_score' : sort.field;
    return [{ [sortField]: { order: sort.direction } }];
  }
}

/**
 * Autocomplete provider with caching and debouncing
 */
class AutocompleteProvider {
  private static readonly CACHE_PREFIX = 'autocomplete:';
  private static readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private client: ElasticsearchClient,
    private redis: Redis
  ) {}

  /**
   * Get autocomplete suggestions with caching
   */
  async getSuggestions(
    partialQuery: string,
    limit: number = 10
  ): Promise<AutocompleteSuggestion[]> {
    if (!partialQuery.trim() || partialQuery.length < 2) {
      return [];
    }

    const cacheKey = `${AutocompleteProvider.CACHE_PREFIX}${partialQuery.toLowerCase()}`;
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const suggestions = await this.generateSuggestions(partialQuery, limit);
      
      // Cache results
      await this.redis.setex(
        cacheKey,
        AutocompleteProvider.CACHE_TTL,
        JSON.stringify(suggestions)
      );
      
      return suggestions;
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  /**
   * Generate autocomplete suggestions from multiple sources
   */
  private async generateSuggestions(
    partialQuery: string,
    limit: number
  ): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];

    // Agent name suggestions
    const agentSuggestions = await this.getAgentSuggestions(partialQuery, Math.ceil(limit * 0.4));
    suggestions.push(...agentSuggestions);

    // Capability suggestions
    const capabilitySuggestions = await this.getCapabilitySuggestions(partialQuery, Math.ceil(