// lib/execution/persistence.ts
// Purpose: Task persistence layer — checkpoint/resume, heartbeat, stall recovery
//          Ensures tasks survive serverless timeouts and cold starts.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const PERSISTENCE_VERSION = "1.0.0";

// ─── Constants ────────────────────────────────────────────────────────────────
// A task is considered stalled if it has been in_progress for longer than this.
// Vercel serverless functions time out at 300s max; we use 180s as stall threshold.
const STALL_THRESHOLD_MS = 180_000; // 3 minutes

// Heartbeat interval — tasks write a heartbeat every N ms to prove they're alive
export const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

// Max retry attempts before a task is permanently failed
const MAX_RETRY_ATTEMPTS = 3;

// ─── Checkpoint record ────────────────────────────────────────────────────────
export interface TaskCheckpoint {
  task_id: string;
  execution_id: string;
  phase: "starting" | "building" | "validating" | "completing" | "done";
  progress_pct: number;      // 0–100
  partial_output?: string;   // Last known partial output
  last_heartbeat: string;    // ISO timestamp
  attempt: number;
  locked_at: string;         // When in_progress was first set
  lock_expires_at: string;   // Stall threshold — after this, task is recoverable
}

// ─── Write checkpoint ─────────────────────────────────────────────────────────
export async function writeCheckpoint(
  taskId: string,
  executionId: string,
  phase: TaskCheckpoint["phase"],
  progressPct: number,
  partialOutput?: string
): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + STALL_THRESHOLD_MS);

  const { error } = await supabase
    .from("task_checkpoints")
    .upsert({
      task_id: taskId,
      execution_id: executionId,
      phase,
      progress_pct: progressPct,
      partial_output: partialOutput ?? null,
      last_heartbeat: now.toISOString(),
      lock_expires_at: expires.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "task_id" });

  if (error) {
    // Non-fatal — checkpoint failure should never block execution
    console.warn(`[persistence] Checkpoint write failed for ${taskId}: ${error.message}`);
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────
// Call this periodically during long-running tasks to prevent stall detection.
export async function heartbeat(taskId: string): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + STALL_THRESHOLD_MS);

  const { error } = await supabase
    .from("task_checkpoints")
    .update({
      last_heartbeat: now.toISOString(),
      lock_expires_at: expires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("task_id", taskId);

  if (error) {
    console.warn(`[persistence] Heartbeat failed for ${taskId}: ${error.message}`);
  }
}

// ─── Clear checkpoint ─────────────────────────────────────────────────────────
export async function clearCheckpoint(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("task_checkpoints")
    .delete()
    .eq("task_id", taskId);

  if (error) {
    console.warn(`[persistence] Checkpoint clear failed for ${taskId}: ${error.message}`);
  }
}

// ─── Read checkpoint ──────────────────────────────────────────────────────────
export async function readCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
  const { data, error } = await supabase
    .from("task_checkpoints")
    .select("*")
    .eq("task_id", taskId)
    .single();

  if (error || !data) return null;
  return data as TaskCheckpoint;
}

// ─── Recover stalled tasks ────────────────────────────────────────────────────
// Scans for tasks stuck in in_progress whose lock has expired.
// Resets them to pending or retry, ready for re-execution.
export interface StalledTask {
  task_id: string;
  execution_id: string;
  stalled_for_ms: number;
  phase: string;
  attempt: number;
}

