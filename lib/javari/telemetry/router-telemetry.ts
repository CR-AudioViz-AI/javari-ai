// lib/javari/telemetry/router-telemetry.ts
// Router v4 Telemetry — persistent cost & execution tracking
// Created: 2026-03-01
//
// CRITICAL: Logging failures NEVER break the router.
// Every public function catches all errors internally.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface RouterTelemetryEvent {
  tier?: string;
  provider: string;
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  latency_ms: number;
  retries?: number;
  success: boolean;
  error_type?: string;
  session_id?: string;
  user_id?: string;
  circuit_breaker_triggered?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT (lazy singleton)
// ═══════════════════════════════════════════════════════════════

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Record a router execution event.
 * Fire-and-forget — NEVER throws, NEVER blocks the router.
 */
export function recordRouterExecution(event: RouterTelemetryEvent): void {
  // Intentionally not awaited — fire and forget
  _insertEvent(event).catch(() => {
    // Swallow ALL errors — telemetry must never break routing
  });
}

/**
 * Awaitable version for tests/admin that want confirmation.
 */
export async function recordRouterExecutionAsync(event: RouterTelemetryEvent): Promise<boolean> {
  return _insertEvent(event);
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Classify HTTP error codes into human-readable error types.
 */
export function classifyError(error: unknown): string {
  if (!error) return 'unknown';
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('401')) return 'auth_invalid';
  if (msg.includes('403')) return 'auth_forbidden';
  if (msg.includes('404')) return 'model_not_found';
  if (msg.includes('429')) return 'rate_limited';
  if (msg.includes('500')) return 'provider_error';
  if (msg.includes('502') || msg.includes('503')) return 'provider_unavailable';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNABORTED')) return 'timeout';
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) return 'network_error';
  if (msg.includes('AbortError')) return 'aborted';
  if (msg.includes('cost') || msg.includes('Cost')) return 'cost_ceiling';
  if (msg.includes('ROUTER_ALL_PROVIDERS_FAILED')) return 'all_providers_failed';

  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL
// ═══════════════════════════════════════════════════════════════

async function _insertEvent(event: RouterTelemetryEvent): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase.from('ai_router_executions').insert({
      tier:                       event.tier ?? null,
      provider:                   event.provider,
      model:                      event.model ?? null,
      prompt_tokens:              event.prompt_tokens ?? 0,
      completion_tokens:          event.completion_tokens ?? 0,
      total_tokens:               event.total_tokens ?? (event.prompt_tokens ?? 0) + (event.completion_tokens ?? 0),
      cost:                       event.cost ?? 0,
      latency_ms:                 event.latency_ms,
      retries:                    event.retries ?? 0,
      success:                    event.success,
      error_type:                 event.error_type ?? null,
      session_id:                 event.session_id ?? null,
      user_id:                    event.user_id ?? null,
      circuit_breaker_triggered:  event.circuit_breaker_triggered ?? false,
    });

    if (error) {
      console.warn('[RouterTelemetry] Insert failed:', error.message);
      return false;
    }

    return true;
  } catch {
    // NEVER throw — telemetry is non-critical
    return false;
  }
}
