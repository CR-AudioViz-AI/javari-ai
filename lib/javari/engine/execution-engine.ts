// lib/javari/team/execution-engine.ts
// Javari TEAM Mode — Multi-Agent Execution Engine
// Consumes an ExecutionGraph from execution-contract.ts and runs tasks in
// topological order with maximum parallelism where dependencies allow.
// Stub runners simulate execution — AI dispatch wired in next layer.
// Created: April 24, 2026
// Updated: April 24, 2026 — persistence wired: createExecution, saveTaskResult, finalizeExecution
// Updated: April 24, 2026 — ExecutionHooks interface + executePlanStreaming wrapper for SSE
// Updated: April 24, 2026 — abort signal via Supabase status flag (serverless-safe kill switch)
// Updated: April 24, 2026 — self-healing loop: MAX_RETRIES per task, generateFixContext, intra-loop retry
// Updated: April 30, 2026 — stub runners replaced with callDispatcher → dispatchAI real model calls
// Updated: May 1, 2026 — context passing: dependency outputs injected into objective for downstream agents

import type {
  ExecutionGraph,
  TaskNode,
} from './execution-contract'

import {
  createExecution,
  saveTaskResult,
  finalizeExecution,
} from './execution-store'

import { createAdminClient }  from '@/lib/supabase/server'

const supabaseAdmin = createAdminClient()
import { dispatchAI }         from '../dispatcher/ai-dispatcher'
import type { AIResponse }    from '../dispatcher/ai-dispatcher'
import type { ExecutionPlan } from './execution-contract'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TaskResultStatus = 'complete' | 'failed'

export interface TaskResult {
  task_id:      string
  status:       TaskResultStatus
  output?:      string
  error?:       string
  cost_used:    number
  started_at:   string
  completed_at: string
}

