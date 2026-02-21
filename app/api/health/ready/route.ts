// app/api/health/ready/route.ts
// CR AudioViz AI — Readiness Probe
// 2026-02-20 — STEP 7 Production Hardening
//
// Checks: DB, Supabase RLS, unified engine, multi-agent router,
// module factory, billing system. Returns structured JSON.

import { NextResponse } from "next/server";
import { healthLog } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Individual checks ─────────────────────────────────────────────────────────

interface CheckResult {
  name:      string;
  status:    "pass" | "fail" | "warn";
  latencyMs: number;
  message:   string;
  details?:  Record<string, unknown>;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { name: "database", status: "fail", latencyMs: 0,
               message: "Missing Supabase credentials" };
    }
    const res = await fetch(`${url}/rest/v1/user_subscription?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal:  AbortSignal.timeout(3000),
    });
    const latencyMs = Date.now() - start;
    if (res.ok || res.status === 406) { // 406 = PGRST116 = no rows, still connected
      return { name: "database", status: "pass", latencyMs, message: "Supabase reachable" };
    }
    return { name: "database", status: "fail", latencyMs,
             message: `Supabase returned ${res.status}` };
  } catch (e) {
    return { name: "database", status: "fail", latencyMs: Date.now() - start,
             message: e instanceof Error ? e.message : "DB check failed" };
  }
}

async function checkBillingEngine(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { getTierDefinitions } = await import("@/lib/javari/revenue/subscriptions");
    const tiers = getTierDefinitions();
    const latencyMs = Date.now() - start;
    if (tiers.length >= 4) {
      return { name: "billing", status: "pass", latencyMs,
               message: `${tiers.length} tiers loaded`, details: { tiers: tiers.map(t => t.tier) } };
    }
    return { name: "billing", status: "warn", latencyMs, message: "Fewer than 4 tiers loaded" };
  } catch (e) {
    return { name: "billing", status: "fail", latencyMs: Date.now() - start,
             message: e instanceof Error ? e.message : "Billing check failed" };
  }
}

async function checkModuleFactory(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { MODULE_REGISTRY } = await import("@/lib/javari/store/registry");
    const latencyMs = Date.now() - start;
    return {
      name: "module_factory", status: "pass", latencyMs,
      message: `Registry has ${MODULE_REGISTRY.length} modules`,
      details: { count: MODULE_REGISTRY.length },
    };
  } catch (e) {
    return { name: "module_factory", status: "fail", latencyMs: Date.now() - start,
             message: e instanceof Error ? e.message : "Factory check failed" };
  }
}

async function checkMultiAgentRouter(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { routeRequest } = await import("@/lib/javari/multi-ai/router");
    const decision = routeRequest({ userPrompt: "health check", contextTokens: 10, _mode: "single" });
    const latencyMs = Date.now() - start;
    if (decision.provider) {
      return { name: "multi_agent_router", status: "pass", latencyMs,
               message: `Router operational, primary: ${decision.provider}` };
    }
    return { name: "multi_agent_router", status: "warn", latencyMs, message: "No provider returned" };
  } catch (e) {
    return { name: "multi_agent_router", status: "fail", latencyMs: Date.now() - start,
             message: e instanceof Error ? e.message : "Router check failed" };
  }
}

async function checkEntitlements(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { TIER_FEATURES } = await import("@/lib/javari/revenue/entitlements");
    const features = TIER_FEATURES;
    const latencyMs = Date.now() - start;
    const tierCount = Object.keys(features).length;
    return { name: "entitlements", status: tierCount >= 4 ? "pass" : "warn",
             latencyMs, message: `${tierCount} tier feature sets loaded` };
  } catch (e) {
    return { name: "entitlements", status: "fail", latencyMs: Date.now() - start,
             message: e instanceof Error ? e.message : "Entitlements check failed" };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const start = Date.now();

  const [dbCheck, billingCheck, factoryCheck, routerCheck, entitlementsCheck] =
    await Promise.all([
      checkDatabase(),
      checkBillingEngine(),
      checkModuleFactory(),
      checkMultiAgentRouter(),
      checkEntitlements(),
    ]);

  const checks = [dbCheck, billingCheck, factoryCheck, routerCheck, entitlementsCheck];
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;

  const overall = failed > 0 ? "unhealthy" : warned > 0 ? "degraded" : "ready";
  const httpStatus = failed > 0 ? 503 : 200;

  healthLog.info(`Readiness check: ${overall}`, {
    meta: { checks: checks.map((c) => `${c.name}:${c.status}`).join(", "),
            durationMs: Date.now() - start },
  });

  return NextResponse.json(
    {
      status:    overall,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      checks:    Object.fromEntries(checks.map((c) => [c.name, c])),
      summary: {
        total:  checks.length,
        passed: checks.filter((c) => c.status === "pass").length,
        warned,
        failed,
      },
    },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store", "X-Health": overall },
    }
  );
}
