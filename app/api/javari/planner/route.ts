// app/api/javari/planner/route.ts
// Purpose: Ecosystem planner — serves pending tasks from roadmap AND triggers canonical
//          discovery pipeline when pending = 0. Discovery generates new tasks from
//          canonical_docs + knowledge graph, then inserts them into roadmap_tasks.
//          Workers continue automatically without human input.
// Date: 2026-03-10

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 120;   // discovery pipeline needs up to 2 min

// ─── Phase priority ───────────────────────────────────────────────────────────

const PHASE_ORDER = [
  "core_platform",
  "autonomy_engine",
  "multi_ai_chat",
  "payments",
  "creator_tools",
  "ecosystem_modules",
];

// ─── Roadmap task loader ──────────────────────────────────────────────────────

async function loadRoadmapTasks(): Promise<Array<{
  id: string;
  title: string;
  description: string;
  phase_id: string;
  depends_on: string[];
}>> {
  const client = db();

  const { data: allTasks, error } = await client
    .from("roadmap_tasks")
    .select("id, title, description, phase_id, depends_on, status, source")
    .in("status", ["pending", "retry"]);

  if (error) {
    console.error("[planner] Roadmap task load error:", error.message);
    return [];
  }
  if (!allTasks?.length) return [];

  const { data: completedRaw } = await client
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "completed");

  const completedIds = new Set((completedRaw ?? []).map((t: { id: string }) => t.id));

  const executable = allTasks.filter((task: { depends_on: string[] | null }) => {
    const deps = task.depends_on ?? [];
    return deps.every((depId: string) => completedIds.has(depId));
  });

  executable.sort((a: { phase_id: string; id: string }, b: { phase_id: string; id: string }) => {
    const aPriority = PHASE_ORDER.indexOf(a.phase_id);
    const bPriority = PHASE_ORDER.indexOf(b.phase_id);
    const aP = aPriority === -1 ? 999 : aPriority;
    const bP = bPriority === -1 ? 999 : bPriority;
    if (aP !== bP) return aP - bP;
    return a.id.localeCompare(b.id);
  });

  return executable.slice(0, 5).map((t: {
    id: string; title: string; description: string;
    phase_id: string; depends_on: string[] | null;
  }) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    phase_id: t.phase_id,
    depends_on: Array.isArray(t.depends_on) ? t.depends_on : [],
  }));
}

// ─── Canonical Discovery Pipeline ────────────────────────────────────────────
// Triggered when pending = 0. Reads canonical_docs + knowledge_graph_nodes,
// uses AI to generate new tasks, inserts them into roadmap_tasks.

interface DiscoveryResult {
  triggered:   boolean;
  docsRead:    number;
  nodesRead:   number;
  generated:   number;
  inserted:    number;
  skipped:     number;
  errors:      string[];
  durationMs:  number;
}

