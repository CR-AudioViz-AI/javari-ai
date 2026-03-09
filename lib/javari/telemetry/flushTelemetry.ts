// lib/javari/telemetry/flushTelemetry.ts
// Purpose: Persists in-memory telemetryStore records to javari_execution_logs in Supabase.
//          Called at the end of each worker cycle. Fire-and-forget safe — never throws.
// Date: 2026-03-10

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { telemetryStore, type TaskTelemetry } from './taskTelemetry'

// ── Supabase singleton ────────────────────────────────────────────────────

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

// ── Row mapper ────────────────────────────────────────────────────────────

function toRow(t: TaskTelemetry) {
  return {
    task_id:           t.taskId,
    title:             t.title,
    phase:             t.phase,
    status:            t.status,
    started_at:        t.startedAt,
    completed_at:      t.completedAt   ?? null,
    duration_ms:       t.durationMs    ?? null,
    model_used:        t.modelUsed     ?? null,
    tokens_prompt:     t.tokensPrompt  ?? null,
    tokens_completion: t.tokensCompletion ?? null,
    cost_usd:          t.costUsd       ?? null,
    error:             t.error         ?? null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Flush all completed/failed records from telemetryStore to Supabase.
 * Skips records still in "started" state (mid-execution).
 * Drains flushed records from the store to prevent duplicate writes.
 *
 * Fire-and-forget safe — catches all errors internally.
 * Returns count of records successfully written (0 on any failure).
 */
export async function flushTelemetry(): Promise<number> {
  try {
    const supabase = getClient()
    if (!supabase) {
      console.warn('[flushTelemetry] Supabase client unavailable — skipping flush')
      return 0
    }

    // Only flush terminal states — leave "started" records in place
    const flushable = telemetryStore.filter(
      t => t.status === 'completed' || t.status === 'failed'
    )

    if (flushable.length === 0) return 0

    const rows = flushable.map(toRow)

    const { error } = await supabase
      .from('javari_execution_logs')
      .insert(rows)

    if (error) {
      console.warn('[flushTelemetry] Insert failed:', error.message)
      return 0
    }

    // Drain flushed records from the in-memory store
    const flushedIds = new Set(flushable.map(t => t.taskId))
    let i = telemetryStore.length
    while (i--) {
      if (flushedIds.has(telemetryStore[i].taskId)) {
        telemetryStore.splice(i, 1)
      }
    }

    console.info(`[flushTelemetry] Flushed ${rows.length} execution log(s) to Supabase`)
    return rows.length

  } catch (err) {
    // NEVER throw — telemetry must never break the worker cycle
    console.warn('[flushTelemetry] Unexpected error:', err instanceof Error ? err.message : String(err))
    return 0
  }
}

/**
 * Fire-and-forget wrapper — call this from the worker cycle end.
 * Does not block the cycle return value.
 */
export function flushTelemetryAsync(): void {
  flushTelemetry().catch(() => {})
}
