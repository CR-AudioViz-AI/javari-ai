```typescript
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Memory entry interface for typed storage
 */
export interface MemoryEntry<T = any> {
  id: string;
  teamId: string;
  agentId: string;
  category: MemoryCategory;
  content: T;
  metadata: MemoryMetadata;
  embedding?: number[];
  relevanceScore?: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * Memory categories for classification
 */
export enum MemoryCategory {
  CONTEXT = 'context',
  LEARNING = 'learning',
  RESULT = 'result',
  INSIGHT = 'insight',
  TASK_STATE = 'task_state',
  COMMUNICATION = 'communication'
}

/**
 * Memory metadata for enhanced retrieval
 */
export interface MemoryMetadata {
  tags: string[];
  priority: MemoryPriority;
  visibility: MemoryVisibility;
  relations: string[];
  version: number;
  source: string;
}

/**
 * Memory priority levels
 */
export enum MemoryPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * Memory visibility settings
 */
export enum MemoryVisibility {
  PRIVATE = 'private',
  TEAM = 'team',
  PUBLIC = 'public'
}

/**
 * Team context interface
 */
export interface TeamContext {
  teamId: string;
  name: string;
  description: string;
  activeAgents: string[];
  sharedMemories: string[];
  contextWindow: number;
  syncEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Memory query interface
 */
export interface MemoryQuery {
  teamId?: string;
  agentId?: string;
  categories?: MemoryCategory[];
  tags?: string[];
  content?: string;
  embedding?: number[];
  limit?: number;
  offset?: number;
  priority?: MemoryPriority[];
  visibility?: MemoryVisibility[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  semanticThreshold?: number;
}

/**
 * Memory storage interface
 */
export interface MemoryStore {
  store<T>(entry: Omit<MemoryEntry<T>, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry<T>>;
  retrieve<T>(id: string): Promise<MemoryEntry<T> | null>;
  query<T>(query: MemoryQuery): Promise<MemoryEntry<T>[]>;
  update<T>(id: string, updates: Partial<MemoryEntry<T>>): Promise<MemoryEntry<T>>;
  delete(id: string): Promise<boolean>;
  cleanup(teamId: string): Promise<number>;
}

/**
 * Memory synchronization interface
 */
export interface MemorySync {
  subscribe(teamId: string, callback: (entry: MemoryEntry) => void): Promise<void>;
  unsubscribe(teamId: string): Promise<void>;
  broadcast<T>(teamId: string, entry: MemoryEntry<T>): Promise<void>;
  syncTeamMemory(teamId: string): Promise<void>;
}

/**
 * Memory retrieval interface
 */
export interface MemoryRetrieval {
  semanticSearch<T>(query: string, options?: MemoryQuery): Promise<MemoryEntry<T>[]>;
  getRelevantMemories<T>(agentId: string, context: string): Promise<MemoryEntry<T>[]>;
  getTeamInsights<T>(teamId: string): Promise<MemoryEntry<T>[]>;
  getRelatedMemories<T>(memoryId: string): Promise<MemoryEntry<T>[]>;
}

/**
 * Memory persistence interface
 */
export interface MemoryPersistence {
  persist<T>(entry: MemoryEntry<T>): Promise<void>;
  load<T>(id: string): Promise<MemoryEntry<T> | null>;
  backup(teamId: string): Promise<string>;
  restore(teamId: string, backupId: string): Promise<boolean>;
}

/**
 * Memory context interface
 */
export interface MemoryContext {
  assembleContext(agentId: string, taskId?: string): Promise<string>;
  updateContext(agentId: string, newContext: any): Promise<void>;
  getSharedContext(teamId: string): Promise<any>;
  clearContext(agentId: string): Promise<void>;
}

/**
 * Shared Memory Service Configuration
 */
export interface SharedMemoryConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  embeddingService: string;
  maxMemorySize: number;
  syncInterval: number;
  contextWindow: number;
  semanticThreshold: number;
}

/**
 * Shared Memory Service Events
 */
export enum SharedMemoryEvents {
  MEMORY_STORED = 'memory:stored',
  MEMORY_UPDATED = 'memory:updated',
  MEMORY_DELETED = 'memory:deleted',
  TEAM_SYNCED = 'team:synced',
  CONTEXT_UPDATED = 'context:updated',
  ERROR = 'error'
}

/**
 * Shared Team Memory Service
 * 
 * Provides distributed memory capabilities for AI agent teams with real-time
 * synchronization, semantic search, and persistent storage.
 */
export class SharedMemoryService extends EventEmitter {
  private supabase: any;
  private redis: Redis;
  private config: SharedMemoryConfig;
  private subscriptions: Map<string, any> = new Map();
  private cache: Map<string, MemoryEntry> = new Map();

  constructor(config: SharedMemoryConfig) {
    super();
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.redis = new Redis(config.redisUrl);
    this.initializeService();
  }

  /**
   * Initialize the shared memory service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.setupDatabase();
      await this.setupRealTimeSubscriptions();
      this.emit('service:initialized');
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Setup database tables and indexes
   */
  private async setupDatabase(): Promise<void> {
    // Tables are assumed to be created via migrations
    // This method would verify table existence and create indexes if needed
  }

  /**
   * Setup real-time subscriptions for memory updates
   */
  private async setupRealTimeSubscriptions(): Promise<void> {
    const subscription = this.supabase
      .channel('shared_memories')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shared_memories'
      }, (payload: any) => {
        this.handleMemoryUpdate(payload);
      })
      .subscribe();

    this.subscriptions.set('global', subscription);
  }

  /**
   * Handle real-time memory updates
   */
  private handleMemoryUpdate(payload: any): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
      case 'INSERT':
        this.emit(SharedMemoryEvents.MEMORY_STORED, newRecord);
        break;
      case 'UPDATE':
        this.emit(SharedMemoryEvents.MEMORY_UPDATED, newRecord);
        break;
      case 'DELETE':
        this.emit(SharedMemoryEvents.MEMORY_DELETED, oldRecord);
        break;
    }
  }

  /**
   * Store a memory entry
   */
  async storeMemory<T>(entry: Omit<MemoryEntry<T>, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry<T>> {
    try {
      const memoryEntry: MemoryEntry<T> = {
        ...entry,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Generate embedding if content is textual
      if (typeof entry.content === 'string') {
        memoryEntry.embedding = await this.generateEmbedding(entry.content);
      }

      // Store in database
      const { data, error } = await this.supabase
        .from('shared_memories')
        .insert(memoryEntry)
        .select()
        .single();

      if (error) throw error;

      // Cache the entry
      this.cache.set(data.id, data);
      await this.redis.setex(`memory:${data.id}`, 3600, JSON.stringify(data));

      this.emit(SharedMemoryEvents.MEMORY_STORED, data);
      return data;
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Retrieve a memory entry by ID
   */
  async retrieveMemory<T>(id: string): Promise<MemoryEntry<T> | null> {
    try {
      // Check cache first
      if (this.cache.has(id)) {
        return this.cache.get(id) as MemoryEntry<T>;
      }

      // Check Redis cache
      const cached = await this.redis.get(`memory:${id}`);
      if (cached) {
        const entry = JSON.parse(cached) as MemoryEntry<T>;
        this.cache.set(id, entry);
        return entry;
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('shared_memories')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;

      // Update caches
      this.cache.set(id, data);
      await this.redis.setex(`memory:${id}`, 3600, JSON.stringify(data));

      return data;
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      return null;
    }
  }

  /**
   * Query memories based on criteria
   */
  async queryMemories<T>(query: MemoryQuery): Promise<MemoryEntry<T>[]> {
    try {
      let dbQuery = this.supabase.from('shared_memories').select('*');

      // Apply filters
      if (query.teamId) {
        dbQuery = dbQuery.eq('team_id', query.teamId);
      }
      
      if (query.agentId) {
        dbQuery = dbQuery.eq('agent_id', query.agentId);
      }

      if (query.categories?.length) {
        dbQuery = dbQuery.in('category', query.categories);
      }

      if (query.priority?.length) {
        dbQuery = dbQuery.in('metadata->>priority', query.priority.map(p => p.toString()));
      }

      if (query.visibility?.length) {
        dbQuery = dbQuery.in('metadata->>visibility', query.visibility);
      }

      if (query.dateRange) {
        dbQuery = dbQuery
          .gte('created_at', query.dateRange.from.toISOString())
          .lte('created_at', query.dateRange.to.toISOString());
      }

      // Apply pagination
      if (query.offset) {
        dbQuery = dbQuery.range(query.offset, (query.offset + (query.limit || 10)) - 1);
      } else if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      const { data, error } = await dbQuery;
      
      if (error) throw error;

      let results = data || [];

      // Apply semantic filtering if embedding provided
      if (query.embedding && query.semanticThreshold) {
        results = results.filter((entry: any) => {
          if (!entry.embedding) return false;
          const similarity = this.cosineSimilarity(query.embedding!, entry.embedding);
          return similarity >= query.semanticThreshold!;
        });
      }

      return results;
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Update a memory entry
   */
  async updateMemory<T>(id: string, updates: Partial<MemoryEntry<T>>): Promise<MemoryEntry<T>> {
    try {
      const updatedEntry = {
        ...updates,
        updatedAt: new Date()
      };

      const { data, error } = await this.supabase
        .from('shared_memories')
        .update(updatedEntry)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update caches
      this.cache.set(id, data);
      await this.redis.setex(`memory:${id}`, 3600, JSON.stringify(data));

      this.emit(SharedMemoryEvents.MEMORY_UPDATED, data);
      return data;
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('shared_memories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from caches
      this.cache.delete(id);
      await this.redis.del(`memory:${id}`);

      this.emit(SharedMemoryEvents.MEMORY_DELETED, { id });
      return true;
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      return false;
    }
  }

  /**
   * Perform semantic search using embeddings
   */
  async semanticSearch<T>(query: string, options: MemoryQuery = {}): Promise<MemoryEntry<T>[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const memories = await this.queryMemories<T>({
        ...options,
        embedding: queryEmbedding,
        semanticThreshold: options.semanticThreshold || this.config.semanticThreshold
      });

      // Sort by relevance score
      return memories
        .map(memory => ({
          ...memory,
          relevanceScore: memory.embedding 
            ? this.cosineSimilarity(queryEmbedding, memory.embedding)
            : 0
        }))
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Get relevant memories for an agent's context
   */
  async getRelevantMemories<T>(agentId: string, context: string): Promise<MemoryEntry<T>[]> {
    try {
      const contextEmbedding = await this.generateEmbedding(context);
      
      // Get agent's team memories
      const { data: agentData } = await this.supabase
        .from('agents')
        .select('team_id')
        .eq('id', agentId)
        .single();

      if (!agentData) return [];

      const memories = await this.queryMemories<T>({
        teamId: agentData.team_id,
        visibility: [MemoryVisibility.TEAM, MemoryVisibility.PUBLIC],
        embedding: contextEmbedding,
        semanticThreshold: this.config.semanticThreshold,
        limit: this.config.contextWindow
      });

      return memories.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Subscribe to team memory updates
   */
  async subscribeToTeam(teamId: string, callback: (entry: MemoryEntry) => void): Promise<void> {
    try {
      const subscription = this.supabase
        .channel(`team_${teamId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'shared_memories',
          filter: `team_id=eq.${teamId}`
        }, (payload: any) => {
          callback(payload.new || payload.old);
        })
        .subscribe();

      this.subscriptions.set(teamId, subscription);
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from team memory updates
   */
  async unsubscribeFromTeam(teamId: string): Promise<void> {
    const subscription = this.subscriptions.get(teamId);
    if (subscription) {
      await subscription.unsubscribe();
      this.subscriptions.delete(teamId);
    }
  }

  /**
   * Assemble context for an agent
   */
  async assembleContext(agentId: string, taskId?: string): Promise<string> {
    try {
      const relevantMemories = await this.getRelevantMemories(agentId, taskId || '');
      
      const contextParts = relevantMemories.map(memory => {
        return `[${memory.category}] ${JSON.stringify(memory.content)}`;
      });

      return contextParts.join('\n\n');
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Cleanup expired memories
   */
  async cleanup(teamId?: string): Promise<number> {
    try {
      let query = this.supabase
        .from('shared_memories')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const deletedCount = data?.length || 0;
      this.emit('cleanup:completed', { deletedCount, teamId });
      
      return deletedCount;
    } catch (error) {
      this.emit(SharedMemoryEvents.ERROR, error);
      throw error;
    }
  }

  /**
   * Generate embedding for text content
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // This would integrate with your embedding service
    // For now, return a mock embedding
    const words = text.toLowerCase().split(' ');
    return Array(384).fill(0).map((_, i) => Math.sin(words.length * i) * 0.1);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Unsubscribe from all subscriptions
    for (const [teamId] of this.subscriptions) {
      await this.unsubscribeFromTeam(teamId);
    }

    // Close Redis connection
    this.redis.disconnect();

    // Clear caches
    this.cache.clear();

    this.removeAllListeners();
  }
}

/**
 * Team Memory Provider
 * 
 * High-level interface for team memory operations
 */
export class TeamMemoryProvider {
  constructor(private memoryService: SharedMemoryService) {}

  /**
   * Create a new team memory context
   */
  async createTeamContext(teamContext: Omit<TeamContext, 'createdAt' | 'updatedAt'>): Promise<TeamContext> {
    const context: TeamContext = {
      ...teamContext,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store team context in database
    const { data, error } = await this.memoryService['supabase']
      .from('team_contexts')
      .insert(context)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Share insight across team
   */
  async shareInsight<T>(teamId: string, agentId: string, insight: T, metadata?: Partial<MemoryMetadata>): Promise<MemoryEntry<T>> {
    return this.memoryService.storeMemory({
      teamId,
      agentId,
      category: MemoryCategory.INSIGHT,
      content: insight,
      metadata: {
        tags: [],
        priority: MemoryPriority.MEDIUM,
        visibility: MemoryVisibility.TEAM,
        relations: [],
        version: 1,
        source: agentId,
        ...metadata
      }
    });
  }

  /**
   * Get team insights summary
   */
  async getTeamInsights<T>(teamId: string): Promise<MemoryEntry<T>[]> {
    return this.memoryService.queryMemories({
      teamId,
      categories: [MemoryCategory.INSIGHT],
      visibility: [MemoryVisibility.TEAM, MemoryVisibility.PUBLIC],
      limit: 50
    });
  }
}

// Export default service instance creator
export const createSharedMemoryService = (config: SharedMemoryConfig): SharedMemoryService => {
  return new SharedMemoryService(config);
};

export default SharedMemoryService;
```