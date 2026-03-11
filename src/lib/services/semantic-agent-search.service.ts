```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Redis from 'ioredis';

/**
 * Search intent types for query classification
 */
export enum SearchIntent {
  FIND_AGENT = 'find_agent',
  COMPARE_AGENTS = 'compare_agents',
  BROWSE_CATEGORY = 'browse_category',
  GENERAL_SEARCH = 'general_search'
}

/**
 * Agent search result interface
 */
export interface AgentSearchResult {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  similarity_score: number;
  relevance_score: number;
  capabilities: string[];
  rating: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  query: string;
  limit?: number;
  threshold?: number;
  category_filter?: string;
  tag_filter?: string[];
  intent?: SearchIntent;
}

/**
 * Processed query result
 */
interface ProcessedQuery {
  original_query: string;
  cleaned_query: string;
  intent: SearchIntent;
  entities: {
    categories: string[];
    tags: string[];
    capabilities: string[];
  };
  keywords: string[];
}

/**
 * Agent indexing data
 */
export interface AgentIndexData {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  capabilities: string[];
  metadata: Record<string, any>;
}

/**
 * Search configuration
 */
export interface SemanticSearchConfig {
  supabase_url: string;
  supabase_key: string;
  openai_api_key: string;
  redis_url: string;
  embedding_model?: string;
  cache_ttl?: number;
  similarity_threshold?: number;
  max_results?: number;
}

/**
 * Embedding service for text vectorization
 */
class EmbeddingService {
  private openai: OpenAI;
  private redis: Redis;
  private model: string;

  constructor(apiKey: string, redis: Redis, model = 'text-embedding-ada-002') {
    this.openai = new OpenAI({ apiKey });
    this.redis = redis;
    this.model = model;
  }

  /**
   * Generate embedding for text with caching
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${Buffer.from(text).toString('base64')}`;
    
    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Generate new embedding
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      await this.redis.setex(cacheKey, 3600, JSON.stringify(embedding));

      return embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      throw new Error(`Failed to generate batch embeddings: ${error}`);
    }
  }
}

/**
 * Intent classifier for query analysis
 */
class IntentClassifier {
  private intentPatterns: Map<SearchIntent, RegExp[]>;

  constructor() {
    this.intentPatterns = new Map([
      [SearchIntent.FIND_AGENT, [
        /find (an? )?agent/i,
        /looking for (an? )?agent/i,
        /need (an? )?agent/i,
        /search for (an? )?agent/i,
        /get (an? )?agent/i
      ]],
      [SearchIntent.COMPARE_AGENTS, [
        /compare agents/i,
        /which agent is better/i,
        /difference between/i,
        /vs\.|versus|compare/i
      ]],
      [SearchIntent.BROWSE_CATEGORY, [
        /show me .* agents/i,
        /list .* agents/i,
        /browse .* category/i,
        /agents in .* category/i
      ]]
    ]);
  }

  /**
   * Classify query intent
   */
  classifyIntent(query: string): SearchIntent {
    for (const [intent, patterns] of this.intentPatterns) {
      if (patterns.some(pattern => pattern.test(query))) {
        return intent;
      }
    }
    return SearchIntent.GENERAL_SEARCH;
  }
}

/**
 * Query processor for NLP preprocessing
 */
class QueryProcessor {
  private intentClassifier: IntentClassifier;
  private stopWords: Set<string>;

  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'i', 'me', 'my', 'we', 'our', 'you', 'your'
    ]);
  }

  /**
   * Process and analyze query
   */
  processQuery(query: string): ProcessedQuery {
    const cleanedQuery = this.cleanQuery(query);
    const intent = this.intentClassifier.classifyIntent(query);
    const entities = this.extractEntities(cleanedQuery);
    const keywords = this.extractKeywords(cleanedQuery);

    return {
      original_query: query,
      cleaned_query: cleanedQuery,
      intent,
      entities,
      keywords
    };
  }

  /**
   * Clean and normalize query text
   */
  private cleanQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract entities from query
   */
  private extractEntities(query: string): ProcessedQuery['entities'] {
    const categories = this.extractCategories(query);
    const tags = this.extractTags(query);
    const capabilities = this.extractCapabilities(query);

    return { categories, tags, capabilities };
  }

  /**
   * Extract category mentions
   */
  private extractCategories(query: string): string[] {
    const categoryPatterns = [
      /music|audio|sound/i,
      /video|visual|graphics/i,
      /text|writing|content/i,
      /data|analytics|analysis/i,
      /automation|workflow/i
    ];

    const categories: string[] = [];
    categoryPatterns.forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) {
        categories.push(matches[0].toLowerCase());
      }
    });

    return categories;
  }

  /**
   * Extract tag mentions
   */
  private extractTags(query: string): string[] {
    const tagPatterns = [
      /ai|artificial intelligence/i,
      /machine learning|ml/i,
      /nlp|natural language/i,
      /computer vision|cv/i,
      /deep learning|neural network/i
    ];

    const tags: string[] = [];
    tagPatterns.forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) {
        tags.push(matches[0].toLowerCase());
      }
    });

    return tags;
  }

  /**
   * Extract capability mentions
   */
  private extractCapabilities(query: string): string[] {
    const capabilityPatterns = [
      /generate|create|make/i,
      /analyze|process|understand/i,
      /translate|convert|transform/i,
      /classify|categorize|detect/i,
      /optimize|improve|enhance/i
    ];

    const capabilities: string[] = [];
    capabilityPatterns.forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) {
        capabilities.push(matches[0].toLowerCase());
      }
    });

    return capabilities;
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(query: string): string[] {
    return query
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }
}

