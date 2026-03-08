// lib/orchestrator/costOptimizer.ts
// Purpose: Selects the cheapest model meeting a quality threshold. Implements
//          Henderson Cost Law: free → low_cost → standard → premium.
//          Uses live benchmark data when available; static registry scores otherwise.
// Date: 2026-03-07

import {
  OrchestratorModel, ORCHESTRATOR_REGISTRY,
  getModelsByCapability, ModelCapabilityTag,
} from "./modelRegistry";
import type { ModelBenchmarkSummary } from "./modelBenchmark";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CostOptimizationRequest {
  taskType            : string;
  qualityThreshold    : number;    // 0-100
  maxCostPer1k?       : number;
  requireCapabilities?: ModelCapabilityTag[];
  excludeProviders?   : string[];
  benchmarks?         : ModelBenchmarkSummary[];
}

export interface OptimizedSelection {
  model             : OrchestratorModel;
  expectedScore     : number;
  costPer1k         : number;
  savingsVsPremium  : number;
  reason            : string;
  alternativeCount  : number;
  tier              : string;
}

// Henderson Cost Law tier order: always exhaust cheaper before escalating
const TIER_ORDER: OrchestratorModel["tier"][] = ["free","low_cost","standard","premium"];

// ── Score estimator ────────────────────────────────────────────────────────

function estimateScore(
  model     : OrchestratorModel,
  taskType  : string,
  benchmarks: ModelBenchmarkSummary[]
): number {
  const bench = benchmarks.find(b => b.model_id === model.id);
  if (bench && bench.total_runs > 0) {
    return bench.task_scores[taskType] ?? bench.avg_score;
  }
  const base = (model.reasoning_score + model.coding_score + model.reliability_score) / 3 * 10;
  const CAP_BOOSTS: Partial<Record<string,ModelCapabilityTag[]>> = {
    security_audit    : ["security_audit","reasoning"],
    code_repair       : ["code_repair","coding"],
    architecture_design: ["architecture_design","reasoning"],
    fast_qa           : ["ultra_fast","fast"],
    math_reasoning    : ["math","reasoning"],
  };
  const caps  = CAP_BOOSTS[taskType] ?? [];
  const boost = caps.filter(c => model.capabilities.includes(c)).length * 5;
  return Math.min(100, Math.round(base + boost));
}

// ── Main optimizer ─────────────────────────────────────────────────────────

export function selectCheapestQualifyingModel(
  req: CostOptimizationRequest
): OptimizedSelection | null {
  const { taskType, qualityThreshold, maxCostPer1k, requireCapabilities, excludeProviders, benchmarks=[] } = req;

  let candidates = ORCHESTRATOR_REGISTRY.filter(m => {
    if (!m.active) return false;
    if (excludeProviders?.includes(m.provider)) return false;
    if (maxCostPer1k !== undefined && m.cost_per_1k_tokens > maxCostPer1k) return false;
    if (requireCapabilities?.length) return requireCapabilities.every(c => m.capabilities.includes(c));
    return true;
  });
  if (!candidates.length) return null;

  const scored = candidates
    .map(m => ({ model:m, score:estimateScore(m, taskType, benchmarks) }))
    .filter(({ score }) => score >= qualityThreshold);
  if (!scored.length) return null;

  // Sort: tier ASC (cost law), then cost ASC, then score DESC
  scored.sort((a,b) => {
    const ta = TIER_ORDER.indexOf(a.model.tier);
    const tb = TIER_ORDER.indexOf(b.model.tier);
    if (ta !== tb) return ta - tb;
    const cd = a.model.cost_per_1k_tokens - b.model.cost_per_1k_tokens;
    if (Math.abs(cd) > 0.0001) return cd;
    return b.score - a.score;
  });

  const winner = scored[0];
  const cheapestPremium = ORCHESTRATOR_REGISTRY
    .filter(m => m.tier === "premium" && m.active && m.reliability_score >= 9)
    .reduce<OrchestratorModel | undefined>((best,m) =>
      !best || m.cost_per_1k_tokens < best.cost_per_1k_tokens ? m : best, undefined);
  const savings = cheapestPremium
    ? Math.max(0, Math.round((1 - winner.model.cost_per_1k_tokens / Math.max(cheapestPremium.cost_per_1k_tokens,0.0001)) * 100))
    : 0;

  return {
    model           : winner.model,
    expectedScore   : winner.score,
    costPer1k       : winner.model.cost_per_1k_tokens,
    savingsVsPremium: savings,
    reason          : `Cheapest model meeting quality≥${qualityThreshold}. Tier:${winner.model.tier}. Score:${winner.score}/100. ${savings}% cheaper than premium.`,
    alternativeCount: scored.length - 1,
    tier            : winner.model.tier,
  };
}

// ── Cost projection ────────────────────────────────────────────────────────

export function projectCost(model: OrchestratorModel, estimatedTokens: number) {
  const perRequest = estimatedTokens / 1000 * model.cost_per_1k_tokens;
  return { perRequest, per1000Requests:perRequest*1000, perDay:perRequest*50, perMonth:perRequest*1500 };
}

// ── Portfolio builder ──────────────────────────────────────────────────────

export function buildCostOptimizedPortfolio(
  taskTypes : string[],
  threshold : number = 60,
  benchmarks: ModelBenchmarkSummary[] = []
): Record<string, OptimizedSelection | null> {
  const portfolio: Record<string, OptimizedSelection | null> = {};
  for (const t of taskTypes) {
    portfolio[t] = selectCheapestQualifyingModel({ taskType:t, qualityThreshold:threshold, benchmarks });
  }
  return portfolio;
}
