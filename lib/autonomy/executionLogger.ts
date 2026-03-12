// lib/autonomy/executionLogger.ts
// Purpose: Write structured execution records to autonomy_execution_log.
//          Tracks every AI call made by autonomous execution for cost accounting,
//          debugging, and performance analysis.
// Date: 2026-03-09
// Table schema (create if not exists — see SQL below):
//   autonomy_execution_log (
//     id              uuid primary key default gen_random_uuid(),
//     task_id         text not null,
//     model_used      text not null,
//     cost_estimate   numeric(10,6) default 0,
//     execution_time  integer not null,  -- ms
//     status          text not null,     -- 'success' | 'failed' | 'skipped'
//     error_message   text,
//     tokens_in       integer default 0,
//     tokens_out      integer default 0,
//     provider        text,
//     task_type       text,
//     cycle_id        text,
//     logged_at       timestamptz default now()
//   )
// ── Types ──────────────────────────────────────────────────────────────────
export interface ExecutionLogEntry {
// ── Write ──────────────────────────────────────────────────────────────────
// ── Read helpers ───────────────────────────────────────────────────────────
export interface ExecutionLogSummary {
    // Top models by call count
// ── DDL (run once in Supabase SQL editor) ──────────────────────────────────
export default {}
