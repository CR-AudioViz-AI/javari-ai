// lib/javari/telemetry/budget-governor.ts
// Velocity-Based Budget Governor — anomaly detection, not hard caps
// v2.0 — 2026-03-01
//
// Philosophy:
//   - Legitimate high spend is ALLOWED (paying users are never blocked by cumulative spend)
//   - Anomalous VELOCITY triggers escalation (burst detection)
//   - Per-request sanity ceiling still enforced
//   - Global emergency kill switch via env var
//   - Retry storms and runaway loops are throttled
//
// Escalation levels:
//   0 = normal (allow)
//   1 = elevated (log, allow)
//   2 = high (increase effective multiplier)
//   3 = critical (require confirmation / throttle 60s)

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  escalation_level?: number;
  anomaly_score?: number;
  spend_last_60s?: number;
  requests_last_60s?: number;
  throttle_seconds?: number;
}

interface BudgetRow {
  scope: string;
  period: string;
  subject_id: string;
  total_spend: number;
  request_count: number;
  last_reset_at: string;
  updated_at: string;
  spend_last_60s: number;
  spend_last_10m: number;
  requests_last_60s: number;
  anomaly_score: number;
  escalation_level: number;
}

// ═══════════════════════════════════════════════════════════════
// VELOCITY THRESHOLDS (configurable via env)
// ═══════════════════════════════════════════════════════════════

function env(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseFloat(v) : fallback;
}

// Per-request sanity ceiling (absolute — never exceeded)
const PER_REQUEST_CEILING_USD   = () => env('BUDGET_PER_REQUEST_USD', 5.0);

// Velocity baselines (normal operating range)
const NORMAL_SPEND_PER_60S      = () => env('BUDGET_NORMAL_60S_USD', 0.50);
const NORMAL_SPEND_PER_10M      = () => env('BUDGET_NORMAL_10M_USD', 2.00);
const NORMAL_REQUESTS_PER_60S   = () => env('BUDGET_NORMAL_REQ_60S', 10);

// Anomaly multipliers → escalation
const ANOMALY_WARN_MULT   = 5;    // 5x normal → escalation 1
const ANOMALY_HIGH_MULT   = 10;   // 10x normal → escalation 2
const ANOMALY_CRIT_MULT   = 20;   // 20x normal → escalation 3

// Throttle duration at critical escalation
const THROTTLE_SECONDS = 60;

// ═══════════════════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════════════════

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key);
  return _sb;
}

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY VELOCITY RING BUFFER
// Tracks last 10 minutes of requests for velocity calculation.
// Resets on cold start (safe — just means a short blind window).
// ═══════════════════════════════════════════════════════════════

interface VelocityEntry { cost: number; ts: number; }
const velocityBuffer: VelocityEntry[] = [];
const BUFFER_MAX_AGE_MS = 600_000; // 10 minutes

function addToVelocityBuffer(cost: number): void {
  const now = Date.now();
  velocityBuffer.push({ cost, ts: now });
  // Prune entries older than 10 min
  while (velocityBuffer.length > 0 && now - velocityBuffer[0].ts > BUFFER_MAX_AGE_MS) {
    velocityBuffer.shift();
  }
}

function getVelocity(): { spend60s: number; spend10m: number; req60s: number } {
  const now = Date.now();
  let spend60s = 0, spend10m = 0, req60s = 0;
  for (const e of velocityBuffer) {
    const age = now - e.ts;
    if (age <= 60_000) { spend60s += e.cost; req60s++; }
    if (age <= 600_000) { spend10m += e.cost; }
  }
  return { spend60s, spend10m, req60s };
}

// ═══════════════════════════════════════════════════════════════
// ANOMALY SCORING
// ═══════════════════════════════════════════════════════════════

function computeAnomalyScore(spend60s: number, spend10m: number, req60s: number): number {
  let score = 0;

  // Spend velocity anomaly (60s window)
  const spendRatio60 = spend60s / Math.max(NORMAL_SPEND_PER_60S(), 0.01);
  if (spendRatio60 > ANOMALY_CRIT_MULT) score += 30;
  else if (spendRatio60 > ANOMALY_HIGH_MULT) score += 20;
  else if (spendRatio60 > ANOMALY_WARN_MULT) score += 10;

  // Spend velocity anomaly (10m window)
  const spendRatio10m = spend10m / Math.max(NORMAL_SPEND_PER_10M(), 0.01);
  if (spendRatio10m > ANOMALY_CRIT_MULT) score += 20;
  else if (spendRatio10m > ANOMALY_HIGH_MULT) score += 10;
  else if (spendRatio10m > ANOMALY_WARN_MULT) score += 5;

  // Request frequency anomaly (retry storm detection)
  const reqRatio = req60s / Math.max(NORMAL_REQUESTS_PER_60S(), 1);
  if (reqRatio > ANOMALY_CRIT_MULT) score += 30;
  else if (reqRatio > ANOMALY_HIGH_MULT) score += 20;
  else if (reqRatio > ANOMALY_WARN_MULT) score += 10;

  return score;
}

