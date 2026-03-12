```typescript
/**
 * Agent Availability Tracking Microservice
 * 
 * Monitors agent resource consumption, availability windows, and capacity limits.
 * Prevents overselling and manages queue prioritization for high-demand agents.
 * 
 * @fileoverview Core service module for agent availability management
 * @version 1.0.0
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

// Types and Interfaces
export interface AgentAvailabilityConfig {
  agentId: string;
  maxConcurrentTasks: number;
  maxDailyUsage: number;
  maxHourlyUsage: number;
  availabilityWindows: AvailabilityWindow[];
  resourceLimits: ResourceLimits;
  queuePriority: number;
}

export interface AvailabilityWindow {
  id: string;
  agentId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  maxCapacity: number;
  isActive: boolean;
}

export interface ResourceLimits {
  cpuLimit: number;
  memoryLimit: number;
  gpuLimit?: number;
  networkBandwidth: number;
  storageLimit: number;
}

export interface ResourceUsage {
  agentId: string;
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  gpuUsage?: number;
  networkUsage: number;
  storageUsage: number;
  activeConnections: number;
}

export interface CapacityStatus {
  agentId: string;
  isAvailable: boolean;
  currentLoad: number;
  availableSlots: number;
  queueLength: number;
  estimatedWaitTime: number;
  nextAvailableSlot: Date | null;
  resourceUtilization: Record<string, number>;
}

export interface QueueItem {
  id: string;
  agentId: string;
  userId: string;
  priority: number;
  requestedAt: Date;
  estimatedDuration: number;
  resourceRequirements: Partial<ResourceLimits>;
}

export interface AvailabilityMetrics {
  agentId: string;
  uptime: number;
  averageResponseTime: number;
  taskCompletionRate: number;
  resourceEfficiency: number;
  queueMetrics: {
    averageWaitTime: number;
    peakQueueLength: number;
    throughput: number;
  };
}

// Service Configuration
interface ServiceConfig {
  supabase: {
    url: string;
    serviceKey: string;
  };
  redis: {
    url: string;
    keyPrefix: string;
  };
  websocket: {
    port: number;
    heartbeatInterval: number;
  };
  monitoring: {
    updateInterval: number;
    metricsRetention: number;
    alertThresholds: {
      highLoad: number;
      lowAvailability: number;
      longQueue: number;
    };
  };
}

/**
 * Agent Availability Tracking Service
 * 
 * Main service class that orchestrates availability monitoring, capacity management,
 * and queue prioritization for AI agents in the marketplace.
 */
export class AgentAvailabilityService extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private wss: WebSocketServer;
  private config: ServiceConfig;
  private realtimeChannels: Map<string, RealtimeChannel> = new Map();
  private activeConnections: Map<string, WebSocket> = new Map();
  private availabilityCache: Map<string, CapacityStatus> = new Map();
  private queueManager: Map<string, QueueItem[]> = new Map();
  private resourceMonitor: NodeJS.Timer | null = null;

  constructor(config: ServiceConfig) {
    super();
    this.config = config;
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    this.redis = new Redis(config.redis.url);
    this.wss = new WebSocketServer({ port: config.websocket.port });
    
    this.initializeService();
  }

  /**
   * Initialize the availability tracking service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.setupRealtimeSubscriptions();
      await this.initializeWebSocketServer();
      await this.startResourceMonitoring();
      await this.loadInitialAvailabilityData();
      
      this.emit('service:initialized');
      console.log('Agent Availability Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Agent Availability Service:', error);
      throw error;
    }
  }

  /**
   * Set up real-time subscriptions for availability updates
   */
  private async setupRealtimeSubscriptions(): Promise<void> {
    // Agent availability updates
    const availabilityChannel = this.supabase
      .channel('agent-availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_availability' },
        (payload) => this.handleAvailabilityUpdate(payload)
      )
      .subscribe();

    this.realtimeChannels.set('availability', availabilityChannel);

    // Resource usage updates
    const resourceChannel = this.supabase
      .channel('resource-usage')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'resource_usage' },
        (payload) => this.handleResourceUpdate(payload)
      )
      .subscribe();

    this.realtimeChannels.set('resource', resourceChannel);

    // Capacity limits updates
    const capacityChannel = this.supabase
      .channel('capacity-limits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'capacity_limits' },
        (payload) => this.handleCapacityUpdate(payload)
      )
      .subscribe();

    this.realtimeChannels.set('capacity', capacityChannel);
  }

  /**
   * Initialize WebSocket server for real-time capacity broadcasting
   */
  private async initializeWebSocketServer(): Promise<void> {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const connectionId = this.generateConnectionId();
      this.activeConnections.set(connectionId, ws);

      // Send initial availability data
      this.sendInitialAvailabilityData(ws);

      // Handle heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, this.config.websocket.heartbeatInterval);

      ws.on('close', () => {
        clearInterval(heartbeat);
        this.activeConnections.delete(connectionId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket connection error for ${connectionId}:`, error);
        this.activeConnections.delete(connectionId);
      });

      ws.on('message', (data) => {
        this.handleWebSocketMessage(connectionId, data);
      });
    });
  }

  /**
   * Start continuous resource monitoring
   */
  private async startResourceMonitoring(): Promise<void> {
    this.resourceMonitor = setInterval(async () => {
      try {
        await this.updateResourceMetrics();
        await this.processQueueUpdates();
        await this.checkCapacityAlerts();
      } catch (error) {
        console.error('Resource monitoring error:', error);
      }
    }, this.config.monitoring.updateInterval);
  }

  /**
   * Load initial availability data from database
   */
  private async loadInitialAvailabilityData(): Promise<void> {
    const { data: agents, error } = await this.supabase
      .from('agent_availability')
      .select(`
        *,
        availability_windows(*),
        capacity_limits(*),
        resource_usage(*)
      `);

    if (error) {
      throw new Error(`Failed to load initial availability data: ${error.message}`);
    }

    for (const agent of agents || []) {
      const status = await this.calculateCapacityStatus(agent.agent_id);
      this.availabilityCache.set(agent.agent_id, status);
    }
  }

  /**
   * Register a new agent for availability tracking
   */
  public async registerAgent(config: AgentAvailabilityConfig): Promise<void> {
    try {
      // Insert agent availability configuration
      const { error: availabilityError } = await this.supabase
        .from('agent_availability')
        .upsert({
          agent_id: config.agentId,
          max_concurrent_tasks: config.maxConcurrentTasks,
          max_daily_usage: config.maxDailyUsage,
          max_hourly_usage: config.maxHourlyUsage,
          queue_priority: config.queuePriority,
          is_active: true,
          updated_at: new Date().toISOString()
        });

      if (availabilityError) {
        throw availabilityError;
      }

      // Insert availability windows
      for (const window of config.availabilityWindows) {
        const { error: windowError } = await this.supabase
          .from('availability_windows')
          .upsert({
            ...window,
            updated_at: new Date().toISOString()
          });

        if (windowError) {
          throw windowError;
        }
      }

      // Insert resource limits
      const { error: limitsError } = await this.supabase
        .from('capacity_limits')
        .upsert({
          agent_id: config.agentId,
          ...config.resourceLimits,
          updated_at: new Date().toISOString()
        });

      if (limitsError) {
        throw limitsError;
      }

      // Initialize availability status
      const status = await this.calculateCapacityStatus(config.agentId);
      this.availabilityCache.set(config.agentId, status);
      this.queueManager.set(config.agentId, []);

      // Cache in Redis
      await this.cacheAgentConfig(config);

      this.emit('agent:registered', { agentId: config.agentId, status });
    } catch (error) {
      console.error(`Failed to register agent ${config.agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get current availability status for an agent
   */
  public async getAvailabilityStatus(agentId: string): Promise<CapacityStatus | null> {
    try {
      // Try cache first
      let status = this.availabilityCache.get(agentId);
      
      if (!status) {
        // Calculate fresh status
        status = await this.calculateCapacityStatus(agentId);
        if (status) {
          this.availabilityCache.set(agentId, status);
        }
      }

      return status || null;
    } catch (error) {
      console.error(`Failed to get availability status for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Check if an agent can accept a new task
   */
  public async canAcceptTask(agentId: string, resourceRequirements: Partial<ResourceLimits>): Promise<boolean> {
    try {
      const status = await this.getAvailabilityStatus(agentId);
      if (!status || !status.isAvailable) {
        return false;
      }

      // Check capacity limits
      if (status.availableSlots <= 0) {
        return false;
      }

      // Check resource requirements
      const { data: limits } = await this.supabase
        .from('capacity_limits')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (!limits) {
        return false;
      }

      // Validate resource requirements against limits
      const currentUsage = await this.getCurrentResourceUsage(agentId);
      
      if (resourceRequirements.cpuLimit && 
          currentUsage.cpuUsage + resourceRequirements.cpuLimit > limits.cpu_limit) {
        return false;
      }

      if (resourceRequirements.memoryLimit && 
          currentUsage.memoryUsage + resourceRequirements.memoryLimit > limits.memory_limit) {
        return false;
      }

      // Check availability window
      const isInAvailabilityWindow = await this.isInAvailabilityWindow(agentId);
      if (!isInAvailabilityWindow) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Failed to check task acceptance for ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Add a task to the agent queue
   */
  public async enqueueTask(queueItem: QueueItem): Promise<number> {
    try {
      const queue = this.queueManager.get(queueItem.agentId) || [];
      
      // Calculate priority score
      const priorityScore = await this.calculatePriorityScore(queueItem);
      queueItem.priority = priorityScore;

      // Insert in priority order
      const insertIndex = queue.findIndex(item => item.priority < priorityScore);
      if (insertIndex === -1) {
        queue.push(queueItem);
      } else {
        queue.splice(insertIndex, 0, queueItem);
      }

      this.queueManager.set(queueItem.agentId, queue);

      // Update queue metrics in cache
      await this.updateQueueMetrics(queueItem.agentId);

      // Broadcast queue update
      await this.broadcastQueueUpdate(queueItem.agentId);

      this.emit('queue:updated', { 
        agentId: queueItem.agentId, 
        queueLength: queue.length,
        position: insertIndex === -1 ? queue.length : insertIndex + 1
      });

      return insertIndex === -1 ? queue.length : insertIndex + 1;
    } catch (error) {
      console.error(`Failed to enqueue task for ${queueItem.agentId}:`, error);
      throw error;
    }
  }

  /**
   * Process the next task in queue
   */
  public async dequeueTask(agentId: string): Promise<QueueItem | null> {
    try {
      const queue = this.queueManager.get(agentId) || [];
      
      if (queue.length === 0) {
        return null;
      }

      const nextTask = queue.shift()!;
      this.queueManager.set(agentId, queue);

      // Update availability status
      await this.updateAvailabilityStatus(agentId);

      // Broadcast queue update
      await this.broadcastQueueUpdate(agentId);

      this.emit('task:dequeued', { agentId, task: nextTask });

      return nextTask;
    } catch (error) {
      console.error(`Failed to dequeue task for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Update resource usage for an agent
   */
  public async updateResourceUsage(agentId: string, usage: Omit<ResourceUsage, 'agentId' | 'timestamp'>): Promise<void> {
    try {
      const resourceUsage: ResourceUsage = {
        agentId,
        timestamp: new Date(),
        ...usage
      };

      // Store in database
      const { error } = await this.supabase
        .from('resource_usage')
        .insert({
          agent_id: agentId,
          timestamp: resourceUsage.timestamp.toISOString(),
          cpu_usage: usage.cpuUsage,
          memory_usage: usage.memoryUsage,
          gpu_usage: usage.gpuUsage,
          network_usage: usage.networkUsage,
          storage_usage: usage.storageUsage,
          active_connections: usage.activeConnections
        });

      if (error) {
        throw error;
      }

      // Cache in Redis with TTL
      await this.redis.setex(
        `${this.config.redis.keyPrefix}:resource:${agentId}`,
        300, // 5 minutes TTL
        JSON.stringify(resourceUsage)
      );

      // Update availability status if needed
      await this.updateAvailabilityStatus(agentId);

      this.emit('resource:updated', { agentId, usage: resourceUsage });
    } catch (error) {
      console.error(`Failed to update resource usage for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get availability metrics for an agent
   */
  public async getAvailabilityMetrics(agentId: string, timeRange: { start: Date; end: Date }): Promise<AvailabilityMetrics | null> {
    try {
      const { data: metrics } = await this.supabase
        .rpc('calculate_availability_metrics', {
          agent_id: agentId,
          start_time: timeRange.start.toISOString(),
          end_time: timeRange.end.toISOString()
        });

      return metrics || null;
    } catch (error) {
      console.error(`Failed to get availability metrics for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Cleanup and shutdown the service
   */
  public async shutdown(): Promise<void> {
    try {
      // Clear monitoring interval
      if (this.resourceMonitor) {
        clearInterval(this.resourceMonitor);
      }

      // Close WebSocket connections
      this.activeConnections.forEach(ws => ws.close());
      this.wss.close();

      // Unsubscribe from real-time channels
      this.realtimeChannels.forEach(channel => channel.unsubscribe());

      // Close Redis connection
      await this.redis.quit();

      this.emit('service:shutdown');
      console.log('Agent Availability Service shutdown complete');
    } catch (error) {
      console.error('Error during service shutdown:', error);
      throw error;
    }
  }

  // Private helper methods

  private async calculateCapacityStatus(agentId: string): Promise<CapacityStatus> {
    const { data: config } = await this.supabase
      .from('agent_availability')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (!config) {
      throw new Error(`Agent configuration not found: ${agentId}`);
    }

    const currentUsage = await this.getCurrentResourceUsage(agentId);
    const queue = this.queueManager.get(agentId) || [];
    const isInWindow = await this.isInAvailabilityWindow(agentId);
    
    const currentLoad = currentUsage.activeConnections / config.max_concurrent_tasks;
    const availableSlots = Math.max(0, config.max_concurrent_tasks - currentUsage.activeConnections);
    
    return {
      agentId,
      isAvailable: isInWindow && availableSlots > 0 && currentLoad < 0.9,
      currentLoad,
      availableSlots,
      queueLength: queue.length,
      estimatedWaitTime: this.calculateEstimatedWaitTime(agentId, queue),
      nextAvailableSlot: await this.getNextAvailableSlot(agentId),
      resourceUtilization: {
        cpu: currentUsage.cpuUsage,
        memory: currentUsage.memoryUsage,
        network: currentUsage.networkUsage,
        storage: currentUsage.storageUsage
      }
    };
  }

  private async getCurrentResourceUsage(agentId: string): Promise<ResourceUsage> {
    // Try Redis cache first
    const cached = await this.redis.get(`${this.config.redis.keyPrefix}:resource:${agentId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const { data } = await this.supabase
      .from('resource_usage')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return data ? {
      agentId: data.agent_id,
      timestamp: new Date(data.timestamp),
      cpuUsage: data.cpu_usage,
      memoryUsage: data.memory_usage,
      gpuUsage: data.gpu_usage,
      networkUsage: data.network_usage,
      storageUsage: data.storage_usage,
      activeConnections: data.active_connections
    } : {
      agentId,
      timestamp: new Date(),
      cpuUsage: 0,
      memoryUsage: 0,
      networkUsage: 0,
      storageUsage: 0,
      activeConnections: 0
    };
  }

  private async isInAvailabilityWindow(agentId: string): Promise<boolean> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const timeString = now.toTimeString().slice(0, 8);

    const { data: windows } = await this.supabase
      .from('availability_windows')
      .select('*')
      .eq('agent_id', agentId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true);

    if (!windows || windows.length === 0) {
      return true; // Default to available if no windows configured
    }

    return windows.some(window => 
      timeString >= window.start_time && timeString <= window.end_time
    );
  }

  private calculateEstimatedWaitTime(agentId: string, queue: QueueItem[]): number {
    if (queue.length === 0) return 0;
    
    const averageTaskDuration = queue.reduce((sum, item) => sum + item.estimatedDuration, 0) / queue.length;
    return averageTaskDuration * queue.length;
  }

  private async getNextAvailableSlot(agentId: string): Promise<Date | null> {
    const status = this.availabilityCache.get(agentId);
    if (!status || status.availableSlots > 0) {
      return null;
    }

    const queue = this.queueManager.get(agentId) || [];
    if (queue.length === 0) {
      return new Date();
    }

    const estimatedWaitTime = this.calculateEstimatedWaitTime(agentId, queue);
    return new Date(Date.now() + estimatedWaitTime * 1000);
  }

  private async calculatePriorityScore(queueItem: QueueItem): Promise<number> {
    // Base priority
    let score = queueItem.priority || 0;
    
    // Time-based priority boost
    const waitTime = Date.now() - queueItem.requestedAt.getTime();
    score += waitTime / (1000 * 60 * 10); // +1 point per 10 minutes waiting
    
    //