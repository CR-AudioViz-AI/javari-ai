// lib/javari/multi-ai/routing-context.ts
// Javari Routing Context Analyzer — Step 1 of the routing pipeline
// 2026-02-20 — STEP 1 implementation
//
// Every request passes through analyzeRoutingContext() BEFORE model selection.
// The returned RoutingContext drives every downstream routing decision:
//   - requires_reasoning_depth → o-series
//   - requires_json            → Mistral strict mode
//   - cost_sensitivity         → Llama (free tier)
//   - high_risk                → validator stage after generation
//   - requires_validation      → Claude validator check
//
// All decisions are deterministic given the same input.
// No I/O, no side effects — pure function.

// ── Types (also exported to lib/types.ts barrel) ─────────────────────────────

import {
  buildCapabilityChain,
  buildDefaultChain,
  getRecommendedModel,
  getProviderCost,
  getActiveModelCount,
  MODEL_REGISTRY_VERSION,
} from "./model-registry";

export const ROUTING_ENGINE_VERSION = "v2.0-registry-routing";

export type CostSensitivity = "free" | "low" | "moderate" | "expensive";

export interface RoutingContext {
  // Original request
  prompt: string;
  mode: "single" | "super" | "advanced" | "roadmap" | "council";
  requestedProvider?: string;

  // ── Detected flags (all deterministic) ────────────────────────────────────
  requires_reasoning_depth: boolean; // → o-series
  requires_json: boolean;            // → Mistral strict
  requires_validation: boolean;      // → Claude validator after gen
  high_risk: boolean;                // → validator + fallback on failure
  cost_sensitivity: CostSensitivity; // → Llama when "free"

  // ── Scoring metadata ──────────────────────────────────────────────────────
  complexity_score: number;          // 0–100
  word_count: number;
  has_code_request: boolean;
  has_multi_step: boolean;
  has_schema_request: boolean;
  is_bulk_task: boolean;             // summarize / extract / classify / rewrite

  // ── Derived routing hints ─────────────────────────────────────────────────
  primary_provider_hint: string;     // groq | openai | anthropic | mistral
  primary_model_hint: string;        // specific model id
  fallback_chain: string[];          // ordered fallback providers
  estimated_cost_usd: number;        // rough estimate for this context
}

// ── Keyword tables ────────────────────────────────────────────────────────────

const REASONING_KEYWORDS = new Set([
  "analyze", "analysis", "evaluate", "assessment",
  "compare", "comparison", "tradeoff", "trade-off",
  "explain why", "reason", "rationale", "logic",
  "multi-step", "step by step", "step-by-step",
  "decision tree", "dependency", "dependencies",
  "architect", "design system", "plan", "strategy",
  "optimize", "optimization", "recommend", "recommendation",
  "pros and cons", "implications", "consequences",
  "debug", "root cause", "diagnose",
]);

const JSON_KEYWORDS = new Set([
  "json", "json format", "json schema",
  "structured output", "structured data",
  "return json", "output json", "as json",
  "yaml", "xml schema", "data schema",
  "api response", "api schema",
  "typescript interface", "typescript type",
  "zod schema", "validation schema",
  "config file", "configuration file",
  "parse", "serialize", "deserialize",
]);

const HIGH_RISK_KEYWORDS = new Set([
  "production", "deploy", "deployment",
  "database migration", "schema migration",
  "delete", "drop table", "truncate",
  "payment", "billing", "stripe", "checkout",
  "authentication", "security", "auth",
  "api key", "secret", "credential",
  "hipaa", "gdpr", "compliance",
  "legal", "contract", "liability",
  "financial", "revenue", "transaction",
]);

const BULK_TASK_KEYWORDS = new Set([
  "summarize", "summary", "summarization",
  "extract", "extraction",
  "classify", "classification",
  "rewrite", "paraphrase",
  "translate", "translation",
  "label", "labeling",
  "list all", "list every",
  "convert", "transform",
  "batch",
]);

const CODE_KEYWORDS = new Set([
  "code", "function", "class", "implement",
  "build", "create component", "generate code",
  "api endpoint", "database", "algorithm",
  "module", "package", "library", "framework",
  "typescript", "javascript", "python",
  "react", "next.js", "nextjs", "supabase",
  "sql", "query",
]);

