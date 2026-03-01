// lib/javari/telemetry/provider-health.ts
// Persistent Provider Health Layer — cold-start safe
// Created: 2026-03-01
// Updated: 2026-03-01 — Added burst-based quarantine
//
// Responsibilities:
//   1. Track consecutive failures & cooldown per provider
//   2. Persist to Supabase ai_provider_health table
//   3. Rebuild from ai_router_executions on cold start
//   4. Burst-based quarantine: 3 failures in 15s → 120s quarantine
//   5. NEVER block or crash the router
//
// Cooldown formula:
//   consecutive_failures >= 3 → cooldown = 60s × 2^(failures-3), max 5 min
// Quarantine formula:
//   3 failures within 15s window → quarantined for 120s

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
  // Quarantine fields
  quarantined: boolean;
  quarantine_until: string | null;
  failure_burst_count: number;
  last_failure_window_start: string | null;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const FAILURE_THRESHOLD = 3;          // Consecutive failures before cooldown
const BASE_COOLDOWN_MS = 60_000;      // 60 seconds
const MAX_COOLDOWN_MS = 300_000;      // 5 minutes
const REBUILD_WINDOW = 200;           // Rows to scan on cold start

// Quarantine constants
const BURST_WINDOW_MS = 15_000;       // 15 second burst detection window
const BURST_FAILURE_THRESHOLD = 3;    // Failures within window to trigger quarantine
const QUARANTINE_DURATION_MS = 120_000; // 120 second quarantine

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY CACHE (seeded from DB, updated on every call)
// ═══════════════════════════════════════════════════════════════

const cache = new Map<string, ProviderHealthState>();
let initialized = false;
let initPromise: Promise<void> | null = null;
let lastDbSync = 0;
const DB_SYNC_INTERVAL_MS = 30_000;

// In-memory burst tracking (not persisted — resets on cold start)
const burstBuffers = new Map<string, number[]>();

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
 * Check if a provider is available. Returns true if AVAILABLE.
 * Checks both cooldown AND quarantine.
 * NEVER throws.
 */