export async function recoverStalledTasks(): Promise<{
  recovered: StalledTask[];
  permanently_failed: string[];
}> {
  const now = new Date().toISOString();

  // Find checkpoints whose lock has expired
  const { data: stalled, error: stallErr } = await supabase
    .from("task_checkpoints")
    .select("*")
    .lt("lock_expires_at", now);

  if (stallErr || !stalled || stalled.length === 0) {
    return { recovered: [], permanently_failed: [] };
  }

  const recovered: StalledTask[] = [];
  const permanentlyFailed: string[] = [];

  for (const checkpoint of stalled as TaskCheckpoint[]) {
    const stalledForMs = Date.now() - new Date(checkpoint.locked_at).getTime();
    const nextAttempt = (checkpoint.attempt ?? 0) + 1;

    if (nextAttempt > MAX_RETRY_ATTEMPTS) {
      // Too many attempts — permanently fail
      await supabase
        .from("roadmap_tasks")
        .update({ status: "failed", updated_at: Math.floor(Date.now() / 1000) })
        .eq("id", checkpoint.task_id);

      await clearCheckpoint(checkpoint.task_id);
      permanentlyFailed.push(checkpoint.task_id);

      console.error(
        `[persistence] Task ${checkpoint.task_id} permanently failed after ${nextAttempt} attempts`
      );
    } else {
      // Reset to retry with incremented attempt counter
      await supabase
        .from("roadmap_tasks")
        .update({ status: "retry", updated_at: Math.floor(Date.now() / 1000) })
        .eq("id", checkpoint.task_id);

      await supabase
        .from("task_checkpoints")
        .update({ attempt: nextAttempt, updated_at: new Date().toISOString() })
        .eq("task_id", checkpoint.task_id);

      recovered.push({
        task_id: checkpoint.task_id,
        execution_id: checkpoint.execution_id,
        stalled_for_ms: stalledForMs,
        phase: checkpoint.phase,
        attempt: nextAttempt,
      });

      console.log(
        `[persistence] Recovered stalled task ${checkpoint.task_id} ` +
        `(stalled ${Math.round(stalledForMs / 1000)}s, attempt ${nextAttempt}/${MAX_RETRY_ATTEMPTS})`
      );
    }
  }

  return { recovered, permanently_failed: permanentlyFailed };
}

// ─── Lock task for execution ──────────────────────────────────────────────────
// Atomically marks a task as in_progress and creates its initial checkpoint.
// Returns false if task was already locked (prevents duplicate execution).
export async function acquireTaskLock(
  taskId: string,
  executionId: string
): Promise<boolean> {
  const now = new Date();
  const expires = new Date(now.getTime() + STALL_THRESHOLD_MS);

  // Try to update task to in_progress only if currently pending or retry
  // NOTE: updated_at is stored as integer epoch seconds in roadmap_tasks
  const { data, error } = await supabase
    .from("roadmap_tasks")
    .update({
      status: "in_progress",
      updated_at: Math.floor(now.getTime() / 1000),
    })
    .in("status", ["pending", "retry"])
    .eq("id", taskId)
    .select("id");

  if (error || !data || data.length === 0) {
    console.warn(`[persistence] Failed to acquire lock for ${taskId} — already locked or missing`);
    return false;
  }

  // Write initial checkpoint
  const { error: cpErr } = await supabase
    .from("task_checkpoints")
    .upsert({
      task_id: taskId,
      execution_id: executionId,
      phase: "starting",
      progress_pct: 0,
      partial_output: null,
      last_heartbeat: now.toISOString(),
      locked_at: now.toISOString(),
      lock_expires_at: expires.toISOString(),
      attempt: 0,
      updated_at: now.toISOString(),
    }, { onConflict: "task_id" });

  if (cpErr) {
    console.warn(`[persistence] Checkpoint init failed for ${taskId}: ${cpErr.message}`);
    // Non-fatal — lock was acquired, proceed
  }

  return true;
}

// ─── Release task lock ────────────────────────────────────────────────────────
export async function releaseTaskLock(
  taskId: string,
  finalStatus: "completed" | "failed"
): Promise<void> {
  await supabase
    .from("roadmap_tasks")
    .update({ status: finalStatus, updated_at: Math.floor(Date.now() / 1000) })
    .eq("id", taskId);

  await clearCheckpoint(taskId);
}

// ─── Background heartbeat loop ────────────────────────────────────────────────
// Returns a cleanup function. Call it to stop the heartbeat.
export function startHeartbeat(taskId: string): () => void {
  const interval = setInterval(async () => {
    await heartbeat(taskId);
  }, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(interval);
}

// ─── Persistence stats ────────────────────────────────────────────────────────
export async function getPersistenceStats(): Promise<{
  active_checkpoints: number;
  stalled_count: number;
  oldest_checkpoint_ms: number | null;
}> {
  const now = new Date().toISOString();

  const { data: all, error } = await supabase
    .from("task_checkpoints")
    .select("lock_expires_at, locked_at");

  if (error || !all) {
    return { active_checkpoints: 0, stalled_count: 0, oldest_checkpoint_ms: null };
  }

  const stalled = all.filter((c: { lock_expires_at: string }) => c.lock_expires_at < now);
  const oldest = all.reduce((min: number | null, c: { locked_at: string }) => {
    const age = Date.now() - new Date(c.locked_at).getTime();
    return min === null ? age : Math.max(min, age);
  }, null as number | null);

  return {
    active_checkpoints: all.length,
    stalled_count: stalled.length,
    oldest_checkpoint_ms: oldest,
  };
}
