```typescript
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Individual memory unit with metadata and relationships
 */
export interface MemoryNode {
  id: string;
  teamId: string;
  agentId: string;
  content: string;
  embedding?: number[];
  metadata: {
    type: 'insight' | 'context' | 'learning' | 'decision' | 'preference';
    tags: string[];
    confidence: number;
    timestamp: Date;
    sessionId?: string;
    parentNodeId?: string;
    relatedNodes: string[];
  };
  accessCount: number;
  lastAccessed: Date;
  expiresAt?: Date;
  isCompressed: boolean;
  compressionRatio?: number;
}

/**
 * Session-scoped shared state for team collaboration
 */
export interface TeamContext {
  id: string;
  teamId: string;
  sessionId: string;
  activeAgents: string[];
  sharedState: Record<string, any>;
  currentGoals: string[];
  recentInsights: MemoryNode[];
  conflictResolutions: ConflictResolution[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Memory conflict resolution record
 */
export interface ConflictResolution {
  id: string;
  conflictType: 'concurrent_write' | 'semantic_duplicate' | 'contradictory_insight';
  memoryNodeIds: string[];
  resolution: 'merge' | 'prioritize' | 'create_variant';
  resolvedBy: string;
  timestamp: Date;
  reasoning: string;
}

/**
 * Memory search parameters and filters
 */
export interface MemorySearchOptions {
  query?: string;
  semanticSearch?: boolean;
  filters?: {
    agentId?: string;
    type?: MemoryNode['metadata']['type'];
    tags?: string[];
    dateRange?: [Date, Date];
    sessionId?: string;
    minConfidence?: number;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'timestamp' | 'access_count' | 'confidence';
  includeExpired?: boolean;
}

/**
 * Memory operation result with metadata
 */
export interface MemoryOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  conflictsDetected?: ConflictResolution[];
  compressionApplied?: boolean;
  syncStatus: 'synchronized' | 'pending' | 'failed';
}

/**
 * Memory compression configuration
 */
export interface CompressionConfig {
  enabled: boolean;
  maxMemoryNodes: number;
  compressionThreshold: number;
  preserveRecent: number;
  preserveHighAccess: number;
  semanticSimilarityThreshold: number;
}

/**
 * Handles concurrent memory updates and conflicts
 */
class MemoryConflictResolver {
  private pendingResolutions = new Map<string, ConflictResolution>();

  /**
   * Resolves conflicts between concurrent memory operations
   */
  async resolveConflict(
    existingMemory: MemoryNode,
    newMemory: MemoryNode,
    conflictType: ConflictResolution['conflictType']
  ): Promise<ConflictResolution> {
    const conflictId = `${existingMemory.id}_${newMemory.id}_${Date.now()}`;
    
    let resolution: ConflictResolution;

    switch (conflictType) {
      case 'concurrent_write':
        resolution = await this.resolveConcurrentWrite(existingMemory, newMemory, conflictId);
        break;
      case 'semantic_duplicate':
        resolution = await this.resolveSemanticDuplicate(existingMemory, newMemory, conflictId);
        break;
      case 'contradictory_insight':
        resolution = await this.resolveContradictoryInsight(existingMemory, newMemory, conflictId);
        break;
      default:
        throw new Error(`Unknown conflict type: ${conflictType}`);
    }

    this.pendingResolutions.set(conflictId, resolution);
    return resolution;
  }

  private async resolveConcurrentWrite(
    existing: MemoryNode,
    newMemory: MemoryNode,
    conflictId: string
  ): Promise<ConflictResolution> {
    // Prioritize based on confidence and recency
    const resolution = existing.metadata.confidence > newMemory.metadata.confidence ? 'prioritize' : 'merge';
    
    return {
      id: conflictId,
      conflictType: 'concurrent_write',
      memoryNodeIds: [existing.id, newMemory.id],
      resolution: resolution as any,
      resolvedBy: 'system',
      timestamp: new Date(),
      reasoning: `Resolved by ${resolution === 'prioritize' ? 'confidence priority' : 'content merge'}`
    };
  }

  private async resolveSemanticDuplicate(
    existing: MemoryNode,
    newMemory: MemoryNode,
    conflictId: string
  ): Promise<ConflictResolution> {
    return {
      id: conflictId,
      conflictType: 'semantic_duplicate',
      memoryNodeIds: [existing.id, newMemory.id],
      resolution: 'merge',
      resolvedBy: 'system',
      timestamp: new Date(),
      reasoning: 'Merged semantically similar memories to avoid duplication'
    };
  }

  private async resolveContradictoryInsight(
    existing: MemoryNode,
    newMemory: MemoryNode,
    conflictId: string
  ): Promise<ConflictResolution> {
    return {
      id: conflictId,
      conflictType: 'contradictory_insight',
      memoryNodeIds: [existing.id, newMemory.id],
      resolution: 'create_variant',
      resolvedBy: 'system',
      timestamp: new Date(),
      reasoning: 'Created variant to preserve both contradictory insights'
    };
  }
}

/**
 * Provides semantic search and indexing for memories
 */
class MemoryIndexer {
  private openai: OpenAI;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Generates embeddings for memory content
   */
  async generateEmbedding(content: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error('Embedding generation failed');
    }
  }

  /**
   * Calculates semantic similarity between embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Performs semantic search across memory nodes
   */
  async semanticSearch(
    query: string,
    memories: MemoryNode[],
    threshold: number = 0.7
  ): Promise<Array<{ memory: MemoryNode; similarity: number }>> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    const results = memories
      .filter(memory => memory.embedding && memory.embedding.length > 0)
      .map(memory => ({
        memory,
        similarity: this.calculateSimilarity(queryEmbedding, memory.embedding!)
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  }
}

/**
 * Manages memory persistence with Supabase
 */
class MemoryPersistenceLayer {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Stores memory node in database
   */
  async storeMemory(memory: MemoryNode): Promise<void> {
    const { error } = await this.supabase
      .from('team_memories')
      .insert({
        id: memory.id,
        team_id: memory.teamId,
        agent_id: memory.agentId,
        content: memory.content,
        embedding: memory.embedding,
        metadata: memory.metadata,
        access_count: memory.accessCount,
        last_accessed: memory.lastAccessed.toISOString(),
        expires_at: memory.expiresAt?.toISOString(),
        is_compressed: memory.isCompressed,
        compression_ratio: memory.compressionRatio
      });

    if (error) {
      throw new Error(`Failed to store memory: ${error.message}`);
    }
  }

  /**
   * Retrieves memories by team ID with filters
   */
  async getMemories(teamId: string, options: MemorySearchOptions = {}): Promise<MemoryNode[]> {
    let query = this.supabase
      .from('team_memories')
      .select('*')
      .eq('team_id', teamId);

    if (options.filters) {
      const { agentId, type, dateRange, sessionId, minConfidence } = options.filters;
      
      if (agentId) {
        query = query.eq('agent_id', agentId);
      }
      
      if (type) {
        query = query.eq('metadata->>type', type);
      }
      
      if (sessionId) {
        query = query.eq('metadata->>sessionId', sessionId);
      }
      
      if (minConfidence !== undefined) {
        query = query.gte('metadata->>confidence', minConfidence);
      }
      
      if (dateRange) {
        query = query
          .gte('metadata->>timestamp', dateRange[0].toISOString())
          .lte('metadata->>timestamp', dateRange[1].toISOString());
      }
    }

    if (!options.includeExpired) {
      query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to retrieve memories: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseToMemoryNode);
  }

  /**
   * Updates memory node
   */
  async updateMemory(memoryId: string, updates: Partial<MemoryNode>): Promise<void> {
    const { error } = await this.supabase
      .from('team_memories')
      .update({
        content: updates.content,
        embedding: updates.embedding,
        metadata: updates.metadata,
        access_count: updates.accessCount,
        last_accessed: updates.lastAccessed?.toISOString(),
        expires_at: updates.expiresAt?.toISOString(),
        is_compressed: updates.isCompressed,
        compression_ratio: updates.compressionRatio
      })
      .eq('id', memoryId);

    if (error) {
      throw new Error(`Failed to update memory: ${error.message}`);
    }
  }

  /**
   * Stores team context
   */
  async storeTeamContext(context: TeamContext): Promise<void> {
    const { error } = await this.supabase
      .from('team_contexts')
      .upsert({
        id: context.id,
        team_id: context.teamId,
        session_id: context.sessionId,
        active_agents: context.activeAgents,
        shared_state: context.sharedState,
        current_goals: context.currentGoals,
        recent_insights: context.recentInsights.map(insight => insight.id),
        conflict_resolutions: context.conflictResolutions,
        created_at: context.createdAt.toISOString(),
        updated_at: context.updatedAt.toISOString(),
        is_active: context.isActive
      });

    if (error) {
      throw new Error(`Failed to store team context: ${error.message}`);
    }
  }

  /**
   * Retrieves team context by session ID
   */
  async getTeamContext(teamId: string, sessionId: string): Promise<TeamContext | null> {
    const { data, error } = await this.supabase
      .from('team_contexts')
      .select('*')
      .eq('team_id', teamId)
      .eq('session_id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    // Fetch recent insights
    const recentInsights = await this.getMemories(teamId, {
      filters: { sessionId },
      limit: 10,
      sortBy: 'timestamp'
    });

    return {
      id: data.id,
      teamId: data.team_id,
      sessionId: data.session_id,
      activeAgents: data.active_agents,
      sharedState: data.shared_state,
      currentGoals: data.current_goals,
      recentInsights,
      conflictResolutions: data.conflict_resolutions,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      isActive: data.is_active
    };
  }

  private mapDatabaseToMemoryNode(data: any): MemoryNode {
    return {
      id: data.id,
      teamId: data.team_id,
      agentId: data.agent_id,
      content: data.content,
      embedding: data.embedding,
      metadata: data.metadata,
      accessCount: data.access_count,
      lastAccessed: new Date(data.last_accessed),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      isCompressed: data.is_compressed,
      compressionRatio: data.compression_ratio
    };
  }
}

/**
 * Handles real-time memory synchronization across team agents
 */
class MemoryBroadcaster extends EventEmitter {
  private supabase: SupabaseClient;
  private channels = new Map<string, RealtimeChannel>();

  constructor(supabaseUrl: string, supabaseKey: string) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Subscribes to team memory updates
   */
  async subscribeToTeam(teamId: string): Promise<void> {
    if (this.channels.has(teamId)) {
      return;
    }

    const channel = this.supabase
      .channel(`team_memories:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_memories',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          this.emit('memoryUpdate', {
            teamId,
            eventType: payload.eventType,
            memory: payload.new || payload.old
          });
        }
      )
      .subscribe();

    this.channels.set(teamId, channel);
  }

  /**
   * Unsubscribes from team memory updates
   */
  async unsubscribeFromTeam(teamId: string): Promise<void> {
    const channel = this.channels.get(teamId);
    if (channel) {
      await this.supabase.removeChannel(channel);
      this.channels.delete(teamId);
    }
  }

  /**
   * Broadcasts memory update to team
   */
  async broadcastUpdate(teamId: string, memory: MemoryNode, operation: string): Promise<void> {
    const channel = this.channels.get(teamId);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'memory_update',
        payload: { memory, operation, timestamp: new Date() }
      });
    }
  }
}

