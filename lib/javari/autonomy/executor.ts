// lib/javari/autonomy/executor.ts
// Javari Autonomous Engine — Execution Engine
// 2026-02-20 — STEP 2 implementation
//
// Traverses a TaskGraph node-by-node, respecting dependency order.
// Per-node pipeline:
//   1. buildPrompt()           — assemble full instruction with dep outputs
//   2. callProvider()          — route to correct model via routing hints
//   3. validateResponse()      — Claude validator if flagged
//   4. writeTaskMemory()       — persist to Supabase javari_knowledge
//   5. completeTask()          — update DB state machine
//   6. emit event              — SSE stream to client
//
// Recovery:
//   - On failure: retry up to node.maxAttempts with exponential backoff
//   - After all retries: escalate if high_risk, else skip dependents
//   - Global goal failure only when critical tasks fail

import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { validateResponse, isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import {
  beginTask,
  completeTask,
  failTask,
  resumeTask,
  escalateTask,
} from "./task-store";
import { writeTaskMemory } from "./memory-writer";
import {
  getReadyTasks,
  gatherDependencyOutputs,
} from "./planner";
import type {
  TaskGraph,
  TaskNode,
  AutonomyEvent,
  AutonomyEventType,
} from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

const RETRY_BASE_MS   = 500;
const RETRY_MAX_MS    = 5_000;
const NODE_TIMEOUT_MS = 45_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
}

