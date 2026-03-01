// lib/javari/telemetry/budget-governor.ts
// Global Budget Governor — platform-wide + per-user cost enforcement
// Created: 2026-03-01
//
// Enforces:
//   - Global hourly spend cap
//   - Global daily spend cap  
//   - Per-user monthly spend cap (from user_cost_settings)
//   - Per-request cost ceiling
//
// CRITICAL: Budget check failures return structured denials.
//           Budget WRITE failures NEVER block the router.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  scope?: string;
  period?: string;
  currentSpend?: number;
  limit?: number;
}

interface BudgetRow {
  scope: string;
  period: string;
  subject_id: string;
  total_spend: number;
  request_count: number;
  last_reset_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURABLE LIMITS (env vars with sane defaults)
// ═══════════════════════════════════════════════════════════════

function getLimit(envKey: string, fallback: number): number {
  const val = process.env[envKey];
  return val ? parseFloat(val) : fallback;
}

const GLOBAL_HOURLY_LIMIT_USD = () => getLimit('BUDGET_GLOBAL_HOURLY_USD', 10.0);
const GLOBAL_DAILY_LIMIT_USD  = () => getLimit('BUDGET_GLOBAL_DAILY_USD', 50.0);
const USER_MONTHLY_LIMIT_USD  = () => getLimit('BUDGET_USER_MONTHLY_USD', 100.0);
const PER_REQUEST_LIMIT_USD   = () => getLimit('BUDGET_PER_REQUEST_USD', 5.0);

const PERIOD_MS: Record<string, number> = {
  hour:  3_600_000,
  day:   86_400_000,
  month: 2_592_000_000,
};

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
// IN-MEMORY CACHE (5s TTL to reduce DB reads)
// ═══════════════════════════════════════════════════════════════

const budgetCache = new Map<string, { row: BudgetRow; fetchedAt: number }>();
const CACHE_TTL_MS = 5_000;

function cacheKey(scope: string, period: string, subjectId: string): string {
  return `${scope}:${period}:${subjectId}`;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Pre-execution budget check. Returns { allowed: true } or denial.
 * NEVER throws — returns allowed:true on any error (fail-open).
 */
export async function checkBudgetBeforeExecution(
  userId: string | null,
  estimatedCost: number
): Promise<BudgetCheckResult> {
  try {
    if (estimatedCost > PER_REQUEST_LIMIT_USD()) {
      return {
        allowed: false,
        reason: 'per_request_limit',
        scope: 'request',
        period: 'single',
        currentSpend: estimatedCost,
        limit: PER_REQUEST_LIMIT_USD(),
      };
    }

    const hourCheck = await _checkPeriod('global', 'hour', '__global__', GLOBAL_HOURLY_LIMIT_USD());
    if (!hourCheck.allowed) return hourCheck;

    const dayCheck = await _checkPeriod('global', 'day', '__global__', GLOBAL_DAILY_LIMIT_USD());
    if (!dayCheck.allowed) return dayCheck;

    if (userId) {
      const userLimit = await _getUserMonthlyLimit(userId);
      const userCheck = await _checkPeriod('user', 'month', userId, userLimit);
      if (!userCheck.allowed) return userCheck;
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Post-execution budget recording. Fire-and-forget, NEVER throws.
 */
export function recordBudgetAfterExecution(
  userId: string | null,
  actualCost: number
): void {
  _recordSpend(userId, actualCost).catch(() => {});
}

/**
 * Get current budget state for admin.
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
// INTERNAL
// ═══════════════════════════════════════════════════════════════

async function _checkPeriod(
  scope: string, period: string, subjectId: string, limit: number
): Promise<BudgetCheckResult> {
  const row = await _getBudgetRow(scope, period, subjectId);
  if (!row) return { allowed: true };

  const elapsed = Date.now() - new Date(row.last_reset_at).getTime();
  if (elapsed > PERIOD_MS[period]) return { allowed: true };

  if (row.total_spend >= limit) {
    return {
      allowed: false,
      reason: 'budget_exceeded',
      scope,
      period,
      currentSpend: row.total_spend,
      limit,
    };
  }
  return { allowed: true };
}

async function _getBudgetRow(
  scope: string, period: string, subjectId: string
): Promise<BudgetRow | null> {
  const key = cacheKey(scope, period, subjectId);
  const cached = budgetCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.row;

  try {
    const client = sb();
    if (!client) return null;
    const { data } = await client.from('ai_budget_state')
      .select('*').eq('scope', scope).eq('period', period).eq('subject_id', subjectId).single();
    if (data) {
      budgetCache.set(key, { row: data as BudgetRow, fetchedAt: Date.now() });
      return data as BudgetRow;
    }
    return null;
  } catch {
    return null;
  }
}

async function _recordSpend(userId: string | null, cost: number): Promise<void> {
  try {
    const client = sb();
    if (!client) return;

    for (const period of ['hour', 'day'] as const) {
      const row = await _getBudgetRow('global', period, '__global__');
      const elapsed = row ? Date.now() - new Date(row.last_reset_at).getTime() : Infinity;
      const needsReset = !row || elapsed > PERIOD_MS[period];

      await client.from('ai_budget_state').upsert({
        scope: 'global',
        period,
        subject_id: '__global__',
        total_spend: needsReset ? cost : (row?.total_spend ?? 0) + cost,
        request_count: needsReset ? 1 : (row?.request_count ?? 0) + 1,
        last_reset_at: needsReset ? new Date().toISOString() : row?.last_reset_at,
        updated_at: new Date().toISOString(),
      });
      budgetCache.delete(cacheKey('global', period, '__global__'));
    }

    if (userId) {
      const row = await _getBudgetRow('user', 'month', userId);
      const elapsed = row ? Date.now() - new Date(row.last_reset_at).getTime() : Infinity;
      const needsReset = !row || elapsed > PERIOD_MS['month'];

      await client.from('ai_budget_state').upsert({
        scope: 'user',
        period: 'month',
        subject_id: userId,
        total_spend: needsReset ? cost : (row?.total_spend ?? 0) + cost,
        request_count: needsReset ? 1 : (row?.request_count ?? 0) + 1,
        last_reset_at: needsReset ? new Date().toISOString() : row?.last_reset_at,
        updated_at: new Date().toISOString(),
      });
      budgetCache.delete(cacheKey('user', 'month', userId));
    }
  } catch {
    // NEVER throw
  }
}

async function _getUserMonthlyLimit(userId: string): Promise<number> {
  try {
    const client = sb();
    if (!client) return USER_MONTHLY_LIMIT_USD();
    const { data } = await client.from('user_cost_settings')
      .select('monthly_limit_usd').eq('user_id', userId).single();
    return data?.monthly_limit_usd ?? USER_MONTHLY_LIMIT_USD();
  } catch {
    return USER_MONTHLY_LIMIT_USD();
  }
}
