// lib/javari/telemetry/flushTelemetry.ts
// Purpose: Persists in-memory telemetryStore records to javari_execution_logs in Supabase.
//          Called at the end of each worker cycle. Fire-and-forget safe — never throws.
// Date: 2026-03-10
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { telemetryStore, type TaskTelemetry } from './taskTelemetry'
// ── Supabase singleton ────────────────────────────────────────────────────
// ── Row mapper ────────────────────────────────────────────────────────────
// ── Public API ────────────────────────────────────────────────────────────
    // Only flush terminal states — leave "started" records in place
    // Drain flushed records from the in-memory store
    // NEVER throw — telemetry must never break the worker cycle
export default {}