/**
 * Manages memory compression to optimize storage and performance
 */
class MemoryCompressionEngine {
  private config: CompressionConfig;
  private indexer: MemoryIndexer;

  constructor(config: CompressionConfig, indexer: MemoryIndexer) {
    this.config = config;
    this.indexer = indexer;
  }

  /**
   * Compresses memories when threshold is reached
   */
  async compressMemories(memories: MemoryNode[]): Promise<MemoryNode[]> {
    if (!this.config.enabled || memories.length <= this.config.maxMemoryNodes) {
      return memories;
    }

    // Sort memories by importance score
    const scoredMemories = memories.map(memory => ({
      memory,
      score: this.calculateImportanceScore(memory)
    }));

    scoredMemories.sort((a, b) => b.score - a.score);

    // Preserve high-priority memories
    const preserved = scoredMemories
      .slice(0, this.config.preserveRecent + this.config.preserveHighAccess)
      .map(item => item.memory);

    // Compress remaining memories
    const toCompress = scoredMemories
      .slice(this.config.preserveRecent + this.config.preserveHighAccess)
      .map(item => item.memory);

    const compressed = await this.performCompression(toCompress);

    return [...preserved, ...compressed];
  }

  /**
   * Calculates importance score for memory prioritization
   */
  private calculateImportanceScore(memory: MemoryNode): number {
    const recencyScore = Math.max(0, 1 - (Date.now() - memory.lastAccessed.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const accessScore = Math.min(1, memory.accessCount / 10);
    const confidenceScore = memory.metadata.confidence;

    return (recencyScore * 0.4) + (accessScore * 0.3) + (confidenceScore * 0.3);
  }

  /**
   * Performs actual memory compression using semantic clustering
   */
  private async performCompression(memories: MemoryNode[]): Promise<MemoryNode[]> {
    const clusters = await this.clusterSimilarMemories(memories);
    const compressed: MemoryNode[] = [];

    for (const cluster of clusters) {
      if (cluster.length === 1) {
        compressed.push(cluster[0]);
      } else {
        const compressedMemory = await this.mergeMemories(cluster);
        compressed.push(compressedMemory);
      }
    }

    return compressed;
  }

  /**
   * Clusters memories by semantic similarity
   */
  private async clusterSimilarMemories(memories: MemoryNode[]): Promise<MemoryNode[][]> {
    const clusters: MemoryNode[][] = [];
    const processed = new Set<string>();

    for (const memory of memories) {
      if (processed.has(memory.id) || !memory.embedding) {
        continue;
      }

      const cluster = [memory];
      processed.add(memory.id);

      for (const otherMemory of memories) {
        if (processed.has(otherMemory.id) || !otherMemory.embedding) {
          continue;
        }

        const similarity = this.indexer.calculateSimilarity(memory.embedding, otherMemory.embedding);
        
        if (similarity >= this.config.semanticSimilarityThreshold) {
          cluster.push(otherMemory);
          processed.add(otherMemory.id);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Merges multiple memories into a compressed representation
   */
  private async mergeMemories(memories: MemoryNode[]): Promise<MemoryNode> {
    const merged = memories[0]; // Use first as base
    
    // Combine content
    const combinedContent = memories
      .map(m => m.content)
      .join(' | ');

    // Merge metadata
    const combinedTags = [...new Set(memories.flatMap(m => m.metadata.tags))];
    const avgConfidence = memories.reduce((sum, m) => sum + m.metadata.confidence, 0) / memories.length;

    return {
      ...merged,
      content: combinedContent.length > 500 ? combinedContent.substring(0, 500) + '...' : combinedContent,
      embedding: await this.indexer.generateEmbedding(combinedContent),
      metadata: {
        ...merged.metadata,
        tags: combinedTags,
        confidence: avgConfidence,
        relatedNodes: memories.map(m => m.id)
      },
      isCompressed: true,
      compressionRatio: memories.length,
      accessCount: memories.reduce((sum, m) => sum + m.accessCount, 0),
      lastAccessed: new Date(Math.max(...memories.map(m => m.lastAccessed.getTime())))
    };
  }
}

/**
 * Main service for distributed team memory management
 */
export class SharedTeamMemoryService extends EventEmitter {
  private persistenceLayer: MemoryPersistenceLayer;
  private conflictResolver: MemoryConflictResolver;
  private indexer: MemoryIndexer;
  private broadcaster: MemoryBroadcaster;
  private compressionEngine: MemoryCompressionEngine;
  private redis: Redis;
  private activeContexts = new Map<string, TeamContext>();

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string,
    redisUrl: string,
    compressionConfig: CompressionConfig = {
      enabled: true,
      maxMemoryNodes: 1000,
      compressionThreshold: 800,
      preserveRecent: 100,
      preserveHighAccess: 50,
      semanticSimilarityThreshold: 0.8
    }
  ) {
    super();

    this.persistenceLayer = new MemoryPersistenceLayer(supabaseUrl, supabaseKey);
    this.conflictResolver = new MemoryConflictResolver();
    this.indexer = new MemoryIndexer(openaiApiKey);
    this.broadcaster = new MemoryBroadcaster(supabase