export async function isProviderAvailable(provider: string): Promise<boolean> {
  try {
    await ensureInitialized();

    if (Date.now() - lastDbSync > DB_SYNC_INTERVAL_MS) {
      _syncFromDb().catch(() => {});
    }

    const state = cache.get(provider);
    if (!state) return true;

    const now = Date.now();

    // Check quarantine first (more severe)
    if (state.quarantined && state.quarantine_until) {
      if (new Date(state.quarantine_until).getTime() > now) {
        return false; // Still quarantined
      }
      // Quarantine expired — clear it
      state.quarantined = false;
      state.quarantine_until = null;
      state.failure_burst_count = 0;
    }

    // Check cooldown
    if (state.cooldown_until) {
      return new Date(state.cooldown_until).getTime() < now;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Record a provider execution result. Updates cache + persists to DB.
 * Includes burst detection for quarantine.
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
  await _syncFromDb();
  return Array.from(cache.values());
}

/**
 * Synchronous health snapshot for routing decisions.
 * NO DB queries. Safe for hot-path.
 */
export function getHealthSnapshot(): Map<string, ProviderHealthState> {
  return cache;
}

/**
 * Force rebuild health from execution log. Admin use.
 */
export async function rebuildHealthFromExecutions(): Promise<number> {
  return _rebuildFromLog();
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function _toHealthState(row: any): ProviderHealthState {
  return {
    provider: row.provider,
    consecutive_failures: row.consecutive_failures ?? 0,
    total_failures: row.total_failures ?? 0,
    total_successes: row.total_successes ?? 0,
    last_failure_at: row.last_failure_at ?? null,
    last_success_at: row.last_success_at ?? null,
    cooldown_until: row.cooldown_until ?? null,
    avg_latency_ms: row.avg_latency_ms ?? 0,
    updated_at: row.updated_at ?? new Date().toISOString(),
    quarantined: row.quarantined ?? false,
    quarantine_until: row.quarantine_until ?? null,
    failure_burst_count: row.failure_burst_count ?? 0,
    last_failure_window_start: row.last_failure_window_start ?? null,
  };
}

async function _syncFromDb(): Promise<void> {
  try {
    const client = sb();
    if (!client) return;
    const { data, error } = await client.from('ai_provider_health').select('*');
    if (!error && data) {
      for (const row of data) {
        const cached = cache.get(row.provider);
        if (!cached || new Date(row.updated_at) >= new Date(cached.updated_at)) {
          cache.set(row.provider, _toHealthState(row));
        }
      }
    }
    lastDbSync = Date.now();
  } catch { /* Never throw */ }
}

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
    const { data, error } = await client.from('ai_provider_health').select('*');
    if (!error && data) {
      for (const row of data) {
        cache.set(row.provider, _toHealthState(row));
      }
    }
    if (cache.size === 0) await _rebuildFromLog();
    lastDbSync = Date.now();
    initialized = true;
  } catch {
    initialized = true;
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL: Burst detection
// ═══════════════════════════════════════════════════════════════

function _checkBurst(provider: string): boolean {
  const now = Date.now();
  let buffer = burstBuffers.get(provider);
  if (!buffer) { buffer = []; burstBuffers.set(provider, buffer); }
  buffer.push(now);
  while (buffer.length > 0 && now - buffer[0] > BURST_WINDOW_MS) buffer.shift();
  return buffer.length >= BURST_FAILURE_THRESHOLD;
}

function _clearBurst(provider: string): void {
  burstBuffers.delete(provider);
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
      state = _toHealthState({ provider });
    }

    const now = new Date().toISOString();

    if (success) {
      state.consecutive_failures = 0;
      state.total_successes++;
      state.last_success_at = now;
      state.cooldown_until = null;

      // Clear quarantine on success
      if (state.quarantined) {
        state.quarantined = false;
        state.quarantine_until = null;
        state.failure_burst_count = 0;
        state.last_failure_window_start = null;
        _clearBurst(provider);
      }

      state.avg_latency_ms = state.avg_latency_ms === 0
        ? latencyMs
        : state.avg_latency_ms * 0.8 + latencyMs * 0.2;
    } else {
      state.consecutive_failures++;
      state.total_failures++;
      state.last_failure_at = now;

      // Burst detection → quarantine
      const burstTriggered = _checkBurst(provider);
      if (burstTriggered && !state.quarantined) {
        state.quarantined = true;
        state.quarantine_until = new Date(Date.now() + QUARANTINE_DURATION_MS).toISOString();
        state.failure_burst_count = burstBuffers.get(provider)?.length ?? BURST_FAILURE_THRESHOLD;
        state.last_failure_window_start = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
        _recordQuarantineEvent(provider, state.failure_burst_count).catch(() => {});
      }

      // Cooldown (orthogonal to quarantine)
      if (state.consecutive_failures >= FAILURE_THRESHOLD) {
        const exponent = Math.min(state.consecutive_failures - FAILURE_THRESHOLD, 3);
        const cooldownMs = Math.min(BASE_COOLDOWN_MS * Math.pow(2, exponent), MAX_COOLDOWN_MS);
        state.cooldown_until = new Date(Date.now() + cooldownMs).toISOString();
      }
    }

    state.updated_at = now;
    cache.set(provider, state);
    _persistState(state).catch(() => {});
  } catch { /* NEVER throw */ }
}

async function _persistState(state: ProviderHealthState): Promise<void> {
  const client = sb();
  if (!client) return;
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
    quarantined: state.quarantined,
    quarantine_until: state.quarantine_until,
    failure_burst_count: state.failure_burst_count,
    last_failure_window_start: state.last_failure_window_start,
  });
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL: Quarantine telemetry
// ═══════════════════════════════════════════════════════════════

async function _recordQuarantineEvent(provider: string, burstCount: number): Promise<void> {
  try {
    const client = sb();
    if (!client) return;
    await client.from('ai_router_executions').insert({
      provider,
      success: false,
      latency_ms: 0,
      error_type: 'quarantine_activated',
      tier: 'system',
      routing_version: 'v2.0-registry-routing',
      routing_primary: provider,
      routing_scores: { burst_count: burstCount, window_ms: BURST_WINDOW_MS, quarantine_ms: QUARANTINE_DURATION_MS },
    });
  } catch { /* NEVER throw */ }
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

    const rebuilt = new Map<string, ProviderHealthState>();
    for (const row of rows) {
      const p = row.provider;
      if (!p || p === 'none') continue;
      let state = rebuilt.get(p);
      if (!state) state = _toHealthState({ provider: p, updated_at: row.created_at });

      if (row.success) {
        state.consecutive_failures = 0;
        state.total_successes++;
        state.last_success_at = row.created_at;
        state.cooldown_until = null;
        state.quarantined = false;
        state.quarantine_until = null;
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

    for (const state of rebuilt.values()) {
      cache.set(state.provider, state);
      _persistState(state).catch(() => {});
    }
    return rebuilt.size;
  } catch { return 0; }
}
