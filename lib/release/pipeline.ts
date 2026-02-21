// lib/release/pipeline.ts
// CR AudioViz AI — Go-Live Release Pipeline
// 2026-02-21 — STEP 8 Go-Live

import { createLogger } from "@/lib/observability/logger";
import { sendErrorAlert } from "@/lib/alerts/escalate";

const log = createLogger("api");

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | "health_check"
  | "canary_warmup"
  | "smoke_test"
  | "canary_promote"
  | "complete";

export interface PipelineResult {
  success:   boolean;
  stage:     PipelineStage;
  durationMs: number;
  details:   Record<string, unknown>;
  error?:    string;
}

export interface PipelineConfig {
  deploymentUrl:   string;
  onRollback?:     (reason: string) => Promise<void>;
  alertOnFailure?: boolean;
  canaryPercent?:  number;   // default 25
}

// ── Health check ──────────────────────────────────────────────────────────────

async function runHealthCheck(url: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  try {
    const res = await fetch(`${url}/api/health/ready`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json() as { status?: string };
    return { ok: data.status === "ready" || data.status === "degraded", status: data.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ── Smoke tests ───────────────────────────────────────────────────────────────

async function runSmokeTests(url: string): Promise<{
  passed: number;
  failed: number;
  details: Record<string, boolean>;
}> {
  const checks: Array<[string, () => Promise<boolean>]> = [
    ["homepage",        async () => { const r = await fetch(url, { signal: AbortSignal.timeout(5000) }); return r.ok; }],
    ["pricing_page",   async () => { const r = await fetch(`${url}/pricing`, { signal: AbortSignal.timeout(5000) }); return r.ok; }],
    ["api_billing",    async () => { const r = await fetch(`${url}/api/billing`, { signal: AbortSignal.timeout(5000) }); const d = await r.json() as { status?: string }; return d.status === "operational"; }],
    ["api_health",     async () => { const r = await fetch(`${url}/api/health/live`, { signal: AbortSignal.timeout(5000) }); const d = await r.json() as { status?: string }; return d.status === "ok"; }],
    ["beta_checklist", async () => { const r = await fetch(`${url}/api/beta/checklist`, { signal: AbortSignal.timeout(8000) }); const d = await r.json() as { ready?: boolean }; return d.ready === true; }],
  ];

  const details: Record<string, boolean> = {};
  let passed = 0, failed = 0;

  await Promise.all(
    checks.map(async ([name, fn]) => {
      try {
        const ok = await fn();
        details[name] = ok;
        if (ok) passed++; else failed++;
      } catch {
        details[name] = false;
        failed++;
      }
    })
  );

  return { passed, failed, details };
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runReleasePipeline(config: PipelineConfig): Promise<PipelineResult> {
  const start   = Date.now();
  const url     = config.deploymentUrl;
  let   stage: PipelineStage = "health_check";

  log.info("Release pipeline started", { meta: { url } });

  try {
    // Stage 1: Health check
    const health = await runHealthCheck(url);
    if (!health.ok) {
      throw new Error(`Health check failed: ${health.error ?? health.status}`);
    }
    log.info("Health check passed", { meta: { status: health.status } });

    // Stage 2: Canary warmup (placeholder — actual canary % managed by Vercel)
    stage = "canary_warmup";
    log.info(`Canary warmup: ${config.canaryPercent ?? 25}%`);
    await new Promise((r) => setTimeout(r, 500)); // simulate warmup

    // Stage 3: Smoke tests
    stage = "smoke_test";
    const smoke = await runSmokeTests(url);
    if (smoke.failed > 0) {
      throw new Error(
        `Smoke tests failed: ${smoke.failed}/${smoke.passed + smoke.failed} — ` +
        Object.entries(smoke.details).filter(([,v]) => !v).map(([k]) => k).join(", ")
      );
    }
    log.info("Smoke tests passed", { meta: smoke });

    // Stage 4: Promote canary to full traffic
    stage = "canary_promote";
    log.info("Promoting canary to 100%");
    await new Promise((r) => setTimeout(r, 200)); // simulate promote

    stage = "complete";
    const durationMs = Date.now() - start;
    log.info(`Pipeline complete in ${durationMs}ms`, { meta: { stage } });

    return {
      success: true,
      stage,
      durationMs,
      details: {
        healthStatus: health.status,
        smokeTests:   smoke,
        canaryPercent: 100,
      },
    };

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;

    log.error(`Pipeline failed at stage: ${stage}`, { meta: { error } });

    // Rollback callback
    if (config.onRollback) {
      try {
        await config.onRollback(error);
        log.info("Rollback callback executed");
      } catch (rbErr) {
        log.error("Rollback callback failed", { meta: { rbErr } });
      }
    }

    // Alert on failure
    if (config.alertOnFailure !== false) {
      void sendErrorAlert({
        title:   `🚨 Release Pipeline Failed — ${stage}`,
        message: error,
        context: { url, stage },
      });
    }

    return { success: false, stage, durationMs, details: {}, error };
  }
}

// ── Post-deploy hook ──────────────────────────────────────────────────────────

export async function postDeployCheck(url: string): Promise<boolean> {
  const result = await runReleasePipeline({
    deploymentUrl: url,
    alertOnFailure: true,
  });
  return result.success;
}
