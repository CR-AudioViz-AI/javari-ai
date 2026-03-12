// lib/observability/metrics.ts
// CR AudioViz AI — Metrics Buckets
// 2026-02-20 — STEP 7 Production Hardening
// In-process metrics accumulator. Buckets for latency, error_rate,
// model_cost, token_usage. Supabase-compatible insert payload builder.
export type MetricBucket = "latency" | "error_rate" | "model_cost" | "token_usage" | "request_count";
export interface MetricPoint {
// ── In-process accumulator ────────────────────────────────────────────────────
// ── Convenience recorders ─────────────────────────────────────────────────────
// ── Query helpers ─────────────────────────────────────────────────────────────
export interface MetricSummary {
// ── Supabase-compatible insert payload ────────────────────────────────────────
export default {}
