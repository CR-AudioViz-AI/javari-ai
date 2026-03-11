import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { promisify } from 'util';

/**
 * Represents a task to be distributed to AI team members
 */
export interface Task {
  id: string;
  type: string;
  complexity: number;
  requiredCapabilities: string[];
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  estimatedDuration: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Represents an AI team member with capabilities and current status
 */
export interface AITeamMember {
  id: string;
  name: string;
  type: 'analyzer' | 'generator' | 'processor' | 'coordinator';
  capabilities: string[];
  maxConcurrentTasks: number;
  currentLoad: number;
  status: 'available' | 'busy' | 'offline' | 'maintenance';
  performanceScore: number;
  averageTaskTime: number;
  successRate: number;
  specializations: string[];
  lastActive: Date;
}

/**
 * Task assignment result with routing information
 */
export interface TaskAssignment {
  taskId: string;
  assignedMemberId: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  confidenceScore: number;
  routingReason: string;
}

/**
 * Performance metrics for task distribution analysis
 */
export interface DistributionMetrics {
  totalTasksDistributed: number;
  averageAssignmentTime: number;
  successfulAssignments: number;
  failedAssignments: number;
  loadBalanceEfficiency: number;
  memberUtilizationRates: Record<string, number>;
  taskTypeDistribution: Record<string, number>;
}

/**
 * Configuration options for task distribution
 */
export interface TaskDistributionConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  maxRetryAttempts: number;
  loadBalanceThreshold: number;
  performanceWindowMinutes: number;
  complexityWeights: Record<string, number>;
  capabilityWeights: Record<string, number>;
}

/**
 * Capability matching result with scoring details
 */
interface CapabilityMatch {
  memberId: string;
  matchScore: number;
  capabilityAlignment: number;
  skillGaps: string[];
  confidenceLevel: number;
}

/**
 * Load balancing information for team members
 */
interface LoadInfo {
  memberId: string;
  currentTasks: number;
  capacity: number;
  utilizationRate: number;
  projectedAvailability: Date;
  queuedTasks: number;
}

/**
 * Historical performance data for analytics
 */
interface PerformanceHistory {
  memberId: string;
  taskType: string;
  completionTime: number;
  successRate: number;
  complexityHandled: number;
  timestamp: Date;
}

/**
 * Task complexity assessment result
 */
interface ComplexityAssessment {
  taskId: string;
  computedComplexity: number;
  factors: Record<string, number>;
  estimatedResources: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Dynamic Task Distribution Service
 * 
 * Intelligently assigns tasks to AI team members based on capabilities,
 * current workload, and historical performance with real-time load balancing.
 */
export class TaskDistributionService extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private realtimeChannel: RealtimeChannel | null = null;
  private webSocketConnections: Map<string, WebSocket> = new Map();
  private teamMembers: Map<string, AITeamMember> = new Map();
  private taskQueue: Map<string, Task> = new Map();
  private activeAssignments: Map<string, TaskAssignment> = new Map();
  private performanceHistory: Map<string, PerformanceHistory[]> = new Map();
  private distributionMetrics: DistributionMetrics;
  private isInitialized = false;

  constructor(private config: TaskDistributionConfig) {
    super();
    
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.redis = new Redis(config.redisUrl);
    
    this.distributionMetrics = {
      totalTasksDistributed: 0,
      averageAssignmentTime: 0,
      successfulAssignments: 0,
      failedAssignments: 0,
      loadBalanceEfficiency: 0,
      memberUtilizationRates: {},
      taskTypeDistribution: {}
    };
  }

  /**
   * Initialize the task distribution service
   */
  public async initialize(): Promise<void> {
    try {
      await this.setupRealtimeSubscriptions();
      await this.loadTeamMembers();
      await this.loadPerformanceHistory();
      await this.initializeTaskQueue();
      await this.startLoadBalancing();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('TaskDistributionService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TaskDistributionService:', error);
      throw new Error(`Initialization failed: ${error}`);
    }
  }

  /**
   * Distribute a task to the most suitable AI team member
   */
  public async distributeTask(task: Task): Promise<TaskAssignment> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const startTime = Date.now();

