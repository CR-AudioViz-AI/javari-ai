// lib/javari/multi-ai/router.ts
// Javari Multi-Model Routing Engine — v2
// 2026-02-20 — STEP 1 complete implementation
//
// Pipeline (in order):
//   1. analyzeRoutingContext()  → determine ALL routing flags
//   2. selectPrimaryModel()     → pick optimal model from flags
//   3. buildFallbackChain()     → ordered provider list for resilience
//   4. routeRequest()           → public API (backward compat with unified.ts)
//
// Routing logic (priority order):
//   A. JSON-mode request → Mistral large (strict structured output)
//   B. Reasoning-depth   → o4-mini / o3 (OpenAI o-series)
//   C. Bulk/cheap tasks  → Groq Llama (free tier, high volume)
//   D. Default           → Groq (speed) → OpenAI → Anthropic
//
// Fallback tree (per spec):
//   o-series → GPT-4-class → Llama → Claude validator
//
// Fully backward-compatible with existing unified.ts import:
//   import { routeRequest, type RoutingDecision, type RoutingContext } from './router'

import { ModelMetadata, selectModelByTask, getModel, getFallbackModel } from "./model-registry";
import { analyzeRoutingContext } from "./routing-context";
import type { RoutingContext as AnalysisContext } from "./routing-context";

// ── Re-export RoutingContext for unified.ts (backward compat) ─────────────────
export type { RoutingContext } from "./routing-context";
export { analyzeRoutingContext } from "./routing-context";

// ── Interfaces ────────────────────────────────────────────────────────────────

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

  // New in v2 — routing metadata attached for downstream use
  routingMeta: {
    requires_reasoning_depth: boolean;
    requires_json: boolean;
    requires_validation: boolean;
    high_risk: boolean;
    cost_sensitivity: string;
    complexity_score: number;
    fallback_chain: string[];
    primary_provider_hint: string;
    primary_model_hint: string;
  };
}

// Legacy interface kept for backward compat with any direct callsites
export interface LegacyRoutingContext {
  prompt: string;
  mode: "single" | "super" | "advanced" | "roadmap" | "council";
  policy?: RoutingPolicy;
  userOverride?: string;
}

// ── Model catalogue (routing-relevant subset) ─────────────────────────────────
// Maps provider hint → preferred model id for use in generateStream()
// When the registry model doesn't carry the actual API model string,
// we override it here via getModelOverride().

