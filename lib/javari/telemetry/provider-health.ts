// lib/javari/telemetry/provider-health.ts
// Persistent Provider Health Layer — cold-start safe
// Created: 2026-03-01
//
// Responsibilities:
//   1. Track consecutive failures & cooldown per provider
//   2. Persist to Supabase ai_provider_health table
//   3. Rebuild from ai_router_executions on cold start
//   4. NEVER block or crash the router
//
// Cooldown formula:
//   consecutive_failures >= 3 → cooldown = 60s × 2^(failures-3), max 5 min

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ProviderHealthState {
  provider: string;
  consecutive_failures: number;
  total_failures: number;
  total_successes: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  cooldown_until: string | null;
  avg_latency_ms: number;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const FAILURE_THRESHOLD = 3;       // Consecutive failures before cooldown
const BASE_COOLDOWN_MS = 60_000;   // 60 seconds
const MAX_COOLDOWN_MS = 300_000;   // 5 minutes
const REBUILD_WINDOW = 200;        // Rows to scan on cold start

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY CACHE (seeded from DB, updated on every call)
// ═══════════════════════════════════════════════════════════════

const cache = new Map<string, ProviderHealthState>();
let initialized = false;
let initPromise: Promise<void> | null = null;

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
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a provider is in cooldown. Returns true if AVAILABLE.
 * Seeds from DB on first call (cold start).
 * NEVER throws.
 */
export async function isProviderAvailable(provider: string): Promise<boolean> {
  try {
    await ensureInitialized();
    const state = cache.get(provider);
    if (!state) return true; // Unknown provider = assume available

    if (!state.cooldown_until) return true;
    return new Date(state.cooldown_until).getTime() < Date.now();
  } catch {
    return true; // On error, assume available (never block router)
  }
}

/**
 * Record a provider execution result. Updates cache + persists to DB.
 * Fire-and-forget — NEVER throws, NEVER blocks router.
 */
export function updateProviderHealth(
  provider: string,
  success: boolean,
  latencyMs: number,
  errorType?: string
): void {
  _updateHealth(provider, success, latencyMs, errorType).catch(() => {});
}

/**
 * Get current health state for all providers (from cache).
 */
export async function getAllProviderHealth(): Promise<ProviderHealthState[]> {
  await ensureInitialized();
  return Array.from(cache.values());
}

/**
 * Force rebuild health from execution log. Admin use.
 */
export async function rebuildHealthFromExecutions(): Promise<number> {
  return _rebuildFromLog();
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION (once per cold start)
// ═══════════════════════════════════════════════════════════════

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = _initialize();
  await initPromise;
}

async function _initialize(): Promise<void> {
  try {
    const client = sb();
    if (!client) { initialized = true; return; }

    // Load existing health rows
    const { data, error } = await client
      .from('ai_provider_health')
      .select('*');

    if (!error && data) {
      for (const row of data) {
        cache.set(row.provider, row as ProviderHealthState);
      }
    }

    // If cache is empty, rebuild from execution log
    if (cache.size === 0) {
      await _rebuildFromLog();
    }

    initialized = true;
  } catch {
    initialized = true; // Don't retry on error, proceed with empty cache
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL: Update health
// ═══════════════════════════════════════════════════════════════

async function _updateHealth(
  provider: string,
  success: boolean,
  latencyMs: number,
  _errorType?: string
): Promise<void> {
  try {
    await ensureInitialized();

    let state = cache.get(provider);
    if (!state) {
      state = {
        provider,
        consecutive_failures: 0,
        total_failures: 0,
        total_successes: 0,
        last_failure_at: null,
        last_success_at: null,
        cooldown_until: null,
        avg_latency_ms: 0,
        updated_at: new Date().toISOString(),
      };
    }

    const now = new Date().toISOString();

    if (success) {
      state.consecutive_failures = 0;
      state.total_successes++;
      state.last_success_at = now;
      state.cooldown_until = null; // Clear any cooldown on success

      // Rolling avg latency (exponential moving average, α=0.2)
      state.avg_latency_ms = state.avg_latency_ms === 0
        ? latencyMs
        : state.avg_latency_ms * 0.8 + latencyMs * 0.2;
    } else {
      state.consecutive_failures++;
      state.total_failures++;
      state.last_failure_at = now;

      // Set cooldown if threshold exceeded
      if (state.consecutive_failures >= FAILURE_THRESHOLD) {
        const exponent = Math.min(state.consecutive_failures - FAILURE_THRESHOLD, 3);
        const cooldownMs = Math.min(BASE_COOLDOWN_MS * Math.pow(2, exponent), MAX_COOLDOWN_MS);
        state.cooldown_until = new Date(Date.now() + cooldownMs).toISOString();
      }
    }

    state.updated_at = now;
    cache.set(provider, state);

    // Persist to DB (non-blocking)
    const client = sb();
    if (client) {
      await client.from('ai_provider_health').upsert({
        provider: state.provider,
        consecutive_failures: state.consecutive_failures,
        total_failures: state.total_failures,
        total_successes: state.total_successes,
        last_failure_at: state.last_failure_at,
        last_success_at: state.last_success_at,
        cooldown_until: state.cooldown_until,
        avg_latency_ms: Math.round(state.avg_latency_ms * 100) / 100,
        updated_at: state.updated_at,
      });
    }
  } catch {
    // NEVER throw
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL: Rebuild from execution log
// ═══════════════════════════════════════════════════════════════

async function _rebuildFromLog(): Promise<number> {
  try {
    const client = sb();
    if (!client) return 0;

    const { data: rows, error } = await client
      .from('ai_router_executions')
      .select('provider, success, latency_ms, error_type, created_at')
      .order('created_at', { ascending: true })
      .limit(REBUILD_WINDOW);

    if (error || !rows || rows.length === 0) return 0;

    // Reset cache
    const rebuilt = new Map<string, ProviderHealthState>();

    for (const row of rows) {
      const p = row.provider;
      if (!p || p === 'none') continue;

      let state = rebuilt.get(p);
      if (!state) {
        state = {
          provider: p,
          consecutive_failures: 0,
          total_failures: 0,
          total_successes: 0,
          last_failure_at: null,
          last_success_at: null,
          cooldown_until: null,
          avg_latency_ms: 0,
          updated_at: row.created_at,
        };
      }

      if (row.success) {
        state.consecutive_failures = 0;
        state.total_successes++;
        state.last_success_at = row.created_at;
        state.cooldown_until = null;
        state.avg_latency_ms = state.avg_latency_ms === 0
          ? (row.latency_ms ?? 0)
          : state.avg_latency_ms * 0.8 + (row.latency_ms ?? 0) * 0.2;
      } else {
        state.consecutive_failures++;
        state.total_failures++;
        state.last_failure_at = row.created_at;
        if (state.consecutive_failures >= FAILURE_THRESHOLD) {
          const exponent = Math.min(state.consecutive_failures - FAILURE_THRESHOLD, 3);
          const cooldownMs = Math.min(BASE_COOLDOWN_MS * Math.pow(2, exponent), MAX_COOLDOWN_MS);
          state.cooldown_until = new Date(new Date(row.created_at).getTime() + cooldownMs).toISOString();
        }
      }

      state.updated_at = row.created_at;
      rebuilt.set(p, state);
    }

    // Persist all rebuilt states
    for (const state of rebuilt.values()) {
      cache.set(state.provider, state);
      await client.from('ai_provider_health').upsert({
        provider: state.provider,
        consecutive_failures: state.consecutive_failures,
        total_failures: state.total_failures,
        total_successes: state.total_successes,
        last_failure_at: state.last_failure_at,
        last_success_at: state.last_success_at,
        cooldown_until: state.cooldown_until,
        avg_latency_ms: Math.round(state.avg_latency_ms * 100) / 100,
        updated_at: state.updated_at,
      });
    }

    return rebuilt.size;
  } catch {
    return 0;
  }
}
