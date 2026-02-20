// lib/javari/autonomy/executor.ts
// Javari Autonomous Engine — Execution Engine v3
// 2026-02-20 — STEP 3: Multi-AI Team Mode integration
//
// Changelog from v2 (STEP 2):
//   - Per-task decision: single-agent path OR multi-agent orchestration
//   - isMultiAgentMode() determines which path each task takes
//   - orchestrateTask() runs the full multi-agent pipeline for complex tasks
//   - OrchestrationEvents forwarded into AutonomyEvent stream (no SSE break)
//   - Agent identity logged per task (agentsUsed[] in task_done meta)
//   - All STEP 2 paths (retry, validator, memory, DB) preserved exactly
//
// Single-agent path:
//   callProvider() → validateResponse() → writeTaskMemory() → completeTask()
//
// Multi-agent path:
//   orchestrateTask() → mergeAgentOutputs() → writeTaskMemory() → completeTask()
//
// Both paths emit identical AutonomyEvent shapes to the SSE stream.

import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { validateResponse, isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import {
  orchestrateTask,
  isMultiAgentMode,
  type OrchestrationEvent,
} from "@/lib/javari/multi-ai/orchestrator";
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

// ── Forward orchestration events into autonomy event stream ───────────────────
// OrchestrationEvent → AutonomyEvent (agent_* events pass through as meta)

function forwardOrchEvent(
  orchEvent: OrchestrationEvent,
  goalId: string,
  emit: (e: AutonomyEvent) => void
): void {
  // Map orchestration event types to AutonomyEvent meta payloads
  // agent_start/agent_output/agent_complete/merge_complete etc. live in meta
  emit({
    type:      "task_start", // reuse task_start as the outer shell for agent events
    goalId,
    taskId:    orchEvent.taskId,
    timestamp: orchEvent.timestamp,
    meta: {
      _orch:      true,
      orchType:   orchEvent.type,
      role:       orchEvent.role,
      content:    orchEvent.content,
      score:      orchEvent.score,
      provider:   orchEvent.provider,
      model:      orchEvent.model,
      ...orchEvent.meta,
    },
  });
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

// ── Single-agent provider call ────────────────────────────────────────────────

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

// ── Execute a single task (with retries + multi-agent awareness) ───────────────

async function executeTask(
  task: TaskNode,
  graph: TaskGraph,
  emit: (e: AutonomyEvent) => void
): Promise<boolean> {
  const goalId     = graph.goalId;
  const depOutputs = gatherDependencyOutputs(graph, task);

  for (let attempt = task.attempt; attempt < task.maxAttempts; attempt++) {
    task.attempt = attempt;
    const tStart = Date.now();

    await beginTask(task, goalId);
    if (attempt > 0) await resumeTask(goalId, task.id, attempt);

    emit(makeEvent("task_start", goalId, {
      taskId:    task.id,
      taskTitle: task.title,
      meta: { attempt, maxAttempts: task.maxAttempts, provider: task.routing.provider },
    }));

    try {
      let finalText        = "";
      let usedProvider     = task.routing.provider;
      let usedModel        = task.routing.model;
      let validationScore: number | undefined;
      let validationPassed: boolean | undefined;
      let agentsUsed: string[] = [task.routing.provider];

      // ── PATH DECISION: multi-agent OR single-agent ─────────────────────
      if (isMultiAgentMode(task)) {
        // ── MULTI-AGENT PATH ──────────────────────────────────────────────
        const orchEmit = (e: OrchestrationEvent) =>
          forwardOrchEvent(e, goalId, emit);

        const orchResult = await orchestrateTask(
          task,
          depOutputs,
          goalId,
          orchEmit
        );

        if (!orchResult.success || !orchResult.finalOutput) {
          throw new Error(orchResult.error ?? "Orchestration returned empty output");
        }

        finalText     = orchResult.finalOutput;
        usedProvider  = orchResult.agentsUsed[0] ?? usedProvider;
        usedModel     = orchResult.strategy;  // strategy as model hint for logging
        agentsUsed    = orchResult.agentsUsed;

        // Multi-agent path: no additional validator call (orchestrator already ran it)
        validationScore  = undefined;
        validationPassed = undefined;

      } else {
        // ── SINGLE-AGENT PATH (STEP 2 logic, unchanged) ───────────────────
        const prompt = buildTaskPrompt(task, depOutputs);
        const { text, provider, model } = await callProvider(prompt, task);
        task.rawOutput = text;
        usedProvider   = provider;
        usedModel      = model;
        agentsUsed     = [provider];
        finalText      = text;

        if (task.routing.requires_validation) {
          const ctx = {
            prompt:                   task.description,
            mode:                     "single" as const,
            requires_reasoning_depth: false,
            requires_json:            task.routing.requires_json,
            requires_validation:      true,
            high_risk:                task.routing.high_risk,
            cost_sensitivity:         task.routing.cost_sensitivity as
                                      "free" | "low" | "moderate" | "expensive",
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
                if (task.routing.high_risk && vr.score < 40) {
                  throw new Error(`Validation failed: score=${vr.score}`);
                }
              }
            }
          } catch (vErr) {
            console.warn("[Executor] Validator error:", vErr instanceof Error ? vErr.message : vErr);
          }
        }
      }

      task.output          = finalText;
      task.validationScore  = validationScore;
      task.validationPassed = validationPassed;

      // ── Write to memory (both paths) ───────────────────────────────────
      let memChunkId: string | undefined;
      try {
        const memResult = await writeTaskMemory(task, finalText, {
          provider:        usedProvider,
          model:           usedModel,
          validationScore,
          goalId,
        });
        if (memResult?.chunkId) {
          memChunkId         = memResult.chunkId;
          task.memoryChunkId = memChunkId;
          emit(makeEvent("memory_write", goalId, {
            taskId: task.id,
            meta: { chunkId: memChunkId, embedded: memResult.embedded },
          }));
        }
      } catch { /* non-fatal */ }

      // ── DB: complete ────────────────────────────────────────────────────
      const durationMs = Date.now() - tStart;
      task.durationMs  = durationMs;
      task.status      = "done";

      await completeTask(goalId, task.id, finalText, {
        provider:        usedProvider,
        model:           usedModel,
        validationScore,
        validationPassed,
        memoryChunkId:   memChunkId,
        durationMs,
      });

      emit(makeEvent("task_done", goalId, {
        taskId:    task.id,
        taskTitle: task.title,
        content:   finalText.slice(0, 500),
        meta: {
          provider:    usedProvider,
          model:       usedModel,
          durationMs,
          validationScore,
          agentsUsed,
          multiAgent:  agentsUsed.length > 1,
        },
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

// ── Main executor (unchanged from v2 — task loop is path-agnostic) ─────────────

export interface ExecutorResult {
  graph:         TaskGraph;
  finalOutput:   string;
  success:       boolean;
  durationMs:    number;
  providersUsed: string[];
}

export async function executeGraph(
  graph: TaskGraph,
  emit: (event: AutonomyEvent) => void,
  options: { allowParallelism?: boolean } = {}
): Promise<ExecutorResult> {
  const t0           = Date.now();
  const allowParallel = options.allowParallelism ?? true;
  const providersUsed = new Set<string>();

  graph.status    = "running";
  graph.startedAt = new Date().toISOString();

  const dispatched = new Set<string>();
  const failed     = new Set<string>();

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

  while (true) {
    const ready = getReadyTasks(graph).filter((t) => !dispatched.has(t.id));

    if (!ready.length) {
      const pending = graph.tasks.filter((t) => t.status === "pending");
      if (!pending.length) break;

      for (const t of pending) {
        const hasFailed = t.dependencies.some((d) => failed.has(d));
        if (hasFailed) skipDownstream(t.id);
      }

      const stillReady = getReadyTasks(graph).filter((t) => !dispatched.has(t.id));
      if (!stillReady.length) break;
      continue;
    }

    if (allowParallel && ready.length > 1) {
      ready.forEach((t) => {
        dispatched.add(t.id);
        t.status = "running";
      });

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

  const doneTasks = graph.tasks.filter((t) => t.status === "done");
  let finalOutput = "";

  const aggTask = [...doneTasks].reverse().find((t) => t.type === "aggregation");
  if (aggTask?.output) {
    finalOutput = aggTask.output;
  } else {
    finalOutput = doneTasks
      .map((t) => `### ${t.title}\n${t.output}`)
      .join("\n\n");
  }

  graph.finalOutput  = finalOutput;
  const success      = graph.failedTasks === 0 || (graph.doneTasks > 0 && !!finalOutput);
  graph.status       = success ? "done" : "failed";
  graph.completedAt  = new Date().toISOString();

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
        providers:  [...providersUsed],
      },
    })
  );

  return {
    graph,
    finalOutput,
    success,
    durationMs:    Date.now() - t0,
    providersUsed: [...providersUsed],
  };
}
