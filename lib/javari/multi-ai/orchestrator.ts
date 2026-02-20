// lib/javari/multi-ai/orchestrator.ts
// Javari Multi-AI Team Mode — Orchestration Engine
// 2026-02-20 — STEP 3 implementation
//
// Accepts a TaskGraph from the autonomous planner.
// Maps each task to the correct agent(s) via delegation rules.
// Executes per-role pipelines (architect/engineer/validator/bulk/json/signal).
// Merges multi-agent outputs via merge.ts.
// Streams orchestration events to caller.
//
// Integration: called by executeGraph() when multi_ai_team mode is active,
// or called directly from /api/autonomy when mode="multi_ai_team".

import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { isOutputMalformed }              from "@/lib/javari/multi-ai/validator";
import {
  AGENT_ROLES,
  determineAgentForTask,
  type AgentRole,
  type AgentDefinition,
  type TaskFlags,
} from "./roles";
import { mergeAgentOutputs, type AgentOutput } from "./merge";
import type { TaskNode, AutonomyEvent }         from "@/lib/javari/autonomy/types";

// ── Orchestration event types (superset of AutonomyEvent types) ───────────────
//
// SSE EVENT MAP:
//   agent_start        → an agent has begun working on a task
//   agent_output       → streaming delta from an agent
//   agent_complete     → an agent finished (content + score)
//   agent_failed       → an agent failed (may fallback)
//   agent_fallback     → switching to fallback provider
//   validation_pass    → validator approved output
//   validation_fail    → validator flagged issues
//   validation_correct → validator rewrote output
//   merge_start        → merging agent outputs
//   merge_complete     → final merged output ready
//   conflict_detected  → architect/engineer disagreed
//   conflict_resolved  → conflict resolved, winner chosen

export type OrchestrationEventType =
  | "agent_start"
  | "agent_output"
  | "agent_complete"
  | "agent_failed"
  | "agent_fallback"
  | "validation_pass"
  | "validation_fail"
  | "validation_correct"
  | "merge_start"
  | "merge_complete"
  | "conflict_detected"
  | "conflict_resolved";

export interface OrchestrationEvent {
  type:      OrchestrationEventType;
  taskId:    string;
  goalId:    string;
  role:      AgentRole;
  content?:  string;
  score?:    number;
  provider?: string;
  model?:    string;
  meta?:     Record<string, unknown>;
  timestamp: string;
}

export interface OrchestratorResult {
  taskId:     string;
  finalOutput: string;
  strategy:   string;
  agentsUsed: AgentRole[];
  durationMs: number;
  success:    boolean;
  error?:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENT_TIMEOUT_MS = {
  architect:      45_000,
  engineer:       50_000,
  validator:      20_000,
  bulk_worker:    20_000,
  json_specialist: 30_000,
  signal_reader:  25_000,
} as const;

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildAgentPrompt(
  task: TaskNode,
  agent: AgentDefinition,
  depOutputs: string,
  priorAgentOutput?: string
): string {
  const parts: string[] = [];

  if (depOutputs) {
    parts.push("=== PRIOR TASK OUTPUTS (context only) ===");
    parts.push(depOutputs);
    parts.push("");
  }

  if (priorAgentOutput) {
    parts.push("=== PRIOR AGENT OUTPUT (build on this) ===");
    parts.push(priorAgentOutput);
    parts.push("");
  }

  parts.push("=== YOUR TASK ===");
  parts.push(task.description);

  if (task.routing.requires_json) {
    parts.push("\n\nRETURN ONLY valid JSON. No markdown fences. No prose outside JSON.");
  }

  return parts.join("\n");
}

// ── Single agent call (streaming → accumulated) ────────────────────────────────

async function callAgent(
  prompt: string,
  agent: AgentDefinition,
  taskId: string,
  goalId: string,
  emit: (e: OrchestrationEvent) => void
): Promise<{ text: string; provider: string; model: string }> {
  const timeout = AGENT_TIMEOUT_MS[agent.role] ?? 30_000;

  // Try primary provider first, then fallback
  const attempts: Array<{ provider: string; model: string }> = [
    { provider: agent.provider,         model: agent.model         },
    { provider: agent.fallbackProvider, model: agent.fallbackModel },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { provider: pName, model } = attempts[i];

    if (i > 0) {
      emit({
        type: "agent_fallback",
        taskId, goalId, role: agent.role,
        meta: { from: attempts[0].provider, to: pName },
        timestamp: new Date().toISOString(),
      });
    }

    let apiKey: string;
    try {
      apiKey = getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
      if (!apiKey) throw new Error("empty key");
    } catch {
      continue;
    }

    try {
      const providerInst = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);
      let accumulated = "";

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const gen = providerInst.generateStream(prompt, {
        rolePrompt:     agent.systemPromptSuffix,
        preferredModel: model,
      });

      const iter = (gen as AsyncIterable<string>)[Symbol.asyncIterator]
        ? (gen as AsyncIterable<string>)[Symbol.asyncIterator]()
        : (gen as AsyncIterator<string>);

      for (;;) {
        if (controller.signal.aborted) throw new Error("Agent timeout");
        const { done, value } = await iter.next();
        if (done) break;
        if (value) {
          accumulated += value;
          // Emit streaming delta
          emit({
            type: "agent_output",
            taskId, goalId, role: agent.role,
            content: value,
            provider: pName, model,
            timestamp: new Date().toISOString(),
          });
        }
      }

      clearTimeout(timer);

      if (isOutputMalformed(accumulated)) {
        throw new Error("Malformed/empty agent output");
      }

      return { text: accumulated.trim(), provider: pName, model };

    } catch (err) {
      clearTimeout(undefined);
      const msg = err instanceof Error ? err.message : String(err);
      if (i === attempts.length - 1) throw new Error(`All providers failed: ${msg}`);
    }
  }

