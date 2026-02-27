// app/api/chat/route.ts
// Javari Chat API — v2.1 FINANCIAL CONTAINMENT
// 2026-02-27 — PHASE 1: Budget enforcement + cost tracking
//   - Monthly budget limits per user ($25 default)
//   - Pre-execution cost estimation
//   - Budget gate before AI call
//   - Provider identity hidden (tier exposure only)
//   - Preserved: streaming, fallback chain, existing response shape

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface ChatRequest {
  message?: string;
  messages?: Array<{ role: string; content: string }>;
  mode?: "single" | "super" | "advanced" | "roadmap";
  provider?: string;
  stream?: boolean;
  history?: Array<{ role: string; content: string }>;
}

// ── Supabase Client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Cost Estimation ───────────────────────────────────────────────────────────
function estimateRoughCost(provider: string, inputLength: number): number {
  // Rough token estimate: ~4 chars per token
  const baseTokenEstimate = Math.ceil(inputLength / 4);
  const avgOutputTokens = 300; // Conservative average
  
  // Cost per 1K tokens (rough averages)
  const pricing: Record<string, number> = {
    groq: 0.0001,       // FREE tier
    openai: 0.002,      // GPT-4o-mini
    anthropic: 0.003,   // Claude Sonnet
    mistral: 0.0015,    // Mistral Small
    openrouter: 0.0025, // Average
  };
  
  const per1k = pricing[provider] ?? 0.002;
  const totalTokens = baseTokenEstimate + avgOutputTokens;
  return (totalTokens / 1000) * per1k;
}

// ── Provider Tier Mapping ─────────────────────────────────────────────────────
function getProviderTier(provider: string): string {
  if (provider === "groq") return "free";
  if (provider === "anthropic") return "advanced";
  return "standard";
}

// ── Budget Enforcement ────────────────────────────────────────────────────────
async function checkAndUpdateBudget(
  userId: string,
  estimatedCost: number
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  // Get or create user budget
  const { data: budget, error: fetchError } = await supabase
    .from("user_budgets")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (fetchError || !budget) {
    // Create default budget for new user
    const { data: newBudget, error: createError } = await supabase
      .from("user_budgets")
      .insert({
        user_id: userId,
        monthly_limit_usd: 25.0,
        current_spend_usd: 0,
      })
      .select()
      .single();

    if (createError || !newBudget) {
      // If creation fails, allow request but log warning
      console.warn(`[BUDGET] Failed to create budget for ${userId}`);
      return { allowed: true, remaining: 25.0, limit: 25.0 };
    }

    return { allowed: true, remaining: 25.0, limit: 25.0 };
  }

  // Check if budget would be exceeded
  const wouldExceed =
    budget.current_spend_usd + estimatedCost > budget.monthly_limit_usd;

  if (wouldExceed) {
    return {
      allowed: false,
      remaining: Math.max(0, budget.monthly_limit_usd - budget.current_spend_usd),
      limit: budget.monthly_limit_usd,
    };
  }

  // Budget OK - will update after successful response
  return {
    allowed: true,
    remaining: budget.monthly_limit_usd - budget.current_spend_usd - estimatedCost,
    limit: budget.monthly_limit_usd,
  };
}

async function incrementSpend(userId: string, actualCost: number): Promise<void> {
  await supabase.rpc("exec_sql", {
    sql: `
      UPDATE user_budgets 
      SET current_spend_usd = current_spend_usd + ${actualCost},
          updated_at = NOW()
      WHERE user_id = '${userId}'
    `,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── GET USER ID ───────────────────────────────────────────────────────────────
async function getUserId(req: NextRequest): Promise<string | null> {
  // Try to get from auth header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data } = await supabase.auth.getUser(token);
    if (data?.user?.id) return data.user.id;
  }

  // Fallback: use first user from profiles (for testing)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);
  
  if (profiles && profiles.length > 0) {
    return profiles[0].id;
  }

  return null;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const t0 = Date.now();

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
  } = body;

  if (!message) {
    return errorResponse("Please provide a message");
  }

  // ── BUDGET ENFORCEMENT ──────────────────────────────────────────────────────
  const userId = await getUserId(req);
  
  if (userId) {
    const estimatedCost = estimateRoughCost(requestedProvider, message.length);
    const budgetCheck = await checkAndUpdateBudget(userId, estimatedCost);

    if (!budgetCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "MONTHLY_BUDGET_EXCEEDED",
          message: `Monthly budget exceeded. Remaining: $${budgetCheck.remaining.toFixed(4)} of $${budgetCheck.limit.toFixed(2)}`,
          budgetInfo: {
            limit: budgetCheck.limit,
            remaining: budgetCheck.remaining,
            exceeded: true,
          },
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ── Resolve provider ──────────────────────────────────────────────────────
  let providerModule: Awaited<ReturnType<typeof import("@/lib/javari/providers").getProvider>> | null = null;
  let usedProvider = requestedProvider;

  const providerPriority = [requestedProvider, "groq", "openai", "anthropic", "mistral", "openrouter"];
  const seen = new Set<string>();

  for (const p of providerPriority) {
    if (seen.has(p)) continue;
    seen.add(p);
    try {
      const { getProvider, getProviderApiKey } = await import("@/lib/javari/providers");
      const key = getProviderApiKey(p as Parameters<typeof getProviderApiKey>[0]);
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

  const tier = getProviderTier(usedProvider);
  const estimatedCost = estimateRoughCost(usedProvider, message.length);

  // ── STREAMING PATH ────────────────────────────────────────────────────────
  if (wantsStream) {
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const enqueue = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Controller closed
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

          // Update budget after successful response
          if (userId) {
            await incrementSpend(userId, estimatedCost);
          }

          enqueue({
            done: true,
            response: fullText,
            tier, // CHANGED: tier instead of provider
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

  // ── BUFFERED PATH ─────────────────────────────────────────────────────────
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

    // Update budget after successful response
    if (userId) {
      await incrementSpend(userId, estimatedCost);
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: fullText,
        tier, // CHANGED: tier instead of provider
        latency: elapsed,
        estimatedCost: estimatedCost.toFixed(6),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return errorResponse(err?.message || "Provider error", 500);
  }
}
