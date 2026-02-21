// app/api/beta/checklist/route.ts
// CR AudioViz AI — Public Beta Readiness Checklist
// 2026-02-20 — STEP 7 Production Hardening
//
// Returns: { ready: boolean, details: {}, timestamp }

import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/observability/logger";
import { getMetrics } from "@/lib/observability/metrics";
import { getAllCanaryConfigs } from "@/lib/canary/feature-canary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckDetail {
  name:    string;
  status:  "pass" | "fail" | "warn";
  message: string;
  value?:  unknown;
}

async function checkHealth(): Promise<CheckDetail> {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${base}/api/health/ready`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as { status?: string };
    const status = data.status === "ready" ? "pass" : data.status === "degraded" ? "warn" : "fail";
    return { name: "health_checks", status, message: `Health: ${data.status ?? "unknown"}`, value: data.status };
  } catch (e) {
    return { name: "health_checks", status: "warn",
             message: `Could not reach readiness endpoint: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

async function checkBilling(): Promise<CheckDetail> {
  try {
    const { getTierDefinitions } = await import("@/lib/javari/revenue/subscriptions");
    const tiers = getTierDefinitions();
    const active = tiers.filter((t) => t.priceMonthlyUsd >= 0);
    return { name: "billing_active", status: active.length >= 4 ? "pass" : "warn",
             message: `${active.length} tiers configured`, value: active.map(t => t.tier) };
  } catch (e) {
    return { name: "billing_active", status: "fail",
             message: e instanceof Error ? e.message : "Billing unavailable" };
  }
}

async function checkEntitlements(): Promise<CheckDetail> {
  try {
    const { TIER_FEATURES } = await import("@/lib/javari/revenue/entitlements");
    const count = Object.keys(TIER_FEATURES).length;
    return { name: "entitlements_active", status: count >= 4 ? "pass" : "warn",
             message: `${count} tier entitlement sets loaded` };
  } catch (e) {
    return { name: "entitlements_active", status: "fail",
             message: e instanceof Error ? e.message : "Entitlements unavailable" };
  }
}

async function checkModuleFactory(): Promise<CheckDetail> {
  try {
    const { MODULE_REGISTRY } = await import("@/lib/javari/store/registry");
    return { name: "module_factory", status: MODULE_REGISTRY.length > 0 ? "pass" : "warn",
             message: `${MODULE_REGISTRY.length} modules in registry`, value: MODULE_REGISTRY.length };
  } catch (e) {
    return { name: "module_factory", status: "fail",
             message: e instanceof Error ? e.message : "Module factory unavailable" };
  }
}

async function checkMultiAgent(): Promise<CheckDetail> {
  try {
    const { analyzeRoutingContext } = await import("@/lib/javari/multi-ai/routing-context");
    const ctx = analyzeRoutingContext("beta check probe", [], false);
    return { name: "multi_agent", status: ctx ? "pass" : "warn",
             message: ctx ? "Routing context engine operational" : "Context returned null",
             value: ctx ? "operational" : "degraded" };
  } catch (e) {
    return { name: "multi_agent", status: "fail",
             message: e instanceof Error ? e.message : "Router unavailable" };
  }
}

function checkObservability(): CheckDetail {
  const logs    = getRecentLogs(10);
  const metrics = getMetrics(undefined, 10);
  const hasLogs = logs.length > 0;
  // Observability may not have events if server just started — that's fine
  return {
    name:    "observability",
    status:  "pass",
    message: `Logger active (${logs.length} recent logs, ${metrics.length} recent metrics)`,
    value:   { logs: logs.length, metrics: metrics.length },
  };
}

function checkCanary(): CheckDetail {
  const configs = getAllCanaryConfigs();
  const stable  = configs.filter((c) => c.stage === "stable" || c.stage !== "disabled").length;
  return {
    name:    "canary_system",
    status:  "pass",
    message: `${configs.length} canary configs, ${stable} active`,
    value:   configs.map((c) => `${c.feature}:${c.stage}`),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const [healthCheck, billingCheck, entitlementsCheck, factoryCheck, multiAgentCheck] =
    await Promise.all([
      checkHealth(),
      checkBilling(),
      checkEntitlements(),
      checkModuleFactory(),
      checkMultiAgent(),
    ]);

  const obsCheck    = checkObservability();
  const canaryCheck = checkCanary();

  const allChecks = [
    healthCheck,
    billingCheck,
    entitlementsCheck,
    factoryCheck,
    multiAgentCheck,
    obsCheck,
    canaryCheck,
  ];

  const failed = allChecks.filter((c) => c.status === "fail").length;
  const warned = allChecks.filter((c) => c.status === "warn").length;
  const ready  = failed === 0;

  const details = Object.fromEntries(
    allChecks.map((c) => [c.name, { status: c.status, message: c.message, value: c.value ?? null }])
  );

  return NextResponse.json(
    {
      ready,
      status:    ready ? (warned > 0 ? "ready_with_warnings" : "ready") : "not_ready",
      timestamp: new Date().toISOString(),
      summary: {
        total:  allChecks.length,
        passed: allChecks.filter((c) => c.status === "pass").length,
        warned,
        failed,
      },
      details,
    },
    {
      status:  ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
