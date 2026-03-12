// lib/javari/autonomy/task-store.ts
// Javari Autonomous Engine — Supabase Task State Machine
// 2026-02-20 — STEP 2 implementation
// All reads/writes to javari_task_state table live here.
// Uses service role key for writes (bypasses RLS).
// All functions return Result<T, Error> — never throw.
// Table: javari_task_state (created via migration SQL below)
// See: supabase/migrations/004_javari_task_state.sql
import type { DbTaskState, TaskNode, TaskStatus } from "./types";
// ── Supabase helpers ──────────────────────────────────────────────────────────
// ── Public task state machine ─────────────────────────────────────────────────
export default {}
