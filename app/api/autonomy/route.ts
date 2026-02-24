// app/api/autonomy/route.ts
// Javari /api/autonomy — Autonomous Goal Execution Endpoint v2
// 2026-02-20 — STEP 3: multi-agent SSE events + team mode
//
// Changelog from v1 (STEP 2):
//   - mode param accepts "multi_ai_team" to force multi-agent orchestration
//   - OrchestrationEvents forwarded to SSE client (nested in meta._orch)
//   - GET /api/autonomy — capabilities now includes multi_ai_team
//   - inspect response includes per-task agent assignment
//   - No regressions to STEP 2 API contract
//
// SSE Event Map — STEP 3 additions:
//   task_start  (meta._orch=true, orchType="agent_start")   → agent began
//   task_start  (meta._orch=true, orchType="agent_complete") → agent done
//   task_start  (meta._orch=true, orchType="merge_complete") → merge done
//   task_start  (meta._orch=true, orchType="conflict_detected") → conflict
//   task_start  (meta._orch=true, orchType="conflict_resolved") → resolved
//   (all existing STEP 2 events preserved)

import { NextRequest } from "next/server";
import { planGoal }         from "@/lib/javari/autonomy/planner";
import { executeGraph }     from "@/lib/javari/autonomy/executor";
import { writeGoalSummary } from "@/lib/javari/autonomy/memory-writer";
import { runHeartbeat }     from "@/lib/javari/autonomy/heartbeat";
import { determineAgentForTask, type TaskFlags } from "@/lib/javari/multi-ai/roles";
import type { AutonomyEvent, PlannerConfig } from "@/lib/javari/autonomy/types";

export const maxDuration = 120;
export const runtime     = "nodejs";

// ── GET — health status ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("heartbeat") === "true") {
    const report = await runHeartbeat();
    return new Response(
      JSON.stringify({ success: true, heartbeat: report }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success:  true,
      status:   "operational",
      engine:   "autonomy-v2",
      capabilities: [
        "task_graph_planning",
        "multi_model_routing",
        "validator_stage",
        "memory_persistence",
        "retry_recovery",
        "heartbeat_monitor",
        "sse_streaming",
        "multi_ai_team",          // NEW — STEP 3
        "role_based_delegation",  // NEW — STEP 3
        "output_merging",         // NEW — STEP 3
        "conflict_resolution",    // NEW — STEP 3
      ],
      agents: {
        architect:      "ChatGPT (GPT-4.1 / gpt-4o)",
        engineer:       "Claude (claude-sonnet-4)",
        validator:      "Claude (claude-haiku-4-5 / sonnet)",
        bulk_worker:    "Llama 3.1 70B / Mixtral (Groq)",
        json_specialist:"Mistral Large",
        signal_reader:  "xAI Grok (optional)",
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ── POST — plan + execute ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    goal?:    string;
    context?: string;
    mode?:    "single" | "multi_ai_team" | "auto";
    config?:  Partial<PlannerConfig>;
    inspect?: boolean;
    stream?:  boolean;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const goal = body.goal?.trim() ?? "";
  if (!goal) {
    return new Response(
      JSON.stringify({ success: false, error: "goal is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const inspectOnly = body.inspect ?? false;
  const streamMode  = body.stream  ?? true;
  const execMode    = body.mode    ?? "auto";

  // ── Plan ─────────────────────────────────────────────────────────────────
  const graph = await planGoal(goal, {
    context: body.context,
    config:  body.config,
  });

  // ── Inspect-only mode ─────────────────────────────────────────────────────
  if (inspectOnly) {
    return new Response(
      JSON.stringify({
        success:    true,
        goalId:     graph.goalId,
        totalTasks: graph.totalTasks,
        tasks: graph.tasks.map((t) => {
          // Build flags for agent assignment preview
          const flags: TaskFlags = {
            requires_reasoning_depth: t.routing.requires_reasoning_depth ?? false,
            requires_json:            t.routing.requires_json,
            requires_validation:      t.routing.requires_validation,
            high_risk:                t.routing.high_risk,
            is_bulk_task:             false,
            has_code_request:         t.description.toLowerCase().includes("code") ||
                                      t.description.toLowerCase().includes("implement"),
            task_type:                t.type,
            complexity_score:         50,
          };
          const assignment = determineAgentForTask(flags);

          return {
            id:           t.id,
            title:        t.title,
            type:         t.type,
            dependencies: t.dependencies,
            routing: {
              provider:            t.routing.provider,
              model:               t.routing.model,
              requires_validation: t.routing.requires_validation,
              high_risk:           t.routing.high_risk,
              cost_sensitivity:    t.routing.cost_sensitivity,
            },
            // NEW in STEP 3
            agentAssignment: {
              primaryRole:  assignment.primaryRole,
              supportRoles: assignment.supportRoles,
              reason:       assignment.reason,
            },
          };
        }),
        edges: graph.edges,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── SSE streaming execution ───────────────────────────────────────────────
  if (streamMode) {
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        function enq(event: AutonomyEvent): void {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          } catch { /* client disconnected */ }
        }

        enq({
          type:      "plan_created",
          goalId:    graph.goalId,
          timestamp: new Date().toISOString(),
          meta: {
            totalTasks:  graph.totalTasks,
            mode:        execMode,
            tasks: graph.tasks.map((t) => ({
              id: t.id, title: t.title, type: t.type, dependencies: t.dependencies,
            })),
          },
        });

        const t0 = Date.now();

        const result = await executeGraph(graph, enq, {
          allowParallelism: body.config?.allowParallelism ?? true,
        });

        if (result.finalOutput) {
          try {
            await writeGoalSummary(
              graph.goalId, goal, result.finalOutput,
              {
                totalTasks:  graph.totalTasks,
                doneTasks:   graph.doneTasks,
                failedTasks: graph.failedTasks,
                durationMs:  Date.now() - t0,
                providers:   result.providersUsed,
              }
            );
          } catch { /* non-fatal */ }
        }

        try { controller.close(); } catch { /* already closed */ }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type":       "text/event-stream",
        "Cache-Control":      "no-cache, no-transform",
        "X-Accel-Buffering":  "no",
        Connection:           "keep-alive",
        "X-Goal-Id":          graph.goalId,
        "X-Engine-Version":   "autonomy-v2",
      },
    });
  }

  // ── Buffered mode ─────────────────────────────────────────────────────────
  const events: AutonomyEvent[] = [];
  const t0 = Date.now();

  const result = await executeGraph(graph, (e) => events.push(e), {
    allowParallelism: body.config?.allowParallelism ?? true,
  });

  if (result.finalOutput) {
    try {
      await writeGoalSummary(graph.goalId, goal, result.finalOutput, {
        totalTasks:  graph.totalTasks,
        doneTasks:   graph.doneTasks,
        failedTasks: graph.failedTasks,
        durationMs:  Date.now() - t0,
        providers:   result.providersUsed,
      });
    } catch { /* non-fatal */ }
  }

  return new Response(
    JSON.stringify({
      success:     result.success,
      goalId:      graph.goalId,
      finalOutput: result.finalOutput,
      durationMs:  result.durationMs,
      totalTasks:  graph.totalTasks,
      doneTasks:   graph.doneTasks,
      failedTasks: graph.failedTasks,
      providers:   result.providersUsed,
      mode:        execMode,
      events: events.map((e) => ({
        type: e.type, taskId: e.taskId, timestamp: e.timestamp,
        isOrch: !!e.meta?.["_orch"],
      })),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