const MULTI_STEP_PATTERNS = [
  /\bstep\s*\d+/i,
  /\b(first|second|third|then|finally|afterwards|next)\b.*\b(first|second|third|then|finally|afterwards|next)\b/i,
  /\band\s+then\b/i,
  /\bafter\s+that\b/i,
  /\b\d+\.\s+\w/,  // numbered list pattern
  /\bphase\s+\d+/i,
];

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreKeywords(lower: string, keywords: Set<string>): number {
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score++;
  }
  return score;
}

function detectMultiStep(text: string): boolean {
  return MULTI_STEP_PATTERNS.some((p) => p.test(text));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((p) => { if (seen.has(p)) return false; seen.add(p); return true; });
}

// ── Main analyzer ─────────────────────────────────────────────────────────────

export function analyzeRoutingContext(
  prompt: string,
  mode: RoutingContext["mode"] = "single",
  requestedProvider?: string
): RoutingContext {
  const lower = prompt.toLowerCase();
  const words = prompt.trim().split(/\s+/);
  const word_count = words.length;

  // ── Score each dimension ──────────────────────────────────────────────────
  const reasoningScore  = scoreKeywords(lower, REASONING_KEYWORDS);
  const jsonScore       = scoreKeywords(lower, JSON_KEYWORDS);
  const highRiskScore   = scoreKeywords(lower, HIGH_RISK_KEYWORDS);
  const bulkScore       = scoreKeywords(lower, BULK_TASK_KEYWORDS);
  const codeScore       = scoreKeywords(lower, CODE_KEYWORDS);
  const has_multi_step  = detectMultiStep(prompt);
  const has_code_request = codeScore >= 1;
  const has_schema_request = jsonScore >= 1;
  const is_bulk_task    = bulkScore >= 1;

  // ── Derive flags ──────────────────────────────────────────────────────────

  // Reasoning: keyword hit OR multi-step OR long complex prompt
  const requires_reasoning_depth =
    reasoningScore >= 2 ||
    has_multi_step ||
    (word_count > 150 && codeScore >= 2) ||
    mode === "advanced" ||
    mode === "roadmap";

  // JSON: any schema/structured-output keyword
  const requires_json = jsonScore >= 1;

  // High risk: any sensitive keyword
  const high_risk = highRiskScore >= 1;

  // Validation: always validate high-risk, also validate when reasoning required
  const requires_validation = high_risk || requires_reasoning_depth || mode === "super";

  // Cost sensitivity
  let cost_sensitivity: CostSensitivity;
  if (requires_reasoning_depth || high_risk) {
    cost_sensitivity = requires_reasoning_depth && high_risk ? "expensive" : "moderate";
  } else if (is_bulk_task) {
    cost_sensitivity = "free"; // Llama for bulk
  } else {
    cost_sensitivity = "low";
  }

  // ── Complexity score (0–100) ──────────────────────────────────────────────
  let complexity_score = 0;
  complexity_score += Math.min(word_count / 5, 30);       // up to 30 for length
  complexity_score += reasoningScore * 8;                  // up to 40 for reasoning
  complexity_score += codeScore * 5;                       // up to 25 for code
  complexity_score += highRiskScore * 6;                   // up to 30 for risk
  complexity_score += has_multi_step ? 15 : 0;
  complexity_score = Math.min(Math.round(complexity_score), 100);

  // ── Capability-based provider + model selection (from registry) ──────────
  let primary_provider_hint: string;
  let primary_model_hint: string;
  let fallback_chain: string[];
  let estimated_cost_usd: number;

  if (requires_json) {
    // JSON-mode: registry models with json_reliability >= 4
    const jsonChain = buildCapabilityChain("json_reliability", 4);
    const defaultChain = buildDefaultChain();
    fallback_chain = dedup([...jsonChain, ...defaultChain]);
    primary_provider_hint = fallback_chain[0] ?? "mistral";
    const model = getRecommendedModel(primary_provider_hint, "json_reliability");
    primary_model_hint = model?.model_id ?? "mistral-large-latest";
    estimated_cost_usd = model?.cost_per_1k_tokens ? model.cost_per_1k_tokens * 4 : 0.008;
  } else if (requires_reasoning_depth) {
    // Reasoning: registry models with reasoning >= 4, sorted by score
    const reasonChain = buildCapabilityChain("reasoning", 4);
    const defaultChain = buildDefaultChain();
    fallback_chain = dedup([...reasonChain, ...defaultChain]);
    primary_provider_hint = fallback_chain[0] ?? "openai";
    // For extreme complexity, pick the deepest reasoning model from the primary provider
    const model = getRecommendedModel(primary_provider_hint, "reasoning");
    primary_model_hint = model?.model_id ?? "o4-mini";
    estimated_cost_usd = model?.cost_per_1k_tokens ? model.cost_per_1k_tokens * 8 : 0.05;
  } else if (has_code_request && codeScore >= 2) {
    // Heavy code tasks: registry models with code_quality >= 4
    const codeChain = buildCapabilityChain("code_quality", 4);
    const defaultChain = buildDefaultChain();
    fallback_chain = dedup([...codeChain, ...defaultChain]);
    primary_provider_hint = fallback_chain[0] ?? "openai";
    const model = getRecommendedModel(primary_provider_hint, "code_quality");
    primary_model_hint = model?.model_id ?? "o4-mini";
    estimated_cost_usd = model?.cost_per_1k_tokens ? model.cost_per_1k_tokens * 6 : 0.03;
  } else if (is_bulk_task && !high_risk) {
    // Bulk/cheap tasks: cheapest models first (cost-optimized chain)
    fallback_chain = buildDefaultChain();
    primary_provider_hint = fallback_chain[0] ?? "groq";
    const model = getRecommendedModel(primary_provider_hint);
    primary_model_hint = model?.model_id ?? "llama-3.3-70b-versatile";
    estimated_cost_usd = 0.0;
  } else {
    // Default: cost-optimized chain from registry
    fallback_chain = buildDefaultChain();
    primary_provider_hint = requestedProvider ?? fallback_chain[0] ?? "groq";
    const model = getRecommendedModel(primary_provider_hint);
    primary_model_hint = model?.model_id ?? "llama-3.3-70b-versatile";
    estimated_cost_usd = model?.cost_per_1k_tokens ?? 0.001;
  }

  // Honor explicit provider request (unless overridden by hard requirements)
  if (requestedProvider && !requires_json && !requires_reasoning_depth) {
    primary_provider_hint = requestedProvider;
    fallback_chain = dedup([
      requestedProvider,
      ...fallback_chain.filter((p) => p !== requestedProvider),
    ]);
    const model = getRecommendedModel(requestedProvider);
    if (model) primary_model_hint = model.model_id;
  }

  return {
    prompt,
    mode,
    requestedProvider,
    requires_reasoning_depth,
    requires_json,
    requires_validation,
    high_risk,
    cost_sensitivity,
    complexity_score,
    word_count,
    has_code_request,
    has_multi_step,
    has_schema_request,
    is_bulk_task,
    primary_provider_hint,
    primary_model_hint,
    fallback_chain,
    estimated_cost_usd,
  };
}