function scoreToEscalation(score: number): number {
  if (score >= 50) return 3; // critical — throttle
  if (score >= 30) return 2; // high — require confirmation
  if (score >= 10) return 1; // elevated — log warning
  return 0;                   // normal
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Pre-execution velocity check. NEVER throws — fail-open.
 *
 * Returns:
 *   allowed: true for levels 0-2
 *   allowed: false ONLY for:
 *     - Per-request ceiling exceeded
 *     - Emergency kill switch
 *     - Critical escalation (level 3) → throttle
 */
export async function checkBudgetBeforeExecution(
  _userId: string | null,
  estimatedCost: number
): Promise<BudgetCheckResult> {
  try {
    // Emergency kill switch
    if (process.env.BUDGET_EMERGENCY_STOP === '1') {
      return {
        allowed: false,
        reason: 'emergency_stop',
        escalation_level: 3,
      };
    }

    // Per-request sanity ceiling (absolute guard)
    if (estimatedCost > PER_REQUEST_CEILING_USD()) {
      return {
        allowed: false,
        reason: 'per_request_ceiling',
        escalation_level: 0,
        spend_last_60s: 0,
        requests_last_60s: 0,
      };
    }

    // Compute velocity from in-memory buffer
    const vel = getVelocity();
    const anomalyScore = computeAnomalyScore(vel.spend60s, vel.spend10m, vel.req60s);
    const escalation = scoreToEscalation(anomalyScore);

    // Persist velocity snapshot (fire-and-forget)
    _persistVelocity(vel, anomalyScore, escalation).catch(() => {});

    if (escalation >= 3) {
      // Critical — throttle
      return {
        allowed: false,
        reason: 'velocity_throttle',
        escalation_level: escalation,
        anomaly_score: anomalyScore,
        spend_last_60s: vel.spend60s,
        requests_last_60s: vel.req60s,
        throttle_seconds: THROTTLE_SECONDS,
      };
    }

    // Levels 0-2: allow (caller can inspect escalation for UI hints)
    return {
      allowed: true,
      escalation_level: escalation,
      anomaly_score: anomalyScore,
      spend_last_60s: vel.spend60s,
      requests_last_60s: vel.req60s,
    };
  } catch {
    return { allowed: true, escalation_level: 0 }; // Fail-open
  }
}

/**
 * Post-execution: record spend into velocity buffer + DB.
 * Fire-and-forget, NEVER throws.
 */
export function recordBudgetAfterExecution(
  userId: string | null,
  actualCost: number
): void {
  addToVelocityBuffer(actualCost);
  _recordSpendToDB(userId, actualCost).catch(() => {});
}

/**
 * Admin: get current budget/velocity state.
 */
export async function getBudgetState(): Promise<BudgetRow[]> {
  try {
    const client = sb();
    if (!client) return [];
    const { data } = await client.from('ai_budget_state').select('*').order('scope').order('period');
    return data ?? [];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL: Persist velocity snapshot
// ═══════════════════════════════════════════════════════════════

async function _persistVelocity(
  vel: { spend60s: number; spend10m: number; req60s: number },
  anomalyScore: number,
  escalation: number
): Promise<void> {
  try {
    const client = sb();
    if (!client) return;

    // Update the global/hour row with velocity data
    await client.from('ai_budget_state').upsert({
      scope: 'global',
      period: 'hour',
      subject_id: '__global__',
      spend_last_60s: Math.round(vel.spend60s * 1e6) / 1e6,
      spend_last_10m: Math.round(vel.spend10m * 1e6) / 1e6,
      requests_last_60s: vel.req60s,
      anomaly_score: anomalyScore,
      escalation_level: escalation,
      updated_at: new Date().toISOString(),
    });
  } catch { /* never throw */ }
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL: Record cumulative spend
// ═══════════════════════════════════════════════════════════════

async function _recordSpendToDB(userId: string | null, cost: number): Promise<void> {
  try {
    const client = sb();
    if (!client) return;

    const now = new Date().toISOString();
    const PERIOD_MS: Record<string, number> = {
      hour: 3_600_000,
      day: 86_400_000,
    };

    for (const period of ['hour', 'day'] as const) {
      const { data: row } = await client.from('ai_budget_state')
        .select('*').eq('scope', 'global').eq('period', period)
        .eq('subject_id', '__global__').single();

      const elapsed = row ? Date.now() - new Date(row.last_reset_at).getTime() : Infinity;
      const needsReset = !row || elapsed > PERIOD_MS[period];

      await client.from('ai_budget_state').upsert({
        scope: 'global',
        period,
        subject_id: '__global__',
        total_spend: needsReset ? cost : (row?.total_spend ?? 0) + cost,
        request_count: needsReset ? 1 : (row?.request_count ?? 0) + 1,
        last_reset_at: needsReset ? now : row?.last_reset_at,
        updated_at: now,
      });
    }

    if (userId) {
      const { data: row } = await client.from('ai_budget_state')
        .select('*').eq('scope', 'user').eq('period', 'month')
        .eq('subject_id', userId).single();

      const elapsed = row ? Date.now() - new Date(row.last_reset_at).getTime() : Infinity;
      const needsReset = !row || elapsed > 2_592_000_000;

      await client.from('ai_budget_state').upsert({
        scope: 'user',
        period: 'month',
        subject_id: userId,
        total_spend: needsReset ? cost : (row?.total_spend ?? 0) + cost,
        request_count: needsReset ? 1 : (row?.request_count ?? 0) + 1,
        last_reset_at: needsReset ? now : row?.last_reset_at,
        updated_at: now,
      });
    }
  } catch { /* never throw */ }
}
