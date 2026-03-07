// lib/roadmap/seedTasksFromRoadmap.ts
// Purpose: Insert RoadmapItems extracted from R2 docs into roadmap_tasks table.
//          Deduplicates by title match. Marks source as "r2_ingest".
//          Matches the exact column schema of roadmap_tasks table.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";
import type { RoadmapItem } from "./ingestRoadmapFromR2";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SeedResult {
  ok        : boolean;
  inserted  : number;
  skipped   : number;
  failed    : number;
  tasks     : SeedRecord[];
  error?    : string;
}

export interface SeedRecord {
  id       : string;
  title    : string;
  status   : "inserted" | "skipped" | "failed";
  error?   : string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function makeTaskId(title: string, index: number): string {
  return `r2-${slugify(title)}-${String(index).padStart(3, "0")}`;
}

function supabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY   ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * seedTasksFromRoadmap
 *
 * Inserts a list of RoadmapItems into roadmap_tasks.
 * - Fetches existing titles first to avoid duplicates (no upsert — title is not unique key)
 * - Inserts in batches of 20
 * - Returns a full audit record of every item
 */
export async function seedTasksFromRoadmap(
  items: RoadmapItem[]
): Promise<SeedResult> {
  if (!items.length) {
    return { ok: true, inserted: 0, skipped: 0, failed: 0, tasks: [] };
  }

  const db = supabaseClient();
  const records: SeedRecord[] = [];
  let inserted = 0;
  let skipped  = 0;
  let failed   = 0;

  try {
    // ── Step 1: load existing titles to detect duplicates ────────────────
    const { data: existing } = await db
      .from("roadmap_tasks")
      .select("title");

    const existingTitles = new Set(
      (existing ?? []).map((r: { title: string }) => r.title.trim().toLowerCase())
    );

    // ── Step 2: prepare rows, skip duplicates ────────────────────────────
    const toInsert: Record<string, unknown>[] = [];

    items.forEach((item, i) => {
      const titleKey = item.title.trim().toLowerCase();

      if (existingTitles.has(titleKey)) {
        skipped++;
        records.push({ id: makeTaskId(item.title, i), title: item.title, status: "skipped" });
        return;
      }

      const id = makeTaskId(item.title, i);

      // roadmap_tasks has no metadata column — embed type as structured tag in description
      const descWithType = `[type:${item.type}][priority:${item.priority}] ${item.description}`;

      toInsert.push({
        id,
        title      : item.title,
        description: descWithType,
        depends_on : [],
        status     : "pending",
        source     : "r2_ingest",
        phase_id   : item.phase ?? "r2_auto",
        updated_at : new Date().toISOString(),
      });

      // Add to seen set so we don't double-insert within this batch
      existingTitles.add(titleKey);
      records.push({ id, title: item.title, status: "inserted" });
    });

    if (!toInsert.length) {
      return { ok: true, inserted: 0, skipped, failed, tasks: records };
    }

    // ── Step 3: insert in batches of 20 ─────────────────────────────────
    const BATCH_SIZE = 20;

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);

      const { error } = await db.from("roadmap_tasks").insert(batch);

      if (error) {
        // Mark entire batch as failed with error detail
        for (const row of batch) {
          const rec = records.find(r => r.id === row.id);
          if (rec) {
            rec.status = "failed";
            rec.error  = error.message;
          }
          failed++;
          inserted = Math.max(0, inserted - 1);
        }
      } else {
        inserted += batch.length;
      }
    }

    return { ok: true, inserted, skipped, failed, tasks: records };

  } catch (err) {
    return {
      ok: false, inserted, skipped, failed, tasks: records,
      error: String(err),
    };
  }
}
