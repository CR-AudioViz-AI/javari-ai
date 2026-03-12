// lib/execution/queue.ts
// Purpose: Execution queue — sequential task execution with guardrails, dependency
//          resolution, audit logging, roadmap-only enforcement, and persistence
// Date: 2026-03-07
import { createClient } from "@supabase/supabase-js";
import { executeGateway } from "./gateway";
import { runGuardrails, GuardrailReport } from "./guardrails";
import {
import { runRoadmapWorker } from "./roadmapWorker";
// Fresh client factory — called per-operation to avoid stale PostgREST schema cache.
// Module-level supabase-js clients cache schema on init; tables created after startup
// may be invisible until the process restarts. Per-call clients bypass this.
export interface Task {
export interface ExecutionLog {
// ─── Roadmap-only enforcement ─────────────────────────────────────────────────
// The planner will never generate discovery tasks, but this is a defense-in-depth
// check at the executor level. Any non-roadmap task is quarantined immediately.
// ─── Fetch executable tasks ───────────────────────────────────────────────────
// ─── Status update ────────────────────────────────────────────────────────────
// ─── Log execution ────────────────────────────────────────────────────────────
// Uses raw fetch() against PostgREST to bypass supabase-js TypeScript type cache.
// supabase-js generated types may not include execution_logs if it was created
// after the last `supabase gen types` run. Raw fetch bypasses this limitation.
// ─── Execute single task ──────────────────────────────────────────────────────
  // ── Persistence: acquire execution lock (atomic, prevents duplicate runs) ──
    // Task was picked up by a concurrent executor — skip gracefully (not a failure)
  // Start heartbeat to keep lock alive during long-running execution
  // ── Guardrail: roadmap-only enforcement ────────────────────────────────────
  // Mark as in_progress before running guardrails (so migration check can detect it)
  // ── Run all guardrails ─────────────────────────────────────────────────────
    // Revert to pending if rollback — retry later; failed if hard block
  // ── Execute via gateway ────────────────────────────────────────────────────
    // ── Verification gate: never write completed directly ────────────────
    // Move to verifying first, then call verify-task which owns the
    // completed transition. This enforces the artifact proof requirement.
    // Step A: mark verifying
    // Step B: call verification gate
    // If AI declared retry or verify failed, revert to retry
    // If verified completed, verify-task already wrote the status — nothing to do here
// ─── Process queue ─────────────────────────────────────────────────────────────
// Routes through runRoadmapWorker when available, ensuring the full verified
// lifecycle: pending → in_progress → verifying → completed | retry | blocked.
// Falls back to the legacy per-task path if the worker fails.
    // Worker init failed — fall back to legacy per-task execution
// ─── Queue stats ──────────────────────────────────────────────────────────────
export default {}
