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

  // ── Provider + model selection hints ─────────────────────────────────────
  let primary_provider_hint: string;
  let primary_model_hint: string;
  let fallback_chain: string[];
  let estimated_cost_usd: number;

  if (requires_json) {
    // JSON-mode: Mistral first (best strict JSON compliance)
    primary_provider_hint = "mistral";
    primary_model_hint    = "mistral-large-latest";
    fallback_chain        = ["mistral", "openai", "anthropic", "groq"];
    estimated_cost_usd    = 0.008;
  } else if (requires_reasoning_depth) {
    // Reasoning: o4-mini first, o3 for extreme cases, then GPT-4o
    // Note: o3 / o4-mini availability gated at runtime via vault key check
    primary_provider_hint = "openai";
    primary_model_hint    = complexity_score >= 80 ? "o3" : "o4-mini";
    fallback_chain        = ["openai", "anthropic", "groq", "mistral"];
    estimated_cost_usd    = complexity_score >= 80 ? 0.25 : 0.05;
  } else if (is_bulk_task && !high_risk) {
    // Bulk/cheap tasks: Groq Llama (free tier)
    primary_provider_hint = "groq";
    primary_model_hint    = "llama-3.1-70b-versatile";
    fallback_chain        = ["groq", "openrouter", "openai", "anthropic"];
    estimated_cost_usd    = 0.0;
  } else {
    // Default: Groq for speed/cost, then fallback
    primary_provider_hint = requestedProvider ?? "groq";
    primary_model_hint    = "llama-3.1-70b-versatile";
    fallback_chain        = ["groq", "openai", "anthropic", "mistral", "openrouter", "xai", "perplexity"];
    estimated_cost_usd    = 0.001;
  }

  // Honor explicit provider request (unless overridden by hard requirements)
  if (requestedProvider && !requires_json && !requires_reasoning_depth) {
    primary_provider_hint = requestedProvider;
    // Move requested provider to front of chain, keep rest
    fallback_chain = [
      requestedProvider,
      ...fallback_chain.filter((p) => p !== requestedProvider),
    ];
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

// Approximate cost per 1K tokens by provider (for scoring only)
const PROVIDER_COST_MAP: Record<string, number> = {
  groq:       0.0,
  openrouter: 0.001,
  mistral:    0.002,
  openai:     0.003,
  anthropic:  0.003,
  xai:        0.002,
  perplexity: 0.002,
};

export interface HealthRankedProvider {
  provider: string;
  score: number;
  breakdown: {
    latency_component: number;
    failure_component: number;
    cost_component: number;
    primary_bonus: boolean;
    in_cooldown: boolean;
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
): { ranked: string[]; scores: HealthRankedProvider[] } {
  const snapshot = getHealthSnapshot();

  // If no health data yet (cold start), return chain unchanged
  if (snapshot.size === 0) {
    return {
      ranked: chain,
      scores: chain.map((p, i) => ({
        provider: p,
        score: i * 0.01, // Preserve original order
        breakdown: {
          latency_component: 0,
          failure_component: 0,
          cost_component: 0,
          primary_bonus: i === 0,
          in_cooldown: false,
        },
      })),
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
    const cost = PROVIDER_COST_MAP[provider] ?? 0.002;
    const maxCost = Math.max(...Object.values(PROVIDER_COST_MAP), 0.001);

    // Normalize to 0–1
    const normalizedLatency = avgLatency / maxLatency;
    const normalizedCost = cost / maxCost;

    // Cooldown check
    const inCooldown = h?.cooldown_until
      ? new Date(h.cooldown_until).getTime() > Date.now()
      : false;

    // Composite score
    let score =
      LATENCY_WEIGHT * normalizedLatency +
      FAILURE_WEIGHT * failureRatio +
      COST_WEIGHT * normalizedCost;

    // Bonuses / penalties
    if (provider === primary) score += PRIMARY_BONUS;
    if (inCooldown) score += COOLDOWN_PENALTY;

    return {
      provider,
      score,
      breakdown: {
        latency_component: Math.round(LATENCY_WEIGHT * normalizedLatency * 1000) / 1000,
        failure_component: Math.round(FAILURE_WEIGHT * failureRatio * 1000) / 1000,
        cost_component: Math.round(COST_WEIGHT * normalizedCost * 1000) / 1000,
        primary_bonus: provider === primary,
        in_cooldown: inCooldown,
      },
      health: h ? {
        avg_latency_ms: Math.round(h.avg_latency_ms),
        success_rate: total > 0 ? Math.round((h.total_successes / total) * 100) : 100,
        consecutive_failures: h.consecutive_failures,
      } : undefined,
    };
  });

  // Sort by score (ascending = better)
  scored.sort((a, b) => a.score - b.score);

  return {
    ranked: scored.map((s) => s.provider),
    scores: scored,
  };
}
