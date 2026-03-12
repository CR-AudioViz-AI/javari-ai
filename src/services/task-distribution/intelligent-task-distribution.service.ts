```typescript
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

/**
 * Represents a task to be distributed
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  complexity: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number;
  deadline?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Represents an agent in the system
 */
export interface Agent {
  id: string;
  name: string;
  email: string;
  skills: AgentSkill[];
  currentWorkload: number;
  maxCapacity: number;
  availability: AgentAvailability;
  performanceMetrics: PerformanceMetrics;
  preferences: AgentPreferences;
  timezone: string;
  status: 'available' | 'busy' | 'offline';
  lastActiveAt: Date;
}

/**
 * Agent skill with proficiency level
 */
export interface AgentSkill {
  skill: string;
  proficiency: number; // 0-100
  experience: number; // years
  lastUsed: Date;
}

/**
 * Agent availability schedule
 */
export interface AgentAvailability {
  workingHours: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  workingDays: number[]; // 0-6 (Sunday-Saturday)
  breakHours: Array<{
    start: string;
    end: string;
  }>;
  vacationDays: Date[];
}

/**
 * Agent performance metrics
 */
export interface PerformanceMetrics {
  completionRate: number; // 0-100
  averageTaskTime: number; // hours
  qualityScore: number; // 0-100
  onTimeDelivery: number; // 0-100
  collaborationScore: number; // 0-100
  taskCount30Days: number;
  lastUpdated: Date;
}

/**
 * Agent preferences for task assignment
 */
export interface AgentPreferences {
  preferredTaskTypes: string[];
  avoidTaskTypes: string[];
  workloadPreference: 'light' | 'moderate' | 'heavy';
  collaborationPreference: 'solo' | 'team' | 'both';
  complexityPreference: 'simple' | 'moderate' | 'complex' | 'mixed';
}

/**
 * Task assignment result
 */
export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  confidenceScore: number; // 0-100
  reasoning: string[];
  fallbackAgents: string[];
}

/**
 * Distribution configuration
 */
export interface DistributionConfig {
  maxTasksPerAgent: number;
  skillMatchWeight: number;
  workloadWeight: number;
  performanceWeight: number;
  availabilityWeight: number;
  preferenceWeight: number;
  deadlineWeight: number;
  rebalanceInterval: number; // minutes
  enablePredictiveAssignment: boolean;
}

/**
 * Task complexity assessment result
 */
export interface ComplexityAssessment {
  taskId: string;
  complexityScore: number; // 0-100
  factors: {
    technicalComplexity: number;
    businessComplexity: number;
    riskLevel: number;
    dependencyCount: number;
  };
  requiredExperience: number; // years
  estimatedEffort: number; // hours
}

/**
 * Workload balance metrics
 */
export interface WorkloadBalance {
  agentId: string;
  currentTasks: number;
  totalEffort: number; // hours
  utilizationRate: number; // 0-100
  projectedCapacity: number; // next 7 days
  burnoutRisk: number; // 0-100
}

/**
 * Distribution optimization result
 */
export interface OptimizationResult {
  assignments: TaskAssignment[];
  balanceScore: number; // 0-100
  efficiencyGain: number; // percentage
  riskAssessment: string[];
  alternativeOptions: TaskAssignment[][];
}

/**
 * Real-time agent status update
 */
export interface AgentStatusUpdate {
  agentId: string;
  status: Agent['status'];
  workload: number;
  availability: Partial<AgentAvailability>;
  timestamp: Date;
}

/**
 * Task distribution event types
 */
export interface TaskDistributionEvents {
  'task-assigned': TaskAssignment;
  'task-reassigned': { from: string; to: string; taskId: string };
  'agent-overloaded': { agentId: string; workload: number };
  'distribution-optimized': OptimizationResult;
  'agent-status-changed': AgentStatusUpdate;
  'task-queue-updated': { queueLength: number; pendingTasks: string[] };
}

/**
 * Service configuration options
 */
export interface IntelligentTaskDistributionConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  websocketPort: number;
  distributionConfig: DistributionConfig;
  enableRealtimeUpdates: boolean;
  enableAnalytics: boolean;
  debugMode: boolean;
}

/**
 * Intelligent Task Distribution Service
 * 
 * Automatically distributes tasks among team agents based on their capabilities,
 * current workload, and historical performance to optimize team efficiency.
 */
export class IntelligentTaskDistributionService extends EventEmitter {
  private readonly supabase: SupabaseClient;
  private readonly redis: Redis;
  private readonly config: IntelligentTaskDistributionConfig;
  private realtimeChannel?: RealtimeChannel;
  private websocketServer?: WebSocket.Server;
  private distributionInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: IntelligentTaskDistributionConfig) {
    super();
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.redis = new Redis(config.redisUrl);
  }

  /**
   * Initialize the task distribution service
   */
  async initialize(): Promise<void> {
    try {
      await this.setupRealtimeSubscriptions();
      await this.setupWebSocketServer();
      await this.startDistributionLoop();
      
      this.isInitialized = true;
      console.log('Intelligent Task Distribution Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize task distribution service:', error);
      throw error;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      if (this.distributionInterval) {
        clearInterval(this.distributionInterval);
      }

      if (this.realtimeChannel) {
        await this.supabase.removeChannel(this.realtimeChannel);
      }

      if (this.websocketServer) {
        this.websocketServer.close();
      }

      await this.redis.quit();
      this.isInitialized = false;
      
      console.log('Task distribution service shutdown complete');
    } catch (error) {
      console.error('Error during service shutdown:', error);
      throw error;
    }
  }

  /**
   * Distribute a single task to the most suitable agent
   */
  async distributeTask(task: Task): Promise<TaskAssignment> {
    try {
      this.validateInitialization();

      // Assess task complexity
      const complexity = await this.assessTaskComplexity(task);
      
      // Get available agents
      const agents = await this.getAvailableAgents();
      
      // Analyze agent capabilities
      const capabilityScores = await this.analyzeAgentCapabilities(task, agents);
      
      // Calculate workload balance
      const workloadBalances = await this.calculateWorkloadBalance(agents);
      
      // Get performance metrics
      const performanceMetrics = await this.collectPerformanceMetrics(agents.map(a => a.id));
      
      // Optimize assignment
      const assignment = await this.optimizeAssignment(
        task,
        complexity,
        agents,
        capabilityScores,
        workloadBalances,
        performanceMetrics
      );

      // Queue assignment
      await this.queueTaskAssignment(assignment);
      
      // Notify stakeholders
      await this.notifyAssignment(assignment);
      
      this.emit('task-assigned', assignment);
      
      return assignment;
    } catch (error) {
      console.error('Failed to distribute task:', error);
      throw error;
    }
  }

  /**
   * Distribute multiple tasks in batch
   */
  async distributeTasks(tasks: Task[]): Promise<TaskAssignment[]> {
    try {
      this.validateInitialization();

      const assignments: TaskAssignment[] = [];
      
      // Sort tasks by priority and deadline
      const sortedTasks = this.prioritizeTasks(tasks);
      
      for (const task of sortedTasks) {
        const assignment = await this.distributeTask(task);
        assignments.push(assignment);
        
        // Brief pause to allow system updates
        await this.delay(100);
      }
      
      return assignments;
    } catch (error) {
      console.error('Failed to distribute tasks in batch:', error);
      throw error;
    }
  }

  /**
   * Rebalance workload across all agents
   */
  async rebalanceWorkload(): Promise<OptimizationResult> {
    try {
      this.validateInitialization();

      const agents = await this.getAvailableAgents();
      const workloadBalances = await this.calculateWorkloadBalance(agents);
      
      // Identify overloaded and underutilized agents
      const overloadedAgents = workloadBalances.filter(wb => wb.utilizationRate > 85);
      const underutilizedAgents = workloadBalances.filter(wb => wb.utilizationRate < 60);
      
      const reassignments: TaskAssignment[] = [];
      
      for (const overloaded of overloadedAgents) {
        const tasks = await this.getAgentTasks(overloaded.agentId);
        const reassignableTasks = tasks.filter(t => this.isTaskReassignable(t));
        
        for (const task of reassignableTasks) {
          const suitableAgent = this.findBestReassignmentAgent(
            task,
            underutilizedAgents,
            agents
          );
          
          if (suitableAgent) {
            const reassignment = await this.reassignTask(task.id, suitableAgent.agentId);
            reassignments.push(reassignment);
            
            this.emit('task-reassigned', {
              from: overloaded.agentId,
              to: suitableAgent.agentId,
              taskId: task.id
            });
            
            // Update utilization rates
            const overloadedIndex = underutilizedAgents.findIndex(
              ua => ua.agentId === suitableAgent.agentId
            );
            if (overloadedIndex >= 0) {
              underutilizedAgents[overloadedIndex].utilizationRate += 
                (task.estimatedDuration / suitableAgent.maxCapacity) * 100;
            }
            
            if (underutilizedAgents[overloadedIndex]?.utilizationRate > 75) {
              underutilizedAgents.splice(overloadedIndex, 1);
            }
          }
        }
      }
      
      const optimizationResult: OptimizationResult = {
        assignments: reassignments,
        balanceScore: await this.calculateBalanceScore(agents),
        efficiencyGain: this.calculateEfficiencyGain(reassignments),
        riskAssessment: this.assessRebalanceRisks(reassignments),
        alternativeOptions: []
      };
      
      this.emit('distribution-optimized', optimizationResult);
      
      return optimizationResult;
    } catch (error) {
      console.error('Failed to rebalance workload:', error);
      throw error;
    }
  }

  /**
   * Get agent availability in real-time
   */
  async getAgentAvailability(agentId: string): Promise<AgentAvailability | null> {
    try {
      const cached = await this.redis.get(`agent_availability:${agentId}`);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const { data, error } = await this.supabase
        .from('agents')
        .select('availability')
        .eq('id', agentId)
        .single();
      
      if (error) throw error;
      
      if (data?.availability) {
        await this.redis.setex(
          `agent_availability:${agentId}`,
          300, // 5 minutes cache
          JSON.stringify(data.availability)
        );
      }
      
      return data?.availability || null;
    } catch (error) {
      console.error('Failed to get agent availability:', error);
      return null;
    }
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: string, status: Agent['status']): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('agents')
        .update({ 
          status, 
          last_active_at: new Date().toISOString() 
        })
        .eq('id', agentId);
      
      if (error) throw error;
      
      await this.redis.setex(`agent_status:${agentId}`, 3600, status);
      
      const statusUpdate: AgentStatusUpdate = {
        agentId,
        status,
        workload: await this.getAgentWorkload(agentId),
        availability: await this.getAgentAvailability(agentId) || {} as AgentAvailability,
        timestamp: new Date()
      };
      
      this.emit('agent-status-changed', statusUpdate);
    } catch (error) {
      console.error('Failed to update agent status:', error);
      throw error;
    }
  }

  /**
   * Get task distribution analytics
   */
  async getDistributionAnalytics(timeRange: { start: Date; end: Date }): Promise<any> {
    try {
      const { data: assignments, error } = await this.supabase
        .from('task_assignments')
        .select(`
          *,
          tasks(*),
          agents(*)
        `)
        .gte('assigned_at', timeRange.start.toISOString())
        .lte('assigned_at', timeRange.end.toISOString());
      
      if (error) throw error;
      
      const analytics = {
        totalAssignments: assignments?.length || 0,
        averageAssignmentTime: this.calculateAverageAssignmentTime(assignments || []),
        distributionEfficiency: this.calculateDistributionEfficiency(assignments || []),
        agentUtilization: await this.calculateAgentUtilization(assignments || []),
        taskComplexityDistribution: this.analyzeComplexityDistribution(assignments || []),
        performanceTrends: this.analyzePerformanceTrends(assignments || [])
      };
      
      return analytics;
    } catch (error) {
      console.error('Failed to get distribution analytics:', error);
      throw error;
    }
  }

  /**
   * Setup real-time subscriptions for agent updates
   */
  private async setupRealtimeSubscriptions(): Promise<void> {
    if (!this.config.enableRealtimeUpdates) return;
    
    this.realtimeChannel = this.supabase
      .channel('task-distribution')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents'
        },
        (payload) => {
          this.handleAgentUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          this.handleTaskUpdate(payload);
        }
      )
      .subscribe();
  }

  /**
   * Setup WebSocket server for real-time notifications
   */
  private async setupWebSocketServer(): Promise<void> {
    this.websocketServer = new WebSocket.Server({ 
      port: this.config.websocketPort 
    });
    
    this.websocketServer.on('connection', (ws: WebSocket) => {
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });
    });
  }

  /**
   * Start the continuous distribution optimization loop
   */
  private async startDistributionLoop(): Promise<void> {
    this.distributionInterval = setInterval(async () => {
      try {
        await this.processTaskQueue();
        
        if (Math.random() < 0.1) { // 10% chance to rebalance
          await this.rebalanceWorkload();
        }
      } catch (error) {
        console.error('Error in distribution loop:', error);
      }
    }, this.config.distributionConfig.rebalanceInterval * 60 * 1000);
  }

  /**
   * Assess task complexity using multiple factors
   */
  private async assessTaskComplexity(task: Task): Promise<ComplexityAssessment> {
    const factors = {
      technicalComplexity: this.assessTechnicalComplexity(task),
      businessComplexity: this.assessBusinessComplexity(task),
      riskLevel: this.assessRiskLevel(task),
      dependencyCount: await this.countTaskDependencies(task.id)
    };
    
    const complexityScore = (
      factors.technicalComplexity * 0.3 +
      factors.businessComplexity * 0.2 +
      factors.riskLevel * 0.3 +
      Math.min(factors.dependencyCount * 10, 100) * 0.2
    );
    
    return {
      taskId: task.id,
      complexityScore: Math.min(Math.max(complexityScore, 0), 100),
      factors,
      requiredExperience: this.calculateRequiredExperience(complexityScore),
      estimatedEffort: task.estimatedDuration
    };
  }

  /**
   * Get all available agents
   */
  private async getAvailableAgents(): Promise<Agent[]> {
    const { data, error } = await this.supabase
      .from('agents')
      .select('*')
      .in('status', ['available', 'busy']);
    
    if (error) throw error;
    
    return data || [];
  }

  /**
   * Analyze agent capabilities for a specific task
   */
  private async analyzeAgentCapabilities(
    task: Task, 
    agents: Agent[]
  ): Promise<Record<string, number>> {
    const capabilityScores: Record<string, number> = {};
    
    for (const agent of agents) {
      let score = 0;
      let totalWeight = 0;
      
      for (const requiredSkill of task.requiredSkills) {
        const agentSkill = agent.skills.find(s => s.skill === requiredSkill);
        const weight = this.getSkillWeight(requiredSkill);
        
        if (agentSkill) {
          const proficiencyScore = agentSkill.proficiency;
          const experienceScore = Math.min(agentSkill.experience * 10, 100);
          const recencyScore = this.calculateRecencyScore(agentSkill.lastUsed);
          
          const skillScore = (proficiencyScore * 0.5 + experienceScore * 0.3 + recencyScore * 0.2);
          score += skillScore * weight;
        }
        
        totalWeight += weight;
      }
      
      capabilityScores[agent.id] = totalWeight > 0 ? score / totalWeight : 0;
    }
    
    return capabilityScores;
  }

  /**
   * Calculate workload balance for agents
   */
  private async calculateWorkloadBalance(agents: Agent[]): Promise<WorkloadBalance[]> {
    const balances: WorkloadBalance[] = [];
    
    for (const agent of agents) {
      const currentTasks = await this.getAgentTaskCount(agent.id);
      const totalEffort = await this.getAgentTotalEffort(agent.id);
      const utilizationRate = (agent.currentWorkload / agent.maxCapacity) * 100;
      const projectedCapacity = await this.calculateProjectedCapacity(agent.id);
      const burnoutRisk = this.calculateBurnoutRisk(agent);
      
      balances.push({
        agentId: agent.id,
        currentTasks,
        totalEffort,
        utilizationRate,
        projectedCapacity,
        burnoutRisk
      });
    }
    
    return balances;
  }

  /**
   * Collect performance metrics for agents
   */
  private async collectPerformanceMetrics(agentIds: string[]): Promise<Record<string, PerformanceMetrics>> {
    const metrics: Record<string, PerformanceMetrics> = {};
    
    for (const agentId of agentIds) {
      const cached = await this.redis.get(`performance_metrics:${agentId}`);
      
      if (cached) {
        metrics[agentId] = JSON.parse(cached);
      } else {
        const calculated = await this.calculatePerformanceMetrics(agentId);
        metrics[agentId] = calculated;
        
        await this.redis.setex(
          `performance_metrics:${agentId}`,
          3600, // 1 hour cache
          JSON.stringify(calculated)
        );
      }
    }
    
    return metrics;
  }

  /**
   * Optimize task assignment using weighted scoring
   */
  private async optimizeAssignment(
    task: Task,
    complexity: ComplexityAssessment,
    agents: Agent[],
    capabilityScores: Record<string, number>,
    workloadBalances: WorkloadBalance[],
    performanceMetrics: Record<string, PerformanceMetrics>
  ): Promise<TaskAssignment> {
    const config = this.config.distributionConfig;
    const scores: Array<{ agentId: string; score: number; reasoning: string[] }> = [];
    
    for (const agent of agents) {
      const reasoning: string[] = [];
      let totalScore = 0;
      
      // Capability score
      const capabilityScore = capabilityScores[agent.id] || 0;
      totalScore += capabilityScore * config.skillMatchWeight;
      reasoning.push(`Skill match: ${capabilityScore.toFixed(1)}/100`);