// app/api/canonical/ingest-ecosystem-v3/route.ts
// CR AudioViz AI — Full Canonical Ecosystem Roadmap Ingestion v3
// Generated: 2026-03-10T18:53:19Z
// Strategy: Fetches task catalog from canonical store at runtime
// Total catalog: 21,870 tasks across 11 phases
// Idempotent: upsert with ignoreDuplicates — safe to re-run
//
// POST /api/canonical/ingest-ecosystem-v3 — run full ingestion
// GET  /api/canonical/ingest-ecosystem-v3 — check status

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 300;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

const GITHUB_TOKEN   = process.env.GITHUB_TOKEN ?? process.env.GH_PAT ?? "";
const CATALOG_REPO   = "CR-AudioViz-AI/javari-ai";
const CATALOG_PATH   = "data/ecosystem-roadmap-v3.json";
const CATALOG_URL    = `https://api.github.com/repos/${CATALOG_REPO}/contents/${CATALOG_PATH}`;
const TOTAL_TASKS    = 21870;

interface TaskRow {
  id         : string;
  roadmap_id : string;
  phase_id   : string;
  title      : string;
  description: string;
  depends_on : string[];
  status     : "pending";
  source     : string;
  updated_at : number;
}

async function fetchCatalog(): Promise<TaskRow[]> {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN / GH_PAT not configured");

  const res = await fetch(CATALOG_URL, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GitHub fetch failed: HTTP ${res.status} for ${CATALOG_PATH}`);
  }

  const item = await res.json() as { content: string };
  const decoded = Buffer.from(item.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return JSON.parse(decoded) as TaskRow[];
}

export async function POST(req: NextRequest) {
  const start  = Date.now();
  const client = db();

  try {
    // Auth guard
    const secret = process.env.INGESTION_SECRET;
    const header = req.headers.get("x-ingestion-secret");
    if (secret && header !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Load catalog from GitHub
    console.log("[ingest-v3] Fetching task catalog from GitHub...");
    const tasks = await fetchCatalog();
    console.log(`[ingest-v3] Catalog loaded: ${tasks.length} tasks`);

    // Current count
    const { count: before } = await client
      .from("roadmap_tasks")
      .select("id", { count: "exact", head: true });

    let inserted = 0;
    let batchErrors = 0;

    // Micro-batch upserts
    const BATCH = 100;
    for (let i = 0; i < tasks.length; i += BATCH) {
      const batch = tasks.slice(i, i + BATCH).map((t) => ({
        id         : t.id,
        roadmap_id : t.roadmap_id ?? "ECOSYSTEM_v3",
        phase_id   : t.phase_id,
        title      : t.title,
        description: t.description,
        depends_on : t.depends_on ?? [],
        status     : "pending" as const,
        source     : t.source ?? "canonical_ingestion_v3",
        updated_at : t.updated_at ?? Date.now(),
      }));

      const { error } = await client
        .from("roadmap_tasks")
        .upsert(batch, { onConflict: "id", ignoreDuplicates: true });

      if (error && error.code !== "23505") {
        console.error(`[ingest-v3] Batch ${Math.floor(i/BATCH)} error:`, error.message);
        batchErrors++;
      } else {
        inserted += batch.length;
      }

      // Progress log every 2000 tasks
      if (i % 2000 === 0) {
        console.log(`[ingest-v3] Progress: ${i}/${tasks.length} (${Math.round(i/tasks.length*100)}%)`);
      }
    }

    const { count: after } = await client
      .from("roadmap_tasks")
      .select("id", { count: "exact", head: true });

    const newTasks   = (after ?? 0) - (before ?? 0);
    const durationMs = Date.now() - start;

    console.log(`[ingest-v3] COMPLETE: ${before??0} → ${after??0} | +${newTasks} new | ${durationMs}ms`);

    return NextResponse.json({
      ok          : true,
      before      : before ?? 0,
      after       : after  ?? 0,
      inserted,
      newTasks,
      batchErrors,
      catalogSize : tasks.length,
      totalTarget : TOTAL_TASKS,
      percentFull : `${Math.round((after??0)/TOTAL_TASKS*100)}%`,
      durationMs,
    });

  } catch (err) {
    console.error("[ingest-v3] Fatal:", String(err));
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { count } = await db()
    .from("roadmap_tasks")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    ok         : true,
    endpoint   : "/api/canonical/ingest-ecosystem-v3",
    current    : count ?? 0,
    target     : TOTAL_TASKS,
    remaining  : Math.max(0, TOTAL_TASKS - (count ?? 0)),
    percentFull: `${Math.round((count??0)/TOTAL_TASKS*100)}%`,
    status     : (count ?? 0) >= TOTAL_TASKS ? "complete" : "ready_to_ingest",
    usage      : "POST to this endpoint to run ingestion",
  });
}
