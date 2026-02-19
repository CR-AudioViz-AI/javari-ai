// lib/javari/roadmap/canonical-types.ts
// Type definitions for the Javari Canonical Roadmap Engine
// 2026-02-19

export type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'complete' | 'failed' | 'skipped';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type PhaseStatus = 'active' | 'pending' | 'complete' | 'failed';
export type RoadmapStatus = 'idle' | 'planning' | 'executing' | 'paused' | 'complete' | 'failed';
export type DependencyType = 'enables' | 'blocks' | 'requires';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ResourceType = 'human' | 'tool' | 'infrastructure' | 'budget';

export interface Phase {
  id: string;
  name: string;
  description: string;
  order: number;
  status: PhaseStatus;
  estimatedDuration: string;
  taskIds: string[];
  milestoneIds: string[];
  exitCriteria: string[];
}

export interface Task {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  provider: string;
  estimatedHours: number;
  dependencies: string[];
  verificationCriteria: string[];
  tags: string[];
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Milestone {
  id: string;
  name: string;
  phaseId: string;
  description: string;
  criteria: string[];
  achievedAt?: string;
}

export interface Dependency {
  from: string;
  to: string;
  type: DependencyType;
}

export interface Risk {
  id: string;
  description: string;
  severity: RiskSeverity;
  mitigation: string;
  affectedTaskIds: string[];
}

export interface Resource {
  type: ResourceType;
  name: string;
  allocation: string;
}

export interface VerificationRequirement {
  category: string;
  checks: string[];
}

export interface CanonicalRoadmap {
  id: string;
  title: string;
  version: string;
  objective: string;
  source: string;
  createdAt: string;
  phases: Phase[];
  tasks: Task[];
  milestones: Milestone[];
  dependencies: Dependency[];
  risks: Risk[];
  resources: Resource[];
  verification: VerificationRequirement[];
}

// ── Execution State (stored in Supabase) ──────────────────────────────────────

export interface RoadmapExecutionState {
  id: string;
  roadmapId: string;
  status: RoadmapStatus;
  currentPhaseId: string;
  activeTaskIds: string[];
  completedTaskIds: string[];
  failedTaskIds: string[];
  progress: number; // 0-100
  lastExecutionAt: string;
  executionLog: ExecutionLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  taskId?: string;
  phaseId?: string;
  message: string;
  provider?: string;
}

// ── API Response Types ────────────────────────────────────────────────────────

export interface RoadmapActivationResponse {
  success: boolean;
  roadmapId: string;
  status: RoadmapStatus;
  phases: PhaseStatus[];
  currentPhase: Phase;
  activeTasks: Task[];
  blockedTasks: Task[];
  pendingTasks: Task[];
  completedTasks: Task[];
  milestones: Milestone[];
  dependencyGraph: DependencyGraph;
  executionSchedule: ExecutionScheduleItem[];
  verificationRequirements: VerificationRequirement[];
  risks: Risk[];
  resources: Resource[];
  summary: string;
  timestamp: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  criticalPath: string[];
}

export interface DependencyNode {
  id: string;
  label: string;
  status: TaskStatus;
  priority: TaskPriority;
  phaseId: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: DependencyType;
}

export interface ExecutionScheduleItem {
  taskId: string;
  taskTitle: string;
  phaseId: string;
  phaseName: string;
  priority: TaskPriority;
  status: TaskStatus;
  provider: string;
  estimatedHours: number;
  canStartNow: boolean;
  blockedBy: string[];
  scheduledAfter?: string;
}
