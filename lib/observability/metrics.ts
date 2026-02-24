// lib/observability/metrics.ts
// CR AudioViz AI — Metrics Buckets
// 2026-02-20 — STEP 7 Production Hardening
//
// In-process metrics accumulator. Buckets for latency, error_rate,
// model_cost, token_usage. Supabase-compatible insert payload builder.

export type MetricBucket = "latency" | "error_rate" | "model_cost" | "token_usage" | "request_count";

export interface MetricPoint {
  bucket:    MetricBucket;
  name:      string;       // e.g. "routing.claude-sonnet" or "api./api/factory"
  value:     number;
  tags?:     Record<string, string>;
  timestamp: string;
}

// ── In-process accumulator ────────────────────────────────────────────────────

const _points: MetricPoint[] = [];
const MAX_POINTS = 500;

export function recordMetric(
  bucket:  MetricBucket,
  name:    string,
  value:   number,
  tags?:   Record<string, string>
): void {
  const point: MetricPoint = {
    bucket,
    name,
    value,
    tags,
    timestamp: new Date().toISOString(),
  };
  _points.push(point);
  if (_points.length > MAX_POINTS) _points.shift();
}

// ── Convenience recorders ─────────────────────────────────────────────────────

export function recordLatency(name: string, ms: number, tags?: Record<string, string>): void {
  recordMetric("latency", name, ms, tags);
}

export function recordError(name: string, tags?: Record<string, string>): void {
  recordMetric("error_rate", name, 1, tags);
}

export function recordModelCost(
  provider: string,
  model:    string,
  costUsd:  number,
  tokens:   number
): void {
  const name = `${provider}.${model}`;
  recordMetric("model_cost",   name, costUsd,  { provider, model });
  recordMetric("token_usage",  name, tokens,   { provider, model });
}

export function recordRequest(path: string, method: string, statusCode: number): void {
  recordMetric("request_count", path, 1, { method, status: String(statusCode) });
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getMetrics(bucket?: MetricBucket, last = 100): MetricPoint[] {
  const pts = bucket ? _points.filter((p) => p.bucket === bucket) : _points;
  return pts.slice(-last);
}

export interface MetricSummary {
  bucket:  MetricBucket;
  name:    string;
  count:   number;
  sum:     number;
  min:     number;
  max:     number;
  avg:     number;
  p95?:    number;
}

export function summariseMetrics(bucket: MetricBucket): MetricSummary[] {
  const pts = _points.filter((p) => p.bucket === bucket);
  const groups: Record<string, number[]> = {};
  for (const p of pts) {
    if (!groups[p.name]) groups[p.name] = [];
    groups[p.name].push(p.value);
  }
  return Object.entries(groups).map(([name, vals]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const sum    = vals.reduce((s, v) => s + v, 0);
    return {
      bucket,
      name,
      count: vals.length,
      sum,
      min:   sorted[0]                                      ?? 0,
      max:   sorted[sorted.length - 1]                      ?? 0,
      avg:   sum / vals.length,
      p95:   sorted[Math.floor(sorted.length * 0.95) - 1]  ?? 0,
    };
  });
}

// ── Supabase-compatible insert payload ────────────────────────────────────────

export function buildSupabaseMetricsBatch(since?: string): object[] {
  const cutoff = since ? new Date(since).getTime() : 0;
  return _points
    .filter((p) => new Date(p.timestamp).getTime() >= cutoff)
    .map((p) => ({
      bucket:    p.bucket,
      name:      p.name,
      value:     p.value,
      tags:      p.tags ?? null,
      recorded_at: p.timestamp,
    }));
}
