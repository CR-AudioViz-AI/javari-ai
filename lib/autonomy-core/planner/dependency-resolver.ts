// lib/autonomy-core/planner/dependency-resolver.ts
// CR AudioViz AI — Dependency Resolver for Roadmap Tasks
// 2026-02-22 — Step 13: Autonomous Roadmap Engine

// Accepts a flat list of JavariTasks and resolves execution order via
// topological sort (Kahn's algorithm). Returns batches of tasks that can
// run concurrently — all tasks in a batch have their dependencies satisfied
// by prior batches.
//
// Safety contracts:
//   - Cycle detection: throws with cycle members listed if a circular dep found
//   - Missing dep: task whose dep doesn't exist in the set is treated as unblocked
//   - Never mutates input

import { createLogger } from "@/lib/observability/logger";

const log = createLogger("autonomy");

export interface JavariTask {
  id:           string;
  roadmap_id:   string;
  title:        string;
  description:  string;
  phase_id:     string;
  phase_order:  number;
  task_order:   number;
  status:       "pending" | "in-progress" | "running" | "complete" | "failed" | "skipped";
  priority:     string;
  dependencies: string[];   // task IDs this task depends on
  subtasks:     unknown[];
  estimated_hours: number;
  verification_criteria: unknown;
  tags:         string[];
  provider?:    string;
  model?:       string;
  result?:      string;
  error?:       string;
  retry_count:  number;
  max_retries:  number;
}

export interface ResolutionResult {
  batches:       JavariTask[][];   // ordered execution batches (run each batch concurrently)
  executionOrder: string[];        // flat ordered task IDs
  blockedTasks:  string[];         // tasks with unresolved cyclic deps
  skippedTasks:  string[];         // tasks already complete/skipped
  readyCount:    number;           // tasks ready to execute (pending + deps satisfied)
  cycleDetected: boolean;
  cycleMembers:  string[];
}

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

export function resolveDependencies(tasks: JavariTask[]): ResolutionResult {
  const taskMap  = new Map<string, JavariTask>(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const adjList  = new Map<string, Set<string>>(); // id → dependents

  // Initialize
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjList.set(task.id, new Set());
  }

  // Build graph — only count deps that exist in our task set
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (!taskMap.has(depId)) continue; // dep outside set — treat as satisfied
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      adjList.get(depId)!.add(task.id);
    }
  }

  // Separate already-done tasks from pending
  const doneTasks: JavariTask[]    = [];
  const activeTasks: JavariTask[]  = [];
  for (const task of tasks) {
    if (task.status === "complete" || task.status === "skipped") {
      doneTasks.push(task);
    } else {
      activeTasks.push(task);
    }
  }

  // All completed tasks count as degree-satisfied for their dependents
  const satisfiedIds = new Set(doneTasks.map((t) => t.id));

  // Recompute in-degree for active tasks (only unsatisfied deps count)
  const activeInDegree = new Map<string, number>();
  for (const task of activeTasks) {
    const unsatisfiedDeps = task.dependencies.filter(
      (d) => taskMap.has(d) && !satisfiedIds.has(d)
    );
    activeInDegree.set(task.id, unsatisfiedDeps.length);
  }

  // Kahn's algorithm over active tasks
  const batches:       JavariTask[][] = [];
  const executionOrder: string[]      = [];
  const processed      = new Set<string>(satisfiedIds);
  let remaining        = [...activeTasks];

  while (remaining.length > 0) {
    const ready = remaining.filter((t) => (activeInDegree.get(t.id) ?? 0) === 0);

    if (ready.length === 0) {
      // Cycle detected — remaining tasks are blocked
      const cycleMembers = remaining.map((t) => t.id);
      log.warn(`Dependency cycle detected: ${cycleMembers.join(", ")}`);
      return {
        batches,
        executionOrder,
        blockedTasks:  cycleMembers,
        skippedTasks:  doneTasks.map((t) => t.id),
        readyCount:    executionOrder.length,
        cycleDetected: true,
        cycleMembers,
      };
    }

    // Sort batch by priority (critical → high → medium → low) then task_order
    const priorityWeight: Record<string, number> = {
      critical: 0, high: 1, medium: 2, low: 3
    };
    ready.sort((a, b) => {
      const pa = priorityWeight[a.priority] ?? 2;
      const pb = priorityWeight[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return a.task_order - b.task_order;
    });

    batches.push(ready);
    for (const task of ready) {
      executionOrder.push(task.id);
      processed.add(task.id);
      // Reduce in-degree for all dependents
      for (const depId of adjList.get(task.id) ?? []) {
        activeInDegree.set(depId, (activeInDegree.get(depId) ?? 1) - 1);
      }
    }
    remaining = remaining.filter((t) => !processed.has(t.id));
  }

  return {
    batches,
    executionOrder,
    blockedTasks:  [],
    skippedTasks:  doneTasks.map((t) => t.id),
    readyCount:    executionOrder.length,
    cycleDetected: false,
    cycleMembers:  [],
  };
}