  throw new Error(`Agent ${agent.role} all providers exhausted`);
}

// ── Per-role pipelines ─────────────────────────────────────────────────────────

async function architectPipeline(
  task: TaskNode,
  depOutputs: string,
  goalId: string,
  emit: (e: OrchestrationEvent) => void
): Promise<AgentOutput> {
  const agent = AGENT_ROLES.architect;
  const t0 = Date.now();
  emit({ type: "agent_start", taskId: task.id, goalId, role: "architect",
         meta: { provider: agent.provider, model: agent.model },
         timestamp: new Date().toISOString() });
  try {
    const prompt = buildAgentPrompt(task, agent, depOutputs);
    const { text, provider, model } = await callAgent(prompt, agent, task.id, goalId, emit);
    emit({ type: "agent_complete", taskId: task.id, goalId, role: "architect",
           content: text.slice(0, 300), provider, model,
           timestamp: new Date().toISOString() });
    return { role: "architect", provider, model, content: text, durationMs: Date.now() - t0 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "agent_failed", taskId: task.id, goalId, role: "architect",
           meta: { error }, timestamp: new Date().toISOString() });
    return { role: "architect", provider: agent.provider, model: agent.model,
             content: "", failed: true, error, durationMs: Date.now() - t0 };
  }
}

async function engineerPipeline(
  task: TaskNode,
  depOutputs: string,
  goalId: string,
  priorOutput: string | undefined,
  emit: (e: OrchestrationEvent) => void
): Promise<AgentOutput> {
  const agent = AGENT_ROLES.engineer;
  const t0 = Date.now();
  emit({ type: "agent_start", taskId: task.id, goalId, role: "engineer",
         meta: { provider: agent.provider, model: agent.model },
         timestamp: new Date().toISOString() });
  try {
    const prompt = buildAgentPrompt(task, agent, depOutputs, priorOutput);
    const { text, provider, model } = await callAgent(prompt, agent, task.id, goalId, emit);
    emit({ type: "agent_complete", taskId: task.id, goalId, role: "engineer",
           content: text.slice(0, 300), provider, model,
           timestamp: new Date().toISOString() });
    return { role: "engineer", provider, model, content: text, durationMs: Date.now() - t0 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "agent_failed", taskId: task.id, goalId, role: "engineer",
           meta: { error }, timestamp: new Date().toISOString() });
    return { role: "engineer", provider: agent.provider, model: agent.model,
             content: "", failed: true, error, durationMs: Date.now() - t0 };
  }
}

