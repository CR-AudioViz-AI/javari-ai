// lib/orchestrator/orchestrator.ts
// Purpose: Main entry point for the Javari Multi-Model Orchestration Engine.
//          Detects task type, selects optimal models, runs ensemble, aggregates
//          the best answer, records benchmark data, and emits artifacts.
// Date: 2026-03-07

import { routeTask, detectTaskType, TaskType, RoutingPriority } from "./modelRouter";
import { runEnsemble, EnsembleResult }                          from "./ensembleEngine";
import { selectCheapestQualifyingModel }                        from "./costOptimizer";
import { recordBenchmarkResult, loadBenchmarkSummaries }        from "./modelBenchmark";
import { getRegistryStats, ORCHESTRATOR_REGISTRY }              from "./modelRegistry";
import { recordArtifact }                                       from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrchestratorRequest {
  task_type?         : string;
  prompt             : string;
  priority?          : RoutingPriority;
  aggregation?       : "confidence" | "majority_vote" | "weighted_ranking" | "fastest";
  max_models?        : number;          // 1-5, default 3
  quality_threshold? : number;          // 0-100, default 50
  task_id?           : string;          // for artifact recording
  api_keys?          : Record<string, string>;
}

export interface OrchestratorResponse {
  ok               : boolean;
  orchestration_id : string;
  task_type        : string;
  priority         : RoutingPriority;
  final_answer     : string;
  winning_model    : string;
  winning_provider : string;
  confidence       : number;
  consensus_score  : number;
  models_used      : number;
  models_succeeded : number;
  models_failed    : number;
  total_cost_usd   : number;
  total_latency_ms : number;
  ensemble_detail  : Array<{
    model_id   : string;
    provider   : string;
    success    : boolean;
    score      : number;
    latency_ms : number;
    cost_usd   : number;
    error?     : string;
  }>;
  routing_reason   : string;
  cost_optimized   : boolean;
  artifact_id?     : string;
  timestamp        : string;
  durationMs       : number;
  error?           : string;
}

// ── API key resolver: caller-provided → process.env → vault ───────────────

async function resolveApiKeys(callerKeys?: Record<string, string>): Promise<Record<string, string>> {
  const ENV_MAP: Record<string, string> = {
    anthropic  : "ANTHROPIC_API_KEY",
    openai     : "OPENAI_API_KEY",
    google     : "GOOGLE_API_KEY",
    mistral    : "MISTRAL_API_KEY",
    deepseek   : "DEEPSEEK_API_KEY",
    groq       : "GROQ_API_KEY",
    together   : "TOGETHER_API_KEY",
    fireworks  : "FIREWORKS_API_KEY",
    openrouter : "OPENROUTER_API_KEY",
    cohere     : "COHERE_API_KEY",
    xai        : "XAI_API_KEY",
    perplexity : "PERPLEXITY_API_KEY",
    replicate  : "REPLICATE_API_KEY",
    huggingface: "HUGGINGFACE_API_KEY",
  };

  const keys: Record<string, string> = {};
  for (const [p, env] of Object.entries(ENV_MAP)) {
    keys[p] = callerKeys?.[p] ?? process.env[env] ?? "";
  }

  // Supplement with vault for missing keys
  const missing = Object.entries(keys).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length) {
    try {
      const { vault } = await import("@/lib/javari/secrets/vault");
      for (const p of missing) {
        try {
          const k = await (vault as { get: (n: string) => Promise<string | null> }).get(p);
          if (k) keys[p] = k;
        } catch { /* key not in vault */ }
      }
    } catch { /* vault unavailable */ }
  }
  return keys;
}

// ── Main orchestrator ──────────────────────────────────────────────────────

