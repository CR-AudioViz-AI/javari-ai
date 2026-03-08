// app/api/javari/orchestrator/run/route.ts
// Purpose: Multi-Model Orchestration Engine REST API + Roadmap Execution Entry Point.
//          GET  → registry stats with totalModels/activeModels/freeModels/providers at top level
//          POST { mode: "roadmap_execution", ... } → run one roadmap worker cycle
//          POST { prompt, task_type?, priority?, ... } → OrchestratorResponse (multi-model)
//          POST { run_benchmark: true } → benchmark suite results
// Date: 2026-03-09 — added mode: "roadmap_execution" dispatch

import { NextRequest, NextResponse }         from "next/server";
import { runOrchestrator, getRegistryStats } from "@/lib/orchestrator/orchestrator";
import { runBenchmarkSuite }                  from "@/lib/orchestrator/modelBenchmark";
import { buildCostOptimizedPortfolio }        from "@/lib/orchestrator/costOptimizer";
import { runRoadmapWorker }                   from "@/lib/execution/roadmapWorker";
import { createClient }                       from "@supabase/supabase-js";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// ── Queue snapshot helper ───────────────────────────────────────────────────
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

async function queueSnapshot(): Promise<Record<string, number>> {
  const { data } = await db().from("roadmap_tasks").select("status");
  return (data ?? []).reduce((acc: Record<string, number>, r: { status: string }) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({})) as {
      mode?              : string;
      task_type?         : string;
      prompt?            : string;
      priority?          : string;
      aggregation?       : string;
      max_models?        : number;
      quality_threshold? : number;
      task_id?           : string;
      run_benchmark?     : boolean;
      build_portfolio?   : boolean;
      benchmark_providers?: string[];
      benchmark_tasks?   : string[];
      portfolio_tasks?   : string[];
      // roadmap_execution params
      userId?            : string;
      maxTasks?          : number;
    };

    // ── Roadmap Execution mode ─────────────────────────────────────────
    // Triggered by: { mode: "roadmap_execution" }
    // Also triggered by: empty body {} — makes this endpoint the canonical
    // entry point Javari uses to kick off autonomous task execution.
    if (body.mode === "roadmap_execution" || (!body.prompt && !body.run_benchmark && !body.build_portfolio)) {
      const userId   = body.userId   ?? "orchestrator";
      const maxTasks = Math.min(body.maxTasks ?? 5, 5);  // cap at 5 per batch

      const before  = await queueSnapshot();
      const result  = await runRoadmapWorker(userId, maxTasks);
      const after   = await queueSnapshot();

      const tasksQueued     = after.pending   ?? 0;
      const tasksCompleted  = result.tasksCompleted;
      const batchNumber     = 1;  // single-cycle per call; cron chains batches

      return NextResponse.json({
        ok              : result.ok,
        status          : result.ok ? "execution_started" : "execution_failed",
        mode            : "roadmap_execution",
        batch           : batchNumber,
        tasksQueued     : tasksQueued,
        tasksExecuted   : result.tasksExecuted,
        tasksCompleted  : tasksCompleted,
        tasksRetried    : result.tasksRetried,
        tasksBlocked    : result.tasksBlocked,
        costUsd         : Number(result.totalCostUsd.toFixed(6)),
        durationMs      : result.durationMs,
        stoppedReason   : result.stoppedReason ?? null,
        queue: {
          before,
          after,
          delta: {
            pending  : (after.pending   ?? 0) - (before.pending   ?? 0),
            completed: (after.completed ?? 0) - (before.completed ?? 0),
          },
        },
        telemetry: result.telemetry,
        cycleId  : result.cycleId,
      });
    }

    // ── Benchmark mode ─────────────────────────────────────────────────
    if (body.run_benchmark) {
      const results = await runBenchmarkSuite({
        providers   : body.benchmark_providers,
        taskTypes   : body.benchmark_tasks,
        parallelism : 3,
      });
      return NextResponse.json({ ok: true, mode: "benchmark", ...results });
    }

    // ── Portfolio mode ─────────────────────────────────────────────────
    if (body.build_portfolio) {
      const portfolio = await buildCostOptimizedPortfolio(body.portfolio_tasks);
      return NextResponse.json({ ok: true, mode: "portfolio", ...portfolio });
    }

    // ── Orchestration mode ─────────────────────────────────────────────
    const { prompt, task_type, priority, aggregation, max_models, quality_threshold, task_id } = body;
    if (!prompt) {
      // Should not reach here — empty body routes to roadmap_execution above.
      // This guard is a safety net for malformed requests with partial fields.
      return NextResponse.json({ ok: false, error: "prompt is required for orchestration mode. Use mode: 'roadmap_execution' for autonomous task execution." }, { status: 400 });
    }

    const result = await runOrchestrator({
      prompt,
      task_type         : task_type,
      priority          : (priority as "quality" | "cost" | "speed" | "balanced") ?? "balanced",
      aggregation       : (aggregation as "confidence" | "majority_vote" | "weighted_ranking" | "fastest") ?? "confidence",
      max_models        : max_models        ?? 3,
      quality_threshold : quality_threshold ?? 50,
      task_id,
    });

    return NextResponse.json({ ok: result.ok, ...result });
  } catch (err) {
    console.error("[orchestrator/run] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const stats = getRegistryStats();
    return NextResponse.json({
      ok           : true,
      // ── Top-level fields (Phase 4) ──
      totalModels  : stats.total,
      activeModels : stats.active,
      freeModels   : stats.free,
      paidModels   : stats.paid,
      providers    : stats.providers,
      // ── Schema ──
      version      : "2.0.0",
      description  : "Javari Multi-Model Orchestration Engine — " + stats.total + " models across " + stats.providers + " providers",
      schema: {
        mode              : "roadmap_execution — run one autonomous roadmap worker batch (5 tasks max)",
        prompt            : "string (required for orchestration mode)",
        task_type         : "code_repair | security_audit | architecture_design | documentation_generation | performance_optimization | general | string",
        priority          : "quality | cost | speed | balanced",
        aggregation       : "confidence | majority_vote | weighted_ranking | fastest",
        max_models        : "1-5 (default 3)",
        quality_threshold : "0-100 (default 50)",
        task_id           : "string — for artifact recording",
        run_benchmark     : "true — run model benchmark suite",
        build_portfolio   : "true — build cost-optimized portfolio",
        userId            : "string — for roadmap_execution mode (default: orchestrator)",
        maxTasks          : "1-5 — tasks per batch for roadmap_execution mode (default: 5)",
      },
      registryStats: stats,
      capabilities: [
        "79+ models across 14 providers",
        "Ensemble voting: confidence/majority_vote/weighted_ranking/fastest",
        "Cost optimization: cheapest model meeting quality threshold",
        "Benchmark-driven routing: learns best models per task type",
        "Artifact recording: model_usage, model_consensus, benchmark_result",
      ],
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
