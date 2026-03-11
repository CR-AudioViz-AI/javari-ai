```typescript
/**
 * Intelligent Task Distribution Service
 * ML-powered service for optimal task assignment based on agent capabilities,
 * workload analysis, and performance history with continuous learning optimization
 */

import { createClient } from '@supabase/supabase-js';
import type {
  Agent,
  AgentCapability,
  AgentStatus,
  AgentWorkload,
  AgentPerformanceMetrics
} from '../../types/agents';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskRequirement,
  TaskAssignment,
  TaskMetrics
} from '../../types/tasks';

/**
 * Configuration for task distribution algorithm
 */
export interface TaskDistributionConfig {
  maxTasksPerAgent: number;
  capabilityThreshold: number;
  workloadWeight: number;
  performanceWeight: number;
  capabilityWeight: number;
  reassignmentThreshold: number;
  learningRate: number;
  explorationRate: number;
}

/**
 * Task distribution decision with reasoning
 */
export interface DistributionDecision {
  taskId: string;
  assignedAgentId: string;
  confidenceScore: number;
  reasoning: {
    capabilityMatch: number;
    workloadScore: number;
    performanceScore: number;
    alternativeAgents: Array<{
      agentId: string;
      score: number;
      reason: string;
    }>;
  };
  estimatedCompletionTime: number;
  priority: TaskPriority;
}

/**
 * Distribution metrics and analytics
 */
export interface DistributionMetrics {
  totalTasksDistributed: number;
  averageAssignmentTime: number;
  successfulAssignments: number;
  reassignments: number;
  agentUtilization: Record<string, number>;
  capabilityMatchAccuracy: number;
  performanceImprovement: number;
  queueWaitTime: number;
}

/**
 * ML optimization model state
 */
export interface OptimizationModel {
  weights: {
    capability: number;
    workload: number;
    performance: number;
    historical: number;
  };
  patterns: Record<string, number>;
  lastTraining: Date;
  accuracy: number;
  iterationCount: number;
}

/**
 * Task queue item with metadata
 */
export interface QueuedTask {
  task: Task;
  queuedAt: Date;
  priority: TaskPriority;
  attempts: number;
  requirements: TaskRequirement[];
  deadline?: Date;
}

/**
 * Agent pool with real-time status
 */
export interface AgentPoolEntry {
  agent: Agent;
  status: AgentStatus;
  currentWorkload: AgentWorkload;
  capabilities: AgentCapability[];
  performance: AgentPerformanceMetrics;
  lastAssignment: Date;
  availability: number; // 0-1 scale
}

/**
 * Intelligent Task Distribution Service
 */
export class IntelligentTaskDistributionService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  private config: TaskDistributionConfig = {
    maxTasksPerAgent: 10,
    capabilityThreshold: 0.7,
    workloadWeight: 0.3,
    performanceWeight: 0.4,
    capabilityWeight: 0.5,
    reassignmentThreshold: 0.2,
    learningRate: 0.01,
    explorationRate: 0.1
  };

  private taskQueue: Map<string, QueuedTask> = new Map();
  private agentPool: Map<string, AgentPoolEntry> = new Map();
  private optimizationModel: OptimizationModel = {
    weights: {
      capability: 0.5,
      workload: 0.3,
      performance: 0.4,
      historical: 0.2
    },
    patterns: {},
    lastTraining: new Date(),
    accuracy: 0.0,
    iterationCount: 0
  };

  private metrics: DistributionMetrics = {
    totalTasksDistributed: 0,
    averageAssignmentTime: 0,
    successfulAssignments: 0,
    reassignments: 0,
    agentUtilization: {},
    capabilityMatchAccuracy: 0,
    performanceImprovement: 0,
    queueWaitTime: 0
  };

  /**
   * Initialize the task distribution service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadAgentPool();
      await this.loadOptimizationModel();
      await this.startDistributionEngine();
      
      console.log('Task distribution service initialized');
    } catch (error) {
      console.error('Failed to initialize task distribution service:', error);
      throw new Error(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Distribute a task to the most suitable agent
   */
  async distributeTask(task: Task): Promise<DistributionDecision> {
    try {
      const startTime = Date.now();
      
      // Add task to queue
      const queuedTask: QueuedTask = {
        task,
        queuedAt: new Date(),
        priority: task.priority,
        attempts: 0,
        requirements: task.requirements || []
      };
      
      this.taskQueue.set(task.id, queuedTask);
      
      // Find optimal agent assignment
      const decision = await this.findOptimalAssignment(queuedTask);
      
      if (decision) {
        await this.assignTaskToAgent(decision);
        this.taskQueue.delete(task.id);
        
        // Update metrics
        this.updateDistributionMetrics(decision, Date.now() - startTime);
        
        return decision;
      }
      
      throw new Error('No suitable agent found for task assignment');
    } catch (error) {
      console.error('Task distribution failed:', error);
      throw new Error(`Distribution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find optimal agent assignment using ML optimization
   */
  private async findOptimalAssignment(queuedTask: QueuedTask): Promise<DistributionDecision | null> {
    const candidates = await this.identifyEligibleAgents(queuedTask);
    
    if (candidates.length === 0) {
      return null;
    }
    
    const scoredCandidates = await Promise.all(
      candidates.map(agent => this.calculateAssignmentScore(queuedTask, agent))
    );
    
    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    const bestCandidate = scoredCandidates[0];
    const alternatives = scoredCandidates.slice(1, 4).map(candidate => ({
      agentId: candidate.agentId,
      score: candidate.score,
      reason: candidate.reasoning
    }));
    
    return {
      taskId: queuedTask.task.id,
      assignedAgentId: bestCandidate.agentId,
      confidenceScore: bestCandidate.score,
      reasoning: {
        capabilityMatch: bestCandidate.capabilityScore,
        workloadScore: bestCandidate.workloadScore,
        performanceScore: bestCandidate.performanceScore,
        alternativeAgents: alternatives
      },
      estimatedCompletionTime: bestCandidate.estimatedTime,
      priority: queuedTask.priority
    };
  }

  /**
   * Calculate assignment score for agent-task pair
   */
  private async calculateAssignmentScore(
    queuedTask: QueuedTask,
    agent: AgentPoolEntry
  ): Promise<{
    agentId: string;
    score: number;
    capabilityScore: number;
    workloadScore: number;
    performanceScore: number;
    estimatedTime: number;
    reasoning: string;
  }> {
    // Calculate capability match using cosine similarity
    const capabilityScore = this.calculateCapabilityMatch(
      queuedTask.requirements,
      agent.capabilities
    );
    
    // Calculate workload score (inverse of current load)
    const workloadScore = this.calculateWorkloadScore(agent.currentWorkload);
    
    // Calculate performance score based on historical data
    const performanceScore = this.calculatePerformanceScore(
      agent.performance,
      queuedTask.task.type
    );
    
    // Apply ML model weights
    const weightedScore = 
      (capabilityScore * this.optimizationModel.weights.capability) +
      (workloadScore * this.optimizationModel.weights.workload) +
      (performanceScore * this.optimizationModel.weights.performance);
    
    // Apply exploration factor for learning
    const explorationBonus = Math.random() < this.config.explorationRate ? 0.1 : 0;
    const finalScore = weightedScore + explorationBonus;
    
    // Estimate completion time
    const estimatedTime = this.estimateCompletionTime(
      queuedTask.task,
      agent.performance
    );
    
    return {
      agentId: agent.agent.id,
      score: finalScore,
      capabilityScore,
      workloadScore,
      performanceScore,
      estimatedTime,
      reasoning: `Capability: ${capabilityScore.toFixed(2)}, Workload: ${workloadScore.toFixed(2)}, Performance: ${performanceScore.toFixed(2)}`
    };
  }

  /**
   * Calculate capability match using cosine similarity
   */
  private calculateCapabilityMatch(
    requirements: TaskRequirement[],
    capabilities: AgentCapability[]
  ): number {
    if (requirements.length === 0 || capabilities.length === 0) {
      return 0;
    }
    
    const reqVector = this.createCapabilityVector(requirements);
    const capVector = this.createCapabilityVector(capabilities);
    
    return this.cosineSimilarity(reqVector, capVector);
  }

  /**
   * Create capability vector for similarity calculation
   */
  private createCapabilityVector(items: (TaskRequirement | AgentCapability)[]): number[] {
    const skillMap = new Map<string, number>();
    
    items.forEach(item => {
      if ('skill' in item) {
        skillMap.set(item.skill, item.level || 1);
      } else {
        skillMap.set(item.name, item.proficiency || 1);
      }
    });
    
    const allSkills = Array.from(skillMap.keys()).sort();
    return allSkills.map(skill => skillMap.get(skill) || 0);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    const maxLength = Math.max(vectorA.length, vectorB.length);
    const a = [...vectorA, ...Array(maxLength - vectorA.length).fill(0)];
    const b = [...vectorB, ...Array(maxLength - vectorB.length).fill(0)];
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate workload score with exponential backoff
   */
  private calculateWorkloadScore(workload: AgentWorkload): number {
    const utilizationRate = workload.activeTasks / this.config.maxTasksPerAgent;
    
    // Exponential backoff for overloaded agents
    if (utilizationRate > 0.8) {
      return Math.exp(-5 * (utilizationRate - 0.8));
    }
    
    return 1 - utilizationRate;
  }

  /**
   * Calculate performance score based on historical metrics
   */
  private calculatePerformanceScore(
    performance: AgentPerformanceMetrics,
    taskType: string
  ): number {
    const typeSpecificPerformance = performance.taskTypePerformance?.[taskType];
    
    if (typeSpecificPerformance) {
      return (
        typeSpecificPerformance.successRate * 0.4 +
        (1 - typeSpecificPerformance.averageTime / typeSpecificPerformance.expectedTime) * 0.3 +
        typeSpecificPerformance.qualityScore * 0.3
      );
    }
    
    return (
      performance.overallSuccessRate * 0.5 +
      performance.averageQualityScore * 0.3 +
      (performance.taskCompletionRate || 0.5) * 0.2
    );
  }

  /**
   * Estimate task completion time
   */
  private estimateCompletionTime(task: Task, performance: AgentPerformanceMetrics): number {
    const baseEstimate = task.estimatedDuration || 3600; // 1 hour default
    const performanceFactor = performance.averageCompletionTime / baseEstimate || 1;
    
    return Math.max(baseEstimate * performanceFactor, 300); // Minimum 5 minutes
  }

  /**
   * Identify agents eligible for task assignment
   */
  private async identifyEligibleAgents(queuedTask: QueuedTask): Promise<AgentPoolEntry[]> {
    const eligibleAgents: AgentPoolEntry[] = [];
    
    for (const [agentId, agentEntry] of this.agentPool) {
      if (
        agentEntry.status === 'available' &&
        agentEntry.currentWorkload.activeTasks < this.config.maxTasksPerAgent &&
        agentEntry.availability > 0.1
      ) {
        const capabilityMatch = this.calculateCapabilityMatch(
          queuedTask.requirements,
          agentEntry.capabilities
        );
        
        if (capabilityMatch >= this.config.capabilityThreshold) {
          eligibleAgents.push(agentEntry);
        }
      }
    }
    
    return eligibleAgents;
  }

  /**
   * Assign task to selected agent
   */
  private async assignTaskToAgent(decision: DistributionDecision): Promise<void> {
    const assignment: TaskAssignment = {
      id: `assignment_${decision.taskId}_${decision.assignedAgentId}`,
      taskId: decision.taskId,
      agentId: decision.assignedAgentId,
      assignedAt: new Date(),
      status: 'assigned',
      confidence: decision.confidenceScore,
      estimatedCompletion: new Date(Date.now() + decision.estimatedCompletionTime * 1000)
    };
    
    // Update database
    const { error: assignmentError } = await this.supabase
      .from('task_assignments')
      .insert(assignment);
    
    if (assignmentError) {
      throw new Error(`Failed to create assignment: ${assignmentError.message}`);
    }
    
    // Update task status
    const { error: taskError } = await this.supabase
      .from('tasks')
      .update({
        status: 'assigned',
        assigned_agent_id: decision.assignedAgentId,
        updated_at: new Date().toISOString()
      })
      .eq('id', decision.taskId);
    
    if (taskError) {
      throw new Error(`Failed to update task: ${taskError.message}`);
    }
    
    // Update agent workload
    const agent = this.agentPool.get(decision.assignedAgentId);
    if (agent) {
      agent.currentWorkload.activeTasks++;
      agent.lastAssignment = new Date();
    }
  }

  /**
   * Load agent pool from database
   */
  private async loadAgentPool(): Promise<void> {
    const { data: agents, error } = await this.supabase
      .from('agents')
      .select(`
        *,
        agent_capabilities(*),
        agent_workload(*),
        agent_performance_metrics(*)
      `)
      .eq('status', 'active');
    
    if (error) {
      throw new Error(`Failed to load agents: ${error.message}`);
    }
    
    for (const agent of agents || []) {
      const poolEntry: AgentPoolEntry = {
        agent: agent as Agent,
        status: agent.current_status || 'available',
        currentWorkload: agent.agent_workload?.[0] || { activeTasks: 0, queuedTasks: 0 },
        capabilities: agent.agent_capabilities || [],
        performance: agent.agent_performance_metrics?.[0] || {
          overallSuccessRate: 0.5,
          averageQualityScore: 0.5,
          averageCompletionTime: 3600
        },
        lastAssignment: new Date(0),
        availability: 1.0
      };
      
      this.agentPool.set(agent.id, poolEntry);
    }
  }

  /**
   * Load ML optimization model
   */
  private async loadOptimizationModel(): Promise<void> {
    const { data: model } = await this.supabase
      .from('ml_optimization_models')
      .select('*')
      .eq('model_type', 'task_distribution')
      .single();
    
    if (model) {
      this.optimizationModel = {
        weights: model.weights || this.optimizationModel.weights,
        patterns: model.patterns || {},
        lastTraining: new Date(model.last_training),
        accuracy: model.accuracy || 0,
        iterationCount: model.iteration_count || 0
      };
    }
  }

  /**
   * Update distribution metrics
   */
  private updateDistributionMetrics(decision: DistributionDecision, assignmentTime: number): void {
    this.metrics.totalTasksDistributed++;
    this.metrics.successfulAssignments++;
    this.metrics.averageAssignmentTime = 
      (this.metrics.averageAssignmentTime * (this.metrics.totalTasksDistributed - 1) + assignmentTime) /
      this.metrics.totalTasksDistributed;
    
    if (!this.metrics.agentUtilization[decision.assignedAgentId]) {
      this.metrics.agentUtilization[decision.assignedAgentId] = 0;
    }
    this.metrics.agentUtilization[decision.assignedAgentId]++;
  }

  /**
   * Start the distribution engine loop
   */
  private async startDistributionEngine(): Promise<void> {
    setInterval(async () => {
      await this.processTaskQueue();
      await this.optimizeDistribution();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process queued tasks
   */
  private async processTaskQueue(): Promise<void> {
    const queuedTasks = Array.from(this.taskQueue.values())
      .sort((a, b) => {
        // Priority first, then queue time
        if (a.priority !== b.priority) {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.queuedAt.getTime() - b.queuedAt.getTime();
      });
    
    for (const queuedTask of queuedTasks.slice(0, 5)) { // Process up to 5 at a time
      try {
        const decision = await this.findOptimalAssignment(queuedTask);
        if (decision) {
          await this.assignTaskToAgent(decision);
          this.taskQueue.delete(queuedTask.task.id);
        }
      } catch (error) {
        console.error(`Failed to process queued task ${queuedTask.task.id}:`, error);
        queuedTask.attempts++;
        
        if (queuedTask.attempts >= 3) {
          this.taskQueue.delete(queuedTask.task.id);
          console.warn(`Removed task ${queuedTask.task.id} after 3 failed attempts`);
        }
      }
    }
  }

  /**
   * Optimize distribution using ML feedback
   */
  private async optimizeDistribution(): Promise<void> {
    if (this.metrics.totalTasksDistributed % 100 === 0 && this.metrics.totalTasksDistributed > 0) {
      // Update model weights based on performance
      const performanceFeedback = await this.collectPerformanceFeedback();
      this.updateOptimizationWeights(performanceFeedback);
      
      // Save updated model
      await this.saveOptimizationModel();
    }
  }

  /**
   * Collect performance feedback for model optimization
   */
  private async collectPerformanceFeedback(): Promise<Record<string, number>> {
    const { data: completedTasks } = await this.supabase
      .from('tasks')
      .select('*, task_assignments(*)')
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const feedback: Record<string, number> = {};
    
    for (const task of completedTasks || []) {
      const assignment = task.task_assignments?.[0];
      if (assignment) {
        const actualTime = new Date(task.completed_at).getTime() - new Date(assignment.assigned_at).getTime();
        const estimatedTime = assignment.estimated_completion ? 
          new Date(assignment.estimated_completion).getTime() - new Date(assignment.assigned_at).getTime() : actualTime;
        
        const timeAccuracy = Math.min(estimatedTime / actualTime, 2); // Cap at 2x
        feedback[`time_accuracy_${assignment.agent_id}`] = timeAccuracy;
        
        if (task.quality_score) {
          feedback[`quality_${assignment.agent_id}`] = task.quality_score;
        }
      }
    }
    
    return feedback;
  }

  /**
   * Update optimization model weights
   */
  private updateOptimizationWeights(feedback: Record<string, number>): void {
    const learningRate = this.config.learningRate;
    
    // Simple gradient descent-like update
    const avgQuality = Object.values(feedback)
      .filter((_, i) => Object.keys(feedback)[i].startsWith('quality'))
      .reduce((sum, val) => sum + val, 0) / Object.keys(feedback).length || 0.5;
    
    if (avgQuality > 0.7) {
      // Good performance, increase capability weight
      this.optimizationModel.weights.capability *= (1 + learningRate);
    } else if (avgQuality < 0.3