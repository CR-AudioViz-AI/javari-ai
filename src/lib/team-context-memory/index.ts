import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import OpenAI from 'openai';

/**
 * Represents a context memory entry with metadata
 */
interface ContextMemory {
  id: string;
  teamId: string;
  sessionId: string;
  content: string;
  type: 'insight' | 'decision' | 'context' | 'learning' | 'pattern';
  privacyLevel: 'public' | 'team' | 'restricted' | 'private';
  embedding: number[];
  tags: string[];
  createdBy: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  relatedMemories: string[];
  expiresAt?: Date;
}

/**
 * Privacy boundary configuration
 */
interface PrivacyBoundary {
  teamId: string;
  level: 'public' | 'team' | 'restricted' | 'private';
  allowedTeams: string[];
  restrictedFields: string[];
  encryptionRequired: boolean;
  retentionPolicy: {
    duration: number;
    autoDelete: boolean;
  };
}

/**
 * Team collaboration context
 */
interface CollaborationContext {
  sessionId: string;
  teamMembers: string[];
  sharedInsights: string[];
  activeTasks: string[];
  contextFlow: {
    timestamp: Date;
    event: string;
    context: string;
    participants: string[];
  }[];
}

/**
 * Context search parameters
 */
interface SearchParams {
  query: string;
  teamId: string;
  type?: string[];
  privacyLevel?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  similarity?: number;
  limit?: number;
}

/**
 * Memory synchronization event
 */
interface MemorySyncEvent {
  type: 'created' | 'updated' | 'deleted' | 'accessed';
  memoryId: string;
  teamId: string;
  timestamp: Date;
  changes?: Partial<ContextMemory>;
}

/**
 * Configuration for the team context memory system
 */
interface TeamContextConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  openaiApiKey: string;
  encryptionKey: string;
  defaultRetentionDays: number;
  maxMemorySize: number;
  syncInterval: number;
}

/**
 * Distributed memory system for AI team collaboration with privacy boundaries
 * and real-time synchronization capabilities
 */
