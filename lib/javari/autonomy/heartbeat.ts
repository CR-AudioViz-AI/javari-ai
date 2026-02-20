// lib/javari/autonomy/heartbeat.ts
// Javari Autonomous Engine — Heartbeat Monitor
// 2026-02-20 — STEP 2 implementation
//
// Purpose:
//   - Detect tasks stuck in "running" state beyond STALE_THRESHOLD_MS
//   - Re-queue them (increment attempt, set to "pending") for re-execution
//   - Log health analytics to Supabase
//   - Callable from:
//     a) /api/autonomy/heartbeat (Vercel cron, every 5 min)
//     b) executeGraph() (periodic internal check every N tasks)
//
// Design:
//   - Stateless: reads from DB, writes to DB, no in-memory state
//   - Safe to call concurrently (no locks needed — upsert semantics)
//   - Never throws

import { getStuckTasks, resumeTask, failTask } from "./task-store";
import type { HeartbeatReport } from "./types";

// ── Config ────────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 90_000;  // task stuck > 90s = stale
const MAX_RECOVERY_PER_RUN = 10;    // safety cap per heartbeat cycle

// ── Supabase analytics writer (fire-and-forget) ───────────────────────────────

async function logHeartbeatToDb(report: HeartbeatReport): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/javari_heartbeat_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stuck_tasks:    report.stuckTasks,
        recovered_tasks: report.recoveredTasks,
        active_goals:   report.activeGoals,
        health_score:   report.healthScore,
        created_at:     report.timestamp,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Fire-and-forget — heartbeat logging failure is non-fatal
  }
}

// ── Health score ──────────────────────────────────────────────────────────────

function computeHealthScore(stuckCount: number, recoveredCount: number): number {
  if (stuckCount === 0) return 100;
  const ratio = recoveredCount / stuckCount;
  return Math.max(0, Math.round(60 + ratio * 40 - stuckCount * 5));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * runHeartbeat — Detect + recover stuck tasks.
 * Safe to call from cron or inline during execution.
 * Returns a HeartbeatReport (never throws).
 */
export async function runHeartbeat(): Promise<HeartbeatReport> {
  const timestamp = new Date().toISOString();
  const stuckIds: string[]     = [];
  const recoveredIds: string[] = [];

  try {
    const stuckTasks = await getStuckTasks(STALE_THRESHOLD_MS);
    const toProcess  = stuckTasks.slice(0, MAX_RECOVERY_PER_RUN);

    for (const t of toProcess) {
      stuckIds.push(t.task_id);
      const nextAttempt = t.attempt + 1;

      if (nextAttempt < t.max_attempts) {
        // Recover: re-queue for retry
        const ok = await resumeTask(t.goal_id, t.task_id, nextAttempt);
        if (ok) {
          recoveredIds.push(t.task_id);
          console.info(
            `[Heartbeat] Recovered stuck task ${t.task_id} (goal=${t.goal_id}, attempt=${nextAttempt})`
          );
        }
      } else {
        // Exhausted retries: mark failed
        await failTask(
          t.goal_id,
          t.task_id,
          `Heartbeat: task stuck > ${STALE_THRESHOLD_MS / 1000}s, all retries exhausted`,
          t.attempt,
          t.max_attempts
        );
        console.warn(
          `[Heartbeat] Task ${t.task_id} exhausted retries via heartbeat — marked failed`
        );
      }
    }
  } catch (err) {
    console.error("[Heartbeat] Error during stuck-task scan:", err instanceof Error ? err.message : err);
  }

  const report: HeartbeatReport = {
    timestamp,
    stuckTasks:     stuckIds,
    recoveredTasks: recoveredIds,
    activeGoals:    stuckIds.length,  // approximation (could query distinct goal_ids)
    healthScore:    computeHealthScore(stuckIds.length, recoveredIds.length),
  };

  // Fire-and-forget analytics
  logHeartbeatToDb(report).catch(() => {});

  return report;
}

/**
 * shouldRunHeartbeat — Call every N tasks during execution to check
 * if an inline heartbeat is warranted.
 */
export function shouldRunHeartbeat(
  tasksCompleted: number,
  heartbeatInterval = 5
): boolean {
  return tasksCompleted > 0 && tasksCompleted % heartbeatInterval === 0;
}
