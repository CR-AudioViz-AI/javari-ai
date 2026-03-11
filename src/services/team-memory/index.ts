/**
 * Distributed Team Memory Service for CR AudioViz AI
 * Enables AI agents to share context across team interactions with conflict resolution,
 * memory prioritization, and intelligent garbage collection.
 * 
 * @fileoverview Core service for managing distributed memory across AI agents
 * @version 1.0.0
 * @author CR AudioViz AI Team
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

/**
 * Memory entry stored in the distributed system
 */
export interface TeamMemory {
  /** Unique identifier for the memory entry */
  id: string;
  /** Agent that created this memory */
  agent_id: string;
  /** Type/category of memory */
  memory_type: 'context' | 'preference' | 'knowledge' | 'interaction' | 'error';
  /** Memory content and metadata */
  content: {
    data: any;
    tags?: string[];
    related_agents?: string[];
    session_id?: string;
  };
  /** Priority score for importance ranking */
  priority_score: number;
  /** Number of times memory has been accessed */
  access_count: number;
  /** Memory creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
  /** Memory expiration timestamp */
  expires_at?: Date;
  /** Version for conflict resolution */
  version: number;
}

/**
 * Memory conflict resolution result
 */
export interface ConflictResolution {
  /** Resolved memory entry */
  resolved: TeamMemory;
  /** Conflicting entries that were merged or discarded */
  conflicts: TeamMemory[];
  /** Resolution strategy applied */
  strategy: 'merge' | 'latest' | 'priority' | 'manual';
}

/**
 * Memory query parameters
 */
export interface MemoryQuery {
  /** Filter by agent ID */
  agent_id?: string;
  /** Filter by memory type */
  memory_type?: TeamMemory['memory_type'];
  /** Filter by tags */
  tags?: string[];
  /** Minimum priority score */
  min_priority?: number;
  /** Maximum age in milliseconds */
  max_age?: number;
  /** Limit number of results */
  limit?: number;
  /** Search query for content */
  search?: string;
}

/**
 * Memory statistics and metrics
 */
export interface MemoryStats {
  /** Total number of memories */
  total_count: number;
  /** Count by memory type */
  by_type: Record<TeamMemory['memory_type'], number>;
  /** Average priority score */
  avg_priority: number;
  /** Memory usage by agent */
  by_agent: Record<string, number>;
  /** Cache hit rate */
  cache_hit_rate: number;
  /** Last garbage collection timestamp */
  last_gc: Date;
}

/**
 * Configuration for the team memory service
 */
export interface TeamMemoryConfig {
  /** Supabase URL */
  supabase_url: string;
  /** Supabase anon key */
  supabase_key: string;
  /** Maximum number of memories per agent */
  max_memories_per_agent?: number;
  /** Default memory TTL in milliseconds */
  default_ttl?: number;
  /** Cache size limit */
  cache_size_limit?: number;
  /** Garbage collection interval in milliseconds */
  gc_interval?: number;
  /** Enable real-time synchronization */
  enable_realtime?: boolean;
}

/**
 * In-memory cache for frequently accessed memories
 */
class MemoryCache extends EventEmitter {
  private cache = new Map<string, TeamMemory>();
  private access_times = new Map<string, number>();
  private readonly max_size: number;

  constructor(max_size: number = 1000) {
    super();
    this.max_size = max_size;
  }

  /**
   * Get memory from cache
   */
  get(id: string): TeamMemory | null {
    const memory = this.cache.get(id);
    if (memory) {
      this.access_times.set(id, Date.now());
      return memory;
    }
    return null;
  }

  /**
   * Store memory in cache with LRU eviction
   */
  set(memory: TeamMemory): void {
    if (this.cache.size >= this.max_size && !this.cache.has(memory.id)) {
      this.evictLeastRecent();
    }
    
    this.cache.set(memory.id, memory);
    this.access_times.set(memory.id, Date.now());
  }

  /**
   * Remove memory from cache
   */
  delete(id: string): boolean {
    this.access_times.delete(id);
    return this.cache.delete(id);
  }

  /**
   * Clear all cached memories
   */
  clear(): void {
    this.cache.clear();
    this.access_times.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hit_rate: number } {
    return {
      size: this.cache.size,
      hit_rate: 0 // TODO: Implement hit rate tracking
    };
  }

  /**
   * Evict least recently used memory
   */
  private evictLeastRecent(): void {
    let oldest_time = Date.now();
    let oldest_id = '';

    for (const [id, time] of this.access_times) {
      if (time < oldest_time) {
        oldest_time = time;
        oldest_id = id;
      }
    }

    if (oldest_id) {
      this.delete(oldest_id);
    }
  }
}

