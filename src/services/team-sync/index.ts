/**
 * Team Synchronization Microservice
 * Coordinates timing and dependencies between AI team members, manages workflow states,
 * and ensures consistent project execution with deadlock detection and recovery.
 */

import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import WebSocket from 'ws';

// Types and Interfaces
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: TeamMemberStatus;
  capabilities: string[];
  currentTask?: string;
  dependencies: string[];
  lastHeartbeat: Date;
}

export interface WorkflowState {
  id: string;
  projectId: string;
  phase: WorkflowPhase;
  status: WorkflowStatus;
  tasks: TaskState[];
  dependencies: DependencyEdge[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskState {
  id: string;
  assigneeId: string;
  status: TaskStatus;
  dependencies: string[];
  estimatedDuration: number;
  actualDuration?: number;
  startTime?: Date;
  completionTime?: Date;
  blockers: string[];
  priority: TaskPriority;
}

export interface DependencyEdge {
  fromTask: string;
  toTask: string;
  type: DependencyType;
  weight: number;
  condition?: string;
}

export interface DeadlockInfo {
  cycle: string[];
  affectedTasks: string[];
  detectionTime: Date;
  severity: DeadlockSeverity;
  suggestedResolution: RecoveryAction[];
}

export interface RecoveryAction {
  type: RecoveryType;
  targetTask?: string;
  targetMember?: string;
  parameters: Record<string, any>;
  expectedImpact: string;
}

export interface SyncEvent {
  type: SyncEventType;
  source: string;
  target?: string;
  payload: any;
  timestamp: Date;
  correlationId: string;
}

export interface HealthMetrics {
  uptime: number;
  activeMembers: number;
  pendingTasks: number;
  deadlockCount: number;
  averageTaskDuration: number;
  throughput: number;
  errorRate: number;
  lastSync: Date;
}

// Enums
export enum TeamMemberStatus {
  ACTIVE = 'active',
  BUSY = 'busy',
  IDLE = 'idle',
  OFFLINE = 'offline',
  BLOCKED = 'blocked'
}

export enum WorkflowPhase {
  PLANNING = 'planning',
  DESIGN = 'design',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  REVIEW = 'review',
  DEPLOYMENT = 'deployment',
  COMPLETED = 'completed'
}

export enum WorkflowStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum TaskStatus {
  PENDING = 'pending',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum DependencyType {
  FINISH_TO_START = 'finish_to_start',
  START_TO_START = 'start_to_start',
  FINISH_TO_FINISH = 'finish_to_finish',
  START_TO_FINISH = 'start_to_finish'
}

export enum DeadlockSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryType {
  REASSIGN_TASK = 'reassign_task',
  BREAK_DEPENDENCY = 'break_dependency',
  PRIORITY_BOOST = 'priority_boost',
  RESOURCE_ALLOCATION = 'resource_allocation',
  ROLLBACK_STATE = 'rollback_state'
}

export enum SyncEventType {
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  STATE_TRANSITION = 'state_transition',
  DEADLOCK_DETECTED = 'deadlock_detected',
  RECOVERY_INITIATED = 'recovery_initiated',
  HEARTBEAT = 'heartbeat'
}

/**
 * Manages workflow states and transitions
 */
class WorkflowStateManager {
  private states = new Map<string, WorkflowState>();
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Creates a new workflow state
   */
  async createWorkflowState(projectId: string, initialTasks: TaskState[]): Promise<WorkflowState> {
    const state: WorkflowState = {
      id: this.generateId(),
      projectId,
      phase: WorkflowPhase.PLANNING,
      status: WorkflowStatus.PENDING,
      tasks: initialTasks,
      dependencies: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.states.set(state.id, state);
    await this.redis.setex(`workflow:${state.id}`, 3600, JSON.stringify(state));
    return state;
  }

  /**
   * Updates workflow state
   */
  async updateWorkflowState(stateId: string, updates: Partial<WorkflowState>): Promise<WorkflowState> {
    const state = this.states.get(stateId);
    if (!state) {
      throw new Error(`Workflow state not found: ${stateId}`);
    }

    const updatedState = { ...state, ...updates, updatedAt: new Date() };
    this.states.set(stateId, updatedState);
    await this.redis.setex(`workflow:${stateId}`, 3600, JSON.stringify(updatedState));
    return updatedState;
  }

  /**
   * Gets workflow state by ID
   */
  async getWorkflowState(stateId: string): Promise<WorkflowState | null> {
    let state = this.states.get(stateId);
    if (!state) {
      const cached = await this.redis.get(`workflow:${stateId}`);
      if (cached) {
        state = JSON.parse(cached);
        this.states.set(stateId, state!);
      }
    }
    return state || null;
  }

  /**
   * Validates state transition
   */
  canTransition(currentPhase: WorkflowPhase, targetPhase: WorkflowPhase): boolean {
    const validTransitions: Record<WorkflowPhase, WorkflowPhase[]> = {
      [WorkflowPhase.PLANNING]: [WorkflowPhase.DESIGN],
      [WorkflowPhase.DESIGN]: [WorkflowPhase.IMPLEMENTATION],
      [WorkflowPhase.IMPLEMENTATION]: [WorkflowPhase.TESTING],
      [WorkflowPhase.TESTING]: [WorkflowPhase.REVIEW],
      [WorkflowPhase.REVIEW]: [WorkflowPhase.DEPLOYMENT],
      [WorkflowPhase.DEPLOYMENT]: [WorkflowPhase.COMPLETED],
      [WorkflowPhase.COMPLETED]: []
    };

    return validTransitions[currentPhase].includes(targetPhase);
  }

  private generateId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Manages dependency relationships between tasks
 */
class DependencyGraph {
  private edges: DependencyEdge[] = [];
  private adjacencyList = new Map<string, Set<string>>();

  /**
   * Adds dependency edge
   */
  addDependency(edge: DependencyEdge): void {
    this.edges.push(edge);
    
    if (!this.adjacencyList.has(edge.fromTask)) {
      this.adjacencyList.set(edge.fromTask, new Set());
    }
    this.adjacencyList.get(edge.fromTask)!.add(edge.toTask);
  }

  /**
   * Removes dependency edge
   */
  removeDependency(fromTask: string, toTask: string): void {
    this.edges = this.edges.filter(e => !(e.fromTask === fromTask && e.toTask === toTask));
    
    const dependencies = this.adjacencyList.get(fromTask);
    if (dependencies) {
      dependencies.delete(toTask);
    }
  }

  /**
   * Gets all dependencies for a task
   */
  getDependencies(taskId: string): string[] {
    return this.edges
      .filter(e => e.toTask === taskId)
      .map(e => e.fromTask);
  }

  /**
   * Gets all dependents for a task
   */
  getDependents(taskId: string): string[] {
    return Array.from(this.adjacencyList.get(taskId) || []);
  }

  /**
   * Detects cycles in dependency graph
   */
  detectCycles(): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = this.adjacencyList.get(node);
      if (dependencies) {
        for (const dep of dependencies) {
          dfs(dep, [...path]);
        }
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const node of this.adjacencyList.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Gets topological sort of tasks
   */
  getTopologicalSort(): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);

      const dependencies = this.adjacencyList.get(node);
      if (dependencies) {
        for (const dep of dependencies) {
          if (!visited.has(dep)) {
            dfs(dep);
          }
        }
      }

      stack.push(node);
    };

    for (const node of this.adjacencyList.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return stack.reverse();
  }
}

/**
 * Detects deadlocks in team coordination
 */
class DeadlockDetector {
  private dependencyGraph: DependencyGraph;
  private detectionInterval: NodeJS.Timeout | null = null;

  constructor(dependencyGraph: DependencyGraph) {
    this.dependencyGraph = dependencyGraph;
  }

  /**
   * Starts deadlock detection
   */
  startDetection(intervalMs: number = 30000): void {
    this.detectionInterval = setInterval(() => {
      this.detectDeadlocks();
    }, intervalMs);
  }

  /**
   * Stops deadlock detection
   */
  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Detects current deadlocks
   */
  detectDeadlocks(): DeadlockInfo[] {
    const cycles = this.dependencyGraph.detectCycles();
    const deadlocks: DeadlockInfo[] = [];

    for (const cycle of cycles) {
      const affectedTasks = this.getAffectedTasks(cycle);
      const severity = this.calculateSeverity(cycle, affectedTasks);
      const resolution = this.suggestResolution(cycle, severity);

      deadlocks.push({
        cycle,
        affectedTasks,
        detectionTime: new Date(),
        severity,
        suggestedResolution: resolution
      });
    }

    return deadlocks;
  }

  private getAffectedTasks(cycle: string[]): string[] {
    const affected = new Set<string>(cycle);
    
    // Add tasks that depend on cycle tasks
    for (const taskId of cycle) {
      const dependents = this.dependencyGraph.getDependents(taskId);
      dependents.forEach(dep => affected.add(dep));
    }

    return Array.from(affected);
  }

  private calculateSeverity(cycle: string[], affectedTasks: string[]): DeadlockSeverity {
    if (cycle.length > 5 || affectedTasks.length > 10) {
      return DeadlockSeverity.CRITICAL;
    } else if (cycle.length > 3 || affectedTasks.length > 5) {
      return DeadlockSeverity.HIGH;
    } else if (cycle.length > 2 || affectedTasks.length > 2) {
      return DeadlockSeverity.MEDIUM;
    }
    return DeadlockSeverity.LOW;
  }

  private suggestResolution(cycle: string[], severity: DeadlockSeverity): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    if (severity === DeadlockSeverity.CRITICAL) {
      // Break multiple dependencies
      actions.push({
        type: RecoveryType.BREAK_DEPENDENCY,
        parameters: { cycles: [cycle] },
        expectedImpact: 'High impact - will require task reassignment'
      });
    } else {
      // Try priority boost first
      actions.push({
        type: RecoveryType.PRIORITY_BOOST,
        targetTask: cycle[0],
        parameters: { priority: TaskPriority.CRITICAL },
        expectedImpact: 'Low impact - may resolve without breaking dependencies'
      });
    }

    return actions;
  }
}

/**
 * Manages recovery from deadlocks and failures
 */
class RecoveryManager {
  private dependencyGraph: DependencyGraph;
  private stateManager: WorkflowStateManager;
  private recoveryHistory: RecoveryAction[] = [];

  constructor(dependencyGraph: DependencyGraph, stateManager: WorkflowStateManager) {
    this.dependencyGraph = dependencyGraph;
    this.stateManager = stateManager;
  }

  /**
   * Executes recovery actions
   */
  async executeRecovery(actions: RecoveryAction[]): Promise<boolean> {
    try {
      for (const action of actions) {
        await this.executeAction(action);
        this.recoveryHistory.push(action);
      }
      return true;
    } catch (error) {
      console.error('Recovery failed:', error);
      return false;
    }
  }

  private async executeAction(action: RecoveryAction): Promise<void> {
    switch (action.type) {
      case RecoveryType.BREAK_DEPENDENCY:
        await this.breakDependency(action);
        break;
      case RecoveryType.REASSIGN_TASK:
        await this.reassignTask(action);
        break;
      case RecoveryType.PRIORITY_BOOST:
        await this.boostPriority(action);
        break;
      case RecoveryType.ROLLBACK_STATE:
        await this.rollbackState(action);
        break;
      default:
        throw new Error(`Unknown recovery action: ${action.type}`);
    }
  }

  private async breakDependency(action: RecoveryAction): Promise<void> {
    const { cycles } = action.parameters;
    
    for (const cycle of cycles) {
      if (cycle.length > 1) {
        // Break the weakest dependency in the cycle
        this.dependencyGraph.removeDependency(cycle[0], cycle[1]);
      }
    }
  }

  private async reassignTask(action: RecoveryAction): Promise<void> {
    // Implementation would integrate with task assignment system
    console.log(`Reassigning task ${action.targetTask} to ${action.parameters.newAssignee}`);
  }

  private async boostPriority(action: RecoveryAction): Promise<void> {
    if (action.targetTask) {
      // Implementation would update task priority in state
      console.log(`Boosting priority of task ${action.targetTask} to ${action.parameters.priority}`);
    }
  }

  private async rollbackState(action: RecoveryAction): Promise<void> {
    const { stateId, targetVersion } = action.parameters;
    // Implementation would restore previous state version
    console.log(`Rolling back state ${stateId} to version ${targetVersion}`);
  }

  /**
   * Gets recovery history
   */
  getRecoveryHistory(limit: number = 100): RecoveryAction[] {
    return this.recoveryHistory.slice(-limit);
  }
}

/**
 * Coordinates timing between team members
 */
class TimingCoordinator {
  private schedules = new Map<string, Date[]>();
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Schedules synchronization point
   */
  async scheduleSync(memberId: string, syncTime: Date): Promise<void> {
    const key = `sync:${memberId}`;
    await this.redis.zadd(key, syncTime.getTime(), syncTime.toISOString());
  }

  /**
   * Gets next sync time for member
   */
  async getNextSync(memberId: string): Promise<Date | null> {
    const key = `sync:${memberId}`;
    const result = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    
    if (result.length === 0) return null;
    
    return new Date(parseInt(result[1]));
  }

  /**
   * Waits for all members to reach sync point
   */
  async waitForSync(syncId: string, memberIds: string[], timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const syncKey = `sync_point:${syncId}`;

    while (Date.now() - startTime < timeoutMs) {
      const readyCount = await this.redis.scard(syncKey);
      
      if (readyCount >= memberIds.length) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  /**
   * Signals member ready for sync
   */
  async signalReady(syncId: string, memberId: string): Promise<void> {
    const syncKey = `sync_point:${syncId}`;
    await this.redis.sadd(syncKey, memberId);
    await this.redis.expire(syncKey, 300); // Expire after 5 minutes
  }
}

/**
 * Handles state transitions with validation
 */
class StateTransitionHandler extends EventEmitter {
  private stateManager: WorkflowStateManager;
  private dependencyGraph: DependencyGraph;

  constructor(stateManager: WorkflowStateManager, dependencyGraph: DependencyGraph) {
    super();
    this.stateManager = stateManager;
    this.dependencyGraph = dependencyGraph;
  }

  /**
   * Handles task state transition
   */
  async transitionTaskState(
    workflowId: string,
    taskId: string,
    newStatus: TaskStatus
  ): Promise<boolean> {
    try {
      const workflow = await this.stateManager.getWorkflowState(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      const task = workflow.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Validate transition
      if (!this.canTransition(task.status, newStatus)) {
        throw new Error(`Invalid transition from ${task.status} to ${newStatus}`);
      }

      // Check dependencies
      if (newStatus === TaskStatus.IN_PROGRESS) {
        const dependencies = this.dependencyGraph.getDependencies(taskId);
        const incompleteDeps = dependencies.filter(depId => {
          const depTask = workflow.tasks.find(t => t.id === depId);
          return depTask?.status !== TaskStatus.COMPLETED;
        });

        if (incompleteDeps.length > 0) {
          throw new Error(`Cannot start task: dependencies not completed: ${incompleteDeps.join(', ')}`);
        }
      }

      // Update task state
      task.status = newStatus;
      if (newStatus === TaskStatus.IN_PROGRESS) {
        task.startTime = new Date();
      } else if (newStatus === TaskStatus.COMPLETED) {
        task.completionTime = new Date();
        if (task.startTime) {
          task.actualDuration = task.completionTime.getTime() - task.startTime.getTime();
        }
      }

      await this.stateManager.updateWorkflowState(workflowId, { tasks: workflow.tasks });

      this.emit('stateTransition', {
        workflowId,
        taskId,
        oldStatus: task.status,
        newStatus,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('State transition failed:', error);
      return false;
    }
  }

  private canTransition(currentStatus: TaskStatus, newStatus: TaskStatus): boolean {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.PENDING]: [TaskStatus.READY],
      [TaskStatus.READY]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.BLOCKED],
      [TaskStatus.BLOCKED]: [TaskStatus.READY, TaskStatus.FAILED],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.FAILED]: [TaskStatus.READY]
    };

    return validTransitions[currentStatus].includes(newStatus);
  }
}

/**
 * Manages team member registry
 */
class TeamMemberRegistry extends EventEmitter {
  private members = new Map<string, TeamMember>();
  private redis: Redis;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  /**
   * Registers a team member
   */
  async registerMember(member: TeamMember): Promise<void> {
    this.members.set(member