const MODEL_OVERRIDES: Record<string, { provider: string; modelId: string }> = {
  // o-series (reasoning)
  "o4-mini": { provider: "openai",    modelId: "o4-mini" },
  "o3":      { provider: "openai",    modelId: "o3" },
  "o1":      { provider: "openai",    modelId: "o1" },
  "o1-mini": { provider: "openai",    modelId: "o1-mini" },

  // Mistral (JSON mode)
  "mistral-large-latest": { provider: "mistral", modelId: "mistral-large-latest" },
  "mixtral-8x7b-32768":   { provider: "mistral", modelId: "mixtral-8x7b-32768" },

  // Groq Llama (bulk/cost)
  "llama-3.1-70b-versatile": { provider: "groq", modelId: "llama-3.1-70b-versatile" },
  "llama-3.1-8b-instant":    { provider: "groq", modelId: "llama-3.1-8b-instant" },

  // GPT-4-class
  "gpt-4o":      { provider: "openai",    modelId: "gpt-4o" },
  "gpt-4o-mini": { provider: "openai",    modelId: "gpt-4o-mini" },

  // Claude (validator / fallback)
  "claude-sonnet-4-20250514":  { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  "claude-haiku-4-5-20251001": { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
};

// ── Synthetic model metadata for o-series / Mistral (not in registry) ────────
// These models don't exist in the local model-registry.ts but ARE valid providers.
// We create minimal metadata so RoutingDecision.selectedModel is always populated.

function syntheticModel(
  id: string,
  provider: string,
  name: string,
  reasoning: number,
  cost: ModelMetadata["cost"],
  priority: number
): ModelMetadata {
  return {
    id,
    provider,
    name,
    speed: cost === "free" ? "ultra-fast" : cost === "low" ? "fast" : "medium",
    cost,
    reliability: 0.95,
    capabilities: { reasoning, coding: 8, analysis: reasoning, speed: cost === "free" ? 9 : 6 },
    limits: { rpm: 500, tpm: 200_000, contextWindow: 128_000 },
    pricing: { inputPerMillion: 0, outputPerMillion: 0 },
    available: true,
    fallbackPriority: priority,
  };
}

const SYNTHETIC_MODELS: Record<string, ModelMetadata> = {
  "o4-mini":              syntheticModel("o4-mini",              "openai",    "OpenAI o4-mini",            10, "high",    1),
  "o3":                   syntheticModel("o3",                   "openai",    "OpenAI o3",                 10, "expensive", 2),
  "o1":                   syntheticModel("o1",                   "openai",    "OpenAI o1",                 10, "expensive", 3),
  "mistral-large-latest": syntheticModel("mistral-large-latest", "mistral",   "Mistral Large",             8,  "moderate", 5),
  "mixtral-8x7b-32768":   syntheticModel("mixtral-8x7b-32768",  "mistral",   "Mixtral 8x7B",              7,  "low",     6),
  "llama-3.1-70b-versatile": syntheticModel("llama-3.1-70b-versatile", "groq", "Llama 3.1 70B (Groq)",  8,  "free",    4),
};

function resolveModel(modelHint: string): ModelMetadata {
  // Try synthetic first (o-series etc.)
  if (SYNTHETIC_MODELS[modelHint]) return SYNTHETIC_MODELS[modelHint];
  // Try registry
  const reg = getModel(modelHint);
  if (reg) return reg;
  // Last resort: fallback model
  return getFallbackModel();
}

// ── Fallback chain builder ────────────────────────────────────────────────────
// Per spec:
//   o-series → GPT-4-class → Llama → Claude validator
//   GPT-4-class → Llama → Claude validator
//   Llama → Claude validator

export function buildFallbackChain(
  primaryProvider: string,
  ctx: AnalysisContext
): string[] {
  // Always end with Claude (validator / final safety net)
  const CLAUDE_ANCHOR = "anthropic";

  if (primaryProvider === "openai" && ctx.requires_reasoning_depth) {
    // o-series path
    return ["openai", "openai", "groq", CLAUDE_ANCHOR];
    //       ^o-series ^gpt-4o  ^llama ^claude
  }
  if (primaryProvider === "mistral") {
    return ["mistral", "openai", "groq", CLAUDE_ANCHOR];
  }
  if (primaryProvider === "groq") {
    return ["groq", "openai", CLAUDE_ANCHOR, "mistral", "openrouter"];
  }
  // Default
  return [primaryProvider, "groq", "openai", CLAUDE_ANCHOR, "mistral", "openrouter", "xai", "perplexity"]
    .filter((p, i, arr) => arr.indexOf(p) === i) // dedupe
    .slice(0, 7);
}

// ── Public routing entry point ────────────────────────────────────────────────
// Backward-compatible with existing unified.ts call:
//   routeRequest({ prompt, mode })

export function routeRequest(
  context: LegacyRoutingContext
): RoutingDecision {
  const { prompt, mode, policy, userOverride } = context;

  // ── 1. Analyze routing context ──────────────────────────────────────────
  const ctx = analyzeRoutingContext(
    prompt,
    mode,
    policy?.preferredProviders?.[0]
  );

  // ── 2. Handle explicit user model override ──────────────────────────────
  if (userOverride) {
    const overrideModel = resolveModel(userOverride);
    return {
      selectedModel: overrideModel,
      reason: `Explicit user override: ${userOverride}`,
      alternatives: [],
      costEstimate: 0,
      confidence: 1.0,
      overrideApplied: userOverride,
      routingMeta: buildMeta(ctx),
    };
  }

  // ── 3. JSON-mode routing → Mistral ──────────────────────────────────────
  if (ctx.requires_json) {
    const mistral = resolveModel("mistral-large-latest");
    return {
      selectedModel: mistral,
      reason: "JSON/structured output required → Mistral Large (strict JSON mode)",
      alternatives: [resolveModel("mixtral-8x7b-32768"), resolveModel("gpt-4o-mini")],
      costEstimate: ctx.estimated_cost_usd,
      confidence: 0.92,
      routingMeta: buildMeta(ctx),
    };
  }

  // ── 4. Reasoning-depth routing → o-series ──────────────────────────────
  if (ctx.requires_reasoning_depth) {
    const oModel = ctx.complexity_score >= 80
      ? resolveModel("o3")
      : resolveModel("o4-mini");

    return {
      selectedModel: oModel,
      reason: `High reasoning depth (complexity=${ctx.complexity_score}) → ${oModel.id}`,
      alternatives: [resolveModel("gpt-4o"), resolveModel("claude-sonnet-4-20250514")],
      costEstimate: ctx.estimated_cost_usd,
      confidence: 0.90,
      routingMeta: buildMeta(ctx),
    };
  }

  // ── 5. Bulk/cost-optimized → Groq Llama ────────────────────────────────
  if (ctx.is_bulk_task && !ctx.high_risk) {
    const llama = resolveModel("llama-3.1-70b-versatile");
    return {
      selectedModel: llama,
      reason: `Bulk task (summarize/extract/classify/rewrite) → Groq Llama 70B (free tier)`,
      alternatives: [resolveModel("gpt-4o-mini")],
      costEstimate: 0,
      confidence: 0.88,
      routingMeta: buildMeta(ctx),
    };
  }

  // ── 6. Cost ceiling enforcement ─────────────────────────────────────────
  if (policy?.maxCostPerRequest !== undefined) {
    const ceiling = policy.maxCostPerRequest;
    if (ceiling === 0) {
      // Must be free
      const llama = resolveModel("llama-3.1-70b-versatile");
      return {
        selectedModel: llama,
        reason: "Cost ceiling = $0 → free tier Llama",
        alternatives: [],
        costEstimate: 0,
        confidence: 0.85,
        routingMeta: buildMeta(ctx),
      };
    }
  }

  // ── 7. Council mode ─────────────────────────────────────────────────────
  if (mode === "council") {
    const council = getModel("gpt-4o-mini") ?? getFallbackModel();
    return {
      selectedModel: council,
      reason: "Council mode: orchestrator manages multi-model workflow",
      alternatives: [],
      costEstimate: 0.002,
      confidence: 1.0,
      routingMeta: buildMeta(ctx),
    };
  }

  // ── 8. Default: Use registry model selection ────────────────────────────
  const taskReqs = {
    needsReasoning: ctx.requires_reasoning_depth,
    needsSpeed:     ctx.cost_sensitivity === "free",
    needsCoding:    ctx.has_code_request,
  };

  let selectedModel = selectModelByTask(taskReqs);

  // Apply preferred provider filter
  if (policy?.preferredProviders?.length) {
    const preferred = policy.preferredProviders;
    if (!preferred.includes(selectedModel.provider)) {
      const alt = selectModelByTask({ ...taskReqs, maxCost: "premium" });
      if (preferred.includes(alt.provider)) {
        selectedModel = alt;
      }
    }
  }

  const estimatedTokens = Math.min(prompt.length * 1.5, 2000);
  const costEstimate =
    (estimatedTokens * selectedModel.pricing.inputPerMillion) / 1_000_000 +
    (estimatedTokens * 2 * selectedModel.pricing.outputPerMillion) / 1_000_000;

  return {
    selectedModel,
    reason: buildReason(selectedModel, ctx),
    alternatives: [],
    costEstimate,
    confidence: Math.min(selectedModel.reliability + 0.05, 1.0),
    routingMeta: buildMeta(ctx),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMeta(ctx: AnalysisContext): RoutingDecision["routingMeta"] {
  return {
    requires_reasoning_depth: ctx.requires_reasoning_depth,
    requires_json:            ctx.requires_json,
    requires_validation:      ctx.requires_validation,
    high_risk:                ctx.high_risk,
    cost_sensitivity:         ctx.cost_sensitivity,
    complexity_score:         ctx.complexity_score,
    fallback_chain:           ctx.fallback_chain,
    primary_provider_hint:    ctx.primary_provider_hint,
    primary_model_hint:       ctx.primary_model_hint,
  };
}

function buildReason(model: ModelMetadata, ctx: AnalysisContext): string {
  const parts: string[] = [];
  if (ctx.has_code_request) parts.push(`code task (coding=${model.capabilities.coding}/10)`);
  if (ctx.is_bulk_task)     parts.push("bulk task → cost-optimized");
  if (model.cost === "free") parts.push("free tier");
  if (parts.length === 0)   parts.push(`general purpose: ${model.name}`);
  return parts.join(", ");
}

// ── Routing logger (preserved from v1) ───────────────────────────────────────

export interface RouterLog {
  timestamp: string;
  context: LegacyRoutingContext;
  decision: RoutingDecision;
  executionTime?: number;
  success?: boolean;
  error?: string;
}

export class RouterLogger {
  private logs: RouterLog[] = [];
  private maxLogs = 100;

  log(context: LegacyRoutingContext, decision: RoutingDecision): void {
    this.logs.unshift({ timestamp: new Date().toISOString(), context, decision });
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

  updateLog(timestamp: string, update: Partial<RouterLog>): void {
    const log = this.logs.find((l) => l.timestamp === timestamp);
    if (log) Object.assign(log, update);
  }

  getLogs(limit = 10): RouterLog[] {
    return this.logs.slice(0, limit);
  }

  getStats() {
    const byProvider: Record<string, number> = {};
    let totalCost = 0;
    let totalConf = 0;
    this.logs.forEach((l) => {
      const p = l.decision.selectedModel.provider;
      byProvider[p] = (byProvider[p] || 0) + 1;
      totalCost += l.decision.costEstimate;
      totalConf += l.decision.confidence;
    });
    return {
      totalRequests: this.logs.length,
      byProvider,
      avgCost:       this.logs.length > 0 ? totalCost / this.logs.length : 0,
      avgConfidence: this.logs.length > 0 ? totalConf / this.logs.length : 0,
    };
  }
}

export const globalRouterLogger = new RouterLogger();