/**
 * Search result ranker for relevance scoring
 */
class SearchResultRanker {
  /**
   * Rank and score search results
   */
  rankResults(
    results: any[],
    processedQuery: ProcessedQuery,
    weights: {
      similarity: number;
      popularity: number;
      recency: number;
      category_match: number;
      tag_match: number;
    } = {
      similarity: 0.4,
      popularity: 0.2,
      recency: 0.1,
      category_match: 0.15,
      tag_match: 0.15
    }
  ): AgentSearchResult[] {
    return results.map(result => {
      const relevanceScore = this.calculateRelevanceScore(
        result,
        processedQuery,
        weights
      );

      return {
        id: result.id,
        name: result.name,
        description: result.description,
        category: result.category,
        tags: result.tags || [],
        similarity_score: result.similarity || 0,
        relevance_score: relevanceScore,
        capabilities: result.capabilities || [],
        rating: result.rating || 0,
        usage_count: result.usage_count || 0,
        created_at: result.created_at,
        updated_at: result.updated_at
      };
    })
    .sort((a, b) => b.relevance_score - a.relevance_score);
  }

  /**
   * Calculate overall relevance score
   */
  private calculateRelevanceScore(
    result: any,
    processedQuery: ProcessedQuery,
    weights: any
  ): number {
    const similarityScore = result.similarity || 0;
    const popularityScore = this.normalizePopularity(result.usage_count || 0);
    const recencyScore = this.calculateRecencyScore(result.updated_at);
    const categoryScore = this.calculateCategoryMatch(result, processedQuery);
    const tagScore = this.calculateTagMatch(result, processedQuery);

    return (
      similarityScore * weights.similarity +
      popularityScore * weights.popularity +
      recencyScore * weights.recency +
      categoryScore * weights.category_match +
      tagScore * weights.tag_match
    );
  }

  /**
   * Normalize popularity score
   */
  private normalizePopularity(usageCount: number): number {
    return Math.min(usageCount / 1000, 1); // Normalize to 0-1
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(updatedAt: string): number {
    const now = new Date();
    const updated = new Date(updatedAt);
    const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
    
    return Math.max(0, 1 - daysDiff / 365); // Decay over a year
  }

  /**
   * Calculate category match score
   */
  private calculateCategoryMatch(result: any, processedQuery: ProcessedQuery): number {
    const resultCategory = result.category?.toLowerCase() || '';
    const queryCategories = processedQuery.entities.categories;
    
    if (queryCategories.some(cat => resultCategory.includes(cat))) {
      return 1;
    }
    return 0;
  }

  /**
   * Calculate tag match score
   */
  private calculateTagMatch(result: any, processedQuery: ProcessedQuery): number {
    const resultTags = (result.tags || []).map((tag: string) => tag.toLowerCase());
    const queryTags = processedQuery.entities.tags;
    
    if (queryTags.length === 0) return 0;
    
    const matches = queryTags.filter(tag => 
      resultTags.some(resultTag => resultTag.includes(tag))
    );
    
    return matches.length / queryTags.length;
  }
}

/**
 * Agent indexer for maintaining searchable metadata
 */
class AgentIndexer {
  private supabase: SupabaseClient;
  private embeddingService: EmbeddingService;

  constructor(supabase: SupabaseClient, embeddingService: EmbeddingService) {
    this.supabase = supabase;
    this.embeddingService = embeddingService;
  }

  /**
   * Index agent for search
   */
  async indexAgent(agentData: AgentIndexData): Promise<void> {
    try {
      // Create searchable text
      const searchText = this.createSearchText(agentData);
      
      // Generate embedding
      const embedding = await this.embeddingService.generateEmbedding(searchText);

      // Store/update agent data
      const { error: agentError } = await this.supabase
        .from('agents')
        .upsert({
          id: agentData.id,
          name: agentData.name,
          description: agentData.description,
          category: agentData.category,
          tags: agentData.tags,
          capabilities: agentData.capabilities,
          metadata: agentData.metadata,
          updated_at: new Date().toISOString()
        });

      if (agentError) throw agentError;

      // Store embedding
      const { error: embeddingError } = await this.supabase
        .from('agent_embeddings')
        .upsert({
          agent_id: agentData.id,
          embedding,
          search_text: searchText,
          updated_at: new Date().toISOString()
        });

      if (embeddingError) throw embeddingError;

    } catch (error) {
      throw new Error(`Failed to index agent ${agentData.id}: ${error}`);
    }
  }

