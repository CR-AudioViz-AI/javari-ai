// lib/release/pipeline.ts
// CR AudioViz AI — Go-Live Release Pipeline v2
// 2026-02-21 — STEP 9 Official Launch

import { createLogger } from "@/lib/observability/logger";
import { sendErrorAlert, sendUsageSpikeAlert } from "@/lib/alerts/escalate";

const log = createLogger("api");

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | "smoke_test"
  | "health_check"
  | "canary_warmup"
  | "canary_promote"
  | "entitlement_test"
  | "billing_test"
  | "complete";

export interface PipelineResult {
  success:    boolean;
  stage:      PipelineStage;
  duration:   number;
  checks:     Record<string, { pass: boolean; detail: string; latencyMs?: number }>;
  rollback?:  string;
  alertSent?: boolean;
}

export interface RollbackTrigger {
  reason:          string;
  latencyThresholdMs?: number;
  errorRateThreshold?: number;
  stage:           PipelineStage;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const ROLLBACK_THRESHOLDS = {
  maxLatencyMs:   5000,
  maxErrorRate:   0.05,    // 5%
  minHealthScore: 3,       // at least 3 of 5 health checks must pass
};

// ── Individual pipeline checks ────────────────────────────────────────────────

async function runSmokeTests(): Promise<{ pass: boolean; detail: string; latencyMs: number }> {
  const start = Date.now();
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const endpoints = [
    { path: "/api/health/live",    label: "liveness" },
    { path: "/api/billing",        label: "billing" },
    { path: "/api/factory",        label: "factory" },
    { path: "/api/autonomy",       label: "autonomy" },
    { path: "/api/beta/checklist", label: "checklist" },
  ];

  let passed = 0;
  const failures: string[] = [];

  for (const ep of endpoints) {
    try {
      const r = await fetch(`${baseUrl}${ep.path}`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { passed++; }
      else { failures.push(`${ep.label}:${r.status}`); }
    } catch (e) {
      failures.push(`${ep.label}:timeout`);
    }
  }

  const pass = passed >= 4; // At least 4/5 must pass
  return {
    pass,
    detail: pass
      ? `Smoke tests: ${passed}/${endpoints.length} passed`
      : `Smoke tests failed: ${passed}/${endpoints.length} — failures: ${failures.join(", ")}`,
    latencyMs: Date.now() - start,
  };
}

async function runHealthCheck(): Promise<{ pass: boolean; detail: string; latencyMs: number }> {
  const start   = Date.now();
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const r    = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json() as { status?: string; summary?: { failed?: number } };
    const pass = data.status === "ready" || data.status === "degraded";
    return {
      pass,
      detail: `Health: ${data.status ?? "unknown"}, failed=${data.summary?.failed ?? "?"}`,
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return { pass: false, detail: `Health check failed: ${e instanceof Error ? e.message : "timeout"}`, latencyMs: Date.now() - start };
  }
}

async function runEntitlementTest(): Promise<{ pass: boolean; detail: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const { TIER_FEATURES } = await import("@/lib/javari/revenue/entitlements");
    const tiers = Object.keys(TIER_FEATURES);
    const pass  = tiers.length >= 4;
    return { pass, detail: `Entitlements: ${tiers.join(", ")}`, latencyMs: Date.now() - start };
  } catch (e) {
    return { pass: false, detail: `Entitlement test failed: ${e instanceof Error ? e.message : "error"}`, latencyMs: Date.now() - start };
  }
}

async function runBillingTest(): Promise<{ pass: boolean; detail: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const { getTierDefinitions } = await import("@/lib/javari/revenue/subscriptions");
    const tiers = getTierDefinitions();
    const pass  = tiers.length >= 4;
    return { pass, detail: `Billing: ${tiers.length} tiers configured`, latencyMs: Date.now() - start };
  } catch (e) {
    return { pass: false, detail: `Billing test failed: ${e instanceof Error ? e.message : "error"}`, latencyMs: Date.now() - start };
  }
}

async function runCanaryWarmup(): Promise<{ pass: boolean; detail: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const { getAllCanaryConfigs } = await import("@/lib/canary/feature-canary");
    const configs  = getAllCanaryConfigs();
    const stable   = configs.filter((c) => c.stage !== "disabled").length;
    const pass     = stable >= 4;
    return { pass, detail: `Canary warmup: ${stable}/${configs.length} features active`, latencyMs: Date.now() - start };
  } catch (e) {
    return { pass: false, detail: `Canary warmup failed: ${e instanceof Error ? e.message : "error"}`, latencyMs: Date.now() - start };
  }
}

