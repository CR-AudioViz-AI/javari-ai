```typescript
import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';
import { Agent, Task, TaskStatus, AgentCapability, ConflictResolutionStrategy } from '@/types/agent-types';
import { calculatePriority, PriorityFactors } from '@/utils/priority-calculator';
import { EventEmitter } from 'events';

type Tables = Database['public']['Tables'];

/**
 * Interface for agent conflict information
 */
export interface AgentConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  agents: string[];
  tasks: string[];
  resources: string[];
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: ConflictResolution;
  metadata: Record<string, any>;
}

/**
 * Types of conflicts that can occur between agents
 */
export enum ConflictType {
  TASK_OVERLAP = 'task_overlap',
  RESOURCE_CONTENTION = 'resource_contention',
  PRIORITY_COLLISION = 'priority_collision',
  DEPENDENCY_VIOLATION = 'dependency_violation',
  CAPABILITY_MISMATCH = 'capability_mismatch'
}

/**
 * Severity levels for conflicts
 */
export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Conflict resolution outcome
 */
export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  actions: ResolutionAction[];
  affectedAgents: string[];
  affectedTasks: string[];
  outcome: ResolutionOutcome;
  reasoning: string;
  metrics: ResolutionMetrics;
}

/**
 * Actions taken to resolve conflicts
 */
export interface ResolutionAction {
  type: 'reassign_task' | 'share_resource' | 'adjust_priority' | 'delay_execution' | 'merge_tasks';
  agentId: string;
  taskId?: string;
  resourceId?: string;
  parameters: Record<string, any>;
}

/**
 * Resolution outcome status
 */
export enum ResolutionOutcome {
  RESOLVED = 'resolved',
  PARTIALLY_RESOLVED = 'partially_resolved',
  ESCALATED = 'escalated',
  FAILED = 'failed'
}

/**
 * Metrics for resolution performance
 */
export interface ResolutionMetrics {
  timeToResolve: number;
  agentsAffected: number;
  tasksReassigned: number;
  resourcesReallocated: number;
  satisfactionScore: number;
}

/**
 * Negotiation protocol interface
 */
export interface NegotiationProtocol {
  type: 'cooperative' | 'competitive' | 'collaborative' | 'hierarchical';
  participants: string[];
  rounds: NegotiationRound[];
  outcome: NegotiationOutcome;
}

/**
 * Negotiation round data
 */
export interface NegotiationRound {
  round: number;
  proposals: NegotiationProposal[];
  responses: NegotiationResponse[];
  consensus: boolean;
}

/**
 * Agent proposal during negotiation
 */
export interface NegotiationProposal {
  agentId: string;
  proposalType: 'yield' | 'share' | 'alternative' | 'counter';
  parameters: Record<string, any>;
  priority: number;
  reasoning: string;
}

/**
 * Agent response to proposals
 */
export interface NegotiationResponse {
  agentId: string;
  proposalId: string;
  response: 'accept' | 'reject' | 'counter';
  reasoning: string;
  counterProposal?: NegotiationProposal;
}

/**
 * Negotiation outcome
 */
export interface NegotiationOutcome {
  success: boolean;
  agreement?: ConflictResolution;
  failureReason?: string;
  consensusLevel: number;
}

/**
 * Task overlap analysis result
 */
export interface TaskOverlap {
  tasks: string[];
  overlapType: 'resource' | 'time' | 'capability' | 'goal';
  severity: number;
  details: Record<string, any>;
}

/**
 * Agent coordination state
 */
export interface CoordinationState {
  agentId: string;
  activeTasks: string[];
  allocatedResources: string[];
  capabilities: AgentCapability[];
  priority: number;
  status: 'available' | 'busy' | 'blocked' | 'negotiating';
  lastUpdate: Date;
}

/**
 * Service class for detecting and resolving agent conflicts
 */
export class AgentConflictResolutionService extends EventEmitter {
  private conflictCache = new Map<string, AgentConflict>();
  private coordinationStates = new Map<string, CoordinationState>();
  private activeNegotiations = new Map<string, NegotiationProtocol>();
  private resolutionHistory: ConflictResolution[] = [];

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize the conflict resolution service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.loadCoordinationStates();
      this.startConflictMonitoring();
      this.emit('service_initialized');
    } catch (error) {
      console.error('Failed to initialize conflict resolution service:', error);
      throw new Error(`Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect conflicts between agents
   */
  public async detectConflicts(): Promise<AgentConflict[]> {
    try {
      const activeAgents = await this.getActiveAgents();
      const conflicts: AgentConflict[] = [];

      // Analyze task overlaps
      const taskOverlaps = await this.analyzeTaskOverlaps(activeAgents);
      conflicts.push(...await this.convertOverlapsToConflicts(taskOverlaps));

      // Check resource contentions
      const resourceConflicts = await this.detectResourceContentions(activeAgents);
      conflicts.push(...resourceConflicts);

      // Identify priority collisions
      const priorityConflicts = await this.detectPriorityCollisions(activeAgents);
      conflicts.push(...priorityConflicts);

      // Update conflict cache
      conflicts.forEach(conflict => {
        this.conflictCache.set(conflict.id, conflict);
      });

      this.emit('conflicts_detected', { count: conflicts.length, conflicts });
      return conflicts;
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      throw new Error(`Conflict detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate priority scores for conflict resolution
   */
  public async calculatePriorityScores(agentIds: string[], taskIds: string[]): Promise<Map<string, number>> {
    try {
      const scores = new Map<string, number>();

      for (const agentId of agentIds) {
        const agent = await this.getAgentById(agentId);
        const agentTasks = await this.getAgentTasks(agentId);
        
        let totalScore = 0;
        for (const task of agentTasks) {
          if (taskIds.includes(task.id)) {
            const factors: PriorityFactors = {
              taskCriticality: this.assessTaskCriticality(task),
              agentExpertiseMatch: this.calculateExpertiseMatch(agent, task),
              deadlineProximity: this.calculateDeadlineUrgency(task),
              resourceAvailability: await this.assessResourceAvailability(task)
            };

            const taskScore = calculatePriority(factors);
            totalScore += taskScore;
          }
        }

        scores.set(agentId, totalScore);
      }

      return scores;
    } catch (error) {
      console.error('Error calculating priority scores:', error);
      throw new Error(`Priority calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initiate negotiation protocol between conflicting agents
   */
  public async initiateNegotiation(conflictId: string, protocol: 'cooperative' | 'competitive' | 'collaborative' | 'hierarchical'): Promise<NegotiationProtocol> {
    try {
      const conflict = this.conflictCache.get(conflictId);
      if (!conflict) {
        throw new Error(`Conflict not found: ${conflictId}`);
      }

      const negotiation: NegotiationProtocol = {
        type: protocol,
        participants: conflict.agents,
        rounds: [],
        outcome: {
          success: false,
          consensusLevel: 0
        }
      };

      this.activeNegotiations.set(conflictId, negotiation);

      // Start negotiation rounds
      const result = await this.conductNegotiation(conflictId, negotiation);
      
      this.emit('negotiation_completed', { conflictId, result });
      return result;
    } catch (error) {
      console.error('Error initiating negotiation:', error);
      throw new Error(`Negotiation initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve conflicts using appropriate strategies
   */
  public async resolveConflict(conflictId: string, strategy?: ConflictResolutionStrategy): Promise<ConflictResolution> {
    try {
      const conflict = this.conflictCache.get(conflictId);
      if (!conflict) {
        throw new Error(`Conflict not found: ${conflictId}`);
      }

      const startTime = Date.now();
      const resolvedStrategy = strategy || await this.selectOptimalStrategy(conflict);

      let resolution: ConflictResolution;
      
      switch (resolvedStrategy) {
        case 'reassign_tasks':
          resolution = await this.resolveByTaskReassignment(conflict);
          break;
        case 'share_resources':
          resolution = await this.resolveByResourceSharing(conflict);
          break;
        case 'parallel_execution':
          resolution = await this.resolveByParallelExecution(conflict);
          break;
        case 'priority_adjustment':
          resolution = await this.resolveByPriorityAdjustment(conflict);
          break;
        case 'escalation':
          resolution = await this.escalateConflict(conflict);
          break;
        default:
          throw new Error(`Unknown resolution strategy: ${resolvedStrategy}`);
      }

      // Update resolution metrics
      resolution.metrics.timeToResolve = Date.now() - startTime;
      
      // Mark conflict as resolved
      conflict.resolvedAt = new Date();
      conflict.resolution = resolution;

      // Update database
      await this.saveConflictResolution(conflictId, resolution);
      
      // Update coordination states
      await this.updateCoordinationStates(resolution);

      // Add to resolution history
      this.resolutionHistory.push(resolution);

      this.emit('conflict_resolved', { conflictId, resolution });
      return resolution;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw new Error(`Conflict resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze task overlaps between agents
   */
  public async analyzeTaskOverlaps(agents: Agent[]): Promise<TaskOverlap[]> {
    try {
      const overlaps: TaskOverlap[] = [];
      
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const agent1 = agents[i];
          const agent2 = agents[j];
          
          const agent1Tasks = await this.getAgentTasks(agent1.id);
          const agent2Tasks = await this.getAgentTasks(agent2.id);
          
          const overlap = this.findTaskOverlap(agent1Tasks, agent2Tasks);
          if (overlap) {
            overlaps.push(overlap);
          }
        }
      }

      return overlaps;
    } catch (error) {
      console.error('Error analyzing task overlaps:', error);
      throw new Error(`Task overlap analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update coordination states for agents
   */
  public async updateCoordinationState(agentId: string, update: Partial<CoordinationState>): Promise<CoordinationState> {
    try {
      const currentState = this.coordinationStates.get(agentId) || {
        agentId,
        activeTasks: [],
        allocatedResources: [],
        capabilities: [],
        priority: 0,
        status: 'available',
        lastUpdate: new Date()
      };

      const updatedState: CoordinationState = {
        ...currentState,
        ...update,
        lastUpdate: new Date()
      };

      this.coordinationStates.set(agentId, updatedState);
      
      // Save to database
      await this.saveCoordinationState(updatedState);

      this.emit('coordination_state_updated', { agentId, state: updatedState });
      return updatedState;
    } catch (error) {
      console.error('Error updating coordination state:', error);
      throw new Error(`Coordination state update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get coordination state for an agent
   */
  public getCoordinationState(agentId: string): CoordinationState | undefined {
    return this.coordinationStates.get(agentId);
  }

  /**
   * Get all active conflicts
   */
  public getActiveConflicts(): AgentConflict[] {
    return Array.from(this.conflictCache.values()).filter(conflict => !conflict.resolvedAt);
  }

  /**
   * Get resolution history with filtering options
   */
  public getResolutionHistory(filters?: {
    strategy?: ConflictResolutionStrategy;
    outcome?: ResolutionOutcome;
    limit?: number;
  }): ConflictResolution[] {
    let history = [...this.resolutionHistory];

    if (filters?.strategy) {
      history = history.filter(r => r.strategy === filters.strategy);
    }

    if (filters?.outcome) {
      history = history.filter(r => r.outcome === filters.outcome);
    }

    if (filters?.limit) {
      history = history.slice(-filters.limit);
    }

    return history.reverse();
  }

  // Private helper methods

  private async loadCoordinationStates(): Promise<void> {
    const { data, error } = await supabase
      .from('agent_coordination_states')
      .select('*');

    if (error) throw error;

    data?.forEach(state => {
      this.coordinationStates.set(state.agent_id, {
        agentId: state.agent_id,
        activeTasks: state.active_tasks || [],
        allocatedResources: state.allocated_resources || [],
        capabilities: state.capabilities || [],
        priority: state.priority || 0,
        status: state.status,
        lastUpdate: new Date(state.updated_at)
      });
    });
  }

  private startConflictMonitoring(): void {
    setInterval(async () => {
      try {
        await this.detectConflicts();
      } catch (error) {
        console.error('Error in conflict monitoring cycle:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async getActiveAgents(): Promise<Agent[]> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active');

    if (error) throw error;
    return data as Agent[];
  }

  private async getAgentById(agentId: string): Promise<Agent> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error) throw error;
    return data as Agent;
  }

  private async getAgentTasks(agentId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_agent_id', agentId)
      .in('status', ['pending', 'in_progress']);

    if (error) throw error;
    return data as Task[];
  }

  private async convertOverlapsToConflicts(overlaps: TaskOverlap[]): Promise<AgentConflict[]> {
    return overlaps.map(overlap => ({
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ConflictType.TASK_OVERLAP,
      severity: this.calculateConflictSeverity(overlap.severity),
      agents: [], // Will be populated based on task assignments
      tasks: overlap.tasks,
      resources: [],
      detectedAt: new Date(),
      metadata: { overlap }
    }));
  }

  private async detectResourceContentions(agents: Agent[]): Promise<AgentConflict[]> {
    // Implementation for resource contention detection
    return [];
  }

  private async detectPriorityCollisions(agents: Agent[]): Promise<AgentConflict[]> {
    // Implementation for priority collision detection
    return [];
  }

  private assessTaskCriticality(task: Task): number {
    // Implementation for task criticality assessment
    return 0.5;
  }

  private calculateExpertiseMatch(agent: Agent, task: Task): number {
    // Implementation for expertise matching
    return 0.8;
  }

  private calculateDeadlineUrgency(task: Task): number {
    if (!task.deadline) return 0;
    
    const now = new Date();
    const deadline = new Date(task.deadline);
    const timeUntilDeadline = deadline.getTime() - now.getTime();
    
    // Convert to hours and normalize
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
    
    if (hoursUntilDeadline <= 0) return 1.0;
    if (hoursUntilDeadline >= 168) return 0.0; // 1 week
    
    return Math.max(0, 1 - (hoursUntilDeadline / 168));
  }

  private async assessResourceAvailability(task: Task): Promise<number> {
    // Implementation for resource availability assessment
    return 0.7;
  }

  private findTaskOverlap(tasks1: Task[], tasks2: Task[]): TaskOverlap | null {
    // Implementation for finding task overlaps
    return null;
  }

  private calculateConflictSeverity(overlapSeverity: number): ConflictSeverity {
    if (overlapSeverity >= 0.8) return ConflictSeverity.CRITICAL;
    if (overlapSeverity >= 0.6) return ConflictSeverity.HIGH;
    if (overlapSeverity >= 0.4) return ConflictSeverity.MEDIUM;
    return ConflictSeverity.LOW;
  }

  private async conductNegotiation(conflictId: string, negotiation: NegotiationProtocol): Promise<NegotiationProtocol> {
    // Implementation for conducting negotiation
    return negotiation;
  }

  private async selectOptimalStrategy(conflict: AgentConflict): Promise<ConflictResolutionStrategy> {
    // Implementation for strategy selection
    return 'reassign_tasks';
  }

  private async resolveByTaskReassignment(conflict: AgentConflict): Promise<ConflictResolution> {
    return {
      strategy: 'reassign_tasks',
      actions: [],
      affectedAgents: conflict.agents,
      affectedTasks: conflict.tasks,
      outcome: ResolutionOutcome.RESOLVED,
      reasoning: 'Tasks reassigned based on priority scores',
      metrics: {
        timeToResolve: 0,
        agentsAffected: conflict.agents.length,
        tasksReassigned: conflict.tasks.length,
        resourcesReallocated: 0,
        satisfactionScore: 0.8
      }
    };
  }

  private async resolveByResourceSharing(conflict: AgentConflict): Promise<ConflictResolution> {
    return {
      strategy: 'share_resources',
      actions: [],
      affectedAgents: conflict.agents,
      affectedTasks: conflict.tasks,
      outcome: ResolutionOutcome.RESOLVED,
      reasoning: 'Resources shared between conflicting agents',
      metrics: {
        timeToResolve: 0,
        agentsAffected: conflict.agents.length,
        tasksReassigned: 0,
        resourcesReallocated: conflict.resources.length,
        satisfactionScore: 0.7
      }
    };
  }

  private async resolveByParallelExecution(conflict: AgentConflict): Promise<ConflictResolution> {
    return {
      strategy: 'parallel_execution',
      actions: [],
      affectedAgents: conflict.agents,
      affectedTasks: conflict.tasks,
      outcome: ResolutionOutcome.RESOLVED,
      reasoning: 'Tasks configured for parallel execution',
      metrics: {
        timeToResolve: 0,
        agentsAffected: conflict.agents.length,
        tasksReassigned: 0,
        resourcesReallocated: 0,
        satisfactionScore: 0.9
      }
    };
  }

  private async resolveByPriorityAdjustment(conflict: AgentConflict): Promise<ConflictResolution> {
    return {
      strategy: 'priority_adjustment',
      actions: [],
      affectedAgents: conflict.agents,
      affectedTasks: conflict.tasks,
      outcome: ResolutionOutcome.RESOLVED,
      reasoning: 'Task priorities adjusted to resolve conflict',
      metrics: {
        timeToResolve: 0,
        agentsAffected: conflict.agents.length,
        tasksReassigned: 0,
        resourcesReallocated: 0,
        satisfactionScore: 0.6
      }
    };
  }

  private async escalateConflict(conflict: AgentConflict): Promise<ConflictResolution> {
    return {
      strategy: 'escalation',
      actions: [],
      affectedAgents: conflict.agents,
      affectedTasks: conflict.tasks,
      outcome: ResolutionOutcome.ESCALATED,
      reasoning: 'Conflict escalated to human supervisor',
      metrics: {
        timeToResolve: 0,
        agentsAffected: conflict.agents.length,
        tasksReassigned: 0,
        resourcesReallocated: 0,
        satisfactionScore: 0.3
      }
    };
  }

  private async saveConflictResolution(conflictId: string, resolution: ConflictResolution): Promise<void> {