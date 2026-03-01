// app/api/chat/route.ts
// Javari Chat API — v3 AUTONOMOUS COST-AWARE ORCHESTRATION
// 2026-02-27 — Full implementation:
//   - Tier-based cost multipliers
//   - Real-time approval gates
//   - Monthly + per-request limits
//   - Full cost transparency
//   - Admin bypass
//   - Preserved: streaming, fallback chain, no provider exposure

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
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
  approvePremium?: boolean; // Explicit approval for high-tier
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

// Base cost per 1K tokens (approximate)
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
  const outputTokens = 300; // Conservative estimate
  
  const baseCost = BASE_COSTS[provider] || 0.001;
  const totalTokens = inputTokens + outputTokens;
  const providerCost = (totalTokens / 1000) * baseCost;
  
  const multiplier = TIER_MULTIPLIERS[tier];
  const projectedCost = providerCost * multiplier;
  
  return {
    projectedCost,
    multiplier,
    tokens: { input: inputTokens, output: outputTokens },
  };
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
    // Create default settings
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

// [CONSOLIDATED] updateMonthlySpend removed — handled by budget-governor.ts

// ═══════════════════════════════════════════════════════════════
// COST LOGGING
// ═══════════════════════════════════════════════════════════════

// [CONSOLIDATED] logExecution removed — cost logging via:
//   router-telemetry.ts → ai_router_executions (per-execution)
//   budget-governor.ts → ai_budget_state (aggregated spend)

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

  // Fallback for testing
  const { data: profiles } = await supabase.from("profiles").select("id").limit(1);
  return profiles && profiles.length > 0 ? profiles[0].id : null;
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

  // Check system pause (kill switch)
  if (process.env.JAVARI_AUTONOMY_PAUSED === "1") {
    return new Response(
      JSON.stringify({ success: false, systemPaused: true, message: "System maintenance in progress" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── USER & COST SETTINGS ──────────────────────────────────────
  const userId = await getUserId(req);
  const settings = userId ? await getUserCostSettings(userId) : null;

  // ─── PROVIDER RESOLUTION ───────────────────────────────────────
  let providerModule: Awaited<ReturnType<typeof import("@/lib/javari/providers").getProvider>> | null = null;
  let usedProvider = requestedProvider;

  const providerPriority = [requestedProvider, "groq", "openai", "anthropic", "mistral", "openrouter"];
  const seen = new Set<string>();

  for (const p of providerPriority) {
    if (seen.has(p)) continue;
    seen.add(p);
    // Skip providers in cooldown
    if (!(await isProviderAvailable(p))) continue;
    try {
      const { getProvider, getProviderApiKey } = await import("@/lib/javari/providers");
      const key = await getProviderApiKey(p as Parameters<typeof getProviderApiKey>[0]);
      if (!key) continue;
      providerModule = getProvider(p as Parameters<typeof getProvider>[0], key);
      usedProvider = p;
      break;
    } catch {
      continue;
    }
  }

  if (!providerModule) {
    return errorResponse("No AI provider available. Check API keys.");
  }

  const tier = getTier(usedProvider);
  const costEstimate = estimateCost(usedProvider, message.length, tier);

  // ─── BUDGET GOVERNOR ──────────────────────────────────────────
  const budgetCheck = await checkBudgetBeforeExecution(userId, costEstimate.projectedCost);
  if (!budgetCheck.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "budget_exceeded",
        scope: budgetCheck.scope,
        period: budgetCheck.period,
        currentSpend: budgetCheck.currentSpend,
        limit: budgetCheck.limit,
        reason: budgetCheck.reason,
        tier,
        projectedCost: costEstimate.projectedCost,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  // Multiplier approval (orthogonal to budget)
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
          } catch {
            // Closed
          }
        };

        try {
          const stream = providerModule!.generateStream(message, {
            maxTokens: 2000,
            temperature: 0.7,
          });

          let fullText = "";
          for await (const chunk of stream) {
            if (chunk) {
              fullText += chunk;
              enqueue({ token: chunk, done: false });
            }
          }

          const elapsed = Date.now() - t0;
          const actualCost = costEstimate.projectedCost; // In production, calculate from actual tokens

          // Budget governor — record spend (fire-and-forget)
          recordBudgetAfterExecution(userId, actualCost);

          const remainingBudget = settings
            ? settings.monthly_limit_usd - settings.current_month_spend - actualCost
            : null;

          enqueue({
            done: true,
            response: fullText,
            tier,
            projected_cost_usd: costEstimate.projectedCost,
            actual_cost_usd: actualCost,
            multiplier: costEstimate.multiplier,
            cumulative_month_spend: settings ? settings.current_month_spend + actualCost : null,
            remaining_month_budget: remainingBudget,
            latency: elapsed,
            success: true,
          });

          controller.close();
        } catch (err: any) {
          enqueue({
            error: err?.message || "Stream error",
            done: true,
            success: false,
          });
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
    const stream = providerModule.generateStream(message, {
      maxTokens: 2000,
      temperature: 0.7,
    });

    let fullText = "";
    for await (const chunk of stream) {
      if (chunk) fullText += chunk;
    }

    const elapsed = Date.now() - t0;
    const actualCost = costEstimate.projectedCost;

    // Budget governor — record spend (fire-and-forget)
    recordBudgetAfterExecution(userId, actualCost);

    const remainingBudget = settings
      ? settings.monthly_limit_usd - settings.current_month_spend - actualCost
      : null;

    // Provider health — fire and forget
    updateProviderHealth(usedProvider, true, elapsed);

    // Router telemetry — fire and forget, never blocks response
    recordRouterExecution({
      tier,
      provider: usedProvider,
      model: providerModule.name ?? 'unknown',
      prompt_tokens: costEstimate.tokens.input,
      completion_tokens: costEstimate.tokens.output,
      total_tokens: costEstimate.tokens.input + costEstimate.tokens.output,
      cost: actualCost,
      latency_ms: elapsed,
      retries: 0,
      success: true,
      user_id: userId ?? undefined,
    });

    return new Response(
      JSON.stringify({
        success: true,
        response: fullText,
        tier,
        projected_cost_usd: costEstimate.projectedCost,
        actual_cost_usd: actualCost,
        multiplier: costEstimate.multiplier,
        cumulative_month_spend: settings ? settings.current_month_spend + actualCost : null,
        remaining_month_budget: remainingBudget,
        latency: elapsed,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Provider health — record failure
    if (usedProvider) {
      updateProviderHealth(usedProvider, false, Date.now() - t0, classifyError(err));
    }

    // Telemetry for failures
    recordRouterExecution({
      tier: tier ?? 'unknown',
      provider: usedProvider ?? 'none',
      latency_ms: Date.now() - t0,
      success: false,
      error_type: classifyError(err),
      user_id: userId ?? undefined,
    });
    return errorResponse(err?.message || "Provider error", 500);
  }
}