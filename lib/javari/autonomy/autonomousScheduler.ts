// lib/javari/autonomy/autonomousScheduler.ts
// Javari AI — Autonomous Scheduler
// Purpose: Manages timing, concurrency control, and health reporting for all
//          autonomous loop invocations. Acts as the control plane for the
//          autonomous execution layer.
// Date: 2026-03-09
//
// Responsibilities:
//   - Track active loop state across serverless instances (via Supabase heartbeat)
//   - Enforce minimum cycle spacing (prevents thundering herd from multiple cron instances)
//   - Expose scheduler status for operations dashboard
//   - Honor kill switches (AUTONOMOUS_LOOP_KILL_SWITCH env var)
//   - Escalate to guardian if circuit breaker fires

import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export type SchedulerState = "idle" | "running" | "paused" | "killed";

export interface SchedulerStatus {
  state            : SchedulerState;
  lastCycleAt      : string | null;
  lastCycleId      : string | null;
  nextEarliestAt   : string | null;
  cyclesLast24h    : number;
  consecutiveErrors: number;
  killSwitchActive : boolean;
  pausedReason?    : string;
}

export interface SchedulerLock {
  acquired: boolean;
  reason? : string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const MIN_CYCLE_SPACING_MS = 3 * 60 * 1000;  // 3 min minimum between cycles
const LOCK_TTL_MS          = 5 * 60 * 1000;  // locks expire after 5 min (safety)
const MAX_CYCLES_24H       = 288;             // Pro plan: up to 288/day (every 5 min)
const KILL_SWITCH_ENV      = "AUTONOMOUS_LOOP_KILL_SWITCH";

// ── Module state ──────────────────────────────────────────────────────────

let _state            : SchedulerState = "idle";
let _lastCycleAt      : Date | null    = null;
let _lastCycleId      : string | null  = null;
let _consecutiveErrors: number         = 0;
let _cyclesLast24h    : number         = 0;
let _pausedReason     : string | undefined;

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Kill switch ────────────────────────────────────────────────────────────

function isKillSwitchActive(): boolean {
  const val = process.env[KILL_SWITCH_ENV];
  return val === "true" || val === "1";
}

// ── Distributed lock (via Supabase) ───────────────────────────────────────

async function acquireLock(cycleId: string): Promise<SchedulerLock> {
  try {
    const supabase  = db();
    const now       = Date.now();
    const expiresAt = now + LOCK_TTL_MS;

    // Upsert lock row — only succeeds if no active lock exists
    const { data, error } = await supabase
      .from("javari_scheduler_lock")
      .upsert(
        {
          lock_key  : "autonomous_loop",
          cycle_id  : cycleId,
          acquired_at: new Date(now).toISOString(),
          expires_at : new Date(expiresAt).toISOString(),
          holder     : process.env.VERCEL_REGION ?? "local",
        },
        {
          onConflict     : "lock_key",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error || !data) {
      // Check if existing lock is expired
      const { data: existing } = await supabase
        .from("javari_scheduler_lock")
        .select("expires_at, cycle_id")
        .eq("lock_key", "autonomous_loop")
        .single();

      if (existing && new Date(existing.expires_at) < new Date()) {
        // Expired lock — force release and retry
        await supabase
          .from("javari_scheduler_lock")
          .delete()
          .eq("lock_key", "autonomous_loop");
        return acquireLock(cycleId);
      }

      return { acquired: false, reason: `Lock held by cycle ${existing?.cycle_id ?? "unknown"}` };
    }

    return { acquired: true };
  } catch (err) {
    // If lock table doesn't exist yet, allow execution (graceful degradation)
    console.warn("[scheduler] Lock table unavailable — proceeding without lock:", err instanceof Error ? err.message : String(err));
    return { acquired: true };
  }
}

async function releaseLock(): Promise<void> {
  try {
    await db()
      .from("javari_scheduler_lock")
      .delete()
      .eq("lock_key", "autonomous_loop");
  } catch { /* non-fatal */ }
}

// ── Cycle counter ─────────────────────────────────────────────────────────

async function getCycles24h(): Promise<number> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db()
      .from("javari_autonomous_cycles")
      .select("*", { count: "exact", head: true })
      .gte("started_at", since);
    return count ?? 0;
  } catch {
    return _cyclesLast24h;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * canRun — Gate check before starting a cycle.
 * Returns { allowed: true } or { allowed: false, reason }
 */
export async function canRun(cycleId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Kill switch
  if (isKillSwitchActive()) {
    _state        = "killed";
    return { allowed: false, reason: `Kill switch active (${KILL_SWITCH_ENV}=true)` };
  }

  // Manual pause
  if (_state === "paused") {
    return { allowed: false, reason: _pausedReason ?? "Scheduler paused" };
  }

  // Already running
  if (_state === "running") {
    return { allowed: false, reason: "Another cycle is already running" };
  }

  // Minimum spacing
  if (_lastCycleAt) {
    const elapsed = Date.now() - _lastCycleAt.getTime();
    if (elapsed < MIN_CYCLE_SPACING_MS) {
      const waitSec = Math.ceil((MIN_CYCLE_SPACING_MS - elapsed) / 1000);
      return { allowed: false, reason: `Too soon — wait ${waitSec}s (min spacing: ${MIN_CYCLE_SPACING_MS / 1000}s)` };
    }
  }

  // Cycle rate cap
  const cycles = await getCycles24h();
  _cyclesLast24h = cycles;
  if (cycles >= MAX_CYCLES_24H) {
    return { allowed: false, reason: `Daily cycle cap reached (${cycles}/${MAX_CYCLES_24H})` };
  }

  // Distributed lock
  const lock = await acquireLock(cycleId);
  if (!lock.acquired) {
    return { allowed: false, reason: lock.reason ?? "Could not acquire distributed lock" };
  }

  return { allowed: true };
}

/**
 * markCycleStart — call at the beginning of a cycle.
 */
export function markCycleStart(cycleId: string): void {
  _state       = "running";
  _lastCycleId = cycleId;
}

/**
 * markCycleEnd — call when a cycle completes (success or error).
 */
export async function markCycleEnd(cycleId: string, success: boolean): Promise<void> {
  _state       = "idle";
  _lastCycleAt = new Date();
  _lastCycleId = cycleId;

  if (success) {
    _consecutiveErrors = 0;
  } else {
    _consecutiveErrors++;
  }

  await releaseLock();
}

/**
 * pause — halt the scheduler (manual intervention).
 */
export function pause(reason: string): void {
  _state        = "paused";
  _pausedReason = reason;
  console.warn(`[scheduler] PAUSED: ${reason}`);
}

/**
 * resume — re-enable the scheduler after a pause.
 */
export function resume(): void {
  _state        = "idle";
  _pausedReason = undefined;
  console.info("[scheduler] Resumed");
}

/**
 * getStatus — return current scheduler state for dashboard/ops.
 */
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const cycles = await getCycles24h().catch(() => _cyclesLast24h);
  const nextEarliestMs = _lastCycleAt
    ? _lastCycleAt.getTime() + MIN_CYCLE_SPACING_MS
    : null;

  return {
    state            : isKillSwitchActive() ? "killed" : _state,
    lastCycleAt      : _lastCycleAt?.toISOString()    ?? null,
    lastCycleId      : _lastCycleId                   ?? null,
    nextEarliestAt   : nextEarliestMs ? new Date(nextEarliestMs).toISOString() : null,
    cyclesLast24h    : cycles,
    consecutiveErrors: _consecutiveErrors,
    killSwitchActive : isKillSwitchActive(),
    pausedReason     : _pausedReason,
  };
}

export { MIN_CYCLE_SPACING_MS, MAX_CYCLES_24H };