export async function runOrchestrator(req: OrchestratorRequest): Promise<OrchestratorResponse> {
  const t0              = Date.now();
  const orchestrationId = `orch-${t0}-${Math.random().toString(36).slice(2,7)}`;
  const timestamp       = new Date().toISOString();

  const {
    prompt, priority="balanced", aggregation="confidence",
    max_models=3, quality_threshold=50, task_id, api_keys,
  } = req;

  const taskType = (req.task_type ?? detectTaskType(prompt)) as TaskType;
  const apiKeys  = await resolveApiKeys(api_keys);

  let benchmarks: Awaited<ReturnType<typeof loadBenchmarkSummaries>> = [];
  try { benchmarks = await loadBenchmarkSummaries(); } catch { /* non-fatal */ }

  // Route: select primary + ensemble
  const selection = routeTask(taskType, priority, max_models);

  // Cost optimization: inject cheaper model as primary when cost/balanced priority
  let costOptimized = false;
  if (priority === "cost" || priority === "balanced") {
    const costSel = selectCheapestQualifyingModel({ taskType, qualityThreshold:quality_threshold, benchmarks });
    if (costSel && costSel.model.id !== selection.primary.id) {
      const cheaper = ORCHESTRATOR_REGISTRY.find(m => m.id === costSel.model.id);
      if (cheaper) {
        selection.ensemble.unshift(selection.primary);
        selection.primary = cheaper;
        costOptimized = true;
      }
    }
  }

  const modelsToUse = [selection.primary, ...selection.ensemble.slice(0, max_models - 1)]
    .filter((m, i, arr) => arr.findIndex(m2 => m2.id === m.id) === i)
    .slice(0, max_models);

  let ensembleResult: EnsembleResult;
  try {
    ensembleResult = await runEnsemble({
      prompt, models:modelsToUse, taskType, apiKeys, aggregation, timeoutMs:45_000,
    });
  } catch (err) {
    return {
      ok:false, orchestration_id:orchestrationId, task_type:taskType, priority,
      final_answer:"", winning_model:"none", winning_provider:"none",
      confidence:0, consensus_score:0, models_used:modelsToUse.length,
      models_succeeded:0, models_failed:modelsToUse.length,
      total_cost_usd:0, total_latency_ms:Date.now()-t0,
      ensemble_detail:[], routing_reason:selection.reason,
      cost_optimized:costOptimized, timestamp, durationMs:Date.now()-t0, error:String(err),
    };
  }

  // Record benchmark results for future routing improvement
  for (const resp of ensembleResult.modelResponses) {
    try {
      await recordBenchmarkResult({
        model_id:resp.model_id, provider:resp.provider, benchmark_id:orchestrationId,
        task_type:taskType, prompt_tokens:Math.ceil(prompt.length/4),
        output_tokens:Math.ceil(resp.content.length/4),
        latency_ms:resp.latency_ms, cost_usd:resp.cost_usd,
        success:resp.success, score:resp.score, error:resp.error, timestamp,
      });
    } catch { /* non-fatal */ }
  }

  // Record artifact: model_usage
  let artifactId: string | undefined;
  if (task_id) {
    try {
      const ar = await recordArtifact({
        task_id,
        artifact_type    : "model_usage" as "commit",
        artifact_location: orchestrationId,
        artifact_data    : {
          task_type:taskType, winning_model:ensembleResult.winningModel,
          models_used:modelsToUse.length, total_cost_usd:ensembleResult.totalCostUsd,
          confidence:ensembleResult.confidence, consensus_score:ensembleResult.consensusScore,
        },
      });
      artifactId = ar.id;
    } catch { /* non-fatal */ }
  }

  // Record artifact: model_consensus
  if (ensembleResult.successCount > 1) {
    try {
      await recordArtifact({
        task_id          : task_id ?? orchestrationId,
        artifact_type    : "model_consensus" as "commit",
        artifact_location: orchestrationId,
        artifact_data    : {
          consensus_score:ensembleResult.consensusScore,
          aggregation:ensembleResult.aggregation,
          models:ensembleResult.modelResponses.map(r=>({ id:r.model_id, score:r.score, success:r.success })),
        },
      });
    } catch { /* non-fatal */ }
  }

  const durationMs = Date.now() - t0;
  return {
    ok               : ensembleResult.successCount > 0,
    orchestration_id : orchestrationId,
    task_type        : taskType,
    priority,
    final_answer     : ensembleResult.finalAnswer,
    winning_model    : ensembleResult.winningModel,
    winning_provider : ensembleResult.winningProvider,
    confidence       : ensembleResult.confidence,
    consensus_score  : ensembleResult.consensusScore,
    models_used      : modelsToUse.length,
    models_succeeded : ensembleResult.successCount,
    models_failed    : ensembleResult.failureCount,
    total_cost_usd   : ensembleResult.totalCostUsd,
    total_latency_ms : ensembleResult.totalLatencyMs,
    ensemble_detail  : ensembleResult.modelResponses.map(r => ({
      model_id:r.model_id, provider:r.provider, success:r.success,
      score:r.score, latency_ms:r.latency_ms, cost_usd:r.cost_usd, error:r.error,
    })),
    routing_reason   : selection.reason,
    cost_optimized   : costOptimized,
    artifact_id      : artifactId,
    timestamp,
    durationMs,
  };
}

export { getRegistryStats };
