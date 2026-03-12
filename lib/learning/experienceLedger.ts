// lib/learning/experienceLedger.ts
// Purpose: Tracks Javari's exposure to specific technologies — occurrences,
//          projects seen, issues detected and resolved. Persists to
//          javari_technology_experience for cross-session accumulation.
// Date: 2026-03-07
import { createClient }   from "@supabase/supabase-js";
import type { LearningEvent } from "./learningCollector";
// ── Types ──────────────────────────────────────────────────────────────────
export interface TechnologyExperience {
export type TechCategory =
export interface ExperienceLedgerReport {
// ── Tech category map ──────────────────────────────────────────────────────
// ── Mastery calculator ─────────────────────────────────────────────────────
// ── Supabase ───────────────────────────────────────────────────────────────
// ── Aggregate from learning events ────────────────────────────────────────
// ── Persist to DB ──────────────────────────────────────────────────────────
export default {}