/**
 * Resolves conflicts between memory entries from different agents
 */
class ConflictResolver {
  /**
   * Resolve conflicts between memory entries
   */
  resolve(existing: TeamMemory, incoming: TeamMemory): ConflictResolution {
    // Strategy 1: Latest timestamp wins if same type and agent
    if (existing.agent_id === incoming.agent_id && existing.memory_type === incoming.memory_type) {
      const latest = existing.updated_at > incoming.updated_at ? existing : incoming;
      return {
        resolved: { ...latest, version: Math.max(existing.version, incoming.version) + 1 },
        conflicts: [existing, incoming],
        strategy: 'latest'
      };
    }

    // Strategy 2: Higher priority wins
    if (existing.priority_score !== incoming.priority_score) {
      const higher_priority = existing.priority_score > incoming.priority_score ? existing : incoming;
      return {
        resolved: { ...higher_priority, version: higher_priority.version + 1 },
        conflicts: [existing, incoming],
        strategy: 'priority'
      };
    }

    // Strategy 3: Merge compatible memories
    if (this.canMerge(existing, incoming)) {
      return {
        resolved: this.mergeMemories(existing, incoming),
        conflicts: [existing, incoming],
        strategy: 'merge'
      };
    }

    // Default: Keep existing, increment version
    return {
      resolved: { ...existing, version: existing.version + 1 },
      conflicts: [incoming],
      strategy: 'latest'
    };
  }

  /**
   * Check if two memories can be merged
   */
  private canMerge(a: TeamMemory, b: TeamMemory): boolean {
    return a.memory_type === b.memory_type && 
           a.memory_type === 'context' || a.memory_type === 'knowledge';
  }

  /**
   * Merge two compatible memories
   */
  private mergeMemories(a: TeamMemory, b: TeamMemory): TeamMemory {
    return {
      ...a,
      content: {
        ...a.content,
        data: { ...a.content.data, ...b.content.data },
        tags: [...(a.content.tags || []), ...(b.content.tags || [])].filter((tag, index, arr) => arr.indexOf(tag) === index),
        related_agents: [...(a.content.related_agents || []), ...(b.content.related_agents || [])].filter((agent, index, arr) => arr.indexOf(agent) === index)
      },
      priority_score: Math.max(a.priority_score, b.priority_score),
      access_count: a.access_count + b.access_count,
      updated_at: new Date(),
      version: Math.max(a.version, b.version) + 1
    };
  }
}

/**
 * Calculates and manages memory priority scores
 */
class MemoryPrioritizer {
  /**
   * Calculate priority score based on recency, frequency, and relevance
   */
  calculatePriority(memory: TeamMemory, context?: any): number {
    const now = Date.now();
    const age_ms = now - memory.created_at.getTime();
    const access_frequency = memory.access_count;
    
    // Recency score (0-40 points) - newer memories score higher
    const recency_score = Math.max(0, 40 - (age_ms / (1000 * 60 * 60 * 24))); // Points decrease by day
    
    // Frequency score (0-30 points) - more accessed memories score higher
    const frequency_score = Math.min(30, access_frequency * 2);
    
    // Type-based relevance (0-30 points)
    const type_scores = {
      'error': 35,        // Critical information
      'context': 25,      // Important for continuity
      'knowledge': 20,    // Valuable learned information
      'preference': 15,   // User preferences
      'interaction': 10   // General interaction data
    };
    const relevance_score = type_scores[memory.memory_type] || 10;
    
    return Math.round(recency_score + frequency_score + relevance_score);
  }

  /**
   * Update priority scores for a batch of memories
   */
  updatePriorities(memories: TeamMemory[]): TeamMemory[] {
    return memories.map(memory => ({
      ...memory,
      priority_score: this.calculatePriority(memory)
    }));
  }
}

/**
 * Handles garbage collection of stale memories
 */
class GarbageCollector {
  private readonly default_ttl: number;

  constructor(default_ttl: number = 7 * 24 * 60 * 60 * 1000) { // 7 days
    this.default_ttl = default_ttl;
  }

