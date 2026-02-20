// lib/javari/autonomy/types.ts
// Javari Autonomous Engine — Canonical Type Definitions
// 2026-02-20 — STEP 2 implementation
//
// All types shared across planner, executor, heartbeat, and memory.
// Single source of truth — no type duplication elsewhere.

// ── Task Graph ─────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "pending"      // not yet started
  | "running"      // actively executing
  | "validating"   // passed to validator
  | "done"         // completed successfully
  | "failed"       // failed, not retried
  | "retrying"     // in retry cycle
  | "skipped"      // dependency failed, this task skipped
  | "escalated";   // requires human intervention

export type TaskType =
  | "analysis"     // research / analyze information
  | "generation"   // generate content / code / data
  | "validation"   // check / validate output
  | "memory"       // persist / retrieve from memory
  | "api_call"     // external API request
  | "decision"     // branch point / decision
  | "aggregation"; // combine multiple outputs

export interface TaskNode {
  id: string;                    // unique within the graph, e.g. "task_001"
  title: string;                 // human-readable
  description: string;           // full instruction fed to the model
  type: TaskType;
  status: TaskStatus;
  dependencies: string[];        // task IDs that must complete before this runs
  dependents: string[];          // task IDs that depend on this one

  // Routing hints (pre-computed by planner from routing context)
  routing: {
    provider: string;            // primary provider hint
    model: string;               // primary model hint
    requires_validation: boolean;
    requires_reasoning_depth?: boolean; // set by planner from routing context
    requires_json: boolean;
    high_risk: boolean;
    cost_sensitivity: string;
    fallback_chain: string[];
  };

  // Execution state
  attempt: number;               // current attempt number (0-indexed)
  maxAttempts: number;           // default 3
  output?: string;               // final validated output
  rawOutput?: string;            // output before validation
  error?: string;                // last error message
  validationScore?: number;      // 0–100 from validator
  validationPassed?: boolean;

  // Timing
  createdAt: string;             // ISO
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  // Memory linkage
  memoryChunkId?: string;        // ID of the persisted memory chunk
  parentGoalId: string;          // links back to the top-level goal
}

export interface TaskEdge {
  from: string;   // task ID
  to: string;     // task ID
  type: "blocks" | "feeds_input"; // blocks = must complete; feeds_input = output passed as context
}

export interface TaskGraph {
  goalId: string;
  goal: string;                  // original user/system goal
  tasks: TaskNode[];
  edges: TaskEdge[];
  status: "planned" | "running" | "done" | "failed" | "paused";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalTasks: number;
  doneTasks: number;
  failedTasks: number;
  finalOutput?: string;          // aggregated final result
}

// ── Execution Events (streamed to client) ─────────────────────────────────────

export type AutonomyEventType =
  | "plan_created"       // graph created, tasks listed
  | "task_start"         // task beginning
  | "task_delta"         // streaming chunk from task
  | "task_done"          // task completed
  | "task_failed"        // task failed (may retry)
  | "task_retry"         // retrying a task
  | "task_skip"          // task skipped (dep failed)
  | "task_escalate"      // human escalation flagged
  | "validation_pass"    // validator passed
  | "validation_fail"    // validator failed
  | "validation_correct" // validator corrected output
  | "memory_write"       // memory chunk persisted
  | "heartbeat"          // periodic health pulse
  | "goal_done"          // all tasks complete
  | "goal_failed"        // goal failed — reasons attached
  | "error";             // unexpected error

export interface AutonomyEvent {
  type: AutonomyEventType;
  goalId: string;
  taskId?: string;
  taskTitle?: string;
  content?: string;          // delta text or final output
  progress?: {
    done: number;
    total: number;
    percent: number;
  };
  meta?: Record<string, unknown>;
  timestamp: string;         // ISO
}

// ── Supabase Task State (DB row shape) ────────────────────────────────────────

export interface DbTaskState {
  id: string;                  // UUID primary key
  goal_id: string;             // groups tasks for one goal
  task_id: string;             // TaskNode.id
  task_title: string;
  task_type: TaskType;
  status: TaskStatus;
  attempt: number;
  max_attempts: number;
  output: string | null;
  error: string | null;
  provider: string | null;
  model: string | null;
  validation_score: number | null;
  validation_passed: boolean | null;
  memory_chunk_id: string | null;
  routing_meta: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

export interface HeartbeatReport {
  timestamp: string;
  stuckTasks: string[];          // task IDs stuck > threshold
  recoveredTasks: string[];      // task IDs that were re-queued
  activeGoals: number;
  healthScore: number;           // 0–100
}

// ── Planner config ────────────────────────────────────────────────────────────

export interface PlannerConfig {
  maxTasks: number;              // safety cap, default 12
  allowParallelism: boolean;     // if false, fully sequential
  requireValidation: boolean;    // override — force validation on all tasks
  maxRetries: number;            // default 3
  costCeiling: "free" | "low" | "moderate" | "expensive";
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  maxTasks: 12,
  allowParallelism: true,
  requireValidation: false,
  maxRetries: 3,
  costCeiling: "moderate",
};