function makeEvent(
  type: AutonomyEventType,
  goalId: string,
  partial: Partial<Omit<AutonomyEvent, "type" | "goalId" | "timestamp">> = {}
): AutonomyEvent {
  return {
    type,
    goalId,
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildTaskPrompt(task: TaskNode, depOutputs: string): string {
  const parts: string[] = [];

  if (depOutputs) {
    parts.push("=== PRIOR TASK OUTPUTS (use as context) ===");
    parts.push(depOutputs);
    parts.push("=== YOUR TASK ===");
  }

  parts.push(task.description);

  if (task.routing.requires_json) {
    parts.push(
      "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no backticks, no prose outside the JSON object."
    );
  }

  return parts.join("\n\n");
}

// ── Single provider call (streaming → accumulated text) ───────────────────────

async function callProvider(
  prompt: string,
  task: TaskNode
): Promise<{ text: string; provider: string; model: string }> {
  const chain = task.routing.fallback_chain;

  for (const pName of chain) {
    let apiKey: string;
    try {
      apiKey = getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
    } catch {
      continue;
    }

    const perProviderModel = pName === chain[0] ? task.routing.model : undefined;

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);

      let text = "";
      const gen = provider.generateStream(prompt, { preferredModel: perProviderModel });
      const iter = (gen as AsyncIterable<string>)[Symbol.asyncIterator]
        ? (gen as AsyncIterable<string>)[Symbol.asyncIterator]()
        : (gen as AsyncIterator<string>);

      const deadline = Date.now() + NODE_TIMEOUT_MS;
      for (;;) {
        if (Date.now() > deadline) throw new Error("Node timeout");
        const { done, value } = await iter.next();
        if (done) break;
        if (value) text += value;
      }

      if (isOutputMalformed(text)) {
        throw new Error("Empty/malformed response");
      }

      return { text: text.trim(), provider: pName, model: perProviderModel ?? pName };
    } catch (err) {
      console.warn(
        `[Executor] ${pName} failed for task ${task.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  throw new Error(`All providers exhausted for task ${task.id}`);
}

// ── Execute a single task (with retries) ──────────────────────────────────────

async function executeTask(
  task: TaskNode,
  graph: TaskGraph,
  emit: (e: AutonomyEvent) => void
): Promise<boolean> {
  const goalId = graph.goalId;
  const depOutputs = gatherDependencyOutputs(graph, task);

  for (let attempt = task.attempt; attempt < task.maxAttempts; attempt++) {
    task.attempt = attempt;
    const tStart = Date.now();

    // DB: begin
    await beginTask(task, goalId);
    if (attempt > 0) await resumeTask(goalId, task.id, attempt);

    emit(makeEvent("task_start", goalId, {
      taskId:    task.id,
      taskTitle: task.title,
      meta: { attempt, maxAttempts: task.maxAttempts, provider: task.routing.provider },
    }));

    try {
      // ── 1. Build prompt ───────────────────────────────────────────────
      const prompt = buildTaskPrompt(task, depOutputs);

      // ── 2. Call provider ──────────────────────────────────────────────
      const { text, provider, model } = await callProvider(prompt, task);
      task.rawOutput = text;

      // ── 3. Validator stage ────────────────────────────────────────────
      let finalText = text;
      let validationScore: number | undefined;
      let validationPassed: boolean | undefined;

      if (task.routing.requires_validation) {
        const ctx = {
          prompt:                   task.description,
          mode:                     "single" as const,
          requires_reasoning_depth: false,
          requires_json:            task.routing.requires_json,
          requires_validation:      true,
          high_risk:                task.routing.high_risk,
          cost_sensitivity:         task.routing.cost_sensitivity as "free" | "low" | "moderate" | "expensive",
          complexity_score:         50,
          word_count:               task.description.split(" ").length,
          has_code_request:         false,
          has_multi_step:           false,
          has_schema_request:       task.routing.requires_json,
          is_bulk_task:             false,
          primary_provider_hint:    provider,
          primary_model_hint:       model,
          fallback_chain:           task.routing.fallback_chain,
          estimated_cost_usd:       0,
        };

        try {
          const vr = await validateResponse(task.description, text, ctx, {
            useFullModel: task.routing.high_risk,
          });

          validationScore  = vr.score;
          validationPassed = vr.passed;

          if (!vr.skipped) {
            if (vr.passed) {
              emit(makeEvent("validation_pass", goalId, {
                taskId: task.id,
                meta: { score: vr.score, model: vr.model },
              }));
            } else if (vr.corrected) {
              finalText = vr.corrected;
              emit(makeEvent("validation_correct", goalId, {
                taskId: task.id,
                meta: { score: vr.score, issues: vr.issues },
              }));
            } else {
              emit(makeEvent("validation_fail", goalId, {
                taskId: task.id,
                meta: { score: vr.score, issues: vr.issues },
              }));
              // Validation failed + no fix → treat as task failure if high_risk
              if (task.routing.high_risk && vr.score < 40) {
                throw new Error(`Validation failed: score=${vr.score}`);
              }
            }
          }
        } catch (vErr) {
          console.warn("[Executor] Validator error:", vErr instanceof Error ? vErr.message : vErr);
          // Non-fatal: continue with original text
        }
      }

      task.output          = finalText;
      task.validationScore  = validationScore;
      task.validationPassed = validationPassed;

      // ── 4. Write to memory ─────────────────────────────────────────────
      let memChunkId: string | undefined;
      try {
        const memResult = await writeTaskMemory(task, finalText, {
          provider,
          model,
          validationScore,
          goalId,
        });
        if (memResult?.chunkId) {
          memChunkId = memResult.chunkId;
          task.memoryChunkId = memChunkId;
          emit(makeEvent("memory_write", goalId, {
            taskId: task.id,
            meta: { chunkId: memChunkId, embedded: memResult.embedded },
          }));
        }
      } catch { /* memory write failure is non-fatal */ }

      // ── 5. DB: complete ───────────────────────────────────────────────
      const durationMs = Date.now() - tStart;
      task.durationMs = durationMs;
      task.status = "done";

      await completeTask(goalId, task.id, finalText, {
        provider,
        model,
        validationScore,
        validationPassed,
        memoryChunkId: memChunkId,
        durationMs,
      });

      emit(makeEvent("task_done", goalId, {
        taskId:    task.id,
        taskTitle: task.title,
        content:   finalText.slice(0, 500),
        meta: { provider, model, durationMs, validationScore },
      }));

      return true;

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Executor] Task ${task.id} attempt ${attempt} failed:`, errMsg);

      await failTask(goalId, task.id, errMsg, attempt, task.maxAttempts);

      const willRetry = attempt + 1 < task.maxAttempts;
      emit(makeEvent(willRetry ? "task_retry" : "task_failed", goalId, {
        taskId:    task.id,
        taskTitle: task.title,
        meta: { attempt, error: errMsg, willRetry },
      }));

      if (willRetry) {
        await sleep(backoffMs(attempt));
      }
    }
  }

  // All retries exhausted
  task.status = "failed";

  if (task.routing.high_risk) {
    await escalateTask(goalId, task.id, `All ${task.maxAttempts} attempts failed`);
    emit(makeEvent("task_escalate", goalId, {
      taskId: task.id,
      meta: { reason: "high_risk task exhausted retries" },
    }));
  }

  return false;
}

// ── Main executor ─────────────────────────────────────────────────────────────

export interface ExecutorResult {
  graph: TaskGraph;
  finalOutput: string;
  success: boolean;
  durationMs: number;
  providersUsed: string[];
}

