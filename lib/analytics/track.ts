// lib/analytics/track.ts
// CR AudioViz AI — Analytics Tracking
// 2026-02-20 — STEP 7 Production Hardening
//
// Server-safe event tracker. Persists to Supabase analytics_events table.
// Client-side usage: import and call track() — no cookies required.

import { analyticsLog } from "@/lib/observability/logger";
import { generateTraceId } from "@/lib/errors/api-error";

// ── Event types ───────────────────────────────────────────────────────────────

export type AnalyticsEvent =
  | "signup"
  | "login"
  | "logout"
  | "upgrade"
  | "downgrade"
  | "cancel_subscription"
  | "module_install"
  | "module_generate"
  | "ai_task"
  | "ai_task_complete"
  | "ai_task_failed"
  | "billing_event"
  | "credit_deducted"
  | "credit_granted"
  | "feature_blocked"
  | "page_view"
  | "error_boundary_hit"
  | "canary_assignment"
  | "outage_detected"
  | "rate_limit_hit";

export interface TrackPayload {
  event:       AnalyticsEvent;
  userId?:     string;
  sessionId?:  string;
  properties?: Record<string, unknown>;
  traceId?:    string;
}

// ── Fire-and-forget Supabase insert ──────────────────────────────────────────

async function persistEvent(payload: TrackPayload & { id: string; timestamp: string }): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    void fetch(`${url}/rest/v1/analytics_events`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({
        id:          payload.id,
        event_name:  payload.event,
        user_id:     payload.userId   ?? null,
        session_id:  payload.sessionId ?? null,
        properties:  payload.properties ?? null,
        trace_id:    payload.traceId  ?? null,
        created_at:  payload.timestamp,
      }),
    });
  } catch {
    // Analytics must never crash the caller
  }
}

// ── Main track() ─────────────────────────────────────────────────────────────

export function track(payload: TrackPayload): void {
  const id        = generateTraceId("evt");
  const timestamp = new Date().toISOString();

  analyticsLog.info(`Event: ${payload.event}`, {
    userId:  payload.userId,
    traceId: payload.traceId ?? id,
    meta:    { event: payload.event, props: payload.properties },
  });

  void persistEvent({ ...payload, id, timestamp });
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export const trackSignup = (userId: string, plan = "free") =>
  track({ event: "signup", userId, properties: { plan } });

export const trackUpgrade = (userId: string, from: string, to: string) =>
  track({ event: "upgrade", userId, properties: { from, to } });

export const trackModuleInstall = (userId: string, moduleId: string, tier: string) =>
  track({ event: "module_install", userId, properties: { moduleId, tier } });

export const trackAiTask = (userId: string, feature: string, model: string, tokens: number) =>
  track({ event: "ai_task", userId, properties: { feature, model, tokens } });

export const trackBillingEvent = (userId: string, type: string, amount: number) =>
  track({ event: "billing_event", userId, properties: { type, amount } });

export const trackError = (event: "error_boundary_hit" | "rate_limit_hit" | "outage_detected",
                           meta: Record<string, unknown>) =>
  track({ event, properties: meta });
