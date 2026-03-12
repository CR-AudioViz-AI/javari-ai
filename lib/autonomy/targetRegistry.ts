// lib/autonomy/targetRegistry.ts
// Purpose: Target Registry — manages the list of systems Javari monitors and
//          repairs. Targets are persisted in javari_targets table. Includes
//          idempotent table migration, CRUD operations, and seed data for the
//          primary CR AudioViz AI platform.
// Date: 2026-03-07
import { createClient, SupabaseClient } from "@supabase/supabase-js";
// ── Types ──────────────────────────────────────────────────────────────────
export type TargetType   = "repo" | "website" | "api" | "service";
export type TargetStatus = "active" | "paused" | "error" | "archived";
export interface JavariTarget {
export interface TargetUpsert {
// ── Default scan intervals (minutes) ──────────────────────────────────────
// ── Migration SQL ──────────────────────────────────────────────────────────
// ── Default seed targets ───────────────────────────────────────────────────
// ── Supabase client ────────────────────────────────────────────────────────
// ── Migration runner ───────────────────────────────────────────────────────
  // Try via rpc/exec_sql — same pattern as auto-migrate
  // exec_sql uses { sql } key; query rpc uses { query } key
  // If RPC unavailable, check if table already exists by querying it
// ── CRUD ───────────────────────────────────────────────────────────────────
  // Filter by each target's individual scan interval
// ── Row mapper ─────────────────────────────────────────────────────────────
export default {}
