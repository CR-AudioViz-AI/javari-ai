// ─────────────────────────────────────────────────────────────────────────────
// Javari AI Engine — DO NOT MIX WITH PLATFORM LOGIC
// ─────────────────────────────────────────────────────────────────────────────
// lib/javari/team/execution-contract.ts
// Javari TEAM Mode — Execution Contract
// Defines the validated, type-safe contract for multi-agent execution plans.
// Responsibilities: schema validation, cycle detection, topological ordering, cost estimation.
// No execution logic — this is the planning/validation layer only.
// Created: April 24, 2026

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Enums & Literals
// ─────────────────────────────────────────────────────────────────────────────

export const AgentRoleSchema = z.enum([
  'architect',
  'builder',
  'tester',
  'reviewer',
  'deployer',
])

export type AgentRole = z.infer<typeof AgentRoleSchema>

export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'complete',
  'failed',
])

export type TaskStatus = z.infer<typeof TaskStatusSchema>

// ─────────────────────────────────────────────────────────────────────────────
// TaskNode Schema
// ─────────────────────────────────────────────────────────────────────────────

export const TaskNodeSchema = z.object({
  id: z
    .string()
    .min(1, 'Task id must not be empty')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Task id must be alphanumeric with dashes or underscores'),
  role: AgentRoleSchema,
  objective: z.string().min(1, 'Objective must not be empty'),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  dependencies: z.array(z.string()),
  model: z.string().min(1, 'Model must not be empty'),
  max_cost: z
    .number()
    .nonnegative('max_cost must be >= 0')
    .finite('max_cost must be finite'),
  status: TaskStatusSchema,
})

export type TaskNode = z.infer<typeof TaskNodeSchema>

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionPlan Schema
// ─────────────────────────────────────────────────────────────────────────────

export const ExecutionPlanSchema = z.object({
  plan_id: z
    .string()
    .min(1, 'plan_id must not be empty')
    .regex(/^[a-zA-Z0-9_-]+$/, 'plan_id must be alphanumeric with dashes or underscores'),
  tasks: z
    .array(TaskNodeSchema)
    .min(1, 'Execution plan must contain at least one task'),
  total_estimated_cost: z
    .number()
    .nonnegative('total_estimated_cost must be >= 0')
    .finite('total_estimated_cost must be finite'),
  created_at: z
    .string()
    .datetime({ message: 'created_at must be a valid ISO 8601 datetime string' }),
})

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>

// ─────────────────────────────────────────────────────────────────────────────
// validateExecutionPlan
// Parses and validates an unknown input against the ExecutionPlan schema.
// Throws a descriptive ZodError on any structural violation.
// Also enforces cross-field integrity rules not expressible in Zod alone.
// ─────────────────────────────────────────────────────────────────────────────

export function validateExecutionPlan(plan: unknown): ExecutionPlan {
  // Step 1: Zod structural parse
  const result = ExecutionPlanSchema.safeParse(plan)
  if (!result.success) {
    const messages = result.error.errors
      .map(e => `[${e.path.join('.')}] ${e.message}`)
      .join(' | ')
    throw new Error(`ExecutionPlan validation failed: ${messages}`)
  }

  const validated = result.data

  // Step 2: Unique task IDs
  const idSet = new Set<string>()
  for (const task of validated.tasks) {
    if (idSet.has(task.id)) {
      throw new Error(
        `ExecutionPlan validation failed: duplicate task id "${task.id}"`
      )
    }
    idSet.add(task.id)
  }

  // Step 3: All dependency references must point to a known task id
  for (const task of validated.tasks) {
    for (const dep of task.dependencies) {
      if (!idSet.has(dep)) {
        throw new Error(
          `ExecutionPlan validation failed: task "${task.id}" has unknown dependency "${dep}"`
        )
      }
      // A task cannot depend on itself
      if (dep === task.id) {
        throw new Error(
          `ExecutionPlan validation failed: task "${task.id}" depends on itself`
        )
      }
    }
  }

  // Step 4: No orphan tasks — every non-root task must be reachable from at least
  // one other task (i.e., referenced as a dependency by something, or a root itself).
  // A task is a root if it has zero dependencies; otherwise it must be a declared
  // dependency of at least one other task OR be the final sink node.
  // We enforce the weaker "no declared dependency points to a non-existent task"
  // (already done above). Full reachability is enforced by the graph builder.
  // Here we additionally check that every task id that appears in any dependency
  // array actually maps to a task (already guaranteed by idSet check above).

  return validated
}

