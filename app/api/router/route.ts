// app/api/router/route.ts
// Javari /api/router — Routing Decision Inspector & Smart Dispatcher
// 2026-02-20 — STEP 1 implementation
//
// Endpoints:
//   POST /api/router       → Route a message and optionally execute
//   GET  /api/router       → Return routing health + stats
//
// Request body (POST):
//   {
//     message:   string          // required
//     mode?:     single|super|advanced|roadmap|council
//     provider?: string          // optional preferred provider
//     execute?:  boolean         // if true, actually call the model (default: true)
//     stream?:   boolean         // if true, return SSE stream
//   }
//
// Response (POST, execute=false — inspect only):
//   {
//     success:        true
//     routing:        { provider, model, reason, requires_*, complexity_score, ... }
//     fallback_chain: string[]
//   }
//
// Response (POST, execute=true — stream=false):
//   {
//     success:  true
//     response: string
//     routing:  { ... }
//   }
//
// Response (POST, execute=true — stream=true):
//   SSE stream: data: { type, content, routing }

import { NextRequest } from "next/server";
import { analyzeRoutingContext, applyHealthRanking, ROUTING_ENGINE_VERSION, getRegistryVersion } from "@/lib/javari/multi-ai/routing-context";
import { routeRequest, buildFallbackChain, globalRouterLogger } from "@/lib/javari/multi-ai/router";
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import { recordRouterExecution, classifyError } from "@/lib/javari/telemetry/router-telemetry";
import { isProviderAvailable, updateProviderHealth } from "@/lib/javari/telemetry/provider-health";
import { checkBudgetBeforeExecution, recordBudgetAfterExecution } from "@/lib/javari/telemetry/budget-governor";

export const runtime = "nodejs";

// ── GET — health + stats ──────────────────────────────────────────────────────

