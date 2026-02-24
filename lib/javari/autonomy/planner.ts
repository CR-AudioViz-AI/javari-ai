// lib/javari/autonomy/planner.ts
// Javari Autonomous Planner — Task Graph Builder
// 2026-02-20 — STEP 2 implementation
//
// Takes a user/system goal → produces a deterministic, typed TaskGraph.
// Uses routing context analyzer to pre-assign model hints to each node.
// No side effects — pure function (LLM call + JSON parsing).
//
// Architecture:
//   1. Call o4-mini (reasoning model) to decompose goal into structured tasks
//   2. Parse JSON response into TaskNode[]
//   3. Resolve dependency edges (topological validation)
//   4. Attach routing metadata to each node via analyzeRoutingContext()
//   5. Return fully-typed TaskGraph (no DB writes here)

import crypto from "crypto";
import { vault } from "@/lib/javari/secrets/vault";
import { analyzeRoutingContext } from "@/lib/javari/multi-ai/routing-context";
import type {
  TaskGraph,
  TaskNode,
  TaskEdge,
  TaskType,
  PlannerConfig,
} from "./types";
import { DEFAULT_PLANNER_CONFIG } from "./types";

// ── Planner system prompt ─────────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are Javari AI's autonomous task planner.
Given a goal, decompose it into a minimal, executable task graph.

Return ONLY this exact JSON structure — no markdown, no backticks, no prose:
{
  "tasks": [
    {
      "id": "task_001",
      "title": "Short task title",
      "description": "Detailed instruction for the AI executing this task",
      "type": "analysis|generation|validation|memory|api_call|decision|aggregation",
      "dependencies": [],
      "maxAttempts": 3
    }
  ]
}