async function validatorPipeline(
  task: TaskNode,
  contentToValidate: string,
  goalId: string,
  emit: (e: OrchestrationEvent) => void
): Promise<AgentOutput> {
  const agent = AGENT_ROLES.validator;
  const t0 = Date.now();
  emit({ type: "agent_start", taskId: task.id, goalId, role: "validator",
         meta: { provider: agent.provider, model: agent.model },
         timestamp: new Date().toISOString() });

  const validationPrompt = [
    "You are the VALIDATOR. Review this output and return ONLY valid JSON:",
    `{ "score": 0-100, "passed": boolean, "issues": string[], "corrected": null or string }`,
    "",
    "ORIGINAL TASK:",
    task.description.slice(0, 500),
    "",
    "OUTPUT TO VALIDATE:",
    contentToValidate.slice(0, 6000),
  ].join("\n");

  try {
    const { text, provider, model } = await callAgent(
      validationPrompt, agent, task.id, goalId, emit
    );
    // Parse score from JSON
    let score: number | undefined;
    let passed: boolean | undefined;
    try {
      const parsed = JSON.parse(
        text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
      ) as { score?: number; passed?: boolean };
      score  = parsed.score;
      passed = parsed.passed;
    } catch { /* validator returned prose */ }

    const eventType: OrchestrationEventType =
      passed === false ? "validation_fail" :
      (score !== undefined && score < 70) ? "validation_fail" :
      "validation_pass";

    emit({ type: eventType, taskId: task.id, goalId, role: "validator",
           score, content: text.slice(0, 200), provider, model,
           timestamp: new Date().toISOString() });

    return { role: "validator", provider, model, content: text,
             score, durationMs: Date.now() - t0 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "agent_failed", taskId: task.id, goalId, role: "validator",
           meta: { error }, timestamp: new Date().toISOString() });
    return { role: "validator", provider: agent.provider, model: agent.model,
             content: "", failed: true, error, durationMs: Date.now() - t0 };
  }
}

async function bulkPipeline(
  task: TaskNode,
  depOutputs: string,
  goalId: string,
  emit: (e: OrchestrationEvent) => void
): Promise<AgentOutput> {
  const agent = AGENT_ROLES.bulk_worker;
  const t0 = Date.now();
  emit({ type: "agent_start", taskId: task.id, goalId, role: "bulk_worker",
         meta: { provider: agent.provider, model: agent.model },
         timestamp: new Date().toISOString() });
  try {
    const prompt = buildAgentPrompt(task, agent, depOutputs);
    const { text, provider, model } = await callAgent(prompt, agent, task.id, goalId, emit);
    emit({ type: "agent_complete", taskId: task.id, goalId, role: "bulk_worker",
           content: text.slice(0, 300), provider, model,
           timestamp: new Date().toISOString() });
    return { role: "bulk_worker", provider, model, content: text, durationMs: Date.now() - t0 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "agent_failed", taskId: task.id, goalId, role: "bulk_worker",
           meta: { error }, timestamp: new Date().toISOString() });
    return { role: "bulk_worker", provider: agent.provider, model: agent.model,
             content: "", failed: true, error, durationMs: Date.now() - t0 };
  }
}

async function jsonPipeline(
  task: TaskNode,
  depOutputs: string,
  goalId: string,
  emit: (e: OrchestrationEvent) => void
): Promise<AgentOutput> {
  const agent = AGENT_ROLES.json_specialist;
  const t0 = Date.now();
  emit({ type: "agent_start", taskId: task.id, goalId, role: "json_specialist",
         meta: { provider: agent.provider, model: agent.model },
         timestamp: new Date().toISOString() });
  try {
    const prompt = buildAgentPrompt(task, agent, depOutputs);
    const { text, provider, model } = await callAgent(prompt, agent, task.id, goalId, emit);

    // Quick JSON validation
    let finalText = text;
    try {
      JSON.parse(text.trim());
    } catch {
      // Strip fences and retry
      const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      try { JSON.parse(stripped); finalText = stripped; } catch { /* use raw */ }
    }

    emit({ type: "agent_complete", taskId: task.id, goalId, role: "json_specialist",
           content: finalText.slice(0, 300), provider, model,
           timestamp: new Date().toISOString() });
    return { role: "json_specialist", provider, model, content: finalText,
             durationMs: Date.now() - t0 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "agent_failed", taskId: task.id, goalId, role: "json_specialist",
           meta: { error }, timestamp: new Date().toISOString() });
    return { role: "json_specialist", provider: agent.provider, model: agent.model,
             content: "", failed: true, error, durationMs: Date.now() - t0 };
  }
}