export interface ExecutionContext {
  plan_id:      string
  execution_id: string
  results:      Map<string, TaskResult>
  total_cost:   number
}

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionHooks
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionHooks {
  onTaskStart?:    (task: TaskNode) => void
  onTaskComplete?: (result: TaskResult) => void
  onEngineError?:  (error: Error) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-Healing constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum retry attempts per task before the engine gives up and marks it failed */
const MAX_RETRIES = 2

/**
 * FixContext — structured diagnosis from generateFixContext().
 * Injected into the retry attempt's objective as additional context.
 * Deliberately lightweight — just a string to prepend to the objective.
 * Replace with real AI-generated diagnosis when real model dispatch is wired.
 */
interface FixContext {
  diagnosis: string
  suggestion: string
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFixContext
// Synthesises a diagnostic context for a failed task.
// Runs synchronously (no DB, no AI calls) — keeps the loop tight.
// When real model dispatch is wired, replace this with an async architect call.
// ─────────────────────────────────────────────────────────────────────────────

function generateFixContext(
  failed:   TaskResult,
  attempt:  number,
): FixContext {
  const errorSummary = failed.error?.slice(0, 200) ?? 'Unknown error'

  const diagnosis =
    `Task "${failed.task_id}" failed on attempt ${attempt} with: ${errorSummary}`

  const suggestion = (() => {
    const err = failed.error?.toLowerCase() ?? ''
    if (err.includes('timeout'))        return 'Reduce scope or simplify objective to avoid timeout.'
    if (err.includes('cost'))           return 'Lower max_cost ceiling or reduce output complexity.'
    if (err.includes('dependency'))     return 'Check that all dependency outputs are present and non-empty.'
    if (err.includes('unknown agent'))  return 'Verify agent role is one of: architect/builder/tester/reviewer/deployer.'
    if (err.includes('aborted'))        return null  // aborts should not be retried
    return 'Retry with simplified objective — previous attempt output may be incomplete.'
  })()

  return { diagnosis, suggestion: suggestion ?? 'No retry suggestion available.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Abort signal
// ─────────────────────────────────────────────────────────────────────────────

export async function abortExecution(execution_id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('javari_team_executions')
    .update({ status: 'aborting' })
    .eq('id', execution_id)

  if (error) {
    throw new Error(
      `abortExecution failed for "${execution_id}": ${error.message} (code: ${error.code})`
    )
  }
}

async function checkAborted(execution_id: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('javari_team_executions')
      .select('status')
      .eq('id', execution_id)
      .single()
    return data?.status === 'aborting'
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// callDispatcher
// Single function replacing all 5 stub runners.
// Calls dispatchAI with the task's role + objective + inputs + max_cost.
// Formats the AIResponse into the shape executeTask expects.
// Never throws — dispatchAI's internal fallback chain ensures a response.
// ─────────────────────────────────────────────────────────────────────────────

interface StubResult {
  output:    string
  cost_used: number
}

async function callDispatcher(
  task:    TaskNode,
  context: ExecutionContext,
  fixCtx?: FixContext,
): Promise<StubResult> {
  // ── Resolve dependency outputs from prior task results ──────────────────
  // Collect the actual AI output from each completed dependency and inject
  // it into the objective so downstream agents (builder, reviewer) receive
  // the architect's real output, not just a static input label.
  const contextInputs = task.dependencies
    .map(depId => {
      const depResult = context.results.get(depId)
      if (!depResult?.output) return null
      try {
        // Parse the JSON wrapper and extract the actual content field
        const parsed = JSON.parse(depResult.output) as Record<string, unknown>
        return parsed['artifact'] ?? parsed['blueprint'] ?? parsed['result'] ?? parsed['output'] ?? depResult.output
      } catch {
        return depResult.output
      }
    })
    .filter(Boolean)

  // Build enriched objective: base + fix context + dependency outputs
  const baseObjective = fixCtx
    ? `${task.objective}\n\nPrevious attempt failed: ${fixCtx.diagnosis}\nSuggestion: ${fixCtx.suggestion}`
    : task.objective

  const objective = contextInputs.length > 0
    ? `${baseObjective}\n\nCONTEXT FROM PRIOR AGENTS:\n${JSON.stringify(contextInputs, null, 2)}`
    : baseObjective

  const result = await dispatchAI({
    role:      task.role,
    objective,
    inputs:    task.inputs,
    max_cost:  task.max_cost,
  })

  // Handle pending approval — treat as a failed task so the engine can cascade
  if ('requiresApproval' in result && result.requiresApproval) {
    const now = new Date().toISOString()
    throw new Error(`Approval required for tool: ${(result as { tool?: string }).tool ?? task.role}`)
  }

  const ai = result as AIResponse

  return {
    output: JSON.stringify({
      role:       task.role,
      task_id:    task.id,
      result:     ai.output,
      model_used: ai.model,
      latency_ms: ai.latency_ms,
      cost_used:  ai.cost_used,
    }),
    cost_used: ai.cost_used,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// executeTask
// Dispatches a single task to its runner.
// Accepts an optional FixContext — passed to stubs so they can embed
// the self-healing context in their output for downstream visibility.
// ─────────────────────────────────────────────────────────────────────────────

export async function executeTask(
  task:    TaskNode,
  _context: ExecutionContext,
  fixCtx?: FixContext,
): Promise<TaskResult> {
  const started_at = new Date().toISOString()

  try {
    // All roles route through callDispatcher → dispatchAI → real model
    const stub = await callDispatcher(task, context, fixCtx)

    const cost_used = Math.min(stub.cost_used, task.max_cost)

    return {
      task_id:      task.id,
      status:       'complete',
      output:       stub.output,
      cost_used,
      started_at,
      completed_at: new Date().toISOString(),
    }
  } catch (err: unknown) {
    return {
      task_id:      task.id,
      status:       'failed',
      error:        err instanceof Error ? err.message : String(err),
      cost_used:    0,
      started_at,
      completed_at: new Date().toISOString(),
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deriveFinalStatus
// ─────────────────────────────────────────────────────────────────────────────

function deriveFinalStatus(
  results:  Map<string, TaskResult>,
  aborted?: boolean,
): 'complete' | 'partial' | 'failed' {
  if (aborted) return 'failed'
  const all      = [...results.values()]
  const total    = all.length
  const complete = all.filter(r => r.status === 'complete').length
  if (total === 0 || complete === 0) return 'failed'
  if (complete === total)            return 'complete'
  return 'partial'
}

// ─────────────────────────────────────────────────────────────────────────────
// executePlan
// Runs tasks in topological order. After each task failure, the self-healing
// loop kicks in (up to MAX_RETRIES per task):
//
//   1. generateFixContext() synthesises a diagnosis from the error
//   2. executeTask() retried with fixCtx injected as additional context
//   3. If the retry succeeds → commit result, continue normally
//   4. If all retries exhausted → commit final failure, cascade downstream
//
// Self-healing is INTRA-LOOP — no nested executePlan calls, no shared
// context corruption, no extra DB execution rows.
//
// Aborts, high-risk approvals, and cascade-fails are not retried.
// ─────────────────────────────────────────────────────────────────────────────

export async function executePlan(
  graph: ExecutionGraph,
  plan:  ExecutionPlan,
  hooks: ExecutionHooks = {},
): Promise<ExecutionContext> {
  const { executionOrder, taskMap } = graph
  const { onTaskStart, onTaskComplete, onEngineError } = hooks

  const execution_id = await createExecution(plan)

  const context: ExecutionContext = {
    plan_id:    plan.plan_id,
    execution_id,
    results:    new Map<string, TaskResult>(),
    total_cost: 0,
  }

  // Per-task retry counter — reset across batches, tracked by task ID
  const retryCount = new Map<string, number>()

  const dispatched = new Set<string>()
  let   remaining  = [...executionOrder]
  let   aborted    = false

  try {
    while (remaining.length > 0) {
      // ── Abort check ────────────────────────────────────────────────────────
      if (await checkAborted(execution_id)) {
        aborted = true
        throw new Error('Execution aborted by user')
      }

      const readyBatch:   TaskNode[] = []
      const stillPending: string[]   = []

      for (const taskId of remaining) {
        const task = taskMap.get(taskId)
        if (!task) { stillPending.push(taskId); continue }

        const depsAllSettled = task.dependencies.every(dep => context.results.has(dep))

        if (depsAllSettled && !dispatched.has(taskId)) {
          readyBatch.push(task)
          dispatched.add(taskId)
        } else if (!dispatched.has(taskId)) {
          stillPending.push(taskId)
        }
      }

      if (readyBatch.length === 0 && stillPending.length > 0) {
        throw new Error(
          `executePlan: no tasks became ready — possible deadlock. Blocked: [${stillPending.join(', ')}]`
        )
      }

      // ── Batch execution with self-healing ────────────────────────────────
      const batchResults = await Promise.all(
        readyBatch.map(async (task): Promise<TaskResult> => {
          try { onTaskStart?.(task) } catch { /* hook errors never propagate */ }

          // Cascade-fail: skip if a dependency failed
          const failedDep = task.dependencies.find(dep =>
            context.results.get(dep)?.status === 'failed'
          )
          if (failedDep !== undefined) {
            const now = new Date().toISOString()
            const cascadeResult: TaskResult = {
              task_id:      task.id,
              status:       'failed',
              error:        `Skipped: dependency "${failedDep}" failed`,
              cost_used:    0,
              started_at:   now,
              completed_at: now,
            }
            await saveTaskResult(execution_id, cascadeResult, task.role)
            try { onTaskComplete?.(cascadeResult) } catch { /* never propagate */ }
            return cascadeResult
          }

          // Initial dispatch
          let result = await executeTask(task, context)

          // ── Self-healing loop ─────────────────────────────────────────────
          // Retries: up to MAX_RETRIES per task.
          // Each retry gets a FixContext synthesised from the prior failure.
          // Aborted tasks and cascade-fails are never retried.
          // High-risk tool approvals flow through the normal approval gate —
          // self-healing never auto-approves.
          while (
            result.status === 'failed' &&
            !(result.error?.includes('aborted')) &&
            !(result.error?.includes('approval'))
          ) {
            const attempts = (retryCount.get(task.id) ?? 0) + 1
            retryCount.set(task.id, attempts)

            if (attempts > MAX_RETRIES) {
              // Retries exhausted — commit final failure
              break
            }

            // Synthesise fix context from the failure
            const fixCtx = generateFixContext(result, attempts)

            // If fix context has no suggestion (e.g. abort), stop retrying
            if (!fixCtx.suggestion || fixCtx.suggestion === 'No retry suggestion available.') {
              break
            }

            // Emit hook: task restarting (reuse task_start so UI shows activity)
            try { onTaskStart?.(task) } catch { /* never propagate */ }

            // Retry with fix context injected
            result = await executeTask(task, context, fixCtx)
          }
          // ── End self-healing loop ─────────────────────────────────────────

          // Persist the final result (success or final failure after retries)
          await saveTaskResult(execution_id, result, task.role)
          try { onTaskComplete?.(result) } catch { /* never propagate */ }
          return result
        })
      )

      for (const result of batchResults) {
        context.results.set(result.task_id, result)
        context.total_cost = roundCost(context.total_cost + result.cost_used)
      }

      remaining = stillPending
    }
  } catch (err: unknown) {
    const engineError = err instanceof Error ? err : new Error(String(err))
    try { onEngineError?.(engineError) } catch { /* never propagate */ }
    throw engineError
  } finally {
    const finalStatus = deriveFinalStatus(context.results, aborted)
    await finalizeExecution(execution_id, finalStatus, context.total_cost)
  }

  return context
}

// ─────────────────────────────────────────────────────────────────────────────
// executePlanStreaming
// ─────────────────────────────────────────────────────────────────────────────

export interface SSEEvent {
  type:       'start' | 'task_start' | 'task_complete' | 'task_error' | 'complete' | 'error' | 'aborted'
  plan_id?:   string
  task_id?:   string
  result?:    TaskResult
  error?:     string
  message?:   string
}

export async function executePlanStreaming(
  graph: ExecutionGraph,
  plan:  ExecutionPlan,
  send:  (event: SSEEvent) => void,
): Promise<ExecutionContext> {
  return executePlan(graph, plan, {
    onTaskStart:    (task)   => send({ type: 'task_start', task_id: task.id }),
    onTaskComplete: (result) => send({
      type:    result.status === 'complete' ? 'task_complete' : 'task_error',
      task_id: result.task_id,
      result,
      error:   result.error,
    }),
    onEngineError: (err) => send({
      type:    err.message === 'Execution aborted by user' ? 'aborted' : 'error',
      message: err.message,
    }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// roundCost
// ─────────────────────────────────────────────────────────────────────────────

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