export class TeamContextMemorySystem extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private openai: OpenAI;
  private config: TeamContextConfig;
  private memoryCache: Map<string, ContextMemory> = new Map();
  private privacyController: PrivacyBoundaryController;
  private insightsEngine: SharedInsightsEngine;
  private historyTracker: CollaborativeHistoryTracker;
  private syncManager: TeamMemorySync;

  constructor(config: TeamContextConfig) {
    super();
    this.config = config;
    this.initializeClients();
    this.initializeComponents();
    this.setupRealtimeSync();
  }

  /**
   * Initialize external service clients
   */
  private initializeClients(): void {
    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
    this.redis = new Redis(this.config.redisUrl);
    this.openai = new OpenAI({ apiKey: this.config.openaiApiKey });
  }

  /**
   * Initialize system components
   */
  private initializeComponents(): void {
    this.privacyController = new PrivacyBoundaryController(this.supabase, this.config.encryptionKey);
    this.insightsEngine = new SharedInsightsEngine(this.openai, this.redis);
    this.historyTracker = new CollaborativeHistoryTracker(this.supabase, this.redis);
    this.syncManager = new TeamMemorySync(this.supabase, this.redis, this);
  }

  /**
   * Set up real-time synchronization
   */
  private setupRealtimeSync(): void {
    this.supabase
      .channel('team_memory_sync')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'context_memories' },
        (payload) => this.handleMemoryChange(payload)
      )
      .subscribe();

    setInterval(() => this.syncManager.performSync(), this.config.syncInterval);
  }

  /**
   * Store context memory with privacy boundaries
   */
  async storeContext(
    teamId: string,
    sessionId: string,
    content: string,
    type: ContextMemory['type'],
    privacyLevel: ContextMemory['privacyLevel'] = 'team',
    userId: string,
    tags: string[] = []
  ): Promise<string> {
    try {
      const memoryId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(content);
      
      // Apply privacy boundaries
      const processedContent = await this.privacyController.processContent(
        content,
        privacyLevel,
        teamId
      );

      const memory: ContextMemory = {
        id: memoryId,
        teamId,
        sessionId,
        content: processedContent,
        type,
        privacyLevel,
        embedding,
        tags,
        createdBy: userId,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        relatedMemories: [],
        ...(this.config.defaultRetentionDays > 0 && {
          expiresAt: new Date(Date.now() + this.config.defaultRetentionDays * 24 * 60 * 60 * 1000)
        })
      };

      // Store in database
      await this.supabase.from('context_memories').insert(memory);
      
      // Cache in Redis
      await this.redis.setex(`memory:${memoryId}`, 3600, JSON.stringify(memory));
      
      // Update local cache
      this.memoryCache.set(memoryId, memory);

      // Extract and store insights
      await this.insightsEngine.extractInsights(memory);
      
      // Track collaboration event
      await this.historyTracker.recordEvent(sessionId, 'context_stored', {
        memoryId,
        type,
        tags
      });

      this.emit('memoryStored', { memoryId, teamId, type });
      
      return memoryId;
    } catch (error) {
      throw new Error(`Failed to store context: ${error.message}`);
    }
  }

  /**
   * Retrieve context memories with privacy filtering
   */
  async getTeamContext(
    teamId: string,
    userId: string,
    filters?: Partial<SearchParams>
  ): Promise<ContextMemory[]> {
    try {
      // Check cache first
      const cacheKey = `team_context:${teamId}:${JSON.stringify(filters)}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        const memories = JSON.parse(cached);
        return this.privacyController.filterByUserAccess(memories, userId, teamId);
      }

      // Build query
      let query = this.supabase
        .from('context_memories')
        .select('*')
        .eq('teamId', teamId);

      if (filters?.type) {
        query = query.in('type', filters.type);
      }

      if (filters?.timeRange) {
        query = query
          .gte('createdAt', filters.timeRange.start.toISOString())
          .lte('createdAt', filters.timeRange.end.toISOString());
      }

      const { data: memories, error } = await query
        .order('lastAccessed', { ascending: false })
        .limit(filters?.limit || 50);

      if (error) throw error;

      // Apply privacy filtering
      const filteredMemories = await this.privacyController.filterByUserAccess(
        memories || [],
        userId,
        teamId
      );

      // Cache results
      await this.redis.setex(cacheKey, 300, JSON.stringify(filteredMemories));

      return filteredMemories;
    } catch (error) {
      throw new Error(`Failed to retrieve team context: ${error.message}`);
    }
  }

  /**
   * Perform semantic search across team memories
   */
  async searchContext(params: SearchParams, userId: string): Promise<ContextMemory[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(params.query);
      
      // Get potential matches from database
      const { data: memories, error } = await this.supabase
        .from('context_memories')
        .select('*')
        .eq('teamId', params.teamId);

      if (error) throw error;

      // Calculate similarity scores
      const scoredMemories = (memories || [])
        .map(memory => ({
          ...memory,
          similarity: this.calculateCosineSimilarity(queryEmbedding, memory.embedding)
        }))
        .filter(memory => memory.similarity > (params.similarity || 0.7))
        .sort((a, b) => b.similarity - a.similarity);

      // Apply privacy filtering
      const filteredMemories = await this.privacyController.filterByUserAccess(
        scoredMemories,
        userId,
        params.teamId
      );

      // Update access counts
      await this.updateAccessCounts(filteredMemories.map(m => m.id));

      return filteredMemories.slice(0, params.limit || 20);
    } catch (error) {
      throw new Error(`Failed to search context: ${error.message}`);
    }
  }

  /**
   * Share insights between teams
   */
  async shareInsight(
    sourceTeamId: string,
    targetTeamId: string,
    memoryId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const memory = await this.getMemoryById(memoryId);
      
      if (!memory || memory.teamId !== sourceTeamId) {
        throw new Error('Memory not found or access denied');
      }

      // Check sharing permissions
      const canShare = await this.privacyController.canShareBetweenTeams(
        sourceTeamId,
        targetTeamId,
        memory.privacyLevel
      );

      if (!canShare) {
        throw new Error('Sharing not permitted by privacy boundaries');
      }

      // Create shared copy
      const sharedMemoryId = await this.storeContext(
        targetTeamId,
        `shared_${memory.sessionId}`,
        memory.content,
        memory.type,
        'team',
        userId,
        [...memory.tags, `shared_from:${sourceTeamId}`]
      );

      // Track sharing event
      await this.historyTracker.recordEvent(memory.sessionId, 'insight_shared', {
        sourceTeam: sourceTeamId,
        targetTeam: targetTeamId,
        originalMemoryId: memoryId,
        sharedMemoryId
      });

      this.emit('insightShared', {
        sourceTeamId,
        targetTeamId,
        memoryId: sharedMemoryId
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to share insight: ${error.message}`);
    }
  }

  /**
   * Get collaborative history for a session
   */
  async getCollaborationHistory(sessionId: string, teamId: string): Promise<CollaborationContext> {
    try {
      return await this.historyTracker.getSessionHistory(sessionId, teamId);
    } catch (error) {
      throw new Error(`Failed to get collaboration history: ${error.message}`);
    }
  }

  /**
   * Update privacy boundaries for team memories
   */
  async updatePrivacyBoundaries(
    teamId: string,
    boundaries: PrivacyBoundary,
    userId: string
  ): Promise<void> {
    try {
      await this.privacyController.updateTeamBoundaries(teamId, boundaries, userId);
      
      // Clear affected caches
      const pattern = `team_context:${teamId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.emit('privacyBoundariesUpdated', { teamId, boundaries });
    } catch (error) {
      throw new Error(`Failed to update privacy boundaries: ${error.message}`);
    }
  }

  /**
   * Generate embedding for semantic indexing
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000) // Limit input size
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get memory by ID with caching
   */
  private async getMemoryById(id: string): Promise<ContextMemory | null> {
    try {
      // Check local cache first
      if (this.memoryCache.has(id)) {
        return this.memoryCache.get(id)!;
      }

      // Check Redis cache
      const cached = await this.redis.get(`memory:${id}`);
      if (cached) {
        const memory = JSON.parse(cached);
        this.memoryCache.set(id, memory);
        return memory;
      }

      // Query database
      const { data, error } = await this.supabase
        .from('context_memories')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;

      // Cache the result
      this.memoryCache.set(id, data);
      await this.redis.setex(`memory:${id}`, 3600, JSON.stringify(data));

      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update access counts for memories
   */
  private async updateAccessCounts(memoryIds: string[]): Promise<void> {
    try {
      const updates = memoryIds.map(id => ({
        id,
        lastAccessed: new Date(),
        accessCount: this.memoryCache.get(id)?.accessCount || 0 + 1
      }));

      await this.supabase
        .from('context_memories')
        .upsert(updates, { onConflict: 'id' });

      // Update local cache
      updates.forEach(update => {
        const memory = this.memoryCache.get(update.id);
        if (memory) {
          memory.lastAccessed = update.lastAccessed;
          memory.accessCount = update.accessCount;
        }
      });
    } catch (error) {
      console.error('Failed to update access counts:', error);
    }
  }

  /**
   * Handle real-time memory changes
   */
  private handleMemoryChange(payload: any): void {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      const syncEvent: MemorySyncEvent = {
        type: eventType === 'INSERT' ? 'created' : 
              eventType === 'UPDATE' ? 'updated' : 'deleted',
        memoryId: newRecord?.id || oldRecord?.id,
        teamId: newRecord?.teamId || oldRecord?.teamId,
        timestamp: new Date(),
        changes: eventType === 'UPDATE' ? newRecord : undefined
      };

      this.emit('memorySyncEvent', syncEvent);
      
      // Update local cache
      if (eventType === 'DELETE') {
        this.memoryCache.delete(syncEvent.memoryId);
        this.redis.del(`memory:${syncEvent.memoryId}`);
      } else if (newRecord) {
        this.memoryCache.set(syncEvent.memoryId, newRecord);
        this.redis.setex(`memory:${syncEvent.memoryId}`, 3600, JSON.stringify(newRecord));
      }
    } catch (error) {
      console.error('Failed to handle memory change:', error);
    }
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpiredMemories(): Promise<number> {
    try {
      const { data: expiredMemories, error } = await this.supabase
        .from('context_memories')
        .select('id')
        .lt('expiresAt', new Date().toISOString());

      if (error || !expiredMemories?.length) return 0;

      const memoryIds = expiredMemories.map(m => m.id);

      await this.supabase
        .from('context_memories')
        .delete()
        .in('id', memoryIds);

      // Clear from caches
      const pipeline = this.redis.pipeline();
      memoryIds.forEach(id => {
        this.memoryCache.delete(id);
        pipeline.del(`memory:${id}`);
      });
      await pipeline.exec();

      return memoryIds.length;
    } catch (error) {
      throw new Error(`Failed to cleanup expired memories: ${error.message}`);
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    totalMemories: number;
    memoriesByTeam: Record<string, number>;
    memoriesByType: Record<string, number>;
    avgAccessCount: number;
    storageSize: number;
  }> {
    try {
      const { data: memories, error } = await this.supabase
        .from('context_memories')
        .select('teamId, type, accessCount, content');

      if (error) throw error;

      const stats = {
        totalMemories: memories?.length || 0,
        memoriesByTeam: {} as Record<string, number>,
        memoriesByType: {} as Record<string, number>,
        avgAccessCount: 0,
        storageSize: 0
      };

      if (memories) {
        const totalAccess = memories.reduce((sum, m) => {
          stats.memoriesByTeam[m.teamId] = (stats.memoriesByTeam[m.teamId] || 0) + 1;
          stats.memoriesByType[m.type] = (stats.memoriesByType[m.type] || 0) + 1;
          stats.storageSize += m.content.length;
          return sum + m.accessCount;
        }, 0);

        stats.avgAccessCount = totalAccess / memories.length;
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get system stats: ${error.message}`);
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    try {
      await this.redis.quit();
      this.removeAllListeners();
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

/**
 * Privacy boundary controller for managing access permissions
 */
class PrivacyBoundaryController {
  constructor(
    private supabase: SupabaseClient,
    private encryptionKey: string
  ) {}

  async processContent(content: string, privacyLevel: string, teamId: string): Promise<string> {
    if (privacyLevel === 'private') {
      return await this.encryptContent(content);
    }
    return content;
  }

  async filterByUserAccess(
    memories: any[],
    userId: string,
    teamId: string
  ): Promise<ContextMemory[]> {
    const userPermissions = await this.getUserPermissions(userId, teamId);
    
    return memories.filter(memory => {
      if (memory.privacyLevel === 'public') return true;
      if (memory.privacyLevel === 'team' && memory.teamId === teamId) return true;
      if (memory.privacyLevel === 'private' && memory.createdBy === userId) return true;
      
      return userPermissions.includes(memory.privacyLevel);
    });
  }

  async canShareBetweenTeams(
    sourceTeamId: string,
    targetTeamId: string,
    privacyLevel: string
  ): Promise<boolean> {
    if (privacyLevel === 'private') return false;
    if (privacyLevel === 'public') return true;
    
    const { data: boundary } = await this.supabase
      .from('privacy_boundaries')
      .select('allowedTeams')
      .eq('teamId', sourceTeamId)
      .single();
    
    return boundary?.allowedTeams?.includes(targetTeamId) || false;
  }

  async updateTeamBoundaries(
    teamId: string,
    boundaries: PrivacyBoundary,
    userId: string
  ): Promise<void> {
    await this.supabase
      .from('privacy_boundaries')
      .upsert({ ...boundaries, updatedBy: userId, updatedAt: new Date() });
  }

  private async encryptContent(content: string): Promise<string> {
    // Simplified encryption - use proper encryption library in production
    return Buffer.from(content).toString('base64');
  }

  private async getUserPermissions(userId: string, teamId: string): Promise<string[]> {
    const { data: permissions } = await this.supabase
      .from('team_permissions')
      .select('permissions')
      .eq('userId', userId)
      .eq('teamId', teamId)
      .single();
    
    return permissions?.permissions || [];
  }
}

/**
 * Shared insights engine for extracting and distributing insights
 */
class SharedInsightsEngine {
  constructor(
    private openai: OpenAI,
    private redis: Redis
  ) {}

  async extractInsights(memory: ContextMemory): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Extract key insights from