  /**
   * Remove agent from index
   */
  async removeAgent(agentId: string): Promise<void> {
    try {
      await Promise.all([
        this.supabase.from('agent_embeddings').delete().eq('agent_id', agentId),
        this.supabase.from('agents').delete().eq('id', agentId)
      ]);
    } catch (error) {
      throw new Error(`Failed to remove agent ${agentId}: ${error}`);
    }
  }

  /**
   * Create searchable text from agent data
   */
  private createSearchText(agentData: AgentIndexData): string {
    return [
      agentData.name,
      agentData.description,
      agentData.category,
      ...agentData.tags,
      ...agentData.capabilities
    ].join(' ');
  }
}

/**
 * Main semantic agent search service
 */
export class SemanticAgentSearchService {
  private supabase: SupabaseClient;
  private embeddingService: EmbeddingService;
  private queryProcessor: QueryProcessor;
  private resultRanker: SearchResultRanker;
  private agentIndexer: AgentIndexer;
  private redis: Redis;
  private config: Required<SemanticSearchConfig>;

  constructor(config: SemanticSearchConfig) {
    this.config = {
      embedding_model: 'text-embedding-ada-002',
      cache_ttl: 3600,
      similarity_threshold: 0.7,
      max_results: 20,
      ...config
    };

    this.supabase = createClient(config.supabase_url, config.supabase_key);
    this.redis = new Redis(config.redis_url);
    this.embeddingService = new EmbeddingService(
      config.openai_api_key,
      this.redis,
      this.config.embedding_model
    );
    this.queryProcessor = new QueryProcessor();
    this.resultRanker = new SearchResultRanker();
    this.agentIndexer = new AgentIndexer(this.supabase, this.embeddingService);
  }

  /**
   * Perform semantic search for agents
   */
  async searchAgents(searchQuery: SearchQuery): Promise<AgentSearchResult[]> {
    try {
      // Process the query
      const processedQuery = this.queryProcessor.processQuery(searchQuery.query);

      // Check cache first
      const cacheKey = this.getCacheKey(searchQuery);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        processedQuery.cleaned_query
      );

      // Perform vector similarity search
      const rawResults = await this.performVectorSearch(
        queryEmbedding,
        searchQuery
      );

      // Rank and score results
      const rankedResults = this.resultRanker.rankResults(
        rawResults,
        processedQuery
      );

      // Apply final filtering
      const finalResults = this.applyFilters(rankedResults, searchQuery);

      // Cache results
      await this.redis.setex(
        cacheKey,
        this.config.cache_ttl,
        JSON.stringify(finalResults)
      );

      return finalResults;

    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  /**
   * Index an agent for search
   */
  async indexAgent(agentData: AgentIndexData): Promise<void> {
    await this.agentIndexer.indexAgent(agentData);
  }

  /**
   * Remove agent from search index
   */
  async removeAgent(agentId: string): Promise<void> {
    await this.agentIndexer.removeAgent(agentId);
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, limit = 5): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('agents')
        .select('name, description, tags')
        .textSearch('name', partialQuery, {
          type: 'websearch',
          config: 'english'
        })
        .limit(limit);

      if (error) throw error;

      return data.map(agent => agent.name);
    } catch (error) {
      throw new Error(`Failed to get suggestions: ${error}`);
    }
  }

  /**
   * Perform vector similarity search
   */
  private async performVectorSearch(
    queryEmbedding: number[],
    searchQuery: SearchQuery
  ): Promise<any[]> {
    try {
      let query = this.supabase
        .from('agent_embeddings')
        .select(`
          agent_id,
          agents!inner (
            id,
            name,
            description,
            category,
            tags,
            capabilities,
            rating,
            usage_count,
            created_at,
            updated_at
          )
        `)
        .gte('similarity', searchQuery.threshold || this.config.similarity_threshold)
        .limit(searchQuery.limit || this.config.max_results);

      // Add category filter
      if (searchQuery.category_filter) {
        query = query.eq('agents.category', searchQuery.category_filter);
      }

      // Add tag filter
      if (searchQuery.tag_filter && searchQuery.tag_filter.length > 0) {
        query = query.overlaps('agents.tags', searchQuery.tag_filter);
      }

      // Perform similarity search using pgvector
      const { data, error } = await query.rpc('match_agents', {
        query_embedding: queryEmbedding,
        similarity_threshold: searchQuery.threshold || this.config.similarity_threshold,
        match_count: searchQuery.limit || this.config.max_results
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      throw new Error(`Vector search failed: ${error}`);
    }
  }

  /**
   * Apply final filters to search results
   */
  private applyFilters(
    results: AgentSearchResult[],
    searchQuery: SearchQuery
  ): AgentSearchResult[] {
    return results
      .filter(result => result.similarity_score >= (searchQuery.threshold || this.config.similarity_threshold))
      .slice(0, searchQuery.limit || this.config.max_results);
  }

  /**
   * Generate cache key for search query
   */
  private getCacheKey(searchQuery: SearchQuery): string {
    const key = `search:${Buffer.from(JSON.stringify(searchQuery)).toString('base64')}`;
    return key.substring(0, 250); // Redis key length limit
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export default SemanticAgentSearchService;
```