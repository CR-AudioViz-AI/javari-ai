// lib/javari/multi-ai/router.ts
// Javari Multi-Model Routing Engine — v3 (Registry Safe)

import {
  ModelMetadata,
  selectModelByTask,
  getModel,
  getFallbackModel,
  initRegistry
} from "./model-registry";

import { analyzeRoutingContext } from "./routing-context";
import type { RoutingContext as AnalysisContext } from "./routing-context";

export type { RoutingContext } from "./routing-context";
export { analyzeRoutingContext } from "./routing-context";

export interface RoutingPolicy {
  maxCostPerRequest?: number;
  preferredProviders?: string[];
  excludedProviders?: string[];
  requireReasoning?: boolean;
  requireSpeed?: boolean;
  requireCoding?: boolean;
  allowFallback?: boolean;
}

export interface RoutingDecision {
  selectedModel: ModelMetadata;
  reason: string;
  alternatives: ModelMetadata[];
  costEstimate: number;
  confidence: number;
  overrideApplied?: string;
  routingMeta: {
    requires_reasoning_depth: boolean;
    requires_json: boolean;
    requires_validation: boolean;
    high_risk: boolean;
    cost_sensitivity: string;
    complexity_score: number;
  };
}

export interface LegacyRoutingContext {
  prompt: string;
  mode: "single" | "super" | "advanced" | "roadmap" | "council";
  policy?: RoutingPolicy;
  userOverride?: string;
}

// 🚨 CRITICAL FIX: routeRequest MUST be async
export async function routeRequest(
  context: LegacyRoutingContext
): Promise<RoutingDecision> {

  // 🚨 REQUIRED FIRST LINE
  await initRegistry();

  const { prompt, mode, policy, userOverride } = context;

  const ctx = analyzeRoutingContext(
    prompt,
    mode,
    policy?.preferredProviders?.[0]
  );

  if (userOverride) {
    const overrideModel = getModel(userOverride) ?? getFallbackModel();
    return {
      selectedModel: overrideModel,
      reason: `Explicit override: ${userOverride}`,
      alternatives: [],
      costEstimate: 0,
      confidence: 1,
      overrideApplied: userOverride,
      routingMeta: buildMeta(ctx),
    };
  }

  const taskReqs = {
    needsReasoning: ctx.requires_reasoning_depth,
    needsSpeed: ctx.cost_sensitivity === "free",
    needsCoding: ctx.has_code_request,
  };

  const selectedModel = selectModelByTask(taskReqs);

  return {
    selectedModel,
    reason: buildReason(selectedModel, ctx),
    alternatives: [],
    costEstimate: 0,
    confidence: selectedModel.reliability,
    routingMeta: buildMeta(ctx),
  };
}

function buildMeta(ctx: AnalysisContext) {
  return {
    requires_reasoning_depth: ctx.requires_reasoning_depth,
    requires_json: ctx.requires_json,
    requires_validation: ctx.requires_validation,
    high_risk: ctx.high_risk,
    cost_sensitivity: ctx.cost_sensitivity,
    complexity_score: ctx.complexity_score,
  };
}

function buildReason(model: ModelMetadata, ctx: AnalysisContext): string {
  if (ctx.has_code_request) return "Code task";
  if (ctx.requires_reasoning_depth) return "High reasoning depth";
  if (ctx.requires_json) return "JSON required";
  return `Selected ${model.name}`;
}

// Additional named exports
export const buildFallbackChain = {}