async function runCanonicalDiscovery(): Promise<DiscoveryResult> {
  const t0     = Date.now();
  const errors: string[] = [];
  const log    = (m: string) => console.log(m);
  const client = db();

  log("[planner:discovery] ══ Canonical Discovery Pipeline starting ══");

  // ── 1. Load canonical docs ──────────────────────────────────────────────
  const { data: docs, error: docsErr } = await client
    .from("canonical_docs")
    .select("title, content, source")
    .limit(20);

  if (docsErr) {
    errors.push(`canonical_docs fetch: ${docsErr.message}`);
    log(`[planner:discovery] ⚠️  ${errors[0]}`);
  }

  const docList = (docs ?? []) as { title: string; content: string; source?: string }[];
  log(`[planner:discovery] Loaded ${docList.length} canonical docs`);

  // ── 2. Load knowledge graph nodes ──────────────────────────────────────
  const { data: nodes, error: nodesErr } = await client
    .from("knowledge_graph_nodes")
    .select("label, node_type, description")
    .limit(50);

  if (nodesErr) {
    log(`[planner:discovery] ⚠️  knowledge_graph_nodes: ${nodesErr.message}`);
  }

  const nodeList = (nodes ?? []) as { label: string; node_type: string; description?: string }[];
  log(`[planner:discovery] Loaded ${nodeList.length} knowledge graph nodes`);

  if (docList.length === 0 && nodeList.length === 0) {
    const msg = "[planner:discovery] No canonical corpus available — discovery skipped";
    log(msg);
    errors.push(msg);
    return { triggered: true, docsRead: 0, nodesRead: 0, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  // ── 3. Build corpus summary for AI ────────────────────────────────────
  const docSummary = docList
    .map(d => `[${d.title}]: ${(d.content ?? "").slice(0, 300)}`)
    .join("\n\n");

  const nodeSummary = nodeList
    .map(n => `${n.node_type}: ${n.label}${n.description ? ` — ${n.description.slice(0, 100)}` : ""}`)
    .join("\n");

  // ── 4. Load existing titles for dedup ─────────────────────────────────
  const { data: allTitlesRows } = await client
    .from("roadmap_tasks")
    .select("title");
  const existingTitles = new Set(
    (allTitlesRows ?? []).map((r: { title: string }) => r.title)
  );

  // ── 5. AI task generation from canonical corpus ───────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) {
    const msg = "[planner:discovery] ANTHROPIC_API_KEY not set — cannot call AI";
    log(msg);
    errors.push(msg);
    return { triggered: true, docsRead: docList.length, nodesRead: nodeList.length, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  const systemPrompt = `You are the Javari Canonical Discovery Engine for CR AudioViz AI.

Your job: analyze the platform's canonical documentation and knowledge graph, then generate exactly 50 new, high-value roadmap tasks that the platform has not yet implemented.

PLATFORM MISSION: "Your Story. Our Design." — Fortune 50-quality AI ecosystem serving creators, businesses, veterans, first responders, faith communities, and animal rescues.

TASK CATEGORIES (use these as phase_id values):
ai_marketplace, creator_monetization, multi_ai_team_mode, craiverse_modules,
enterprise_integrations, community_systems, autonomous_deployment,
platform_scaling, security_infrastructure, global_payments

RULES:
1. Return ONLY valid JSON — an array of exactly 50 task objects. No markdown, no backticks.
2. Every task must have: phase_id, title, description
3. title must be unique and never match any existing title listed
4. description must be 2-4 sentences, technically specific, and production-ready
5. Derive tasks DIRECTLY from the canonical documents and knowledge graph — build what the docs describe
6. Every task must produce a concrete, deployable deliverable`;

  const userPrompt = `CANONICAL DOCUMENTATION CORPUS:
${docSummary}

KNOWLEDGE GRAPH NODES:
${nodeSummary}

EXISTING TASK TITLES (do not duplicate any of these):
${Array.from(existingTitles).slice(-100).join("\n")}

Generate exactly 50 new tasks derived from the canonical corpus above. Return ONLY the JSON array.`;

  log("[planner:discovery] Calling Anthropic API for canonical-derived tasks");

  let raw = "";
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const err = await response.text();
      errors.push(`Anthropic API ${response.status}: ${err.slice(0, 200)}`);
      log(`[planner:discovery] ❌ ${errors[errors.length - 1]}`);
      return { triggered: true, docsRead: docList.length, nodesRead: nodeList.length, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
      usage?:  { input_tokens: number; output_tokens: number };
    };

    log(`[planner:discovery] API tokens — in=${data.usage?.input_tokens ?? "?"} out=${data.usage?.output_tokens ?? "?"}`);

    raw = data.content
      .filter(b => b.type === "text")
      .map(b => b.text ?? "")
      .join("")
      .trim();

  } catch (err) {
    const msg = `Anthropic fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    log(`[planner:discovery] ❌ ${msg}`);
    return { triggered: true, docsRead: docList.length, nodesRead: nodeList.length, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  // ── 6. Parse AI response ───────────────────────────────────────────────
  let drafts: Array<{ phase_id: string; title: string; description: string }> = [];
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    drafts = JSON.parse(cleaned);
    if (!Array.isArray(drafts)) throw new Error("Response is not an array");
    log(`[planner:discovery] AI produced ${drafts.length} task drafts`);
  } catch (err) {
    const msg = `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    log(`[planner:discovery] ❌ ${msg} | raw[0:300]: ${raw.slice(0, 300)}`);
    return { triggered: true, docsRead: docList.length, nodesRead: nodeList.length, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  // ── 7. Deduplicate and prepare inserts ────────────────────────────────
  const seenInBatch = new Set<string>();
  const toInsert: Array<{
    id: string; title: string; description: string;
    phase_id: string; depends_on: string[]; status: string;
    source: string; updated_at: number;
  }> = [];

  const phaseCounters: Record<string, number> = {};

  const VALID_PHASES = new Set([
    "ai_marketplace", "creator_monetization", "multi_ai_team_mode", "craiverse_modules",
    "enterprise_integrations", "community_systems", "autonomous_deployment",
    "platform_scaling", "security_infrastructure", "global_payments",
  ]);

  for (const draft of drafts) {
    if (!draft.phase_id || !draft.title || !draft.description) continue;
    if (!VALID_PHASES.has(draft.phase_id)) continue;
    if (existingTitles.has(draft.title) || seenInBatch.has(draft.title)) continue;

    seenInBatch.add(draft.title);
    const idx = phaseCounters[draft.phase_id] ?? 0;
    phaseCounters[draft.phase_id] = idx + 1;

    const slug = draft.title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "").trim()
      .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 48);

    toInsert.push({
      id:          `cd-${draft.phase_id.slice(0, 12)}-${slug}-${String(idx).padStart(2, "0")}`,
      title:       draft.title,
      description: draft.description,
      phase_id:    draft.phase_id,
      depends_on:  [],
      status:      "pending",
      source:      "canonical_discovery",
      updated_at:  Math.floor(Date.now() / 1000),
    });
  }

  const skipped = drafts.length - toInsert.length;
  log(`[planner:discovery] After dedup: ${toInsert.length} to insert, ${skipped} skipped`);

  // ── 8. Insert in batches ───────────────────────────────────────────────
  let inserted = 0;
  const BATCH  = 25;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error: insErr } = await client.from("roadmap_tasks").insert(batch);

    if (insErr) {
      if (insErr.code === "23505" || insErr.message.includes("duplicate")) {
        for (const row of batch) {
          const { error: e2 } = await client.from("roadmap_tasks").insert(row);
          if (!e2) inserted++;
        }
      } else {
        errors.push(`INSERT batch ${i}: ${insErr.message}`);
        log(`[planner:discovery] ❌ ${errors[errors.length - 1]}`);
      }
    } else {
      inserted += batch.length;
    }
  }

  log(`[planner:discovery] ✅ Discovery complete — inserted=${inserted} skipped=${skipped} errors=${errors.length} duration=${Date.now() - t0}ms`);

  return {
    triggered:  true,
    docsRead:   docList.length,
    nodesRead:  nodeList.length,
    generated:  drafts.length,
    inserted,
    skipped,
    errors,
    durationMs: Date.now() - t0,
  };
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { goal?: string };
    const goal = body.goal ?? "Execute next ecosystem tasks";

    console.log("[planner] Request received — ecosystem mode");
    console.log("[planner] Goal context:", goal.slice(0, 80));

    const tasks = await loadRoadmapTasks();

    // ── Canonical discovery: fires when pending = 0 ──────────────────────
    let discovery: DiscoveryResult | null = null;
    if (tasks.length === 0) {
      console.log("[planner] No pending tasks — triggering canonical discovery pipeline");
      try {
        discovery = await runCanonicalDiscovery();
        console.log(
          `[planner] Discovery complete — ` +
          `inserted=${discovery.inserted} generated=${discovery.generated} ` +
          `docs=${discovery.docsRead} nodes=${discovery.nodesRead}`
        );
      } catch (err) {
        console.error("[planner] Discovery pipeline error (non-fatal):", err instanceof Error ? err.message : String(err));
      }

      // Return the newly inserted tasks if discovery produced any
      if (discovery && discovery.inserted > 0) {
        const freshTasks = await loadRoadmapTasks();
        return NextResponse.json({
          success:          true,
          planner_source:   "canonical_discovery",
          planner_mode:     "ecosystem",
          discovery_enabled: true,
          goal,
          tasksAvailable:   freshTasks.length,
          tasks:            freshTasks,
          discovery,
        });
      }

      return NextResponse.json({
        success:          true,
        planner_source:   "canonical_discovery",
        planner_mode:     "ecosystem",
        discovery_enabled: true,
        goal,
        tasksAvailable:   0,
        tasks:            [],
        discovery,
        message:          "Discovery ran but produced no new tasks — corpus may need expansion",
      });
    }

    console.log(`[planner] Returning ${tasks.length} task(s) from roadmap`);

    return NextResponse.json({
      success:          true,
      planner_source:   "roadmap",
      planner_mode:     "ecosystem",
      discovery_enabled: true,
      goal,
      tasksCreated:     0,
      tasksAvailable:   tasks.length,
      tasks:            tasks.map(t => ({
        id:          t.id,
        title:       t.title,
        description: t.description,
        phase_id:    t.phase_id,
        depends_on:  t.depends_on,
        status:      "pending",
        source:      "roadmap",
      })),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[planner] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ─── GET — planner health + state ─────────────────────────────────────────────

export async function GET() {
  const tasks = await loadRoadmapTasks();
  const client = db();

  const { count: canonicalCount } = await client
    .from("canonical_docs")
    .select("*", { count: "exact", head: true });

  const { count: nodeCount } = await client
    .from("knowledge_graph_nodes")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({
    ok:                true,
    planner_mode:      "ecosystem",
    discovery_enabled: true,
    corpus: {
      canonical_docs:          canonicalCount ?? 0,
      knowledge_graph_nodes:   nodeCount ?? 0,
    },
    executable_tasks:  tasks.length,
    next_tasks:        tasks.slice(0, 3).map(t => ({
      id:       t.id,
      title:    t.title,
      phase_id: t.phase_id,
    })),
  });
}