// ═══════════════════════════════════════════════════════════════
// ADAPTIVE HEALTH-BASED CHAIN RANKING
// ═══════════════════════════════════════════════════════════════
//
// Post-processes a capability-selected fallback chain using live
// provider health metrics from the in-memory cache.
//
// Composite score (lower = better):
//   score = (latencyWeight × normalizedLatency)
//         + (failureWeight × failureRatio)
//         + (costWeight    × normalizedCost)
//         + (cooldownPenalty)
//
// The primary provider (chain[0]) from capability routing gets a
// bonus to preserve capability constraints (JSON→mistral, etc).

import { getHealthSnapshot, type ProviderHealthState } from "@/lib/javari/telemetry/provider-health";

const LATENCY_WEIGHT  = 0.35;
const FAILURE_WEIGHT  = 0.40;
const COST_WEIGHT     = 0.25;
const PRIMARY_BONUS   = -0.15;  // Negative = advantage for capability-selected primary
const COOLDOWN_PENALTY = 10.0;  // Massive penalty for providers in active cooldown
const QUARANTINE_PENALTY = 100.0; // Providers in quarantine are effectively eliminated

// Cost per 1K tokens — driven by model registry (no hardcoded map)
function getProviderCostForScoring(provider: string): number {
  return getProviderCost(provider);
}

export interface HealthRankedProvider {
  provider: string;
  score: number;
  breakdown: {
    latency_component: number;
    failure_component: number;
    cost_component: number;
    primary_bonus: boolean;
    in_cooldown: boolean;
    in_quarantine: boolean;
  };
  health?: {
    avg_latency_ms: number;
    success_rate: number;
    consecutive_failures: number;
  };
}

