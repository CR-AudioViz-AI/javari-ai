// app/api/autonomy/route.ts
// Javari /api/autonomy — Autonomous Goal Execution Endpoint
// 2026-02-20 — STEP 2 implementation
//
// POST /api/autonomy
//   Body: { goal, context?, mode?, config?, inspect? }
//   inspect=true → return task graph only (no execution)
//   inspect=false (default) → plan + execute, stream SSE events
//
// GET /api/autonomy
//   Returns system status + heartbeat health
//
// GET /api/autonomy/heartbeat
//   Triggers a heartbeat cycle (also wired to Vercel cron)
//
// SSE Event format:
//   data: {"type":"...", "goalId":"...", ...}\n\n
//
// All events defined in AutonomyEvent type (autonomy/types.ts).

import { NextRequest } from "next/server";
import { planGoal } from "@/lib/javari/autonomy/planner";
import { executeGraph } from "@/lib/javari/autonomy/executor";
import { writeGoalSummary } from "@/lib/javari/autonomy/memory-writer";
import { runHeartbeat } from "@/lib/javari/autonomy/heartbeat";
import type { AutonomyEvent, PlannerConfig } from "@/lib/javari/autonomy/types";

// Long-running autonomous tasks — Vercel Pro 120s limit
export const maxDuration = 120;
export const runtime = "nodejs";

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
      success: true,
      status:  "operational",
      engine:  "autonomy-v1",
      capabilities: [
        "task_graph_planning",
        "multi_model_routing",
        "validator_stage",
        "memory_persistence",
        "retry_recovery",
        "heartbeat_monitor",
        "sse_streaming",
      ],
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ── POST — plan + execute ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    goal?: string;
    context?: string;
    mode?: "single" | "super" | "advanced" | "roadmap" | "council";
    config?: Partial<PlannerConfig>;
    inspect?: boolean;  // true = plan only, no execution
    stream?: boolean;   // false = buffer all events, return JSON
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
  const streamMode  = body.stream  ?? true;  // SSE by default

  // ── Plan the goal ─────────────────────────────────────────────────────────
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
        tasks: graph.tasks.map((t) => ({
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
        })),
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

        // Emit plan_created immediately so client can render task list
        enq({
          type:      "plan_created",
          goalId:    graph.goalId,
          timestamp: new Date().toISOString(),
          meta: {
            totalTasks: graph.totalTasks,
            tasks: graph.tasks.map((t) => ({
              id: t.id, title: t.title, type: t.type, dependencies: t.dependencies,
            })),
          },
        });

        const t0 = Date.now();

        // Execute the graph
        const result = await executeGraph(graph, enq, {
          allowParallelism: body.config?.allowParallelism ?? true,
        });

        // Write goal summary to memory
        if (result.finalOutput) {
          try {
            await writeGoalSummary(
              graph.goalId,
              goal,
              result.finalOutput,
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
        "Content-Type":    "text/event-stream",
        "Cache-Control":   "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection:        "keep-alive",
        "X-Goal-Id":       graph.goalId,
      },
    });
  }

  // ── Buffered (non-streaming) mode ─────────────────────────────────────────
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
      success:      result.success,
      goalId:       graph.goalId,
      finalOutput:  result.finalOutput,
      durationMs:   result.durationMs,
      totalTasks:   graph.totalTasks,
      doneTasks:    graph.doneTasks,
      failedTasks:  graph.failedTasks,
      providers:    result.providersUsed,
      events:       events.map((e) => ({ type: e.type, taskId: e.taskId, timestamp: e.timestamp })),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
