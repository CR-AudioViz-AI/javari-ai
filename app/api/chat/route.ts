// app/api/chat/route.ts
// Javari Chat API — v4 UNIFIED SMART ROUTING
// 2026-03-01 — Replaced hardcoded provider loop with analyzeRoutingContext
//   - Context-aware provider selection based on prompt complexity
//   - Smart fallback chain from routing-context (not static list)
//   - Output validation via isOutputMalformed
//   - Preserved: streaming, tier system, budget gates, telemetry

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { analyzeRoutingContext, applyHealthRanking, ROUTING_ENGINE_VERSION, getRegistryVersion } from "@/lib/javari/multi-ai/routing-context";
import { isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import { recordRouterExecution, classifyError } from "@/lib/javari/telemetry/router-telemetry";
import { isProviderAvailable, updateProviderHealth } from "@/lib/javari/telemetry/provider-health";
import { checkBudgetBeforeExecution, recordBudgetAfterExecution } from "@/lib/javari/telemetry/budget-governor";

export const runtime = "nodejs";

interface ChatRequest {
  message?: string;
  messages?: Array<{ role: string; content: string }>;
  mode?: "single" | "super" | "advanced" | "roadmap";
  provider?: string;
  stream?: boolean;
  history?: Array<{ role: string; content: string }>;
  approvePremium?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════
// TIER CONFIGURATION
// ═══════════════════════════════════════════════════════════════

type Tier = "free" | "low" | "mid" | "high";

const PROVIDER_TIER_MAP: Record<string, Tier> = {
  groq: "free",
  "openrouter-free": "free",
  "mistral-small": "low",
  "openai-mini": "low",
  mistral: "mid",
  openai: "mid",
  "openrouter-mid": "mid",
  anthropic: "high",
  "openrouter-premium": "high",
};

const TIER_MULTIPLIERS: Record<Tier, number> = {
  free: 1.0,
  low: 1.5,
  mid: 2.5,
  high: 4.0,
};

const BASE_COSTS: Record<string, number> = {
  groq: 0.0,
  "openai-mini": 0.00015,
  "mistral-small": 0.0002,
  openai: 0.003,
  mistral: 0.002,
  anthropic: 0.003,
  openrouter: 0.001,
};

// ═══════════════════════════════════════════════════════════════
// COST CALCULATION
// ═══════════════════════════════════════════════════════════════

function estimateCost(
  provider: string,
  inputLength: number,
  tier: Tier
): { projectedCost: number; multiplier: number; tokens: { input: number; output: number } } {
  const inputTokens = Math.ceil(inputLength / 4);
  const outputTokens = 300;

  const baseCost = BASE_COSTS[provider] || 0.001;
  const totalTokens = inputTokens + outputTokens;
  const providerCost = (totalTokens / 1000) * baseCost;

  const multiplier = TIER_MULTIPLIERS[tier];
  const projectedCost = providerCost * multiplier;

  return { projectedCost, multiplier, tokens: { input: inputTokens, output: outputTokens } };
}

// ═══════════════════════════════════════════════════════════════
// USER COST SETTINGS
// ═══════════════════════════════════════════════════════════════

async function getUserCostSettings(userId: string) {
  const { data, error } = await supabase
    .from("user_cost_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    const { data: newSettings } = await supabase
      .from("user_cost_settings")
      .insert({
        user_id: userId,
        monthly_limit_usd: 100.0,
        per_request_limit_usd: 5.0,
        auto_approve_multiplier_below: 1.0,
        require_approval_above: 2.0,
        current_month_spend: 0,
        is_admin: false,
      })
      .select()
      .single();

    return newSettings || {
      monthly_limit_usd: 100.0,
      per_request_limit_usd: 5.0,
      auto_approve_multiplier_below: 1.0,
      require_approval_above: 2.0,
      current_month_spend: 0,
      is_admin: false,
    };
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function errorResponse(msg: string, status = 200) {
  return new Response(
    JSON.stringify({ success: false, response: msg, error: msg }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

function extractMessage(body: ChatRequest): string {
  if (body.message && typeof body.message === "string") return body.message.trim();
  if (Array.isArray(body.messages)) {
    const last = [...body.messages].reverse().find((m) => m.role === "user");
    if (last?.content) return last.content.trim();
  }
  return "";
}

function getTier(provider: string): Tier {
  return PROVIDER_TIER_MAP[provider] || "mid";
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data } = await supabase.auth.getUser(token);
    if (data?.user?.id) return data.user.id;
  }
  const { data: profiles } = await supabase.from("profiles").select("id").limit(1);
  return profiles && profiles.length > 0 ? profiles[0].id : null;
}

// ═══════════════════════════════════════════════════════════════
// PROVIDER RESOLUTION — SMART ROUTING
// ═══════════════════════════════════════════════════════════════

async function resolveProvider(
  message: string,
  mode: ChatRequest["mode"],
  requestedProvider: string
): Promise<{
  providerModule: Awaited<ReturnType<typeof import("@/lib/javari/providers").getProvider>>;
  usedProvider: string;
  fallbackChain: string[];
  routingReason: string;
  complexityScore: number;
  healthScores: ReturnType<typeof applyHealthRanking>["scores"];
  routingWeights: ReturnType<typeof applyHealthRanking>["weights"];
  primaryHint: string;
  capabilityOverride: string | null;
}> {
  // Step 1: Analyze prompt for capability-based routing
  const ctx = analyzeRoutingContext(message, mode ?? "single", requestedProvider);

  // Step 2: Re-rank chain by live health metrics (no DB query)
  const { ranked, scores, weights } = applyHealthRanking(ctx.fallback_chain);

  const { getProvider, getProviderApiKey } = await import("@/lib/javari/providers");

  for (const pName of ranked) {
    if (!(await isProviderAvailable(pName))) continue;

    try {
      const key = await getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
      if (!key) continue;
      const providerModule = getProvider(pName as Parameters<typeof getProvider>[0], key);
      return {
        providerModule,
        usedProvider: pName,
        fallbackChain: ranked,
        routingReason: `Adaptive: ${ctx.primary_provider_hint}→${pName} (complexity=${ctx.complexity_score}, score=${scores.find(s => s.provider === pName)?.score.toFixed(3) ?? "?"})`,
        complexityScore: ctx.complexity_score,
        healthScores: scores,
        routingWeights: weights,
        primaryHint: ctx.primary_provider_hint,
        capabilityOverride: ctx.requires_json ? "requires_json" : ctx.requires_reasoning_depth ? "requires_reasoning" : null,
      };
    } catch {
      continue;
    }
  }

  throw new Error("No AI provider available");
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE + COLLECT — shared by stream and buffered paths
// ═══════════════════════════════════════════════════════════════

async function executeAndCollect(
  providerModule: Awaited<ReturnType<typeof import("@/lib/javari/providers").getProvider>>,
  message: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const gen = providerModule.generateStream(message, {
    maxTokens: 2000,
    temperature: 0.7,
  });

  let fullText = "";
  for await (const chunk of gen) {
    if (chunk) {
      fullText += chunk;
      if (onChunk) onChunk(chunk);
    }
  }

  return fullText;
}

// ═══════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const requestId = randomUUID();

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON in request body");
  }

  const message = extractMessage(body);
  const {
    mode = "single",
    provider: requestedProvider = "groq",
    stream: wantsStream = false,
    approvePremium = false,
  } = body;

  if (!message) {
    return errorResponse("Please provide a message");
  }

  if (process.env.JAVARI_AUTONOMY_PAUSED === "1") {
    return new Response(
      JSON.stringify({ success: false, systemPaused: true, message: "System maintenance in progress" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── USER & COST SETTINGS ──────────────────────────────────────
  const userId = await getUserId(req);
  const settings = userId ? await getUserCostSettings(userId) : null;

  // ─── SMART PROVIDER RESOLUTION ─────────────────────────────────
  let resolved: Awaited<ReturnType<typeof resolveProvider>>;
  try {
    resolved = await resolveProvider(message, mode, requestedProvider);
  } catch {
    return errorResponse("No AI provider available. Check API keys.");
  }

  const { providerModule, usedProvider, fallbackChain, routingReason, complexityScore, healthScores, routingWeights, primaryHint, capabilityOverride } = resolved;
  const tier = getTier(usedProvider);
  const costEstimate = estimateCost(usedProvider, message.length, tier);

  // ─── VELOCITY GUARDRAIL ────────────────────────────────────────
  const budgetCheck = await checkBudgetBeforeExecution(userId, costEstimate.projectedCost);
  if (!budgetCheck.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "velocity_throttle",
        reason: budgetCheck.reason,
        escalation_level: budgetCheck.escalation_level,
        anomaly_score: budgetCheck.anomaly_score,
        spend_last_60s: budgetCheck.spend_last_60s,
        requests_last_60s: budgetCheck.requests_last_60s,
        throttle_seconds: budgetCheck.throttle_seconds,
        tier,
        projectedCost: costEstimate.projectedCost,
        message: budgetCheck.reason === "emergency_stop"
          ? "Platform spending paused by administrator."
          : budgetCheck.reason === "per_request_ceiling"
            ? "This request exceeds the per-request cost ceiling."
            : `Anomalous velocity detected (score: ${budgetCheck.anomaly_score}). Throttled for ${budgetCheck.throttle_seconds}s.`,
      }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(budgetCheck.throttle_seconds ?? 60) } }
    );
  }

  // Multiplier approval gate
  if (settings && !settings.is_admin) {
    if (costEstimate.multiplier >= (settings.require_approval_above ?? 2.0) && !approvePremium) {
      return new Response(
        JSON.stringify({
          success: false,
          requiresApproval: true,
          tier,
          projectedCost: costEstimate.projectedCost,
          multiplier: costEstimate.multiplier,
          message: `High-tier model (${tier}) requires explicit approval.`,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ─── STREAMING PATH ────────────────────────────────────────────
  if (wantsStream) {
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const enqueue = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* client disconnected */ }
        };

        try {
          const fullText = await executeAndCollect(providerModule, message, (chunk) => {
            enqueue({ token: chunk, done: false });
          });

          const elapsed = Date.now() - t0;
          const actualCost = costEstimate.projectedCost;
          const malformed = isOutputMalformed(fullText);

          recordBudgetAfterExecution(userId, actualCost);
          updateProviderHealth(usedProvider, !malformed, elapsed);
          recordRouterExecution({
            tier,
            provider: usedProvider,
            prompt_tokens: costEstimate.tokens.input,
            completion_tokens: costEstimate.tokens.output,
            cost: actualCost,
            latency_ms: elapsed,
            success: !malformed,
            user_id: userId ?? undefined,
            routing_version: ROUTING_ENGINE_VERSION,
            registry_version: getRegistryVersion(),
            routing_primary: primaryHint,
            routing_chain: fallbackChain,
            routing_scores: Object.fromEntries(healthScores.map(s => [s.provider, Math.round(s.score * 1000) / 1000])),
            routing_weights: routingWeights,
            capability_override: capabilityOverride ?? undefined,
          });

          const remainingBudget = settings
            ? settings.monthly_limit_usd - settings.current_month_spend - actualCost
            : null;

          enqueue({
            done: true,
            response: fullText,
            tier,
            routing: routingReason,
            routing_version: ROUTING_ENGINE_VERSION,
            registry_version: getRegistryVersion(),
            complexity_score: complexityScore,
            fallback_chain: fallbackChain,
            projected_cost_usd: costEstimate.projectedCost,
            actual_cost_usd: actualCost,
            multiplier: costEstimate.multiplier,
            cumulative_month_spend: settings ? settings.current_month_spend + actualCost : null,
            remaining_month_budget: remainingBudget,
            latency: elapsed,
            success: true,
            output_valid: !malformed,
          });

          controller.close();
        } catch (err: any) {
          updateProviderHealth(usedProvider, false, Date.now() - t0, classifyError(err));
          enqueue({ error: err?.message || "Stream error", done: true, success: false });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ─── BUFFERED PATH ─────────────────────────────────────────────
  try {
    const fullText = await executeAndCollect(providerModule, message);

    const elapsed = Date.now() - t0;
    const actualCost = costEstimate.projectedCost;
    const malformed = isOutputMalformed(fullText);

    recordBudgetAfterExecution(userId, actualCost);
    updateProviderHealth(usedProvider, !malformed, elapsed);
    recordRouterExecution({
      tier,
      provider: usedProvider,
      prompt_tokens: costEstimate.tokens.input,
      completion_tokens: costEstimate.tokens.output,
      total_tokens: costEstimate.tokens.input + costEstimate.tokens.output,
      cost: actualCost,
      latency_ms: elapsed,
      success: !malformed,
      user_id: userId ?? undefined,
      routing_version: ROUTING_ENGINE_VERSION,
      registry_version: getRegistryVersion(),
      routing_primary: primaryHint,
      routing_chain: fallbackChain,
      routing_scores: Object.fromEntries(healthScores.map(s => [s.provider, Math.round(s.score * 1000) / 1000])),
      routing_weights: routingWeights,
      capability_override: capabilityOverride ?? undefined,
    });

    const remainingBudget = settings
      ? settings.monthly_limit_usd - settings.current_month_spend - actualCost
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        response: fullText,
        tier,
        routing: routingReason,
        routing_version: ROUTING_ENGINE_VERSION,
        registry_version: getRegistryVersion(),
        complexity_score: complexityScore,
        fallback_chain: fallbackChain,
        health_ranking: healthScores,
        projected_cost_usd: costEstimate.projectedCost,
        actual_cost_usd: actualCost,
        multiplier: costEstimate.multiplier,
        cumulative_month_spend: settings ? settings.current_month_spend + actualCost : null,
        remaining_month_budget: remainingBudget,
        latency: elapsed,
        output_valid: !malformed,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    updateProviderHealth(usedProvider, false, Date.now() - t0, classifyError(err));
    recordRouterExecution({
      tier,
      provider: usedProvider,
      latency_ms: Date.now() - t0,
      success: false,
      error_type: classifyError(err),
      user_id: userId ?? undefined,
      routing_version: ROUTING_ENGINE_VERSION,
      registry_version: getRegistryVersion(),
      routing_primary: primaryHint,
      routing_chain: fallbackChain,
      routing_scores: Object.fromEntries(healthScores.map(s => [s.provider, Math.round(s.score * 1000) / 1000])),
      routing_weights: routingWeights,
      capability_override: capabilityOverride ?? undefined,
    });
    return errorResponse(err?.message || "Provider error", 500);
  }
}