/**
 * Re-rank a fallback chain using live health metrics.
 *
 * Preserves capability constraints: if the chain was built for JSON
 * (mistral first), mistral gets a PRIMARY_BONUS that keeps it at the
 * top unless its health is significantly worse.
 *
 * NO DB queries — reads from the in-memory health cache only.
 * Safe for hot-path use on every request.
 */
export function applyHealthRanking(
  chain: string[]
): {
  ranked: string[];
  scores: HealthRankedProvider[];
  weights: { latency: number; failure: number; cost: number; primary_bonus: number; cooldown_penalty: number };
} {
  const snapshot = getHealthSnapshot();

  // If no health data yet (cold start), return chain unchanged
  if (snapshot.size === 0) {
    return {
      ranked: chain,
      scores: chain.map((p, i) => ({
        provider: p,
        score: i * 0.01,
        breakdown: {
          latency_component: 0,
          failure_component: 0,
          cost_component: 0,
          primary_bonus: i === 0,
          in_cooldown: false,
          in_quarantine: false,
        },
      })),
      weights: {
        latency: LATENCY_WEIGHT,
        failure: FAILURE_WEIGHT,
        cost: COST_WEIGHT,
        primary_bonus: PRIMARY_BONUS,
        cooldown_penalty: COOLDOWN_PENALTY,
      },
    };
  }

  const primary = chain[0]; // Capability-selected primary

  // Collect health for scoring
  const maxLatency = Math.max(
    ...chain.map((p) => snapshot.get(p)?.avg_latency_ms ?? 500),
    1 // Avoid division by zero
  );

  const scored: HealthRankedProvider[] = chain.map((provider) => {
    const h = snapshot.get(provider);
    const total = (h?.total_successes ?? 0) + (h?.total_failures ?? 0);
    const failureRatio = total > 0 ? (h?.total_failures ?? 0) / total : 0;
    const avgLatency = h?.avg_latency_ms ?? 500; // Unknown → assume 500ms
    const cost = getProviderCostForScoring(provider);
    const maxCost = Math.max(...chain.map(p => getProviderCostForScoring(p)), 0.001);

    // Normalize to 0–1
    const normalizedLatency = avgLatency / maxLatency;
    const normalizedCost = cost / maxCost;

    // Cooldown check
    const inCooldown = h?.cooldown_until
      ? new Date(h.cooldown_until).getTime() > Date.now()
      : false;

    // Quarantine check (burst-based, more severe than cooldown)
    const inQuarantine = (h as any)?.quarantined === true && (h as any)?.quarantine_until
      ? new Date((h as any).quarantine_until).getTime() > Date.now()
      : false;

    // Composite score
    let score =
      LATENCY_WEIGHT * normalizedLatency +
      FAILURE_WEIGHT * failureRatio +
      COST_WEIGHT * normalizedCost;

    // Bonuses / penalties
    if (provider === primary) score += PRIMARY_BONUS;
    if (inQuarantine) score += QUARANTINE_PENALTY;
    else if (inCooldown) score += COOLDOWN_PENALTY;

    return {
      provider,
      score,
      breakdown: {
        latency_component: Math.round(LATENCY_WEIGHT * normalizedLatency * 1000) / 1000,
        failure_component: Math.round(FAILURE_WEIGHT * failureRatio * 1000) / 1000,
        cost_component: Math.round(COST_WEIGHT * normalizedCost * 1000) / 1000,
        primary_bonus: provider === primary,
        in_cooldown: inCooldown,
        in_quarantine: inQuarantine,
      },
      health: h ? {
        avg_latency_ms: Math.round(h.avg_latency_ms),
        success_rate: total > 0 ? Math.round((h.total_successes / total) * 100) : 100,
        consecutive_failures: h.consecutive_failures,
      } : undefined,
    };
  });

  // Sort by score (ascending = better), alphabetical tie-breaker for determinism
  scored.sort((a, b) => a.score - b.score || a.provider.localeCompare(b.provider));

  return {
    ranked: scored.map((s) => s.provider),
    scores: scored,
    weights: {
      latency: LATENCY_WEIGHT,
      failure: FAILURE_WEIGHT,
      cost: COST_WEIGHT,
      primary_bonus: PRIMARY_BONUS,
      cooldown_penalty: COOLDOWN_PENALTY,
    },
  };
}
