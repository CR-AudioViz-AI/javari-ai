// app/api/admin/system-status/route.ts
// Control Tower API — live system visibility for internal admin
// 2026-03-01

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAllProviderHealth } from "@/lib/javari/telemetry/provider-health";
import { getBudgetState } from "@/lib/javari/telemetry/budget-governor";
import { applyHealthRanking } from "@/lib/javari/multi-ai/routing-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  // Gate: ADMIN_MODE must be "1"
  if (process.env.ADMIN_MODE !== "1") {
    return json({ error: "Admin mode disabled" }, 403);
  }

  const t0 = Date.now();

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Parallel data fetch ──────────────────────────────────────
    const [
      providerHealth,
      budgetState,
      recentExecutions,
    ] = await Promise.all([
      getAllProviderHealth().catch(() => []),
      getBudgetState().catch(() => []),
      sb
        .from("ai_router_executions")
        .select("provider, model, tier, cost, latency_ms, success, error_type, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r) => r.data ?? [])
        .catch(() => []),
    ]);

    // ── Derive cooldown + health status ──────────────────────────
    const now = Date.now();
    const providers = providerHealth.map((p) => {
      const total = p.total_successes + p.total_failures;
      const successRate = total > 0 ? Math.round((p.total_successes / total) * 100) : 100;
      const inCooldown = p.cooldown_until
        ? new Date(p.cooldown_until).getTime() > now
        : false;
      const cooldownRemaining = inCooldown
        ? Math.ceil((new Date(p.cooldown_until!).getTime() - now) / 1000)
        : 0;

      let status: "healthy" | "degraded" | "cooldown" | "unknown" = "unknown";
      if (inCooldown) status = "cooldown";
      else if (successRate >= 80) status = "healthy";
      else if (total > 0) status = "degraded";

      return {
        provider: p.provider,
        status,
        success_rate: successRate,
        total_successes: p.total_successes,
        total_failures: p.total_failures,
        consecutive_failures: p.consecutive_failures,
        avg_latency_ms: Math.round(p.avg_latency_ms),
        in_cooldown: inCooldown,
        cooldown_remaining_s: cooldownRemaining,
        last_success_at: p.last_success_at,
        last_failure_at: p.last_failure_at,
      };
    });

    // ── Adaptive routing scores (for default chain) ──────────────
    const defaultChain = ["groq", "openai", "anthropic", "mistral", "openrouter", "xai", "perplexity"];
    const { scores: routingScores } = applyHealthRanking(defaultChain);

    // ── Budget/velocity state ────────────────────────────────────
    const budgetRows = budgetState.map((b: any) => ({
      scope: b.scope,
      period: b.period,
      total_spend: b.total_spend,
      request_count: b.request_count,
      spend_last_60s: b.spend_last_60s,
      spend_last_10m: b.spend_last_10m,
      requests_last_60s: b.requests_last_60s,
      anomaly_score: b.anomaly_score,
      escalation_level: b.escalation_level,
      updated_at: b.updated_at,
    }));

    // ── Aggregate escalation ─────────────────────────────────────
    const maxEscalation = budgetRows.reduce(
      (max: number, r: any) => Math.max(max, r.escalation_level ?? 0),
      0
    );

    const emergencyStop = process.env.BUDGET_EMERGENCY_STOP === "1";
    const systemPaused = process.env.JAVARI_AUTONOMY_PAUSED === "1";

    return json({
      timestamp: new Date().toISOString(),
      query_ms: Date.now() - t0,

      system: {
        emergency_stop: emergencyStop,
        system_paused: systemPaused,
        admin_mode: true,
        max_escalation_level: maxEscalation,
        escalation_label:
          maxEscalation === 0
            ? "normal"
            : maxEscalation === 1
              ? "elevated"
              : maxEscalation === 2
                ? "high"
                : "critical",
      },

      providers,

      routing_scores: routingScores,

      budget: budgetRows,

      recent_executions: recentExecutions,

      summary: {
        total_providers: providers.length,
        healthy_providers: providers.filter((p) => p.status === "healthy").length,
        degraded_providers: providers.filter((p) => p.status === "degraded").length,
        cooldown_providers: providers.filter((p) => p.status === "cooldown").length,
        total_spend: budgetRows.reduce((s: number, r: any) => s + (r.total_spend ?? 0), 0),
        spend_last_60s: budgetRows.reduce((s: number, r: any) => s + (r.spend_last_60s ?? 0), 0),
        spend_last_10m: budgetRows.reduce((s: number, r: any) => s + (r.spend_last_10m ?? 0), 0),
        requests_last_60s: budgetRows.reduce((s: number, r: any) => s + (r.requests_last_60s ?? 0), 0),
      },
    });
  } catch (err) {
    return json(
      { error: "Failed to fetch system status", detail: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