/**
 * executeGraph — Run a TaskGraph to completion, streaming events.
 * Respects dependency ordering. Parallel execution where allowed.
 * Never throws — returns partial result on failure.
 */
export async function executeGraph(
  graph: TaskGraph,
  emit: (event: AutonomyEvent) => void,
  options: { allowParallelism?: boolean } = {}
): Promise<ExecutorResult> {
  const t0 = Date.now();
  const allowParallel = options.allowParallelism ?? true;
  const providersUsed = new Set<string>();

  graph.status = "running";
  graph.startedAt = new Date().toISOString();

  // Track which tasks have been dispatched (avoid double-dispatch in parallel mode)
  const dispatched = new Set<string>();
  const failed     = new Set<string>();

  // Skip a task and all its dependents recursively
  function skipDownstream(taskId: string): void {
    const task = graph.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === "pending") {
      task.status = "skipped";
      emit(makeEvent("task_skip", graph.goalId, {
        taskId: task.id,
        meta: { reason: "upstream dependency failed" },
      }));
      for (const dep of task.dependents) skipDownstream(dep);
    }
  }

  // ── Main execution loop ───────────────────────────────────────────────────
  // Iterate until all tasks are in a terminal state or we have no ready tasks
  while (true) {
    const ready = getReadyTasks(graph).filter((t) => !dispatched.has(t.id));

    if (!ready.length) {
      // Check if everything is done
      const pending = graph.tasks.filter((t) => t.status === "pending");
      if (!pending.length) break;

      // Pending but no ready tasks = all remaining have failed deps → skip them
      for (const t of pending) {
        const hasFailed = t.dependencies.some((d) => failed.has(d));
        if (hasFailed) skipDownstream(t.id);
      }

      // If still no ready tasks, we're stuck — break
      const stillReady = getReadyTasks(graph).filter((t) => !dispatched.has(t.id));
      if (!stillReady.length) break;
      continue;
    }

    // Execute ready tasks (parallel or sequential)
    if (allowParallel && ready.length > 1) {
      // Parallel: dispatch all ready tasks concurrently
      ready.forEach((t) => dispatched.add(t.id));
      t.status = "running";

      const results = await Promise.allSettled(
        ready.map((task) => executeTask(task, graph, emit))
      );

      results.forEach((result, i) => {
        const task = ready[i];
        if (result.status === "fulfilled" && result.value) {
          graph.doneTasks++;
          const prov = task.routing.provider;
          if (prov) providersUsed.add(prov);
        } else {
          graph.failedTasks++;
          failed.add(task.id);
          for (const dep of task.dependents) skipDownstream(dep);
        }
      });
    } else {
      // Sequential: one at a time
      for (const task of ready) {
        dispatched.add(task.id);
        task.status = "running";

        const ok = await executeTask(task, graph, emit);
        if (ok) {
          graph.doneTasks++;
          const prov = task.routing.provider;
          if (prov) providersUsed.add(prov);
        } else {
          graph.failedTasks++;
          failed.add(task.id);
          for (const dep of task.dependents) skipDownstream(dep);
        }
      }
    }
  }

  // ── Aggregate final output ────────────────────────────────────────────────
  const doneTasks = graph.tasks.filter((t) => t.status === "done");
  let finalOutput = "";

  // Last aggregation task wins; otherwise concatenate all done outputs
  const aggTask = [...doneTasks].reverse().find((t) => t.type === "aggregation");
  if (aggTask?.output) {
    finalOutput = aggTask.output;
  } else {
    finalOutput = doneTasks
      .map((t) => `### ${t.title}\n${t.output}`)
      .join("\n\n");
  }

  graph.finalOutput = finalOutput;
  const success = graph.failedTasks === 0 || (graph.doneTasks > 0 && !!finalOutput);
  graph.status = success ? "done" : "failed";
  graph.completedAt = new Date().toISOString();

  emit(
    makeEvent(success ? "goal_done" : "goal_failed", graph.goalId, {
      content: finalOutput.slice(0, 1000),
      progress: {
        done:    graph.doneTasks,
        total:   graph.totalTasks,
        percent: Math.round((graph.doneTasks / Math.max(graph.totalTasks, 1)) * 100),
      },
      meta: {
        durationMs: Date.now() - t0,
        providers: [...providersUsed],
      },
    })
  );

  return {
    graph,
    finalOutput,
    success,
    durationMs: Date.now() - t0,
    providersUsed: [...providersUsed],
  };
}