  /**
   * Identify memories that should be garbage collected
   */
  identifyStaleMemories(memories: TeamMemory[]): string[] {
    const now = new Date();
    const stale_ids: string[] = [];

    for (const memory of memories) {
      // Check explicit expiration
      if (memory.expires_at && memory.expires_at < now) {
        stale_ids.push(memory.id);
        continue;
      }

      // Check TTL
      const age = now.getTime() - memory.created_at.getTime();
      if (age > this.default_ttl) {
        // Keep high-priority or frequently accessed memories longer
        if (memory.priority_score < 50 && memory.access_count < 5) {
          stale_ids.push(memory.id);
        }
      }
    }

    return stale_ids;
  }

  /**
   * Clean up memories based on usage patterns and agent limits
   */
  cleanupByUsage(memories: TeamMemory[], max_per_agent: number = 100): string[] {
    const by_agent = new Map<string, TeamMemory[]>();
    
    // Group by agent
    for (const memory of memories) {
      if (!by_agent.has(memory.agent_id)) {
        by_agent.set(memory.agent_id, []);
      }
      by_agent.get(memory.agent_id)!.push(memory);
    }

    const to_delete: string[] = [];

    // Clean up excess memories per agent
    for (const [agent_id, agent_memories] of by_agent) {
      if (agent_memories.length > max_per_agent) {
        // Sort by priority (ascending) and take the lowest priority ones for deletion
        const sorted = agent_memories.sort((a, b) => a.priority_score - b.priority_score);
        const excess = sorted.slice(0, sorted.length - max_per_agent);
        to_delete.push(...excess.map(m => m.id));
      }
    }

    return to_delete;
  }
}

/**
 * Main distributed team memory service
 */
export class TeamMemoryService extends EventEmitter {
  private supabase: SupabaseClient;
  private cache: MemoryCache;
  private conflict_resolver: ConflictResolver;
  private prioritizer: MemoryPrioritizer;
  private garbage_collector: GarbageCollector;
  private realtime_channel?: RealtimeChannel;
  private gc_interval?: NodeJS.Timeout;
  private readonly config: Required<TeamMemoryConfig>;

  constructor(config: TeamMemoryConfig) {
    super();
    
    this.config = {
      max_memories_per_agent: 1000,
      default_ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
      cache_size_limit: 500,
      gc_interval: 60 * 60 * 1000, // 1 hour
      enable_realtime: true,
      ...config
    };

    this.supabase = createClient(config.supabase_url, config.supabase_key);
    this.cache = new MemoryCache(this.config.cache_size_limit);
    this.conflict_resolver = new ConflictResolver();
    this.prioritizer = new MemoryPrioritizer();
    this.garbage_collector = new GarbageCollector(this.config.default_ttl);

    this.initializeRealtime();
    this.startGarbageCollection();
  }

