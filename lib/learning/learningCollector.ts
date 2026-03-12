// lib/learning/learningCollector.ts
// Purpose: Collects learning signals from all Javari subsystems — code intelligence
//          scans, crawler audits, repair results, ecosystem analysis — and stores
//          structured learning events for knowledge growth tracking.
// Date: 2026-03-07
import { createClient } from "@supabase/supabase-js";
// ── Types ──────────────────────────────────────────────────────────────────
export type LearningEventType =
export type KnowledgeDomain =
export interface LearningEvent {
// ── Supabase ───────────────────────────────────────────────────────────────
// ── Migration ─────────────────────────────────────────────────────────────
// ── Core write ────────────────────────────────────────────────────────────
// ── Ingest from existing platform data ───────────────────────────────────
  // Pull roadmap tasks to learn from
    // Determine domain from task content
    // Determine technology from task content
  // Pull engineering cycles
  // Pull ecosystem registry for tech encounters
  // Dedup: check which IDs don't exist yet (use source+details hash approach — just batch insert with ignore)
// ── Raw query helpers ─────────────────────────────────────────────────────
export default {}
