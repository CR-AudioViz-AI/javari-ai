// lib/canary/feature-canary.ts
// CR AudioViz AI — Canary Release System
// 2026-02-20 — STEP 7 Production Hardening
//
// Supports 1% → 5% → 25% → 100% rollout logic with cookie-based
// sticky assignment. Tie into unified.ts mode flags.

import { canaryLog } from "@/lib/observability/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CanaryFeature =
  | "multi_ai_team"
  | "module_factory"
  | "autonomy_v2"
  | "streaming_v2"
  | "cost_tracking_v2"
  | "db_schema_gen";

export type CanaryStage = "disabled" | "canary_1" | "canary_5" | "canary_25" | "stable";

export interface CanaryConfig {
  feature:      CanaryFeature;
  stage:        CanaryStage;
  percentage:   number;
  killOnError:  boolean; // auto-disable if error_rate > threshold
  errorThreshold: number; // fraction, e.g. 0.05 = 5%
}

// ── Stage → percentage map ────────────────────────────────────────────────────

const STAGE_PCT: Record<CanaryStage, number> = {
  disabled:  0,
  canary_1:  1,
  canary_5:  5,
  canary_25: 25,
  stable:    100,
};

// ── Default canary configs ────────────────────────────────────────────────────
// In production these would be fetched from DB / feature flags service.
// For now: stable config for all launched features.

const DEFAULT_CONFIGS: Record<CanaryFeature, CanaryConfig> = {
  multi_ai_team:     { feature: "multi_ai_team",     stage: "stable",    percentage: 100, killOnError: true,  errorThreshold: 0.10 },
  module_factory:    { feature: "module_factory",    stage: "stable",    percentage: 100, killOnError: true,  errorThreshold: 0.10 },
  autonomy_v2:       { feature: "autonomy_v2",       stage: "stable",    percentage: 100, killOnError: true,  errorThreshold: 0.05 },
  streaming_v2:      { feature: "streaming_v2",      stage: "stable",    percentage: 100, killOnError: false, errorThreshold: 0.15 },
  cost_tracking_v2:  { feature: "cost_tracking_v2",  stage: "stable",    percentage: 100, killOnError: false, errorThreshold: 0.20 },
  db_schema_gen:     { feature: "db_schema_gen",     stage: "canary_25", percentage: 25,  killOnError: true,  errorThreshold: 0.05 },
};

// ── In-memory override store (updated at runtime by kill logic) ───────────────

const _overrides: Partial<Record<CanaryFeature, CanaryConfig>> = {};
const _errorCounts: Partial<Record<CanaryFeature, { errors: number; total: number }>> = {};

export function overrideCanary(feature: CanaryFeature, config: Partial<CanaryConfig>): void {
  _overrides[feature] = { ...DEFAULT_CONFIGS[feature], ...config };
  canaryLog.info(`Canary override applied: ${feature}`, { meta: { config } });
}

export function killCanary(feature: CanaryFeature, reason: string): void {
  _overrides[feature] = { ...DEFAULT_CONFIGS[feature], stage: "disabled", percentage: 0 };
  canaryLog.warn(`Canary killed: ${feature} — ${reason}`);
}

// ── Sticky assignment ─────────────────────────────────────────────────────────
// Converts a userId + feature to a deterministic 0–99 bucket.

function hashBucket(userId: string, feature: string): number {
  let h = 5381;
  const s = `${userId}::${feature}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return Math.abs(h) % 100;
}

// ── Core check ────────────────────────────────────────────────────────────────

export function isCanaryEnabled(feature: CanaryFeature, userId: string): boolean {
  const cfg = _overrides[feature] ?? DEFAULT_CONFIGS[feature];
  if (!cfg || cfg.percentage <= 0) return false;
  if (cfg.percentage >= 100) return true;
  const bucket = hashBucket(userId, feature);
  return bucket < cfg.percentage;
}

export function getCanaryConfig(feature: CanaryFeature): CanaryConfig {
  return _overrides[feature] ?? DEFAULT_CONFIGS[feature];
}

export function getAllCanaryConfigs(): CanaryConfig[] {
  return Object.keys(DEFAULT_CONFIGS).map((f) =>
    getCanaryConfig(f as CanaryFeature)
  );
}

// ── Error rate tracking (auto-kill) ──────────────────────────────────────────

export function recordCanaryOutcome(
  feature: CanaryFeature,
  success: boolean
): void {
  if (!_errorCounts[feature]) _errorCounts[feature] = { errors: 0, total: 0 };
  const c = _errorCounts[feature]!;
  c.total++;
  if (!success) c.errors++;

  const cfg = getCanaryConfig(feature);
  if (cfg.killOnError && c.total >= 20) {
    const rate = c.errors / c.total;
    if (rate > cfg.errorThreshold) {
      killCanary(feature, `error rate ${(rate * 100).toFixed(1)}% > threshold ${(cfg.errorThreshold * 100).toFixed(1)}%`);
      // Reset counters after kill
      _errorCounts[feature] = { errors: 0, total: 0 };
    }
  }
}

export function getCanaryStats(): Record<CanaryFeature, { stage: CanaryStage; pct: number; errors?: number; total?: number }> {
  const out: Record<string, unknown> = {};
  for (const f of Object.keys(DEFAULT_CONFIGS) as CanaryFeature[]) {
    const cfg  = getCanaryConfig(f);
    const errs = _errorCounts[f];
    out[f] = {
      stage:  cfg.stage,
      pct:    cfg.percentage,
      errors: errs?.errors,
      total:  errs?.total,
    };
  }
  return out as Record<CanaryFeature, { stage: CanaryStage; pct: number; errors?: number; total?: number }>;
}
