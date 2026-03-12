// lib/roadmap/seedTasksFromRoadmap.ts
// Purpose: Insert RoadmapItems extracted from R2 docs into roadmap_tasks table.
//          Deduplicates by title match. Marks source as "r2_ingest".
//          Matches the exact column schema of roadmap_tasks table.
// Date: 2026-03-07
import { createClient } from "@supabase/supabase-js";
import type { RoadmapItem } from "./ingestRoadmapFromR2";
// ── Types ──────────────────────────────────────────────────────────────────
export interface SeedResult {
export interface SeedRecord {
// ── Helpers ────────────────────────────────────────────────────────────────
// ── Main export ────────────────────────────────────────────────────────────
    // ── Step 1: load existing titles to detect duplicates ────────────────
    // ── Step 2: prepare rows, skip duplicates ────────────────────────────
      // roadmap_tasks has no metadata column — embed type as structured tag in description
      // Add to seen set so we don't double-insert within this batch
    // ── Step 3: insert in batches of 20 ─────────────────────────────────
        // Mark entire batch as failed with error detail
export default {}
