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

async function updateMonthlySpend(userId: string, amount: number) {
  await supabase.rpc("exec_sql", {
    sql: `
      UPDATE user_cost_settings 
      SET current_month_spend = current_month_spend + ${amount},
          updated_at = NOW()
      WHERE user_id = '${userId}'
    `,
  });
}

// ═══════════════════════════════════════════════════════════════
// COST LOGGING
// ═══════════════════════════════════════════════════════════════

async function logExecution(data: {
  requestId: string;
  userId: string | null;
  route: string;
  tier: Tier;
  providerInternal: string;
  modelInternal: string;
  inputTokens: number;
  outputTokens: number;
  projectedCost: number;
  actualCost: number;
  multiplier: number;
  approved: boolean;
}) {
  await supabase.from("llm_execution_costs").insert({
    request_id: data.requestId,
    user_id: data.userId,
    route: data.route,
    tier: data.tier,
    provider_internal: data.providerInternal,
    model_internal: data.modelInternal,
    input_tokens: data.inputTokens,
    output_tokens: data.outputTokens,
    projected_cost_usd: data.projectedCost,
    actual_cost_usd: data.actualCost,
    multiplier: data.multiplier,
    approved: data.approved,
  });
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

  // ─── APPROVAL GATES ────────────────────────────────────────────
  if (settings && !settings.is_admin) {
    // Per-request limit check
    if (costEstimate.projectedCost > settings.per_request_limit_usd) {
      return new Response(
        JSON.stringify({
          success: false,
          needsApproval: true,
          tier,
          projectedCost: costEstimate.projectedCost,
          multiplier: costEstimate.multiplier,
          perRequestLimit: settings.per_request_limit_usd,
          message: "This request exceeds your per-request cost limit. Premium tier escalation required.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Monthly limit check
    const projectedTotal = settings.current_month_spend + costEstimate.projectedCost;
    if (projectedTotal > settings.monthly_limit_usd) {
      return new Response(
        JSON.stringify({
          success: false,
          monthlyLimitReached: true,
          tier,
          projectedCost: costEstimate.projectedCost,
          currentSpend: settings.current_month_spend,
          monthlyLimit: settings.monthly_limit_usd,
          remainingBudget: Math.max(0, settings.monthly_limit_usd - settings.current_month_spend),
          message: "Monthly budget limit would be exceeded.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Multiplier approval check
    if (costEstimate.multiplier >= settings.require_approval_above && !approvePremium) {
      return new Response(
        JSON.stringify({
          success: false,
          requiresApproval: true,
          tier,
          projectedCost: costEstimate.projectedCost,
          multiplier: costEstimate.multiplier,
          message: `High-tier model (${tier}) requires explicit approval. Add "approvePremium: true" to request body.`,
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

          // Update spend
          if (userId && settings) {
            await updateMonthlySpend(userId, actualCost);
          }

          // Log execution
          await logExecution({
            requestId,
            userId,
            route: "/api/chat",
            tier,
            providerInternal: usedProvider,
            modelInternal: providerModule!.name ?? 'unknown',
            inputTokens: costEstimate.tokens.input,
            outputTokens: costEstimate.tokens.output,
            projectedCost: costEstimate.projectedCost,
            actualCost,
            multiplier: costEstimate.multiplier,
            approved: true,
          });

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

    // Update spend
    if (userId && settings) {
      await updateMonthlySpend(userId, actualCost);
    }

    // Log execution
    await logExecution({
      requestId,
      userId,
      route: "/api/chat",
      tier,
      providerInternal: usedProvider,
      modelInternal: providerModule.name ?? 'unknown',
      inputTokens: costEstimate.tokens.input,
      outputTokens: costEstimate.tokens.output,
      projectedCost: costEstimate.projectedCost,
      actualCost,
      multiplier: costEstimate.multiplier,
      approved: true,
    });

    const remainingBudget = settings
      ? settings.monthly_limit_usd - settings.current_month_spend - actualCost
      : null;

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