async function signalPipeline(
  task: TaskNode,
  depOutputs: string,
  goalId: string,
  emit: (e: OrchestrationEvent) => void
): Promise<AgentOutput> {
  const agent = AGENT_ROLES.signal_reader;
  const t0 = Date.now();

  // signal_reader is optional — skip if xAI key unavailable
  let apiKey = "";
  try {
    apiKey = getProviderApiKey("xai");
  } catch { /* no key */ }
  if (!apiKey) {
    // Graceful skip → delegate to architect instead
    return architectPipeline(task, depOutputs, goalId, emit);
  }

  emit({ type: "agent_start", taskId: task.id, goalId, role: "signal_reader",
         meta: { provider: agent.provider, model: agent.model },
         timestamp: new Date().toISOString() });
  try {
    const prompt = buildAgentPrompt(task, agent, depOutputs);
    const { text, provider, model } = await callAgent(prompt, agent, task.id, goalId, emit);
    emit({ type: "agent_complete", taskId: task.id, goalId, role: "signal_reader",
           content: text.slice(0, 300), provider, model,
           timestamp: new Date().toISOString() });
    return { role: "signal_reader", provider, model, content: text,
             durationMs: Date.now() - t0 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "agent_failed", taskId: task.id, goalId, role: "signal_reader",
           meta: { error }, timestamp: new Date().toISOString() });
    return { role: "signal_reader", provider: agent.provider, model: agent.model,
             content: "", failed: true, error, durationMs: Date.now() - t0 };
  }
}

// ── orchestrateTask — public API ───────────────────────────────────────────────

/**
 * orchestrateTask — Run a single TaskNode through the multi-agent pipeline.
 * Selects agents via delegation rules, runs pipelines, merges output.
 */
