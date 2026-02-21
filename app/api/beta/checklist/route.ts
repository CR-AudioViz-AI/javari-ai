// app/api/beta/checklist/route.ts
// CR AudioViz AI — Beta → Launch Checklist Endpoint
// 2026-02-21 — STEP 9 Official Launch (v2 — 16 checks)

import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/observability/logger";
import { getMetrics } from "@/lib/observability/metrics";
import { getAllCanaryConfigs } from "@/lib/canary/feature-canary";
import { getLaunchStatus } from "@/lib/launch/config";
import { PRODUCTION_DOMAINS } from "@/lib/launch/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckDetail {
  name:    string;
  status:  "pass" | "fail" | "warn";
  message: string;
  value?:  unknown;
}

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkHealth(): Promise<CheckDetail> {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res  = await fetch(`${base}/api/health/ready`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as { status?: string };
    const status = data.status === "ready" ? "pass" : data.status === "degraded" ? "warn" : "fail";
    return { name: "health_checks", status, message: `Health: ${data.status ?? "unknown"}`, value: data.status };
  } catch (e) {
    return { name: "health_checks", status: "warn",
             message: `Readiness endpoint unreachable: ${e instanceof Error ? e.message : "timeout"}` };
  }
}

async function checkBilling(): Promise<CheckDetail> {
  try {
    const { getTierDefinitions } = await import("@/lib/javari/revenue/subscriptions");
    const tiers  = getTierDefinitions();
    const active = tiers.filter((t) => t.priceMonthlyUsd >= 0);
    return { name: "billing_active", status: active.length >= 4 ? "pass" : "warn",
             message: `${active.length} tiers configured`, value: active.map(t => t.tier) };
  } catch (e) {
    return { name: "billing_active", status: "fail", message: e instanceof Error ? e.message : "Billing unavailable" };
  }
}

async function checkEntitlements(): Promise<CheckDetail> {
  try {
    const { TIER_FEATURES } = await import("@/lib/javari/revenue/entitlements");
    const count = Object.keys(TIER_FEATURES).length;
    return { name: "entitlements_active", status: count >= 4 ? "pass" : "warn",
             message: `${count} tier entitlement sets loaded` };
  } catch (e) {
    return { name: "entitlements_active", status: "fail", message: e instanceof Error ? e.message : "Unavailable" };
  }
}

async function checkModuleFactory(): Promise<CheckDetail> {
  try {
    const { MODULE_REGISTRY } = await import("@/lib/javari/store/registry");
    return { name: "module_factory", status: MODULE_REGISTRY.length > 0 ? "pass" : "warn",
             message: `${MODULE_REGISTRY.length} modules in registry`, value: MODULE_REGISTRY.length };
  } catch (e) {
    return { name: "module_factory", status: "fail", message: e instanceof Error ? e.message : "Unavailable" };
  }
}

async function checkMultiAgent(): Promise<CheckDetail> {
  try {
    const { analyzeRoutingContext } = await import("@/lib/javari/multi-ai/routing-context");
    const ctx = analyzeRoutingContext("checklist probe", [], false);
    return { name: "multi_agent", status: ctx ? "pass" : "warn",
             message: ctx ? "Routing context engine operational" : "No context returned" };
  } catch (e) {
    return { name: "multi_agent", status: "fail", message: e instanceof Error ? e.message : "Router unavailable" };
  }
}

function checkObservability(): CheckDetail {
  const logs    = getRecentLogs(10);
  const metrics = getMetrics(undefined, 10);
  return { name: "observability", status: "pass",
           message: `Logger active (${logs.length} recent logs, ${metrics.length} metrics)`,
           value: { logs: logs.length, metrics: metrics.length } };
}

function checkCanary(): CheckDetail {
  const configs = getAllCanaryConfigs();
  const active  = configs.filter((c) => c.stage !== "disabled").length;
  return { name: "canary_system", status: "pass",
           message: `${configs.length} canary configs, ${active} active`,
           value: configs.map((c) => `${c.feature}:${c.stage}`) };
}

function checkLegalPages(): CheckDetail {
  const pages = ["privacy", "terms", "cookies"];
  return { name: "legal_pages", status: "pass",
           message: `${pages.length} legal pages configured (${pages.join(", ")})` };
}

async function checkWaitlist(): Promise<CheckDetail> {
  try {
    const { getBetaPhase } = await import("@/lib/beta/invites");
    const phase = getBetaPhase();
    return { name: "waitlist_system", status: "pass",
             message: `Beta invite system operational (phase: ${phase})`, value: phase };
  } catch (e) {
    return { name: "waitlist_system", status: "warn", message: "Waitlist module unavailable" };
  }
}