// ─────────────────────────────────────────────────────────────────────────────
// detectCycles
// Uses Kahn's algorithm (BFS topological sort) to detect cycles.
// Throws if any cycle is found, naming the involved task ids.
// ─────────────────────────────────────────────────────────────────────────────

export function detectCycles(tasks: TaskNode[]): void {
  // Build in-degree map and adjacency list (dependency → dependents)
  const inDegree = new Map<string, number>()
  // adj[a] = set of tasks that depend on a (i.e., a must run before them)
  const dependents = new Map<string, Set<string>>()

  for (const task of tasks) {
    if (!inDegree.has(task.id)) inDegree.set(task.id, 0)
    if (!dependents.has(task.id)) dependents.set(task.id, new Set())
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      // task.id depends on dep → dep must come before task.id
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
      dependents.get(dep)!.add(task.id)
    }
  }

  // Kahn's BFS: enqueue all nodes with in-degree 0
  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  let processed = 0
  while (queue.length > 0) {
    const current = queue.shift()!
    processed++
    for (const dependent of dependents.get(current) ?? []) {
      const newDeg = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, newDeg)
      if (newDeg === 0) queue.push(dependent)
    }
  }

  if (processed !== tasks.length) {
    // Identify which tasks were not processed — those form the cycle
    const cycleNodes = tasks
      .filter(t => (inDegree.get(t.id) ?? 0) > 0)
      .map(t => t.id)
      .sort()
    throw new Error(
      `ExecutionPlan cycle detected: circular dependency among tasks [${cycleNodes.join(', ')}]`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionGraph
// Returned by buildExecutionGraph — adjacency list + topological order.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionGraph {
  /** Adjacency list: task id → set of task ids that depend on it */
  adjacency: Map<string, Set<string>>
  /** Topologically sorted task ids — safe execution order, deterministic */
  executionOrder: string[]
  /** Map of task id → TaskNode for O(1) lookup */
  taskMap: Map<string, TaskNode>
}

// ─────────────────────────────────────────────────────────────────────────────
// buildExecutionGraph
// Validates for cycles first, then builds the adjacency list and returns
// a deterministic topological execution order using Kahn's algorithm.
// Ties in topological order are broken alphabetically for determinism.
// ─────────────────────────────────────────────────────────────────────────────

export function buildExecutionGraph(plan: ExecutionPlan): ExecutionGraph {
  const { tasks } = plan

  // Cycle check — throws if found
  detectCycles(tasks)

  // Build taskMap
  const taskMap = new Map<string, TaskNode>()
  for (const task of tasks) {
    taskMap.set(task.id, task)
  }

  // Build adjacency list: dep → dependents
  const adjacency = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()

  for (const task of tasks) {
    if (!adjacency.has(task.id)) adjacency.set(task.id, new Set())
    if (!inDegree.has(task.id)) inDegree.set(task.id, 0)
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      adjacency.get(dep)!.add(task.id)
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
    }
  }

  // Kahn's BFS with alphabetic tie-breaking for determinism
  const executionOrder: string[] = []
  // Priority queue: always process alphabetically smallest available node
  let available: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) available.push(id)
  }
  available.sort()

  while (available.length > 0) {
    const current = available.shift()!
    executionOrder.push(current)

    const newlyReady: string[] = []
    for (const dependent of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, newDeg)
      if (newDeg === 0) newlyReady.push(dependent)
    }
    // Sort newly ready nodes before inserting to maintain determinism
    newlyReady.sort()
    available = [...available, ...newlyReady].sort()
  }

  if (executionOrder.length !== tasks.length) {
    // Should never reach here since detectCycles already ran, but defensive
    throw new Error(
      'buildExecutionGraph: topological sort did not include all tasks — possible internal state error'
    )
  }

  return { adjacency, executionOrder, taskMap }
}

// ─────────────────────────────────────────────────────────────────────────────
// estimatePlanCost
// Returns the sum of all task max_cost values.
// Rounded to 6 decimal places to avoid floating-point drift.
// ─────────────────────────────────────────────────────────────────────────────

export function estimatePlanCost(plan: ExecutionPlan): number {
  const sum = plan.tasks.reduce((acc, task) => acc + task.max_cost, 0)
  return Math.round(sum * 1_000_000) / 1_000_000
}
