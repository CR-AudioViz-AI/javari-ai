// app/api/javari/orchestrator/run/route.ts
// Purpose: Multi-Model Orchestration Engine REST API.
//          GET  → registry stats with totalModels/activeModels/freeModels/providers at top level
//          POST { prompt, task_type?, priority?, ... } → OrchestratorResponse
//          POST { run_benchmark: true } → benchmark suite results
// Date: 2026-03-08

import { NextRequest, NextResponse }         from "next/server";
import { runOrchestrator, getRegistryStats } from "@/lib/orchestrator/orchestrator";
import { runBenchmarkSuite }                  from "@/lib/orchestrator/modelBenchmark";
import { buildCostOptimizedPortfolio }        from "@/lib/orchestrator/costOptimizer";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
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
    };

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
      return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
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
        prompt            : "string (required)",
        task_type         : "code_repair | security_audit | architecture_design | documentation_generation | performance_optimization | general | string",
        priority          : "quality | cost | speed | balanced",
        aggregation       : "confidence | majority_vote | weighted_ranking | fastest",
        max_models        : "1-5 (default 3)",
        quality_threshold : "0-100 (default 50)",
        task_id           : "string — for artifact recording",
        run_benchmark     : "true — run model benchmark suite",
        build_portfolio   : "true — build cost-optimized portfolio",
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
