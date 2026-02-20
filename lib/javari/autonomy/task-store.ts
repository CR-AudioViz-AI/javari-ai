// lib/javari/autonomy/task-store.ts
// Javari Autonomous Engine — Supabase Task State Machine
// 2026-02-20 — STEP 2 implementation
//
// All reads/writes to javari_task_state table live here.
// Uses service role key for writes (bypasses RLS).
// All functions return Result<T, Error> — never throw.
//
// Table: javari_task_state (created via migration SQL below)
// See: supabase/migrations/004_javari_task_state.sql

import type { DbTaskState, TaskNode, TaskStatus } from "./types";

// ── Supabase helpers ──────────────────────────────────────────────────────────

function getSupabaseConfig(): { url: string; headers: Record<string, string> } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn("[TaskStore] Supabase not configured — task persistence disabled");
    return null;
  }
  return {
    url,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  };
}

async function supabaseUpsert(
  table: string,
  row: Record<string, unknown>,
  onConflict: string
): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/${table}?on_conflict=${onConflict}`,
      {
        method: "POST",
        headers: { ...cfg.headers, Prefer: "return=minimal,resolution=merge-duplicates" },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(8_000),
      }
    );
    return res.ok;
  } catch (err) {
    console.error(`[TaskStore] upsert ${table} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function supabasePatch(
  table: string,
  filter: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/${table}?${filter}`,
      {
        method: "PATCH",
        headers: cfg.headers,
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    return res.ok;
  } catch (err) {
    console.error(`[TaskStore] patch ${table} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function supabaseSelect<T>(
  table: string,
  filter: string,
  select = "*"
): Promise<T[]> {
  const cfg = getSupabaseConfig();
  if (!cfg) return [];

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/${table}?select=${select}&${filter}`,
      {
        method: "GET",
        headers: { ...cfg.headers, Prefer: "return=representation" },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

// ── Public task state machine ─────────────────────────────────────────────────

/**
 * begin_task — Insert or reset a task row to "running".
 * Idempotent: safe to call multiple times (upsert on task_id+goal_id).
 */
export async function beginTask(
  node: TaskNode,
  goalId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const row: Partial<DbTaskState> = {
    goal_id:        goalId,
    task_id:        node.id,
    task_title:     node.title,
    task_type:      node.type,
    status:         "running",
    attempt:        node.attempt,
    max_attempts:   node.maxAttempts,
    output:         null,
    error:          null,
    provider:       node.routing.provider,
    model:          node.routing.model,
    validation_score:   null,
    validation_passed:  null,
    memory_chunk_id:    null,
    routing_meta:   node.routing as Record<string, unknown>,
    started_at:     now,
    completed_at:   null,
    duration_ms:    null,
    created_at:     now,
    updated_at:     now,
  };
  return supabaseUpsert("javari_task_state", row as Record<string, unknown>, "goal_id,task_id");
}

/**
 * updateTask — Update status / attempt mid-execution.
 */
export async function updateTask(
  goalId: string,
  taskId: string,
  patch: Partial<Pick<DbTaskState, "status" | "attempt" | "error">>
): Promise<boolean> {
  return supabasePatch(
    "javari_task_state",
    `goal_id=eq.${goalId}&task_id=eq.${taskId}`,
    patch
  );
}

/**
 * completeTask — Mark done, write output + validation results.
 */
export async function completeTask(
  goalId: string,
  taskId: string,
  output: string,
  meta: {
    provider: string;
    model: string;
    validationScore?: number;
    validationPassed?: boolean;
    memoryChunkId?: string;
    durationMs?: number;
  }
): Promise<boolean> {
  const now = new Date().toISOString();
  return supabasePatch(
    "javari_task_state",
    `goal_id=eq.${goalId}&task_id=eq.${taskId}`,
    {
      status:           "done",
      output,
      provider:         meta.provider,
      model:            meta.model,
      validation_score:  meta.validationScore ?? null,
      validation_passed: meta.validationPassed ?? null,
      memory_chunk_id:   meta.memoryChunkId ?? null,
      duration_ms:       meta.durationMs ?? null,
      completed_at:     now,
    }
  );
}

/**
 * failTask — Mark failed with error. If attempts remain, status stays "pending" for retry.
 */
export async function failTask(
  goalId: string,
  taskId: string,
  error: string,
  attempt: number,
  maxAttempts: number
): Promise<boolean> {
  const willRetry = attempt + 1 < maxAttempts;
  return supabasePatch(
    "javari_task_state",
    `goal_id=eq.${goalId}&task_id=eq.${taskId}`,
    {
      status: willRetry ? "retrying" : "failed",
      error,
      attempt,
      completed_at: willRetry ? null : new Date().toISOString(),
    }
  );
}

/**
 * resumeTask — Increment attempt counter and set back to "running".
 */
export async function resumeTask(
  goalId: string,
  taskId: string,
  attempt: number
): Promise<boolean> {
  return supabasePatch(
    "javari_task_state",
    `goal_id=eq.${goalId}&task_id=eq.${taskId}`,
    {
      status:     "running",
      attempt,
      started_at: new Date().toISOString(),
      error:      null,
    }
  );
}

/**
 * getStuckTasks — Find tasks in "running" state older than staleMs.
 */
export async function getStuckTasks(staleMs = 60_000): Promise<DbTaskState[]> {
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  return supabaseSelect<DbTaskState>(
    "javari_task_state",
    `status=eq.running&started_at=lt.${cutoff}`,
    "goal_id,task_id,task_title,attempt,max_attempts,started_at"
  );
}

/**
 * getGoalTasks — Return all tasks for a given goalId.
 */
export async function getGoalTasks(goalId: string): Promise<DbTaskState[]> {
  return supabaseSelect<DbTaskState>(
    "javari_task_state",
    `goal_id=eq.${goalId}`,
    "*"
  );
}

/**
 * escalateTask — Flag task for human review.
 */
export async function escalateTask(
  goalId: string,
  taskId: string,
  reason: string
): Promise<boolean> {
  return supabasePatch(
    "javari_task_state",
    `goal_id=eq.${goalId}&task_id=eq.${taskId}`,
    {
      status: "escalated",
      error:  `ESCALATED: ${reason}`,
    }
  );
}
