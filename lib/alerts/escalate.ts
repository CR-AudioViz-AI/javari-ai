// lib/alerts/escalate.ts
// CR AudioViz AI — Alerting & Escalation System
// 2026-02-21 — STEP 8 Go-Live

import { createLogger } from "@/lib/observability/logger";
import { track } from "@/lib/analytics/track";

const log = createLogger("api");

// ── Alert types ───────────────────────────────────────────────────────────────

export interface AlertPayload {
  title:    string;
  message:  string;
  severity?: "info" | "warning" | "critical";
  context?: Record<string, unknown>;
  userId?:  string;
}

// ── Email send placeholder ─────────────────────────────────────────────────────
// In production: wire to Resend or SendGrid via email templates.

async function dispatchAlert(payload: AlertPayload): Promise<void> {
  const { title, message, severity = "warning", context } = payload;

  // 1. Structured log (captured by Vercel / any log drain)
  log.error(`[ALERT:${severity.toUpperCase()}] ${title}`, {
    meta: { message, context, severity },
  });

  // 2. Analytics event
  track({
    event:      "error_boundary_hit",
    userId:     payload.userId,
    properties: { title, message, severity, ...context },
  });

  // 3. Email dispatch (placeholder — replace with Resend integration)
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const alertEmail = process.env.ALERT_EMAIL ?? "royhenderson@craudiovizai.com";

    if (resendKey && alertEmail) {
      const body = {
        from:    "alerts@craudiovizai.com",
        to:      [alertEmail],
        subject: `[${severity.toUpperCase()}] ${title}`,
        text:    `${title}\n\n${message}\n\nContext:\n${JSON.stringify(context ?? {}, null, 2)}\n\nTimestamp: ${new Date().toISOString()}`,
      };
      await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
    }
  } catch (e) {
    // Alerts must never crash the caller
    log.warn("Alert email dispatch failed", { meta: { error: e instanceof Error ? e.message : String(e) } });
  }
}

// ── Exported alert functions ──────────────────────────────────────────────────

export async function sendErrorAlert(payload: AlertPayload): Promise<void> {
  return dispatchAlert({ ...payload, severity: payload.severity ?? "critical" });
}

export async function sendUsageSpikeAlert(opts: {
  userId?:      string;
  feature:      string;
  requestsPerMin: number;
  threshold:    number;
}): Promise<void> {
  return dispatchAlert({
    title:    `Usage Spike Detected — ${opts.feature}`,
    message:  `${opts.requestsPerMin} req/min (threshold: ${opts.threshold})`,
    severity: "warning",
    context:  opts,
    userId:   opts.userId,
  });
}

export async function sendBillingFailureAlert(opts: {
  userId:    string;
  reason:    string;
  amount?:   number;
  provider?: string;
}): Promise<void> {
  return dispatchAlert({
    title:    "Billing Failure",
    message:  opts.reason,
    severity: "critical",
    context:  { amount: opts.amount, provider: opts.provider },
    userId:   opts.userId,
  });
}

export async function sendDeployAlert(opts: {
  success:   boolean;
  url:       string;
  stage?:    string;
  error?:    string;
}): Promise<void> {
  return dispatchAlert({
    title:    opts.success ? "✅ Deployment Succeeded" : `🚨 Deployment Failed — ${opts.stage ?? "unknown"}`,
    message:  opts.error ?? "Deploy completed successfully",
    severity: opts.success ? "info" : "critical",
    context:  opts,
  });
}

export async function sendProviderOutageAlert(provider: string, details?: string): Promise<void> {
  return dispatchAlert({
    title:    `Provider Outage — ${provider}`,
    message:  details ?? `${provider} is not responding. Javari has switched to fallback providers.`,
    severity: "warning",
    context:  { provider },
  });
}
