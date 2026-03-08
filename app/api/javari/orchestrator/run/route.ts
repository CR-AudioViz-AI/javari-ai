// app/api/javari/orchestrator/run/route.ts
// Purpose: Multi-Model Orchestration Engine REST API.
//          POST  { prompt, task_type?, priority?, ... } → OrchestratorResponse
//          POST  { run_benchmark: true } → benchmark suite results
//          GET   → registry stats + schema
// Date: 2026-03-07

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
      // Orchestration mode
      task_type?         : string;
      prompt?            : string;
      priority?          : string;
      aggregation?       : string;
      max_models?        : number;
      quality_threshold? : number;
      task_id?           : string;
      // Benchmark mode
      run_benchmark?     : boolean;
      benchmark_providers?: string[];
      benchmark_tasks?   : string[];
      // Portfolio mode
      build_portfolio?   : boolean;
      portfolio_tasks?   : string[];
    };

    // ── Benchmark mode ────────────────────────────────────────────────────
    if (body.run_benchmark) {
      const { results, summary } = await runBenchmarkSuite({
        providers : body.benchmark_providers ?? ["groq", "openrouter", "google"],
        taskTypes : body.benchmark_tasks     ?? ["fast_qa", "coding", "analysis"],
        maxModels : 15,
        parallel  : 5,
      });
      return NextResponse.json({
        ok           : true,
        mode         : "benchmark",
        modelsRan    : results.length,
        successful   : results.filter(r => r.success).length,
        failed       : results.filter(r => !r.success).length,
        avgScore     : Math.round(summary.reduce((s,m) => s + m.avg_score, 0) / Math.max(1, summary.length)),
        avgLatencyMs : Math.round(summary.reduce((s,m) => s + m.avg_latency_ms, 0) / Math.max(1, summary.length)),
        summary      : summary.slice(0, 25),
        timestamp    : new Date().toISOString(),
      });
    }

    // ── Portfolio mode ────────────────────────────────────────────────────
    if (body.build_portfolio) {
      const taskTypes = body.portfolio_tasks ?? [
        "security_audit","code_repair","architecture_design","general_analysis","fast_qa",
        "backend_coding","frontend_coding","math_reasoning","summarization",
      ];
      const portfolio = buildCostOptimizedPortfolio(taskTypes, 50);
      return NextResponse.json({
        ok        : true,
        mode      : "portfolio",
        taskCount : taskTypes.length,
        portfolio : Object.fromEntries(
          Object.entries(portfolio).map(([t, s]) => [t, s ? {
            model: s.model.display_name, provider: s.model.provider,
            tier: s.tier, costPer1k: s.costPer1k,
            expectedScore: s.expectedScore, savingsVsPremium: s.savingsVsPremium,
          } : null])
        ),
        timestamp : new Date().toISOString(),
      });
    }

    // ── Orchestration mode ────────────────────────────────────────────────
    if (!body.prompt?.trim()) {
      return NextResponse.json({ ok:false, error:"prompt is required" }, { status:400 });
    }

    const result = await runOrchestrator({
      task_type        : body.task_type,
      prompt           : body.prompt,
      priority         : (body.priority as never) ?? "balanced",
      aggregation      : (body.aggregation as never) ?? "confidence",
      max_models       : Math.min(Math.max(body.max_models ?? 3, 1), 5),
      quality_threshold: body.quality_threshold ?? 50,
      task_id          : body.task_id,
    });

    return NextResponse.json(result);

  } catch (err) {
    console.error("[orchestrator/run] Error:", err);
    return NextResponse.json({ ok:false, error:String(err) }, { status:500 });
  }
}

export async function GET(): Promise<NextResponse> {
  const stats = getRegistryStats();
  return NextResponse.json({
    ok      : true,
    endpoint: "POST /api/javari/orchestrator/run",
    version : "1.0.0",
    registry: stats,
    modes   : {
      orchestration: "{ prompt, task_type?, priority?, aggregation?, max_models?, quality_threshold? }",
      benchmark    : "{ run_benchmark: true, benchmark_providers?, benchmark_tasks? }",
      portfolio    : "{ build_portfolio: true, portfolio_tasks? }",
    },
    task_types: [
      "security_audit","code_repair","architecture_design","frontend_coding","backend_coding",
      "database_design","devops_analysis","ai_integration","performance_audit",
      "brand_analysis","ux_analysis","general_analysis","summarization","classification",
      "math_reasoning","creative_writing","translation","fast_qa",
    ],
    priority_options  : ["quality","cost","speed","balanced"],
    aggregation_options: ["confidence","majority_vote","weighted_ranking","fastest"],
  });
}