export async function GET() {
  const stats = globalRouterLogger.getStats();
  return new Response(
    JSON.stringify({
      success: true,
      status: "operational",
      engine: "v2",
      timestamp: new Date().toISOString(),
      stats,
      capabilities: [
        "reasoning_depth_routing",
        "json_mode_routing",
        "cost_optimization",
        "validator_stage",
        "fallback_chain",
        "streaming",
      ],
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ── POST — route + (optionally) execute ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  let body: {
    message?: string;
    mode?: "single" | "super" | "advanced" | "roadmap" | "council";
    provider?: string;
    execute?: boolean;
    stream?: boolean;
    history?: Array<{ role: string; content: string }>;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const message = body.message?.trim() ?? "";
  if (!message) {
    return new Response(
      JSON.stringify({ success: false, error: "message is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const mode     = body.mode     ?? "single";
  const execute  = body.execute  ?? true;
  const stream   = body.stream   ?? false;

  // ── 1. Analyze routing context ──────────────────────────────────────────
  const ctx = analyzeRoutingContext(message, mode, body.provider);
  const { ranked: healthRankedChain, scores: healthScores, weights: healthWeights } = applyHealthRanking(ctx.fallback_chain);
  const decision = routeRequest({ prompt: message, mode });

  // Log the decision
  globalRouterLogger.log({ prompt: message, mode }, decision);

  // ── 2. Inspect-only mode ────────────────────────────────────────────────
  if (!execute) {
    return new Response(
      JSON.stringify({
        success: true,
        routing: {
          provider:                 ctx.primary_provider_hint,
          model:                    ctx.primary_model_hint,
          reason:                   decision.reason,
          requires_reasoning_depth: ctx.requires_reasoning_depth,
          requires_json:            ctx.requires_json,
          requires_validation:      ctx.requires_validation,
          high_risk:                ctx.high_risk,
          cost_sensitivity:         ctx.cost_sensitivity,
          complexity_score:         ctx.complexity_score,
          word_count:               ctx.word_count,
          is_bulk_task:             ctx.is_bulk_task,
          has_multi_step:           ctx.has_multi_step,
          estimated_cost_usd:       ctx.estimated_cost_usd,
          confidence:               decision.confidence,
        },
        fallback_chain: healthRankedChain,
        health_ranking: healthScores,
        durationMs: Date.now() - t0,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 3. Velocity guardrail ────────────────────────────────────────────────
  const budgetCheck = await checkBudgetBeforeExecution(null, ctx.estimated_cost_usd ?? 0.01);
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
      }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(budgetCheck.throttle_seconds ?? 60) } }
    );
  }

  // ── 4. Execute with routing logic ───────────────────────────────────────

  // Build system prompt hint for JSON mode
  const jsonInstruction = ctx.requires_json
    ? "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no backticks, no prose outside JSON."
    : "";

  // ── STREAMING PATH ──────────────────────────────────────────────────────
  if (stream) {
    const encoder = new TextEncoder();
    const chain   = healthRankedChain;

    const readable = new ReadableStream({
      async start(controller) {
        const enq = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* client disconnected */ }
        };

        // Emit routing metadata immediately so client knows what's happening
        enq({
          type: "routing",
          routing: {
            provider:    ctx.primary_provider_hint,
            model:       ctx.primary_model_hint,
            requires_reasoning: ctx.requires_reasoning_depth,
            requires_json:      ctx.requires_json,
            complexity:         ctx.complexity_score,
          },
        });

        let success = false;

        for (const pName of chain) {
          let apiKey: string;
          try {
            apiKey = await getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
          } catch {
            enq({ type: "fallback", from: pName, reason: "key_missing" });
            continue;
          }

          try {
            const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);
            const gen = provider.generateStream(message + jsonInstruction, {
              preferredModel: pName === chain[0] ? ctx.primary_model_hint : undefined,
            });

            let accumulated = "";

            const iter = (gen as AsyncIterable<string>)[Symbol.asyncIterator]
              ? (gen as AsyncIterable<string>)[Symbol.asyncIterator]()
              : (gen as AsyncIterator<string>);

            for (;;) {
              const { done, value } = await iter.next();
              if (done) break;
              if (!value) continue;
              accumulated += value;
              enq({ type: "delta", content: value });
            }

            if (isOutputMalformed(accumulated)) {
              enq({ type: "fallback", from: pName, reason: "malformed_output" });
              continue;
            }

            enq({
              type: "done",
              content: accumulated,
              provider: pName,
              model: pName === chain[0] ? ctx.primary_model_hint : undefined,
              durationMs: Date.now() - t0,
            });
            success = true;
            break;

          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            enq({ type: "fallback", from: pName, reason: msg.slice(0, 100) });
          }
        }

        if (!success) {
          enq({ type: "error", error: "All providers exhausted" });
        }

        try { controller.close(); } catch { /* already closed */ }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  }

  // ── BUFFERED PATH ───────────────────────────────────────────────────────
  const chain = healthRankedChain;
  let response = "";
  let usedProvider = "";

  for (const pName of chain) {
    // Skip providers in cooldown
    if (!(await isProviderAvailable(pName))) continue;

    let apiKey: string;
    try {
      apiKey = await getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
    } catch { continue; }

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);
      const gen = provider.generateStream(message + jsonInstruction, {
        preferredModel: pName === chain[0] ? ctx.primary_model_hint : undefined,
      });

      let acc = "";
      const iter = (gen as AsyncIterable<string>)[Symbol.asyncIterator]
        ? (gen as AsyncIterable<string>)[Symbol.asyncIterator]()
        : (gen as AsyncIterator<string>);

      for (;;) {
        const { done, value } = await iter.next();
        if (done) break;
        if (value) acc += value;
      }

      if (isOutputMalformed(acc)) continue;

      response = acc.trim();
      usedProvider = pName;
      break;
    } catch { continue; }
  }

  if (!response) {
    recordRouterExecution({
      provider: 'none',
      latency_ms: Date.now() - t0,
      success: false,
      error_type: 'all_providers_failed',
      routing_version: ROUTING_ENGINE_VERSION,
      registry_version: getRegistryVersion(),
      routing_primary: ctx.primary_provider_hint,
      routing_chain: healthRankedChain,
      routing_scores: Object.fromEntries(healthScores.map(s => [s.provider, Math.round(s.score * 1000) / 1000])),
      routing_weights: healthWeights,
      capability_override: ctx.requires_json ? "requires_json" : ctx.requires_reasoning_depth ? "requires_reasoning" : undefined,
    });
    // Note: individual provider failures already recorded in chain loop
    return new Response(
      JSON.stringify({ success: false, error: "All providers exhausted" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const durationMs = Date.now() - t0;

  // Provider health — fire and forget
  updateProviderHealth(usedProvider, true, durationMs);
  recordBudgetAfterExecution(null, ctx.estimated_cost_usd ?? 0);

  // Router telemetry — fire and forget
  recordRouterExecution({
    tier: ctx.cost_sensitivity ?? 'unknown',
    provider: usedProvider,
    model: ctx.primary_model_hint,
    cost: ctx.estimated_cost_usd ?? 0,
    latency_ms: durationMs,
    success: true,
    routing_version: ROUTING_ENGINE_VERSION,
    registry_version: getRegistryVersion(),
    routing_primary: ctx.primary_provider_hint,
    routing_chain: healthRankedChain,
    routing_scores: Object.fromEntries(healthScores.map(s => [s.provider, Math.round(s.score * 1000) / 1000])),
    routing_weights: healthWeights,
    capability_override: ctx.requires_json ? "requires_json" : ctx.requires_reasoning_depth ? "requires_reasoning" : undefined,
  });

  return new Response(
    JSON.stringify({
      success:  true,
      response,
      provider: usedProvider,
      routing_version: ROUTING_ENGINE_VERSION,
      registry_version: getRegistryVersion(),
      routing: {
        provider:    ctx.primary_provider_hint,
        model:       ctx.primary_model_hint,
        reason:      decision.reason,
        requires_reasoning: ctx.requires_reasoning_depth,
        requires_json:      ctx.requires_json,
        complexity_score:   ctx.complexity_score,
        high_risk:          ctx.high_risk,
        fallback_chain:     ctx.fallback_chain,
      },
      durationMs,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}