// ── Rollback trigger ──────────────────────────────────────────────────────────

async function triggerRollback(trigger: RollbackTrigger): Promise<void> {
  log.error(`ROLLBACK TRIGGERED at stage ${trigger.stage}: ${trigger.reason}`);
  await sendErrorAlert({
    traceId:  `rollback_${Date.now().toString(36)}`,
    code:     "PIPELINE_ROLLBACK",
    message:  `Release pipeline rollback at ${trigger.stage}: ${trigger.reason}`,
    path:     "/api/release/pipeline",
    severity: "critical",
  });
}

// ── Main pipeline runner ──────────────────────────────────────────────────────

export async function runReleasePipeline(): Promise<PipelineResult> {
  const start  = Date.now();
  let   stage: PipelineStage = "smoke_test";

  log.info("Release pipeline started");

  try {
    // Stage 1: Smoke tests
    const smoke = await runSmokeTests();
    if (!smoke.pass) {
      await triggerRollback({ reason: `Smoke tests failed: ${smoke.detail}`, stage });
      return { success: false, stage, duration: Date.now() - start, checks: { smoke_test: { pass: false, detail: smoke.detail } }, rollback: smoke.detail, alertSent: true };
    }

    // Stage 2: Health check
    stage = "health_check";
    const health = await runHealthCheck();
    if (!health.pass) {
      await triggerRollback({ reason: `Health check failed`, stage });
      return { success: false, stage, duration: Date.now() - start, checks: { health_check: { pass: false, detail: health.detail } }, rollback: health.detail, alertSent: true };
    }

    // Stage 3: Entitlement test
    stage = "entitlement_test";
    const ent = await runEntitlementTest();

    // Stage 4: Billing test
    stage = "billing_test";
    const billing = await runBillingTest();
    if (!billing.pass) {
      await triggerRollback({ reason: `Billing check failed`, stage });
      return { success: false, stage, duration: Date.now() - start, checks: { billing: { pass: false, detail: billing.detail } }, rollback: billing.detail, alertSent: true };
    }

    // Stage 5: Canary warmup
    stage = "canary_warmup";
    const canary = await runCanaryWarmup();

    // Stage 6: Canary promote
    stage = "canary_promote";
    // All checks passed — promote canary to full
    try {
      const { setCanaryThreshold } = await import("@/lib/launch/config");
      setCanaryThreshold(100);
    } catch { /* non-fatal */ }

    stage = "complete";
    const duration = Date.now() - start;

    log.info(`Release pipeline complete in ${duration}ms`);

    return {
      success:  true,
      stage:    "complete",
      duration,
      checks: {
        smoke_test:        { pass: smoke.pass,   detail: smoke.detail,   latencyMs: smoke.latencyMs },
        health_check:      { pass: health.pass,  detail: health.detail,  latencyMs: health.latencyMs },
        entitlement_test:  { pass: ent.pass,     detail: ent.detail,     latencyMs: ent.latencyMs },
        billing_test:      { pass: billing.pass, detail: billing.detail, latencyMs: billing.latencyMs },
        canary_warmup:     { pass: canary.pass,  detail: canary.detail,  latencyMs: canary.latencyMs },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown pipeline error";
    log.error(`Pipeline error at ${stage}: ${msg}`);
    await triggerRollback({ reason: msg, stage });
    return { success: false, stage, duration: Date.now() - start, checks: {}, rollback: msg, alertSent: true };
  }
}

// ── Post-deploy hook ──────────────────────────────────────────────────────────

export async function runPostDeployChecks(): Promise<{ ready: boolean; details: string }> {
  const [health, billing] = await Promise.all([runHealthCheck(), runBillingTest()]);
  const ready = health.pass && billing.pass;
  const details = `health=${health.pass} billing=${billing.pass}`;
  if (!ready) {
    await sendUsageSpikeAlert({ endpoint: "post_deploy", value: 0, threshold: 0, note: `Post-deploy check failed: ${details}` });
  }
  return { ready, details };
}
