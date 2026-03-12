// lib/analytics/track.ts
// CR AudioViz AI — Analytics Tracking
// 2026-02-20 — STEP 7 Production Hardening
// Server-safe event tracker. Persists to Supabase analytics_events table.
// Client-side usage: import and call track() — no cookies required.
import { analyticsLog } from "@/lib/observability/logger";
import { generateTraceId } from "@/lib/errors/api-error";
// ── Event types ───────────────────────────────────────────────────────────────
export type AnalyticsEvent =
export interface TrackPayload {
// ── Fire-and-forget Supabase insert ──────────────────────────────────────────
    // Analytics must never crash the caller
// ── Main track() ─────────────────────────────────────────────────────────────
// ── Convenience wrappers ──────────────────────────────────────────────────────
export default {}