  /**
   * Store a new memory or update existing one
   */
  async storeMemory(memory: Omit<TeamMemory, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<TeamMemory> {
    try {
      const now = new Date();
      const new_memory: TeamMemory = {
        id: this.generateId(),
        created_at: now,
        updated_at: now,
        version: 1,
        ...memory,
        priority_score: this.prioritizer.calculatePriority({ ...memory, id: '', created_at: now, updated_at: now, version: 1 } as TeamMemory)
      };

      // Check for conflicts
      const existing = await this.findSimilarMemory(new_memory);
      let final_memory = new_memory;

      if (existing) {
        const resolution = this.conflict_resolver.resolve(existing, new_memory);
        final_memory = resolution.resolved;
        this.emit('conflict_resolved', resolution);
      }

      // Store in database
      const { data, error } = await this.supabase
        .from('team_memories')
        .upsert(this.serializeMemory(final_memory))
        .select()
        .single();

      if (error) throw error;

      final_memory = this.deserializeMemory(data);
      
      // Update cache
      this.cache.set(final_memory);

      // Broadcast to other agents
      if (this.config.enable_realtime && this.realtime_channel) {
        this.realtime_channel.send({
          type: 'broadcast',
          event: 'memory_stored',
          payload: final_memory
        });
      }

      this.emit('memory_stored', final_memory);
      return final_memory;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Retrieve memory by ID
   */
  async getMemory(id: string): Promise<TeamMemory | null> {
    try {
      // Check cache first
      const cached = this.cache.get(id);
      if (cached) {
        await this.incrementAccessCount(id);
        return cached;
      }

      // Query database
      const { data, error } = await this.supabase
        .from('team_memories')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;

      const memory = this.deserializeMemory(data);
      this.cache.set(memory);
      await this.incrementAccessCount(id);

      return memory;

    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Query memories with filters
   */
  async queryMemories(query: MemoryQuery): Promise<TeamMemory[]> {
    try {
      let db_query = this.supabase.from('team_memories').select('*');

      // Apply filters
      if (query.agent_id) {
        db_query = db_query.eq('agent_id', query.agent_id);
      }
      
      if (query.memory_type) {
        db_query = db_query.eq('memory_type', query.memory_type);
      }
      
      if (query.min_priority !== undefined) {
        db_query = db_query.gte('priority_score', query.min_priority);
      }

      if (query.max_age) {
        const cutoff = new Date(Date.now() - query.max_age);
        db_query = db_query.gte('created_at', cutoff.toISOString());
      }

      if (query.limit) {
        db_query = db_query.limit(query.limit);
      }

      // Order by priority and recency
      db_query = db_query.order('priority_score', { ascending: false })
                         .order('updated_at', { ascending: false });

      const { data, error } = await db_query;
      if (error) throw error;

      let memories = (data || []).map(this.deserializeMemory);

      // Apply additional filters
      if (query.tags && query.tags.length > 0) {
        memories = memories.filter(memory => 
          memory.content.tags?.some(tag => query.tags!.includes(tag))
        );
      }

      if (query.search) {
        const search_lower = query.search.toLowerCase();
        memories = memories.filter(memory =>
          JSON.stringify(memory.content.data).toLowerCase().includes(search_lower)
        );
      }

      return memories;

    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Delete memory by ID
   */
  async deleteMemory(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('team_memories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      this.cache.delete(id);

      // Broadcast deletion
      if (this.config.enable_realtime && this.realtime_channel) {
        this.realtime_channel.send({
          type: 'broadcast',
          event: 'memory_deleted',
          payload: { id }
        });
      }

      this.emit('memory_deleted', id);
      return true;

    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    try {
      const { data, error } = await this.supabase
        .from('team_memories')
        .select('memory_type, agent_id, priority_score');

      if (error) throw error;

      const memories = data || [];
      const by_type: Record<string, number> = {};
      const by_agent: Record<string, number> = {};
      let total_priority = 0;

      for (const memory of memories) {
        by_type[memory.memory_type] = (by_type[memory.memory_type] || 0) + 1;
        by_agent[memory.agent_id] = (by_agent[memory.agent_id] || 0) + 1;
        total_priority += memory.priority_score || 0;
      }

      const cache_stats = this.cache.getStats();

      return {
        total_count: memories.length,
        by_type: by_type as Record<TeamMemory['memory_type'], number>,
        avg_priority: memories.length > 0 ? total_priority / memories.length : 0,
        by_agent,
        cache_hit_rate: cache_stats.hit_rate,
        last_gc: new Date() // TODO: Track actual GC timestamp
      };

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Manually trigger garbage collection
   */
  async runGarbageCollection(): Promise<{ deleted: number; cleaned: number }> {
    try {
      const { data, error } = await this.supabase
        .from('team_memories')
        .select('*');

      if (error) throw error;

      const memories = (data || []).map(this.deserializeMemory);
      
      // Identify stale memories
      const stale_ids = this.garbage_collector.identifyStaleMemories(memories);
      
      // Clean up by usage patterns
      const excess_ids = this.garbage_collector.cleanupByUsage(memories, this.config.max_memories_per_agent);
      
      const all_to_delete = [...new Set([...stale_ids, ...excess_ids])];

      // Delete in batches
      if (all_to_delete.length > 0) {
        const { error: delete_error } = await this.supabase
          .from('team_memories')
          .delete()
          .in('id', all_to_delete);

        if (delete_error) throw delete_error;

        // Clear from cache
        for (const id of all_to_delete) {
          this.cache.delete(id);
        }
      }

      this.emit('garbage_collected', { deleted: all_to_delete.length, stale: stale_ids.length, excess: excess_ids.length });

      return { deleted: all_to_delete.length, cleaned: stale_ids.length };

    } catch (error) {
      this.emit('error', error);
      return { deleted: 0, cleaned: 0 };
    }
  }

  /**
   * Initialize real-time synchronization
   */
  private initializeRealtime(): void {
    if (!this.config.enable_realtime) return;

    this.realtime_channel = this.supabase.channel('team_memories')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'team_memories' },
        (payload) => this.handleRealtimeChange(payload)
      )
      .on('broadcast', 
        { event: 'memory_stored' },
        (payload) => this.handleMemoryBroadcast(payload)
      )
      .on('broadcast',
        { event: 'memory_deleted' },
        (payload) => this.handleMemoryDeleted(payload)
      )
      .subscribe();
  }

  /**
   *