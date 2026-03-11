```typescript
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

/**
 * Task definition with metadata and requirements
 */
export interface Task {
  id: string;
  type: string;
  priority: number;
  estimatedDuration: number;
  requiredCapabilities: string[];
  dependencies: string[];
  payload: Record<string, any>;
  createdAt: Date;
  deadline?: Date;
}

/**
 * Agent definition with capabilities and status
 */
export interface Agent {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  currentWorkload: number;
  maxConcurrentTasks: number;
  performanceScore: number;
  lastActiveAt: Date;
}

/**
 * Agent capability with proficiency level
 */
export interface AgentCapability {
  skill: string;
  proficiency: number; // 0-1 scale
  experience: number;
}

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OVERLOADED = 'overloaded',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance'
}

/**
 * Task assignment result
 */
export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  priority: number;
  confidence: number;
}

/**
 * Distribution strategy configuration
 */
export interface DistributionStrategy {
  algorithm: 'round_robin' | 'capability_match' | 'performance_weighted' | 'hybrid';
  weightFactors: {
    workload: number;
    capability: number;
    performance: number;
    proximity: number;
  };
  loadThreshold: number;
}

/**
 * Workload analysis result
 */
export interface WorkloadAnalysis {
  agentId: string;
  currentLoad: number;
  projectedLoad: number;
  availableCapacity: number;
  recommendedTaskTypes: string[];
}

/**
 * Performance metrics for agents
 */
export interface PerformanceMetrics {
  agentId: string;
  completionRate: number;
  averageExecutionTime: number;
  qualityScore: number;
  reliabilityScore: number;
  lastUpdated: Date;
}

/**
 * Task queue item with metadata
 */
export interface QueuedTask extends Task {
  queuedAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  assignedAgent?: string;
}

/**
 * Distribution event types
 */
export interface DistributionEvents {
  taskAssigned: (assignment: TaskAssignment) => void;
  agentStatusChanged: (agentId: string, status: AgentStatus) => void;
  workloadUpdated: (analysis: WorkloadAnalysis) => void;
  taskCompleted: (taskId: string, agentId: string) => void;
  taskFailed: (taskId: string, agentId: string, error: string) => void;
}

/**
 * Service configuration
 */
export interface TeamTaskDistributionConfig {
  supabase: {
    url: string;
    key: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  websocket: {
    port: number;
  };
  distribution: DistributionStrategy;
  monitoring: {
    metricsInterval: number;
    healthCheckInterval: number;
  };
}

/**
 * Team Task Distribution Service
 * Intelligently distributes tasks among team agents based on workload, capabilities, and performance
 */
export class TeamTaskDistributionService extends EventEmitter {
  private supabase: any;
  private redis: Redis;
  private wsServer: WebSocketServer;
  private agents: Map<string, Agent> = new Map();
  private taskQueue: Map<string, QueuedTask> = new Map();
  private performanceCache: Map<string, PerformanceMetrics> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private distributionStrategy: DistributionStrategy;
  private isRunning = false;

  constructor(private config: TeamTaskDistributionConfig) {
    super();
    this.initializeConnections();
    this.distributionStrategy = config.distribution;
    this.setupEventHandlers();
  }

  /**
   * Initialize database and cache connections
   */
  private initializeConnections(): void {
    this.supabase = createClient(
      this.config.supabase.url,
      this.config.supabase.key
    );

    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    this.wsServer = new WebSocketServer({
      port: this.config.websocket.port
    });
  }

  /**
   * Setup event handlers for real-time updates
   */
  private setupEventHandlers(): void {
    this.wsServer.on('connection', (ws: WebSocket) => {
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.supabase
      .channel('team_agents')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'team_agents' },
        (payload: any) => this.handleAgentChange(payload)
      )
      .subscribe();
  }

  /**
   * Start the task distribution service
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      await this.loadAgents();
      await this.loadTaskQueue();
      await this.loadPerformanceMetrics();
      
      this.startMonitoring();
      this.isRunning = true;
      
      console.log('Team Task Distribution Service started');
    } catch (error) {
      console.error('Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Stop the task distribution service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    await this.redis.disconnect();
    this.wsServer.close();
    
    console.log('Team Task Distribution Service stopped');
  }

  /**
   * Add a task to the distribution queue
   */
  public async addTask(task: Task): Promise<void> {
    const queuedTask: QueuedTask = {
      ...task,
      queuedAt: new Date(),
      attempts: 0
    };

    this.taskQueue.set(task.id, queuedTask);
    await this.redis.zadd('task_queue', task.priority, task.id);
    await this.buildDependencyGraph(task);
    
    // Attempt immediate assignment if possible
    await this.tryAssignTask(queuedTask);
  }

  /**
   * Register a new agent with the service
   */
  public async registerAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
    
    await this.supabase
      .from('team_agents')
      .upsert({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        status: agent.status,
        max_concurrent_tasks: agent.maxConcurrentTasks,
        updated_at: new Date().toISOString()
      });

    await this.redis.hset(`agent:${agent.id}`, {
      status: agent.status,
      workload: agent.currentWorkload,
      last_active: agent.lastActiveAt.toISOString()
    });

    this.emit('agentStatusChanged', agent.id, agent.status);
  }

  /**
   * Update agent status
   */
  public async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    agent.status = status;
    agent.lastActiveAt = new Date();
    
    await this.redis.hset(`agent:${agentId}`, 'status', status);
    await this.supabase
      .from('team_agents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', agentId);

    this.emit('agentStatusChanged', agentId, status);
    
    // Trigger rebalancing if agent becomes available
    if (status === AgentStatus.AVAILABLE) {
      await this.rebalanceWorkload();
    }
  }

  /**
   * Complete a task assignment
   */
  public async completeTask(taskId: string, agentId: string, result: any): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    // Update agent workload
    agent.currentWorkload = Math.max(0, agent.currentWorkload - 1);
    await this.redis.hset(`agent:${agentId}`, 'workload', agent.currentWorkload);

    // Remove task from queue
    this.taskQueue.delete(taskId);
    await this.redis.zrem('task_queue', taskId);
    await this.redis.del(`task:${taskId}`);

    // Update performance metrics
    await this.updatePerformanceMetrics(agentId, taskId, true, task.estimatedDuration);

    // Resolve dependencies
    await this.resolveDependencies(taskId);

    this.emit('taskCompleted', taskId, agentId);

    // Try to assign more tasks to this agent
    await this.tryAssignNextTask(agentId);
  }

  /**
   * Report task failure
   */
  public async failTask(taskId: string, agentId: string, error: string): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) return;

    task.attempts++;
    task.lastAttemptAt = new Date();

    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentWorkload = Math.max(0, agent.currentWorkload - 1);
      await this.redis.hset(`agent:${agentId}`, 'workload', agent.currentWorkload);
    }

    // Update performance metrics
    await this.updatePerformanceMetrics(agentId, taskId, false, 0);

    if (task.attempts < 3) {
      // Retry with different agent
      task.assignedAgent = undefined;
      await this.tryAssignTask(task);
    } else {
      // Mark as failed permanently
      this.taskQueue.delete(taskId);
      await this.redis.zrem('task_queue', taskId);
    }

    this.emit('taskFailed', taskId, agentId, error);
  }

  /**
   * Get current workload analysis for all agents
   */
  public async getWorkloadAnalysis(): Promise<WorkloadAnalysis[]> {
    const analyses: WorkloadAnalysis[] = [];

    for (const [agentId, agent] of this.agents) {
      const projectedLoad = await this.calculateProjectedLoad(agentId);
      const availableCapacity = Math.max(0, agent.maxConcurrentTasks - agent.currentWorkload);
      const recommendedTypes = await this.getRecommendedTaskTypes(agentId);

      analyses.push({
        agentId,
        currentLoad: agent.currentWorkload / agent.maxConcurrentTasks,
        projectedLoad,
        availableCapacity,
        recommendedTaskTypes: recommendedTypes
      });
    }

    return analyses;
  }

  /**
   * Load agents from database
   */
  private async loadAgents(): Promise<void> {
    const { data, error } = await this.supabase
      .from('team_agents')
      .select('*');

    if (error) throw error;

    for (const agentData of data) {
      const agent: Agent = {
        id: agentData.id,
        name: agentData.name,
        capabilities: agentData.capabilities || [],
        status: agentData.status || AgentStatus.OFFLINE,
        currentWorkload: 0,
        maxConcurrentTasks: agentData.max_concurrent_tasks || 5,
        performanceScore: agentData.performance_score || 0.5,
        lastActiveAt: new Date(agentData.updated_at)
      };

      this.agents.set(agent.id, agent);

      // Load current workload from Redis
      const workload = await this.redis.hget(`agent:${agent.id}`, 'workload');
      if (workload) {
        agent.currentWorkload = parseInt(workload);
      }
    }
  }

  /**
   * Load task queue from Redis
   */
  private async loadTaskQueue(): Promise<void> {
    const taskIds = await this.redis.zrange('task_queue', 0, -1);
    
    for (const taskId of taskIds) {
      const taskData = await this.redis.hgetall(`task:${taskId}`);
      if (taskData.payload) {
        const task: QueuedTask = JSON.parse(taskData.payload);
        this.taskQueue.set(taskId, task);
      }
    }
  }

  /**
   * Load performance metrics from cache
   */
  private async loadPerformanceMetrics(): Promise<void> {
    const { data, error } = await this.supabase
      .from('performance_metrics')
      .select('*');

    if (error) throw error;

    for (const metrics of data) {
      this.performanceCache.set(metrics.agent_id, {
        agentId: metrics.agent_id,
        completionRate: metrics.completion_rate,
        averageExecutionTime: metrics.avg_execution_time,
        qualityScore: metrics.quality_score,
        reliabilityScore: metrics.reliability_score,
        lastUpdated: new Date(metrics.updated_at)
      });
    }
  }

  /**
   * Build task dependency graph
   */
  private async buildDependencyGraph(task: Task): Promise<void> {
    if (task.dependencies.length > 0) {
      this.dependencyGraph.set(task.id, new Set(task.dependencies));
    }
  }

  /**
   * Try to assign a task to the best available agent
   */
  private async tryAssignTask(task: QueuedTask): Promise<boolean> {
    if (task.assignedAgent) return false;

    // Check if dependencies are resolved
    if (!await this.areDependenciesResolved(task.id)) {
      return false;
    }

    const suitableAgent = await this.findBestAgent(task);
    if (!suitableAgent) return false;

    return await this.assignTaskToAgent(task, suitableAgent);
  }

  /**
   * Find the best agent for a given task
   */
  private async findBestAgent(task: QueuedTask): Promise<Agent | null> {
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => 
        agent.status === AgentStatus.AVAILABLE &&
        agent.currentWorkload < agent.maxConcurrentTasks
      );

    if (availableAgents.length === 0) return null;

    let bestAgent: Agent | null = null;
    let bestScore = -1;

    for (const agent of availableAgents) {
      const score = await this.calculateAgentScore(agent, task);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * Calculate agent suitability score for a task
   */
  private async calculateAgentScore(agent: Agent, task: QueuedTask): Promise<number> {
    const capabilityScore = this.calculateCapabilityMatch(agent, task);
    const workloadScore = 1 - (agent.currentWorkload / agent.maxConcurrentTasks);
    const performanceScore = agent.performanceScore;

    const weights = this.distributionStrategy.weightFactors;
    
    return (
      capabilityScore * weights.capability +
      workloadScore * weights.workload +
      performanceScore * weights.performance
    ) / (weights.capability + weights.workload + weights.performance);
  }

  /**
   * Calculate capability match between agent and task
   */
  private calculateCapabilityMatch(agent: Agent, task: QueuedTask): number {
    if (task.requiredCapabilities.length === 0) return 0.5;

    let totalMatch = 0;
    let requiredCount = 0;

    for (const requiredSkill of task.requiredCapabilities) {
      const capability = agent.capabilities.find(cap => cap.skill === requiredSkill);
      if (capability) {
        totalMatch += capability.proficiency;
      }
      requiredCount++;
    }

    return requiredCount > 0 ? totalMatch / requiredCount : 0;
  }

  /**
   * Assign task to specific agent
   */
  private async assignTaskToAgent(task: QueuedTask, agent: Agent): Promise<boolean> {
    try {
      agent.currentWorkload++;
      task.assignedAgent = agent.id;

      await this.redis.hset(`agent:${agent.id}`, 'workload', agent.currentWorkload);
      await this.redis.hset(`task:${task.id}`, 'assigned_agent', agent.id);

      const assignment: TaskAssignment = {
        taskId: task.id,
        agentId: agent.id,
        assignedAt: new Date(),
        estimatedCompletion: new Date(Date.now() + task.estimatedDuration * 1000),
        priority: task.priority,
        confidence: await this.calculateAgentScore(agent, task)
      };

      // Notify via WebSocket
      this.broadcastToAgent(agent.id, {
        type: 'task_assignment',
        task: task,
        assignment: assignment
      });

      this.emit('taskAssigned', assignment);
      return true;

    } catch (error) {
      console.error('Failed to assign task:', error);
      return false;
    }
  }

  /**
   * Check if task dependencies are resolved
   */
  private async areDependenciesResolved(taskId: string): Promise<boolean> {
    const dependencies = this.dependencyGraph.get(taskId);
    if (!dependencies || dependencies.size === 0) return true;

    for (const depId of dependencies) {
      if (this.taskQueue.has(depId)) return false;
    }

    return true;
  }

  /**
   * Resolve dependencies when task completes
   */
  private async resolveDependencies(completedTaskId: string): Promise<void> {
    for (const [taskId, dependencies] of this.dependencyGraph) {
      if (dependencies.has(completedTaskId)) {
        dependencies.delete(completedTaskId);
        
        if (dependencies.size === 0) {
          const task = this.taskQueue.get(taskId);
          if (task) {
            await this.tryAssignTask(task);
          }
        }
      }
    }
  }

  /**
   * Calculate projected workload for an agent
   */
  private async calculateProjectedLoad(agentId: string): Promise<number> {
    const agent = this.agents.get(agentId);
    if (!agent) return 0;

    // Simple projection based on current queue and agent performance
    const queuedTasks = Array.from(this.taskQueue.values())
      .filter(task => !task.assignedAgent);
    
    const suitableTasks = queuedTasks.filter(task => 
      this.calculateCapabilityMatch(agent, task) > 0.6
    ).length;

    return Math.min(1, (agent.currentWorkload + suitableTasks * 0.3) / agent.maxConcurrentTasks);
  }

  /**
   * Get recommended task types for an agent
   */
  private async getRecommendedTaskTypes(agentId: string): Promise<string[]> {
    const agent = this.agents.get(agentId);
    if (!agent) return [];

    return agent.capabilities
      .filter(cap => cap.proficiency > 0.7)
      .map(cap => cap.skill)
      .slice(0, 5);
  }

  /**
   * Update performance metrics for an agent
   */
  private async updatePerformanceMetrics(
    agentId: string, 
    taskId: string, 
    success: boolean, 
    executionTime: number
  ): Promise<void> {
    const metrics = this.performanceCache.get(agentId) || {
      agentId,
      completionRate: 0.5,
      averageExecutionTime: 300,
      qualityScore: 0.5,
      reliabilityScore: 0.5,
      lastUpdated: new Date()
    };

    // Update completion rate (exponential moving average)
    const alpha = 0.1;
    metrics.completionRate = alpha * (success ? 1 : 0) + (1 - alpha) * metrics.completionRate;
    
    if (success && executionTime > 0) {
      metrics.averageExecutionTime = alpha * executionTime + (1 - alpha) * metrics.averageExecutionTime;
    }

    metrics.lastUpdated = new Date();
    this.performanceCache.set(agentId, metrics);

    // Update agent performance score
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.performanceScore = (metrics.completionRate + metrics.reliabilityScore) / 2;
    }

    // Persist to database
    await this.supabase
      .from('performance_metrics')
      .upsert({
        agent_id: agentId,
        completion_rate: metrics.completionRate,
        avg_execution_time: metrics.averageExecutionTime,
        quality_score: metrics.qualityScore,
        reliability_score: metrics.reliabilityScore,
        updated_at: new Date().toISOString()
      });
  }

  /**
   * Try to assign next task to available agent
   */
  private async tryAssignNextTask(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.currentWorkload >= agent.maxConcurrentTasks) return;

    // Find highest priority unassigned task
    const unassignedTasks = Array.from(this.taskQueue.