export async function orchestrateTask(
  task: TaskNode,
  depOutputs: string,
  goalId: string,
  emit: (e: OrchestrationEvent) => void
): Promise<OrchestratorResult> {
  const t0 = Date.now();

  // Build TaskFlags from routing context
  const flags: TaskFlags = {
    requires_reasoning_depth: task.routing.requires_reasoning_depth ?? false,
    requires_json:            task.routing.requires_json,
    requires_validation:      task.routing.requires_validation,
    high_risk:                task.routing.high_risk,
    is_bulk_task:             false,
    has_code_request:         task.description.toLowerCase().includes("code") ||
                              task.description.toLowerCase().includes("implement") ||
                              task.description.toLowerCase().includes("build"),
    task_type:                task.type,
    complexity_score:         50,
  };

  // Determine agent assignment
  const assignment = determineAgentForTask(flags);
  const agentsToRun: AgentRole[] = [assignment.primaryRole, ...assignment.supportRoles];

  const outputs: AgentOutput[] = [];

  // ── Execute primary pipeline ─────────────────────────────────────────────
  let primaryOutput: AgentOutput;

  switch (assignment.primaryRole) {
    case "architect":
      primaryOutput = await architectPipeline(task, depOutputs, goalId, emit);
      break;
    case "engineer":
      primaryOutput = await engineerPipeline(task, depOutputs, goalId, undefined, emit);
      break;
    case "bulk_worker":
      primaryOutput = await bulkPipeline(task, depOutputs, goalId, emit);
      break;
    case "json_specialist":
      primaryOutput = await jsonPipeline(task, depOutputs, goalId, emit);
      break;
    case "signal_reader":
      primaryOutput = await signalPipeline(task, depOutputs, goalId, emit);
      break;
    case "validator":
      primaryOutput = await validatorPipeline(task, task.description, goalId, emit);
      break;
    default:
      primaryOutput = await bulkPipeline(task, depOutputs, goalId, emit);
  }

  outputs.push(primaryOutput);

  // ── Execute support pipelines ────────────────────────────────────────────
  for (const supportRole of assignment.supportRoles) {
    // Skip if primary already failed completely (but run validator regardless)
    if (primaryOutput.failed && supportRole !== "validator") continue;

    let supportOutput: AgentOutput;
    const priorText = primaryOutput.failed ? undefined : primaryOutput.content;

    switch (supportRole) {
      case "architect":
        supportOutput = await architectPipeline(task, depOutputs, goalId, emit);
        break;
      case "engineer":
        supportOutput = await engineerPipeline(task, depOutputs, goalId, priorText, emit);
        break;
      case "validator":
        supportOutput = await validatorPipeline(
          task, priorText ?? task.description, goalId, emit
        );
        break;
      case "bulk_worker":
        supportOutput = await bulkPipeline(task, depOutputs, goalId, emit);
        break;
      case "json_specialist":
        supportOutput = await jsonPipeline(task, depOutputs, goalId, emit);
        break;
      case "signal_reader":
        supportOutput = await signalPipeline(task, depOutputs, goalId, emit);
        break;
      default:
        supportOutput = await bulkPipeline(task, depOutputs, goalId, emit);
    }

    outputs.push(supportOutput);
  }

  // ── Conflict detection ────────────────────────────────────────────────────
  const arch = outputs.find((o) => o.role === "architect");
  const eng  = outputs.find((o) => o.role === "engineer");
  if (arch && eng && !arch.failed && !eng.failed) {
    // Check similarity
    const archWords = new Set(arch.content.toLowerCase().split(/\s+/).slice(0, 100));
    const engWords  = new Set(eng.content.toLowerCase().split(/\s+/).slice(0, 100));
    let overlap = 0;
    for (const w of archWords) if (engWords.has(w)) overlap++;
    const sim = overlap / Math.max(archWords.size, engWords.size, 1);
    if (sim < 0.30) {
      emit({
        type: "conflict_detected", taskId: task.id, goalId,
        role: "architect",
        meta: { similarity: sim.toFixed(2), architect: arch.content.slice(0,100), engineer: eng.content.slice(0,100) },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Merge ──────────────────────────────────────────────────────────────────
  emit({
    type: "merge_start", taskId: task.id, goalId, role: assignment.primaryRole,
    meta: { agents: agentsToRun, strategy: "pending" },
    timestamp: new Date().toISOString(),
  });

  const mergeResult = mergeAgentOutputs(outputs, {
    requireJson:     task.routing.requires_json,
    taskDescription: task.description,
  });

  if (mergeResult.conflictDetected) {
    emit({
      type: "conflict_resolved", taskId: task.id, goalId, role: assignment.primaryRole,
      meta: { resolution: mergeResult.conflictResolution, strategy: mergeResult.strategy },
      timestamp: new Date().toISOString(),
    });
  }

  emit({
    type: "merge_complete", taskId: task.id, goalId, role: assignment.primaryRole,
    content:  mergeResult.finalContent.slice(0, 500),
    meta: {
      strategy:    mergeResult.strategy,
      sourcedFrom: mergeResult.sourcedFrom,
      validationUsed: mergeResult.validationUsed,
      durationMs:  mergeResult.durationMs,
    },
    timestamp: new Date().toISOString(),
  });

  const success = !!mergeResult.finalContent && !primaryOutput.failed;

  return {
    taskId:      task.id,
    finalOutput: mergeResult.finalContent,
    strategy:    mergeResult.strategy,
    agentsUsed:  mergeResult.sourcedFrom,
    durationMs:  Date.now() - t0,
    success,
    error:       !success ? primaryOutput.error : undefined,
  };
}

/**
 * isMultiAgentMode — Returns true when a task should use multi-agent orchestration.
 * Heuristic: use multi-agent when task has both reasoning + code, is high-risk,
 * requires JSON + validation, or complexity_score >= 70.
 */
export function isMultiAgentMode(task: TaskNode): boolean {
  const flags: TaskFlags = {
    requires_reasoning_depth: task.routing.requires_reasoning_depth ?? false,
    requires_json:            task.routing.requires_json,
    requires_validation:      task.routing.requires_validation,
    high_risk:                task.routing.high_risk,
    is_bulk_task:             false,
    has_code_request:         false,
    task_type:                task.type,
    complexity_score:         50,
  };
  // Multi-agent when: high-risk, JSON+validation, reasoning+code, or explicitly set
  return (
    flags.high_risk ||
    (flags.requires_json && flags.requires_validation) ||
    (flags.requires_reasoning_depth && flags.has_code_request)
  );
}