    try {
      // Assess task complexity
      const complexityAssessment = await this.assessTaskComplexity(task);
      
      // Find suitable team members based on capabilities
      const capabilityMatches = await this.findCapabilityMatches(task, complexityAssessment);
      
      if (capabilityMatches.length === 0) {
        throw new Error(`No team members found with required capabilities: ${task.requiredCapabilities.join(', ')}`);
      }

      // Apply load balancing to select optimal member
      const selectedMember = await this.selectOptimalMember(capabilityMatches, complexityAssessment);
      
      // Create task assignment
      const assignment = await this.createTaskAssignment(task, selectedMember, complexityAssessment);
      
      // Update team member load
      await this.updateMemberLoad(selectedMember.memberId, 1);
      
      // Store assignment and update metrics
      this.activeAssignments.set(task.id, assignment);
      await this.updateDistributionMetrics(assignment, Date.now() - startTime);
      
      // Notify assigned member via WebSocket
      await this.notifyMemberAssignment(assignment);
      
      this.emit('taskAssigned', assignment);
      
      return assignment;
      
    } catch (error) {
      this.distributionMetrics.failedAssignments++;
      this.emit('assignmentFailed', { taskId: task.id, error });
      throw error;
    }
  }

  /**
   * Handle task completion and update performance metrics
   */
  public async handleTaskCompletion(
    taskId: string, 
    success: boolean, 
    completionTime: number,
    feedback?: Record<string, any>
  ): Promise<void> {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment) {
      throw new Error(`Assignment not found for task ${taskId}`);
    }

    try {
      // Update member load
      await this.updateMemberLoad(assignment.assignedMemberId, -1);
      
      // Record performance data
      await this.recordPerformanceData(assignment, success, completionTime, feedback);
      
      // Update member performance scores
      await this.updateMemberPerformanceScore(assignment.assignedMemberId, success, completionTime);
      
      // Remove from active assignments
      this.activeAssignments.delete(taskId);
      
      // Update distribution metrics
      if (success) {
        this.distributionMetrics.successfulAssignments++;
      }
      
      this.emit('taskCompleted', { taskId, success, completionTime });
      
    } catch (error) {
      console.error('Error handling task completion:', error);
      throw error;
    }
  }

  /**
   * Get real-time distribution metrics
   */
  public getDistributionMetrics(): DistributionMetrics {
    return { ...this.distributionMetrics };
  }

  /**
   * Get current team member status
   */
  public getTeamMemberStatus(): AITeamMember[] {
    return Array.from(this.teamMembers.values());
  }

  /**
   * Rebalance task distribution based on current loads
   */
  public async rebalanceDistribution(): Promise<void> {
    try {
      const loadInfos = await this.calculateLoadBalancing();
      const overloadedMembers = loadInfos.filter(info => info.utilizationRate > this.config.loadBalanceThreshold);
      
      if (overloadedMembers.length === 0) {
        return;
      }

      // Redistribute tasks from overloaded members
      for (const overloadedMember of overloadedMembers) {
        await this.redistributeTasks(overloadedMember.memberId, loadInfos);
      }
      
      this.emit('distributionRebalanced', { rebalancedMembers: overloadedMembers.length });
      
    } catch (error) {
      console.error('Error rebalancing distribution:', error);
      throw error;
    }
  }

  /**
   * Set up Supabase realtime subscriptions for team member updates
   */
  private async setupRealtimeSubscriptions(): Promise<void> {
    this.realtimeChannel = this.supabase
      .channel('team-members')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ai_team_members'
      }, async (payload) => {
        await this.handleTeamMemberUpdate(payload);
      })
      .subscribe();
  }

  /**
   * Load team members from database
   */
  private async loadTeamMembers(): Promise<void> {
    const { data: members, error } = await this.supabase
      .from('ai_team_members')
      .select('*')
      .eq('status', 'available');

    if (error) {
      throw new Error(`Failed to load team members: ${error.message}`);
    }

    for (const member of members || []) {
      this.teamMembers.set(member.id, member);
    }
  }

  /**
   * Load historical performance data
   */
  private async loadPerformanceHistory(): Promise<void> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.config.performanceWindowMinutes);

    const { data: history, error } = await this.supabase
      .from('performance_history')
      .select('*')
      .gte('timestamp', windowStart.toISOString());

    if (error) {
      throw new Error(`Failed to load performance history: ${error.message}`);
    }

    for (const record of history || []) {
      if (!this.performanceHistory.has(record.member_id)) {
        this.performanceHistory.set(record.member_id, []);
      }
      this.performanceHistory.get(record.member_id)!.push(record);
    }
  }

  /**
   * Initialize task queue from Redis
   */
  private async initializeTaskQueue(): Promise<void> {
    const queuedTasks = await this.redis.hgetall('task_queue');
    
    for (const [taskId, taskData] of Object.entries(queuedTasks)) {
      try {
        const task = JSON.parse(taskData);
        this.taskQueue.set(taskId, task);
      } catch (error) {
        console.error(`Failed to parse queued task ${taskId}:`, error);
      }
    }
  }

  /**
   * Start periodic load balancing
   */
  private async startLoadBalancing(): Promise<void> {
    setInterval(async () => {
      try {
        await this.rebalanceDistribution();
      } catch (error) {
        console.error('Load balancing error:', error);
      }
    }, 30000); // Rebalance every 30 seconds
  }

  /**
   * Assess task complexity using multiple factors
   */
  private async assessTaskComplexity(task: Task): Promise<ComplexityAssessment> {
    const factors: Record<string, number> = {};
    
    // Capability complexity
    factors.capabilityComplexity = task.requiredCapabilities.length * 0.2;
    
    // Payload size complexity
    factors.payloadComplexity = Math.min(JSON.stringify(task.payload).length / 1000, 2);
    
    // Priority complexity
    const priorityWeights = { low: 0.5, medium: 1, high: 1.5, critical: 2 };
    factors.priorityComplexity = priorityWeights[task.priority];
    
    // Duration complexity
    factors.durationComplexity = Math.min(task.estimatedDuration / 3600, 2); // Hours to complexity
    
    // Apply configured weights
    let computedComplexity = 0;
    for (const [factor, value] of Object.entries(factors)) {
      const weight = this.config.complexityWeights[factor] || 1;
      computedComplexity += value * weight;
    }
    
    // Normalize to 0-10 scale
    computedComplexity = Math.min(Math.max(computedComplexity, 0), 10);
    
    const riskLevel = computedComplexity < 3 ? 'low' : 
                     computedComplexity < 7 ? 'medium' : 'high';
    
    return {
      taskId: task.id,
      computedComplexity,
      factors,
      estimatedResources: Math.ceil(computedComplexity / 2),
      riskLevel
    };
  }

  /**
   * Find team members with matching capabilities
   */
  private async findCapabilityMatches(task: Task, complexity: ComplexityAssessment): Promise<CapabilityMatch[]> {
    const matches: CapabilityMatch[] = [];
    
    for (const [memberId, member] of this.teamMembers) {
      if (member.status !== 'available') {
        continue;
      }
      
      // Calculate capability alignment
      const requiredCaps = new Set(task.requiredCapabilities);
      const memberCaps = new Set(member.capabilities);
      const intersection = new Set([...requiredCaps].filter(x => memberCaps.has(x)));
      const capabilityAlignment = intersection.size / requiredCaps.size;
      
      if (capabilityAlignment === 0) {
        continue; // No matching capabilities
      }
      
      // Calculate skill gaps
      const skillGaps = [...requiredCaps].filter(x => !memberCaps.has(x));
      
      // Calculate specialization bonus
      const specializationBonus = member.specializations.some(spec => 
        task.requiredCapabilities.includes(spec)
      ) ? 0.2 : 0;
      
      // Calculate performance factor
      const performanceFactor = member.performanceScore / 10;
      
      // Calculate load factor (prefer less loaded members)
      const loadFactor = 1 - (member.currentLoad / member.maxConcurrentTasks);
      
      // Calculate overall match score
      const matchScore = (
        capabilityAlignment * 0.4 +
        performanceFactor * 0.3 +
        loadFactor * 0.2 +
        specializationBonus
      ) * (1 - skillGaps.length * 0.1); // Penalty for skill gaps
      
      const confidenceLevel = Math.min(matchScore * (1 - complexity.computedComplexity / 10), 1);
      
      matches.push({
        memberId,
        matchScore,
        capabilityAlignment,
        skillGaps,
        confidenceLevel
      });
    }
    
    // Sort by match score descending
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Select optimal team member using load balancing
   */
  private async selectOptimalMember(
    capabilityMatches: CapabilityMatch[], 
    complexity: ComplexityAssessment
  ): Promise<CapabilityMatch> {
    const loadInfos = await this.calculateLoadBalancing();
    const loadMap = new Map(loadInfos.map(info => [info.memberId, info]));
    
    // Score candidates based on capability match and load balance
    const scoredCandidates = capabilityMatches.map(match => {
      const loadInfo = loadMap.get(match.memberId);
      if (!loadInfo) {
        return { ...match, finalScore: 0 };
      }
      
      const loadScore = 1 - loadInfo.utilizationRate;
      const availabilityScore = loadInfo.projectedAvailability <= new Date() ? 1 : 0.5;
      
      const finalScore = (
        match.matchScore * 0.5 +
        loadScore * 0.3 +
        availabilityScore * 0.2
      );
      
      return { ...match, finalScore };
    });
    
    // Select highest scoring candidate
    const selectedCandidate = scoredCandidates.reduce((best, current) => 
      current.finalScore > best.finalScore ? current : best
    );
    
    if (selectedCandidate.finalScore === 0) {
      throw new Error('No suitable team member available');
    }
    
    return selectedCandidate;
  }

  /**
   * Calculate current load balancing information
   */
  private async calculateLoadBalancing(): Promise<LoadInfo[]> {
    const loadInfos: LoadInfo[] = [];
    
    for (const [memberId, member] of this.teamMembers) {
      const queuedTasks = await this.redis.llen(`member_queue:${memberId}`);
      const utilizationRate = member.currentLoad / member.maxConcurrentTasks;
      
      // Estimate when member will be available based on current tasks
      const avgTaskTime = member.averageTaskTime || 3600; // Default 1 hour
      const projectedAvailability = new Date(Date.now() + (member.currentLoad * avgTaskTime * 1000));
      
      loadInfos.push({
        memberId,
        currentTasks: member.currentLoad,
        capacity: member.maxConcurrentTasks,
        utilizationRate,
        projectedAvailability,
        queuedTasks
      });
    }
    
    return loadInfos;
  }

  /**
   * Create task assignment record
   */
  private async createTaskAssignment(
    task: Task, 
    selectedMember: CapabilityMatch, 
    complexity: ComplexityAssessment
  ): Promise<TaskAssignment> {
    const member = this.teamMembers.get(selectedMember.memberId)!;
    const estimatedCompletion = new Date(Date.now() + (member.averageTaskTime * 1000));
    
    const assignment: TaskAssignment = {
      taskId: task.id,
      assignedMemberId: selectedMember.memberId,
      assignedAt: new Date(),
      estimatedCompletion,
      confidenceScore: selectedMember.confidenceLevel,
      routingReason: `Capability match: ${selectedMember.capabilityAlignment.toFixed(2)}, Load: ${member.currentLoad}/${member.maxConcurrentTasks}`
    };
    
    // Store in database
    await this.supabase
      .from('task_assignments')
      .insert({
        task_id: assignment.taskId,
        assigned_member_id: assignment.assignedMemberId,
        assigned_at: assignment.assignedAt,
        estimated_completion: assignment.estimatedCompletion,
        confidence_score: assignment.confidenceScore,
        routing_reason: assignment.routingReason
      });
    
    return assignment;
  }

  /**
   * Update team member load
   */
  private async updateMemberLoad(memberId: string, delta: number): Promise<void> {
    const member = this.teamMembers.get(memberId);
    if (!member) {
      throw new Error(`Team member ${memberId} not found`);
    }
    
    member.currentLoad = Math.max(0, member.currentLoad + delta);
    
    // Update in database
    await this.supabase
      .from('ai_team_members')
      .update({ current_load: member.currentLoad })
      .eq('id', memberId);
    
    // Update in Redis cache
    await this.redis.hset('member_loads', memberId, member.currentLoad.toString());
  }

  /**
   * Record performance data for analytics
   */
  private async recordPerformanceData(
    assignment: TaskAssignment,
    success: boolean,
    completionTime: number,
    feedback?: Record<string, any>
  ): Promise<void> {
    const performanceRecord = {
      member_id: assignment.assignedMemberId,
      task_id: assignment.taskId,
      success,
      completion_time: completionTime,
      estimated_time: assignment.estimatedCompletion.getTime() - assignment.assignedAt.getTime(),
      confidence_score: assignment.confidenceScore,
      feedback: feedback || {},
      timestamp: new Date()
    };
    
    // Store in database
    await this.supabase
      .from('performance_history')
      .insert(performanceRecord);
    
    // Update in-memory cache
    if (!this.performanceHistory.has(assignment.assignedMemberId)) {
      this.performanceHistory.set(assignment.assignedMemberId, []);
    }
    
    this.performanceHistory.get(assignment.assignedMemberId)!.push(performanceRecord);
    
    // Keep only recent history
    const history = this.performanceHistory.get(assignment.assignedMemberId)!;
    const cutoffTime = new Date(Date.now() - this.config.performanceWindowMinutes * 60 * 1000);
    this.performanceHistory.set(
      assignment.assignedMemberId,
      history.filter(record => record.timestamp >= cutoffTime)
    );
  }

  /**
   * Update team member performance score
   */
  private async updateMemberPerformanceScore(
    memberId: string,
    success: boolean,
    completionTime: number
  ): Promise<void> {
    const member = this.teamMembers.get(memberId);
    if (!member) {
      return;
    }
    
    const history = this.performanceHistory.get(memberId) || [];
    const recentTasks = history.slice(-10); // Last 10 tasks
    
    if (recentTasks.length