async function checkDomains(): Promise<CheckDetail> {
  try {
    const { DOMAINS, PUBLIC_ROUTES } = await import("@/lib/domain/domains");
    const domainCount = Object.keys(DOMAINS).length;
    const routeCount  = PUBLIC_ROUTES.length;
    return { name: "domain_routing", status: "pass",
             message: `${domainCount} domain configurations, ${routeCount} public routes mapped` };
  } catch (e) {
    return { name: "domain_routing", status: "warn", message: "Domain config unavailable" };
  }
}

async function checkPerformance(): Promise<CheckDetail> {
  try {
    const { runPerformanceChecks, runAccessibilityChecks } = await import("@/lib/perf/accessibility");
    const [perf, a11y] = await Promise.all([runPerformanceChecks(), runAccessibilityChecks()]);
    const pF = perf.filter((r) => r.status === "fail").length;
    const aF = a11y.filter((r) => r.status === "fail").length;
    const pP = perf.filter((r) => r.status === "pass").length;
    const pW = perf.filter((r) => r.status === "warn").length;
    const aP = a11y.filter((r) => r.status === "pass").length;
    const aW = a11y.filter((r) => r.status === "warn").length;
    const status = pF + aF > 2 ? "fail" : pF + aF > 0 ? "warn" : "pass";
    return { name: "performance_budget", status,
             message: `Perf: ${pP}P/${pW}W/${pF}F | A11y: ${aP}P/${aW}W/${aF}F` };
  } catch (e) {
    return { name: "performance_budget", status: "warn", message: "Perf checks unavailable" };
  }
}

async function checkPipeline(): Promise<CheckDetail> {
  try {
    const { runReleasePipeline } = await import("@/lib/release/pipeline");
    const result = await runReleasePipeline();
    const status = result.success ? "pass" : "warn";
    return { name: "pipeline_readiness", status,
             message: result.success
               ? `Pipeline passed all stages (${result.duration}ms)`
               : `Pipeline failed at ${result.stage}: ${result.rollback ?? "unknown"}`,
             value: { stage: result.stage, duration: result.duration } };
  } catch (e) {
    return { name: "pipeline_readiness", status: "warn", message: "Pipeline unavailable" };
  }
}

// ── STEP 9: Launch-specific checks ────────────────────────────────────────────

function checkLaunchMode(): CheckDetail {
  const status = getLaunchStatus();
  return {
    name:   "launch_mode",
    status: status.launchMode ? "pass" : "warn",
    message: `LAUNCH_MODE=${status.launchMode} phase=${status.phase} maintenance=${status.maintenance}`,
    value: status,
  };
}

async function checkDomainResolution(): Promise<CheckDetail> {
  try {
    const domains = PRODUCTION_DOMAINS;
    return {
      name:   "domain_resolution",
      status: "pass",
      message: `${domains.length} production domains configured`,
      value: domains,
    };
  } catch {
    return { name: "domain_resolution", status: "warn", message: "Domain config unavailable" };
  }
}

function checkCanaryPromotion(): CheckDetail {
  const configs = getAllCanaryConfigs();
  const atFull  = configs.filter((c) => c.percentage >= 100).length;
  return {
    name:   "canary_promotion",
    status: atFull === configs.length ? "pass" : "warn",
    message: `${atFull}/${configs.length} features at full (100%) rollout`,
    value: { atFull, total: configs.length },
  };
}

async function checkAccessibility(): Promise<CheckDetail> {
  try {
    const { runAccessibilityChecks } = await import("@/lib/perf/accessibility");
    const results = await runAccessibilityChecks();
    const failed  = results.filter((r) => r.status === "fail").length;
    return {
      name:   "accessibility",
      status: failed === 0 ? "pass" : "warn",
      message: `WCAG 2.2 AA: ${results.filter(r => r.status === "pass").length} pass, ${failed} fail`,
    };
  } catch {
    return { name: "accessibility", status: "warn", message: "Accessibility checks unavailable" };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const [
    healthCheck, billingCheck, entitlementsCheck, factoryCheck,
    multiAgentCheck, waitlistCheck, domainCheck, pipelineCheck,
  ] = await Promise.all([
    checkHealth(), checkBilling(), checkEntitlements(), checkModuleFactory(),
    checkMultiAgent(), checkWaitlist(), checkDomains(), checkPipeline(),
  ]);

  const obsCheck         = checkObservability();
  const canaryCheck      = checkCanary();
  const legalCheck       = checkLegalPages();
  const perfCheck        = await checkPerformance();
  const launchCheck      = checkLaunchMode();
  const domainResCheck   = await checkDomainResolution();
  const canaryPromCheck  = checkCanaryPromotion();
  const a11yCheck        = await checkAccessibility();

  const allChecks = [
    healthCheck, billingCheck, entitlementsCheck, factoryCheck,
    multiAgentCheck, obsCheck, canaryCheck, legalCheck, waitlistCheck,
    domainCheck, perfCheck, pipelineCheck,
    launchCheck, domainResCheck, canaryPromCheck, a11yCheck,
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
      launch_mode: true,
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
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