Rules:
- Max 12 tasks. Break down only what is necessary.
- id must be "task_001", "task_002", etc. — always zero-padded 3 digits.
- dependencies: array of task IDs that must complete before this task starts.
- type must be one of: analysis, generation, validation, memory, api_call, decision, aggregation
- description must be a full, self-contained instruction the AI can execute without additional context.
- Last task should always be type "aggregation" to combine results.
- Simple goals (1–2 steps) should have 2–3 tasks maximum.
- Complex goals with multiple sub-components should have 5–10 tasks.
- Never add tasks just to add tasks. Quality over quantity.`;

// ── LLM planner call ──────────────────────────────────────────────────────────

async function callPlannerLLM(goal: string, context?: string): Promise<string> {
  // Try o4-mini first (best reasoning), fall back to gpt-4o, then anthropic
  const providers: Array<{ name: string; model: string }> = [
    { name: "openai",    model: "o4-mini" },
    { name: "openai",    model: "gpt-4o" },
    { name: "anthropic", model: "claude-sonnet-4-20250514" },
    { name: "groq",      model: "llama-3.1-70b-versatile" },
  ];

  const userMessage = context
    ? `GOAL: ${goal}\n\nCONTEXT:\n${context}`
    : `GOAL: ${goal}`;

  for (const { name, model } of providers) {
    const apiKey = vault.get(name as "openai" | "anthropic" | "groq");
    if (!apiKey) continue;

    try {
      if (name === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: PLANNER_SYSTEM_PROMPT },
              { role: "user",   content: userMessage },
            ],
            // o-series doesn't support temperature; gpt-4o does
            ...(model === "o4-mini" || model === "o3"
              ? {}
              : { temperature: 0.1 }),
            max_completion_tokens: 2048,
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) continue;
        const data = await res.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "";
        if (text.includes('"tasks"')) return text;
      }

      if (name === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
            system: PLANNER_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMessage }],
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) continue;
        const data = await res.json() as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text = data.content?.[0]?.text ?? "";
        if (text.includes('"tasks"')) return text;
      }

      if (name === "groq") {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: PLANNER_SYSTEM_PROMPT },
              { role: "user",   content: userMessage },
            ],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) continue;
        const data = await res.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "";
        if (text.includes('"tasks"')) return text;
      }
    } catch {
      continue;
    }
  }

  throw new Error("[Planner] All LLM providers failed to produce a task plan");
}

// ── JSON parser + validator ───────────────────────────────────────────────────

interface RawTask {
  id?: string;
  title?: string;
  description?: string;
  type?: string;
  dependencies?: string[];
  maxAttempts?: number;
}

function parseAndValidateTasks(
  raw: string,
  goalId: string,
  config: PlannerConfig
): { nodes: TaskNode[]; edges: TaskEdge[] } {
  // Strip accidental markdown fences
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  // Find the JSON object even if there's surrounding prose
  const match = cleaned.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
  if (!match) {
    throw new Error("[Planner] Could not find tasks JSON in LLM response");
  }

  let parsed: { tasks?: RawTask[] };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error("[Planner] Tasks JSON parse failed");
  }

  const rawTasks = parsed.tasks ?? [];
  if (!rawTasks.length) {
    throw new Error("[Planner] Empty task list returned");
  }

  // Cap at maxTasks
  const capped = rawTasks.slice(0, config.maxTasks);
  const validIds = new Set(capped.map((t) => t.id ?? ""));
  const now = new Date().toISOString();

  const VALID_TYPES = new Set<TaskType>([
    "analysis", "generation", "validation", "memory",
    "api_call", "decision", "aggregation",
  ]);

  const nodes: TaskNode[] = capped.map((raw, i) => {
    const id = raw.id ?? `task_${String(i + 1).padStart(3, "0")}`;
    const type: TaskType = VALID_TYPES.has(raw.type as TaskType)
      ? (raw.type as TaskType)
      : "generation";

    // Pre-compute routing context for this task
    const ctx = analyzeRoutingContext(raw.description ?? raw.title ?? "", "single");

    // Filter deps to only valid IDs within this graph
    const deps = (raw.dependencies ?? []).filter(
      (d) => validIds.has(d) && d !== id
    );

    return {
      id,
      title: raw.title ?? id,
      description: raw.description ?? raw.title ?? "",
      type,
      status: "pending",
      dependencies: deps,
      dependents: [], // resolved below
      routing: {
        provider:             ctx.primary_provider_hint,
        model:                ctx.primary_model_hint,
        requires_validation:  config.requireValidation || ctx.requires_validation,
        requires_json:        ctx.requires_json,
        high_risk:            ctx.high_risk,
        requires_reasoning_depth: ctx.requires_reasoning_depth,
        cost_sensitivity:     ctx.cost_sensitivity,
        fallback_chain:       ctx.fallback_chain,
      },
      attempt: 0,
      maxAttempts: Math.min(raw.maxAttempts ?? config.maxRetries, 5),
      createdAt: now,
      parentGoalId: goalId,
    };
  });

  // Resolve dependents
  for (const node of nodes) {
    for (const depId of node.dependencies) {
      const dep = nodes.find((n) => n.id === depId);
      if (dep && !dep.dependents.includes(node.id)) {
        dep.dependents.push(node.id);
      }
    }
  }

  // Build edges
  const edges: TaskEdge[] = [];
  for (const node of nodes) {
    for (const depId of node.dependencies) {
      edges.push({ from: depId, to: node.id, type: "blocks" });
    }
  }

  // Topological cycle check (DFS)
  assertNoCycles(nodes, edges);

  return { nodes, edges };
}

function assertNoCycles(nodes: TaskNode[], edges: TaskEdge[]): void {
  const graph = new Map<string, string[]>();
  for (const n of nodes) graph.set(n.id, []);
  for (const e of edges) graph.get(e.from)?.push(e.to);

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): void {
    if (inStack.has(id)) throw new Error(`[Planner] Cycle detected at task: ${id}`);
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    for (const next of graph.get(id) ?? []) dfs(next);
    inStack.delete(id);
  }

  for (const n of nodes) dfs(n.id);
}

// ── Fallback: build single-task graph ────────────────────────────────────────

function buildFallbackGraph(goalId: string, goal: string): TaskGraph {
  const now = new Date().toISOString();
  const ctx = analyzeRoutingContext(goal, "single");
  const node: TaskNode = {
    id: "task_001",
    title: "Execute goal directly",
    description: goal,
    type: "generation",
    status: "pending",
    dependencies: [],
    dependents: [],
    routing: {
      provider:            ctx.primary_provider_hint,
      model:               ctx.primary_model_hint,
      requires_validation: ctx.requires_validation,
      requires_json:       ctx.requires_json,
      high_risk:           ctx.high_risk,
      requires_reasoning_depth: ctx.requires_reasoning_depth,
      cost_sensitivity:    ctx.cost_sensitivity,
      fallback_chain:      ctx.fallback_chain,
    },
    attempt: 0,
    maxAttempts: 3,
    createdAt: now,
    parentGoalId: goalId,
  };
  return {
    goalId,
    goal,
    tasks: [node],
    edges: [],
    status: "planned",
    createdAt: now,
    totalTasks: 1,
    doneTasks: 0,
    failedTasks: 0,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Plan a goal into a TaskGraph.
 * Never throws — returns a fallback single-task graph on LLM failure.
 */
export async function planGoal(
  goal: string,
  options: {
    context?: string;
    config?: Partial<PlannerConfig>;
    goalId?: string;
  } = {}
): Promise<TaskGraph> {
  const config: PlannerConfig = { ...DEFAULT_PLANNER_CONFIG, ...options.config };
  const goalId = options.goalId ?? `goal_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    const rawResponse = await callPlannerLLM(goal, options.context);
    const { nodes, edges } = parseAndValidateTasks(rawResponse, goalId, config);

    return {
      goalId,
      goal,
      tasks: nodes,
      edges,
      status: "planned",
      createdAt: now,
      totalTasks: nodes.length,
      doneTasks: 0,
      failedTasks: 0,
    };
  } catch (err) {
    console.warn(
      "[Planner] Planning failed, using fallback graph:",
      err instanceof Error ? err.message : err
    );
    return buildFallbackGraph(goalId, goal);
  }
}

/**
 * Return tasks ready to execute (all deps done).
 */
export function getReadyTasks(graph: TaskGraph): TaskNode[] {
  const doneIds = new Set(
    graph.tasks.filter((t) => t.status === "done").map((t) => t.id)
  );
  return graph.tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.dependencies.every((dep) => doneIds.has(dep))
  );
}

/**
 * Gather output from all dependency tasks to inject as context.
 */
export function gatherDependencyOutputs(
  graph: TaskGraph,
  task: TaskNode
): string {
  const deps = task.dependencies
    .map((id) => graph.tasks.find((t) => t.id === id))
    .filter((t): t is TaskNode => !!t && t.status === "done" && !!t.output);

  if (!deps.length) return "";

  return deps
    .map((t) => `### Output from "${t.title}":\n${t.output}`)
    .join("\n\n");
}
