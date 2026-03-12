```typescript
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AgentCapabilityDiscoveryService } from './agent-capability-discovery.service';
import { trackSearchEvent } from '../lib/analytics/search-analytics';
import type { Database } from '../lib/database/schema';

/**
 * Interface for vector embedding operations
 */
interface VectorStore {
  storeEmbedding(agentId: string, embedding: number[], metadata: AgentMetadata): Promise<void>;
  searchSimilar(queryVector: number[], limit: number, threshold?: number): Promise<VectorSearchResult[]>;
  updateEmbedding(agentId: string, embedding: number[], metadata: AgentMetadata): Promise<void>;
  deleteEmbedding(agentId: string): Promise<void>;
}

/**
 * Agent metadata for enhanced search context
 */
interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tags: string[];
  category: string;
  rating: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Vector search result from database
 */
interface VectorSearchResult {
  agent_id: string;
  similarity: number;
  metadata: AgentMetadata;
}

/**
 * Semantic search result with enhanced scoring
 */
interface SemanticSearchResult {
  agent: AgentMetadata;
  relevanceScore: number;
  semanticScore: number;
  capabilityMatch: number;
  explanation: string;
}

/**
 * Search configuration options
 */
interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  categories?: string[];
  includeExplanation?: boolean;
  boostFactors?: {
    rating?: number;
    usage?: number;
    recency?: number;
  };
}

/**
 * Search analytics data
 */
interface SearchAnalytics {
  query: string;
  resultsCount: number;
  searchTime: number;
  clickedAgentId?: string;
  userSatisfaction?: number;
}

/**
 * Embedding generator for text vectorization
 */
class EmbeddingGenerator {
  private openai: OpenAI;
  private readonly model = 'text-embedding-ada-002';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate embedding vector for text input
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text.trim(),
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts.map(text => text.trim()),
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      throw new Error(`Failed to generate batch embeddings: ${error}`);
    }
  }
}

/**
 * Agent capability semantic matching
 */
class AgentCapabilityMatcher {
  private capabilityDiscovery: AgentCapabilityDiscoveryService;

  constructor(capabilityDiscovery: AgentCapabilityDiscoveryService) {
    this.capabilityDiscovery = capabilityDiscovery;
  }

  /**
   * Calculate semantic relevance between query and agent capabilities
   */
  async calculateCapabilityMatch(query: string, agent: AgentMetadata): Promise<number> {
    try {
      const queryCapabilities = await this.extractQueryCapabilities(query);
      const agentCapabilities = agent.capabilities;

      let matchScore = 0;
      let totalWeight = 0;

      for (const queryCapability of queryCapabilities) {
        const weight = queryCapability.importance;
        totalWeight += weight;

        const bestMatch = this.findBestCapabilityMatch(
          queryCapability.capability,
          agentCapabilities
        );

        matchScore += bestMatch * weight;
      }

      return totalWeight > 0 ? matchScore / totalWeight : 0;
    } catch (error) {
      console.warn(`Capability matching failed: ${error}`);
      return 0;
    }
  }

  /**
   * Extract capabilities from user query
   */
  private async extractQueryCapabilities(query: string): Promise<Array<{
    capability: string;
    importance: number;
  }>> {
    // Use capability discovery service to identify query intentions
    const capabilities = await this.capabilityDiscovery.analyzeQuery(query);
    
    return capabilities.map(cap => ({
      capability: cap.name,
      importance: cap.confidence
    }));
  }

  /**
   * Find best matching capability using semantic similarity
   */
  private findBestCapabilityMatch(queryCapability: string, agentCapabilities: string[]): number {
    let bestMatch = 0;

    for (const agentCapability of agentCapabilities) {
      const similarity = this.calculateStringSimilarity(queryCapability, agentCapability);
      bestMatch = Math.max(bestMatch, similarity);
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}

/**
 * Search result ranking and scoring
 */
class SearchResultRanker {
  /**
   * Rank search results with comprehensive scoring
   */
  rankResults(
    results: VectorSearchResult[],
    capabilityScores: Map<string, number>,
    options: SearchOptions
  ): SemanticSearchResult[] {
    const boostFactors = options.boostFactors || {};

    return results.map(result => {
      const agent = result.metadata;
      const capabilityMatch = capabilityScores.get(agent.id) || 0;

      // Calculate composite relevance score
      const relevanceScore = this.calculateRelevanceScore(
        result.similarity,
        capabilityMatch,
        agent,
        boostFactors
      );

      return {
        agent,
        relevanceScore,
        semanticScore: result.similarity,
        capabilityMatch,
        explanation: this.generateExplanation(result, capabilityMatch, options)
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate comprehensive relevance score
   */
  private calculateRelevanceScore(
    similarity: number,
    capabilityMatch: number,
    agent: AgentMetadata,
    boostFactors: SearchOptions['boostFactors'] = {}
  ): number {
    const baseScore = (similarity * 0.6) + (capabilityMatch * 0.4);
    
    // Apply boost factors
    let boostedScore = baseScore;
    
    if (boostFactors.rating) {
      const ratingBoost = (agent.rating / 5.0) * boostFactors.rating;
      boostedScore += ratingBoost;
    }
    
    if (boostFactors.usage) {
      const usageBoost = Math.log(agent.usage_count + 1) * boostFactors.usage;
      boostedScore += usageBoost;
    }
    
    if (boostFactors.recency) {
      const daysSinceUpdate = (Date.now() - new Date(agent.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 1 - (daysSinceUpdate / 365)) * boostFactors.recency;
      boostedScore += recencyBoost;
    }

    return Math.min(1.0, Math.max(0.0, boostedScore));
  }

  /**
   * Generate human-readable explanation for search result
   */
  private generateExplanation(
    result: VectorSearchResult,
    capabilityMatch: number,
    options: SearchOptions
  ): string {
    if (!options.includeExplanation) return '';

    const explanations: string[] = [];

    if (result.similarity > 0.8) {
      explanations.push('High semantic similarity to your query');
    }

    if (capabilityMatch > 0.7) {
      explanations.push('Strong capability match for your requirements');
    }

    if (result.metadata.rating >= 4.5) {
      explanations.push('Highly rated by users');
    }

    if (result.metadata.usage_count > 1000) {
      explanations.push('Popular choice among users');
    }

    return explanations.join(', ') || 'Matches your search criteria';
  }
}

/**
 * Supabase vector store implementation
 */
class SupabaseVectorStore implements VectorStore {
  private client: ReturnType<typeof createClient<Database>>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient<Database>(supabaseUrl, supabaseKey);
  }

  async storeEmbedding(agentId: string, embedding: number[], metadata: AgentMetadata): Promise<void> {
    const { error } = await this.client
      .from('agent_embeddings')
      .upsert({
        agent_id: agentId,
        embedding: JSON.stringify(embedding),
        metadata: metadata,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to store embedding: ${error.message}`);
    }
  }

  async searchSimilar(
    queryVector: number[],
    limit: number,
    threshold: number = 0.5
  ): Promise<VectorSearchResult[]> {
    const { data, error } = await this.client.rpc('match_agents', {
      query_embedding: JSON.stringify(queryVector),
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return data.map(row => ({
      agent_id: row.agent_id,
      similarity: row.similarity,
      metadata: row.metadata
    }));
  }

  async updateEmbedding(agentId: string, embedding: number[], metadata: AgentMetadata): Promise<void> {
    await this.storeEmbedding(agentId, embedding, metadata);
  }

  async deleteEmbedding(agentId: string): Promise<void> {
    const { error } = await this.client
      .from('agent_embeddings')
      .delete()
      .eq('agent_id', agentId);

    if (error) {
      throw new Error(`Failed to delete embedding: ${error.message}`);
    }
  }
}

/**
 * Semantic Agent Search Service
 * 
 * Provides intelligent agent discovery using vector embeddings and semantic matching
 * to find the most relevant marketplace agents based on user queries and requirements.
 */
export class SemanticAgentSearchService {
  private embeddingGenerator: EmbeddingGenerator;
  private capabilityMatcher: AgentCapabilityMatcher;
  private resultRanker: SearchResultRanker;
  private vectorStore: VectorStore;

  constructor(
    openaiApiKey: string,
    supabaseUrl: string,
    supabaseKey: string,
    capabilityDiscovery: AgentCapabilityDiscoveryService
  ) {
    this.embeddingGenerator = new EmbeddingGenerator(openaiApiKey);
    this.capabilityMatcher = new AgentCapabilityMatcher(capabilityDiscovery);
    this.resultRanker = new SearchResultRanker();
    this.vectorStore = new SupabaseVectorStore(supabaseUrl, supabaseKey);
  }

  /**
   * Search for agents using semantic similarity
   */
  async searchAgents(query: string, options: SearchOptions = {}): Promise<SemanticSearchResult[]> {
    const startTime = Date.now();
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);

      // Perform vector similarity search
      const vectorResults = await this.vectorStore.searchSimilar(
        queryEmbedding,
        options.limit || 20,
        options.minSimilarity || 0.5
      );

      // Filter by categories if specified
      const filteredResults = options.categories?.length 
        ? vectorResults.filter(result => 
            options.categories!.includes(result.metadata.category)
          )
        : vectorResults;

      // Calculate capability matches
      const capabilityScores = new Map<string, number>();
      await Promise.all(
        filteredResults.map(async (result) => {
          const score = await this.capabilityMatcher.calculateCapabilityMatch(
            query,
            result.metadata
          );
          capabilityScores.set(result.metadata.id, score);
        })
      );

      // Rank and return results
      const rankedResults = this.resultRanker.rankResults(
        filteredResults,
        capabilityScores,
        options
      );

      // Track search analytics
      const searchTime = Date.now() - startTime;
      await this.trackSearchAnalytics({
        query,
        resultsCount: rankedResults.length,
        searchTime
      });

      return rankedResults.slice(0, options.limit || 10);
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw new Error(`Search operation failed: ${error}`);
    }
  }

  /**
   * Index a new agent for semantic search
   */
  async indexAgent(agent: AgentMetadata): Promise<void> {
    try {
      // Create searchable text from agent metadata
      const searchableText = this.createSearchableText(agent);

      // Generate embedding
      const embedding = await this.embeddingGenerator.generateEmbedding(searchableText);

      // Store in vector database
      await this.vectorStore.storeEmbedding(agent.id, embedding, agent);
    } catch (error) {
      throw new Error(`Failed to index agent: ${error}`);
    }
  }

  /**
   * Update agent index
   */
  async updateAgentIndex(agent: AgentMetadata): Promise<void> {
    try {
      const searchableText = this.createSearchableText(agent);
      const embedding = await this.embeddingGenerator.generateEmbedding(searchableText);
      await this.vectorStore.updateEmbedding(agent.id, embedding, agent);
    } catch (error) {
      throw new Error(`Failed to update agent index: ${error}`);
    }
  }

  /**
   * Remove agent from search index
   */
  async removeAgentFromIndex(agentId: string): Promise<void> {
    try {
      await this.vectorStore.deleteEmbedding(agentId);
    } catch (error) {
      throw new Error(`Failed to remove agent from index: ${error}`);
    }
  }

  /**
   * Bulk index multiple agents
   */
  async bulkIndexAgents(agents: AgentMetadata[]): Promise<void> {
    const batchSize = 100;
    
    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(agent => this.indexAgent(agent))
      );
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    try {
      const embedding = await this.embeddingGenerator.generateEmbedding(partialQuery);
      const results = await this.vectorStore.searchSimilar(embedding, limit * 2, 0.7);
      
      // Extract unique capability-based suggestions
      const suggestions = new Set<string>();
      
      for (const result of results) {
        result.metadata.capabilities.forEach(cap => {
          if (cap.toLowerCase().includes(partialQuery.toLowerCase()) && suggestions.size < limit) {
            suggestions.add(cap);
          }
        });
      }
      
      return Array.from(suggestions);
    } catch (error) {
      console.warn('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Create searchable text representation of agent
   */
  private createSearchableText(agent: AgentMetadata): string {
    return [
      agent.name,
      agent.description,
      agent.category,
      ...agent.capabilities,
      ...agent.tags
    ].filter(Boolean).join(' ');
  }

  /**
   * Track search analytics
   */
  private async trackSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
    try {
      await trackSearchEvent({
        query: analytics.query,
        results_count: analytics.resultsCount,
        search_time_ms: analytics.searchTime,
        clicked_agent_id: analytics.clickedAgentId,
        user_satisfaction: analytics.userSatisfaction,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to track search analytics:', error);
    }
  }
}

export type {
  SemanticSearchResult,
  SearchOptions,
  AgentMetadata,
  VectorStore,
  SearchAnalytics
};
```