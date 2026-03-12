// lib/execution/persistence.ts
// Purpose: Task persistence layer — checkpoint/resume, heartbeat, stall recovery
//          Ensures tasks survive serverless timeouts and cold starts.
// Date: 2026-03-07
import { createClient } from "@supabase/supabase-js";
// Per-call fresh client — avoids stale supabase-js schema cache on long-running processes
// ─── Constants ────────────────────────────────────────────────────────────────
// A task is considered stalled if it has been in_progress for longer than this.
// Vercel serverless functions time out at 300s max; we use 180s as stall threshold.
// Heartbeat interval — tasks write a heartbeat every N ms to prove they're alive
// Max retry attempts before a task is permanently failed
// ─── Checkpoint record ────────────────────────────────────────────────────────
export interface TaskCheckpoint {
// ─── Write checkpoint ─────────────────────────────────────────────────────────
    // Non-fatal — checkpoint failure should never block execution
// ─── Heartbeat ────────────────────────────────────────────────────────────────
// Call this periodically during long-running tasks to prevent stall detection.
// ─── Clear checkpoint ─────────────────────────────────────────────────────────
// ─── Read checkpoint ──────────────────────────────────────────────────────────
// ─── Recover stalled tasks ────────────────────────────────────────────────────
// Scans for tasks stuck in in_progress whose lock has expired.
// Resets them to pending or retry, ready for re-execution.
export interface StalledTask {
  // Find checkpoints whose lock has expired
      // Too many attempts — permanently fail
      // Reset to retry with incremented attempt counter
// ─── Lock task for execution ──────────────────────────────────────────────────
// Atomically marks a task as in_progress and creates its initial checkpoint.
// Returns false if task was already locked (prevents duplicate execution).
  // Try to update task to in_progress only if currently pending or retry
  // NOTE: updated_at is stored as integer epoch seconds in roadmap_tasks
  // Write initial checkpoint
    // Non-fatal — lock was acquired, proceed
// ─── Release task lock ────────────────────────────────────────────────────────
// ─── Background heartbeat loop ────────────────────────────────────────────────
// Returns a cleanup function. Call it to stop the heartbeat.
// ─── Persistence stats ────────────────────────────────────────────────────────
export default {}
