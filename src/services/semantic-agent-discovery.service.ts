```typescript
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { redis } from '../lib/cache/redis';
import { supabase } from '../lib/database/supabase';
import { AnalyticsService } from './analytics.service';
import type { Agent, AgentCapability, AgentSearchContext } from '../types/agent.types';

/**
 * Configuration for semantic search parameters
 */
interface SemanticSearchConfig {
  /** Maximum number of results to return */
  maxResults: number;
  /** Minimum similarity threshold (0-1) */
  similarityThreshold: number;
  /** Enable usage pattern weighting */
  useUsagePatterns: boolean;
  /** Cache TTL for embeddings in seconds */
  embeddingCacheTtl: number;
  /** Enable contextual recommendations */
  enableContextualRecs: boolean;
}

/**
 * Search result with relevance scoring
 */
interface AgentSearchResult {
  agent: Agent;
  relevanceScore: number;
  similarityScore: number;
  usageScore: number;
  contextScore: number;
  matchedCapabilities: AgentCapability[];
  reasoning: string[];
}

/**
 * Vector embedding with metadata
 */
interface AgentEmbedding {
  agentId: string;
  embedding: number[];
  capabilities: string[];
  lastUpdated: Date;
  version: string;
}

/**
 * Usage pattern data for contextual scoring
 */
interface UsagePattern {
  userId: string;
  agentId: string;
  queryVector: number[];
  successScore: number;
  timestamp: Date;
  context: Record<string, any>;
}

/**
 * Search context for personalized results
 */
interface SearchContext {
  userId?: string;
  sessionId?: string;
  previousQueries: string[];
  currentProject?: string;
  userPreferences: Record<string, any>;
}

/**
 * Default configuration for semantic search
 */
const DEFAULT_CONFIG: SemanticSearchConfig = {
  maxResults: 10,
  similarityThreshold: 0.7,
  useUsagePatterns: true,
  embeddingCacheTtl: 3600, // 1 hour
  enableContextualRecs: true,
};

/**
 * Semantic Agent Discovery Service
 * 
 * Provides intelligent agent discovery using vector embeddings and semantic search.
 * Matches user queries with agent capabilities using OpenAI embeddings and provides
 * relevance scoring based on similarity, usage patterns, and contextual factors.
 */
export class SemanticAgentDiscoveryService {
  private openai: OpenAI;
  private analytics: AnalyticsService;
  private config: SemanticSearchConfig;
  private embeddingModel = 'text-embedding-3-small';
  private vectorDimension = 1536;

  constructor(config: Partial<SemanticSearchConfig> = {}) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.analytics = new AnalyticsService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Search for agents using semantic matching
   * 
   * @param query - Natural language search query
   * @param context - Search context for personalization
   * @returns Promise resolving to ranked search results
   */
  async searchAgents(
    query: string,
    context: SearchContext = {}
  ): Promise<AgentSearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      // Perform vector similarity search
      const candidates = await this.vectorSearch(queryEmbedding);
      
      // Score and rank results
      const scoredResults = await this.scoreAndRankResults(
        candidates,
        queryEmbedding,
        query,
        context
      );
      
      // Track search analytics
      await this.trackSearchAnalytics(query, scoredResults, context);
      
      return scoredResults.slice(0, this.config.maxResults);
    } catch (error) {
      console.error('Agent search failed:', error);
      throw new Error(`Agent search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Index an agent's capabilities for semantic search
   * 
   * @param agent - Agent to index
   * @returns Promise resolving when indexing is complete
   */
  async indexAgent(agent: Agent): Promise<void> {
    try {
      // Extract searchable text from agent capabilities
      const capabilityText = this.extractCapabilityText(agent);
      
      // Generate embedding for agent capabilities
      const embedding = await this.generateEmbedding(capabilityText);
      
      // Store embedding in vector database
      await this.storeAgentEmbedding({
        agentId: agent.id,
        embedding,
        capabilities: agent.capabilities.map(c => c.name),
        lastUpdated: new Date(),
        version: agent.version || '1.0.0',
      });
      
      console.log(`Agent ${agent.id} successfully indexed`);
    } catch (error) {
      console.error(`Failed to index agent ${agent.id}:`, error);
      throw new Error(`Agent indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update agent index when capabilities change
   * 
   * @param agentId - ID of agent to update
   * @param agent - Updated agent data
   * @returns Promise resolving when update is complete
   */
  async updateAgentIndex(agentId: string, agent: Agent): Promise<void> {
    try {
      // Check if agent exists in index
      const existingEmbedding = await this.getAgentEmbedding(agentId);
      
      if (!existingEmbedding) {
        // Index as new agent
        await this.indexAgent(agent);
        return;
      }
      
      // Generate new embedding
      const capabilityText = this.extractCapabilityText(agent);
      const newEmbedding = await this.generateEmbedding(capabilityText);
      
      // Update existing record
      await this.updateAgentEmbedding(agentId, {
        embedding: newEmbedding,
        capabilities: agent.capabilities.map(c => c.name),
        lastUpdated: new Date(),
        version: agent.version || existingEmbedding.version,
      });
      
      console.log(`Agent ${agentId} index updated`);
    } catch (error) {
      console.error(`Failed to update agent index ${agentId}:`, error);
      throw new Error(`Agent index update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove agent from search index
   * 
   * @param agentId - ID of agent to remove
   * @returns Promise resolving when removal is complete
   */
  async removeAgentFromIndex(agentId: string): Promise<void> {
    try {
      await supabase
        .from('agent_embeddings')
        .delete()
        .eq('agent_id', agentId);
      
      // Clear related cache entries
      await this.clearAgentCache(agentId);
      
      console.log(`Agent ${agentId} removed from index`);
    } catch (error) {
      console.error(`Failed to remove agent ${agentId} from index:`, error);
      throw new Error(`Agent removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get contextual agent recommendations based on usage patterns
   * 
   * @param userId - User ID for personalization
   * @param context - Current context
   * @returns Promise resolving to recommended agents
   */
  async getContextualRecommendations(
    userId: string,
    context: AgentSearchContext = {}
  ): Promise<AgentSearchResult[]> {
    try {
      if (!this.config.enableContextualRecs) {
        return [];
      }
      
      // Analyze user patterns
      const userPatterns = await this.analyzeUserPatterns(userId);
      
      // Get agents with high usage correlation
      const recommendations = await this.generateRecommendations(
        userPatterns,
        context
      );
      
      return recommendations.slice(0, 5); // Top 5 recommendations
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return [];
    }
  }

  /**
   * Generate embedding for query with caching
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const cacheKey = `query_embedding:${Buffer.from(query).toString('base64')}`;
    
    try {
      // Check cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Generate new embedding
      const embedding = await this.generateEmbedding(query);
      
      // Cache with TTL
      await redis.setex(
        cacheKey,
        this.config.embeddingCacheTtl,
        JSON.stringify(embedding)
      );
      
      return embedding;
    } catch (error) {
      console.error('Query embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.trim(),
        encoding_format: 'float',
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform vector similarity search using pgvector
   */
  private async vectorSearch(queryEmbedding: number[]): Promise<Agent[]> {
    try {
      const { data, error } = await supabase.rpc('search_agents_by_embedding', {
        query_embedding: queryEmbedding,
        similarity_threshold: this.config.similarityThreshold,
        match_count: this.config.maxResults * 2, // Get more candidates for ranking
      });
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Score and rank search results using multiple factors
   */
  private async scoreAndRankResults(
    candidates: Agent[],
    queryEmbedding: number[],
    originalQuery: string,
    context: SearchContext
  ): Promise<AgentSearchResult[]> {
    const scoredResults: AgentSearchResult[] = [];
    
    for (const agent of candidates) {
      try {
        // Get agent embedding for detailed scoring
        const agentEmbedding = await this.getAgentEmbedding(agent.id);
        if (!agentEmbedding) continue;
        
        // Calculate similarity score
        const similarityScore = this.calculateCosineSimilarity(
          queryEmbedding,
          agentEmbedding.embedding
        );
        
        // Calculate usage score
        const usageScore = this.config.useUsagePatterns
          ? await this.calculateUsageScore(agent.id, context.userId)
          : 0;
        
        // Calculate context score
        const contextScore = await this.calculateContextScore(
          agent,
          context,
          originalQuery
        );
        
        // Find matched capabilities
        const matchedCapabilities = await this.findMatchedCapabilities(
          agent,
          originalQuery,
          queryEmbedding
        );
        
        // Calculate combined relevance score
        const relevanceScore = this.calculateRelevanceScore(
          similarityScore,
          usageScore,
          contextScore
        );
        
        // Generate reasoning
        const reasoning = this.generateReasoning(
          similarityScore,
          usageScore,
          contextScore,
          matchedCapabilities
        );
        
        scoredResults.push({
          agent,
          relevanceScore,
          similarityScore,
          usageScore,
          contextScore,
          matchedCapabilities,
          reasoning,
        });
      } catch (error) {
        console.error(`Error scoring agent ${agent.id}:`, error);
        continue;
      }
    }
    
    // Sort by relevance score
    return scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Extract searchable text from agent capabilities
   */
  private extractCapabilityText(agent: Agent): string {
    const parts = [
      agent.name,
      agent.description,
      ...agent.capabilities.map(c => `${c.name}: ${c.description}`),
      agent.tags?.join(' ') || '',
    ];
    
    return parts.join(' ').trim();
  }

  /**
   * Store agent embedding in database
   */
  private async storeAgentEmbedding(embedding: AgentEmbedding): Promise<void> {
    const { error } = await supabase
      .from('agent_embeddings')
      .upsert({
        agent_id: embedding.agentId,
        embedding: embedding.embedding,
        capabilities: embedding.capabilities,
        last_updated: embedding.lastUpdated.toISOString(),
        version: embedding.version,
      });
    
    if (error) throw error;
  }

  /**
   * Get agent embedding from database
   */
  private async getAgentEmbedding(agentId: string): Promise<AgentEmbedding | null> {
    const { data, error } = await supabase
      .from('agent_embeddings')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    
    if (error || !data) return null;
    
    return {
      agentId: data.agent_id,
      embedding: data.embedding,
      capabilities: data.capabilities,
      lastUpdated: new Date(data.last_updated),
      version: data.version,
    };
  }

  /**
   * Update agent embedding in database
   */
  private async updateAgentEmbedding(
    agentId: string,
    updates: Partial<AgentEmbedding>
  ): Promise<void> {
    const { error } = await supabase
      .from('agent_embeddings')
      .update({
        ...(updates.embedding && { embedding: updates.embedding }),
        ...(updates.capabilities && { capabilities: updates.capabilities }),
        ...(updates.lastUpdated && { last_updated: updates.lastUpdated.toISOString() }),
        ...(updates.version && { version: updates.version }),
      })
      .eq('agent_id', agentId);
    
    if (error) throw error;
  }

  /**
   * Calculate cosine similarity between vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Calculate usage-based score for an agent
   */
  private async calculateUsageScore(
    agentId: string,
    userId?: string
  ): Promise<number> {
    if (!userId) return 0;
    
    try {
      const { data } = await supabase
        .from('agent_usage_patterns')
        .select('success_score')
        .eq('agent_id', agentId)
        .eq('user_id', userId)
        .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (!data || data.length === 0) return 0;
      
      const averageSuccess = data.reduce((sum, p) => sum + p.success_score, 0) / data.length;
      return averageSuccess;
    } catch (error) {
      console.error('Usage score calculation failed:', error);
      return 0;
    }
  }

  /**
   * Calculate contextual relevance score
   */
  private async calculateContextScore(
    agent: Agent,
    context: SearchContext,
    query: string
  ): Promise<number> {
    let score = 0;
    
    // Project context matching
    if (context.currentProject && agent.tags?.includes(context.currentProject)) {
      score += 0.2;
    }
    
    // Query history relevance
    if (context.previousQueries.length > 0) {
      const queryRelevance = await this.calculateQueryHistoryRelevance(
        agent,
        context.previousQueries
      );
      score += queryRelevance * 0.3;
    }
    
    // User preference matching
    if (context.userPreferences) {
      const prefScore = this.calculatePreferenceMatch(agent, context.userPreferences);
      score += prefScore * 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Find capabilities that match the query
   */
  private async findMatchedCapabilities(
    agent: Agent,
    query: string,
    queryEmbedding: number[]
  ): Promise<AgentCapability[]> {
    const matched: AgentCapability[] = [];
    const queryLower = query.toLowerCase();
    
    for (const capability of agent.capabilities) {
      // Keyword matching
      const capabilityText = `${capability.name} ${capability.description}`.toLowerCase();
      if (capabilityText.includes(queryLower) || 
          queryLower.includes(capability.name.toLowerCase())) {
        matched.push(capability);
      }
    }
    
    return matched;
  }

  /**
   * Calculate combined relevance score
   */
  private calculateRelevanceScore(
    similarityScore: number,
    usageScore: number,
    contextScore: number
  ): number {
    // Weighted combination of scores
    const weights = {
      similarity: 0.6,
      usage: 0.25,
      context: 0.15,
    };
    
    return (
      similarityScore * weights.similarity +
      usageScore * weights.usage +
      contextScore * weights.context
    );
  }

  /**
   * Generate human-readable reasoning for the match
   */
  private generateReasoning(
    similarityScore: number,
    usageScore: number,
    contextScore: number,
    matchedCapabilities: AgentCapability[]
  ): string[] {
    const reasoning: string[] = [];
    
    if (similarityScore > 0.8) {
      reasoning.push('High semantic similarity to your query');
    } else if (similarityScore > 0.6) {
      reasoning.push('Good semantic match for your needs');
    }
    
    if (usageScore > 0.7) {
      reasoning.push('Previously successful for similar tasks');
    } else if (usageScore > 0.4) {
      reasoning.push('Some positive usage history');
    }
    
    if (contextScore > 0.5) {
      reasoning.push('Well-suited for your current context');
    }
    
    if (matchedCapabilities.length > 0) {
      reasoning.push(
        `Matches ${matchedCapabilities.length} relevant ${matchedCapabilities.length === 1 ? 'capability' : 'capabilities'}`
      );
    }
    
    if (reasoning.length === 0) {
      reasoning.push('Basic compatibility with your query');
    }
    
    return reasoning;
  }

  /**
   * Analyze user patterns for recommendations
   */
  private async analyzeUserPatterns(userId: string): Promise<UsagePattern[]> {
    try {
      const { data } = await supabase
        .from('agent_usage_patterns')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(50);
      
      return data || [];
    } catch (error) {
      console.error('User pattern analysis failed:', error);
      return [];
    }
  }

  /**
   * Generate contextual recommendations
   */
  private async generateRecommendations(
    patterns: UsagePattern[],
    context: AgentSearchContext
  ): Promise<AgentSearchResult[]> {
    // Implementation would analyze patterns and generate recommendations
    // This is a simplified version
    return [];
  }

  /**
   * Calculate query history relevance
   */
  private async calculateQueryHistoryRelevance(
    agent: Agent,
    previousQueries: string[]
  ): Promise<number> {
    // Implementation would compare agent capabilities with previous queries
    return 0;
  }

  /**
   * Calculate preference matching score
   */
  private calculatePreferenceMatch(
    agent: Agent,
    preferences: Record<string, any>
  ): number {
    // Implementation would match agent properties with user preferences
    return 0;
  }

  /**
   * Clear agent-related cache entries
   */
  private async clearAgentCache(agentId: string): Promise<void> {
    try {
      const pattern = `*agent*${agentId}*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clearing failed:', error);
    }
  }

  /**
   * Track search analytics
   */
  private async trackSearchAnalytics(
    query: string,
    results: AgentSearchResult[],
    context: SearchContext
  ): Promise<void> {
    try {
      await this.analytics.trackEvent('agent_search', {
        query,
        resultCount: results.length,
        topScore: results[0]?.relevanceScore || 0,
        userId: context.userId,
        sessionId: context.sessionId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Search analytics tracking failed:', error);
    }
  }
}

// Export default instance
export const semanticAgentDiscovery = new SemanticAgentDiscoveryService();

// Export types for external use
export type {
  SemanticSearchConfig,
  AgentSearchResult,
  AgentEmbedding,
  UsagePattern,
  SearchContext,
};
```