// app/api/javari/planner/route.ts
// Purpose: Hybrid planner — serves roadmap tasks first, falls back to AI discovery
// Date: 2026-03-06

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAI } from "@/lib/ai/router";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlannerTask {
  id: string;
  title: string;
  description: string;
  depends_on: string[];
}

// ─── Cycle suffix ─────────────────────────────────────────────────────────────
// Appended to every inserted task ID to prevent primary key collisions across
// autonomy cycles. Shared within one planning call so depends_on refs stay valid.
function cycleSuffix(): string {
  return Date.now().toString(36).slice(-5);
}

// ─── Roadmap task loader ──────────────────────────────────────────────────────
// Fetches up to 5 pending tasks that were seeded by a human roadmap (source='roadmap').
// Returns them directly without calling AI — they are already fully specified.
async function loadRoadmapTasks(
  phaseId: string,
  roadmapId: string | null
): Promise<Array<{ id: string; title: string; description: string; depends_on: string[] }>> {
  let query = supabase
    .from("roadmap_tasks")
    .select("id, title, description, depends_on")
    .eq("status", "pending")
    .eq("source", "roadmap")
    .limit(5);

  // Scope to roadmap if provided
  if (roadmapId) {
    query = query.eq("roadmap_id", roadmapId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[planner] Roadmap task load error:", error.message);
    return [];
  }

  return (data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    description: t.description as string,
    depends_on: Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [],
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { goal, phaseId, roadmapId } = body;

    if (!goal || typeof goal !== "string" || !goal.trim()) {
      return NextResponse.json(
        { success: false, error: "goal is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const resolvedPhaseId: string = phaseId ?? "planner";
    const resolvedRoadmapId: string | null = roadmapId ?? null;
    const suffix = cycleSuffix();

    console.log("[planner] Goal:", goal.slice(0, 120));
    console.log("[planner] Phase:", resolvedPhaseId, "| Roadmap:", resolvedRoadmapId, "| Suffix:", suffix);

    // ── Step 1: Check for human-seeded roadmap tasks first ────────────────────
    const roadmapTasks = await loadRoadmapTasks(resolvedPhaseId, resolvedRoadmapId);

    if (roadmapTasks.length > 0) {
      console.log(`[planner] planner_source: roadmap | ${roadmapTasks.length} task(s) found — skipping AI`);

      // Roadmap tasks already exist in the DB — no insert needed.
      // Return them directly as planner output so the queue can pick them up.
      return NextResponse.json({
        success: true,
        goal,
        model: null,
        planner_source: "roadmap",
        phaseId: resolvedPhaseId,
        tasksCreated: 0,
        tasks: roadmapTasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          depends_on: t.depends_on,
          status: "pending",
          source: "roadmap",
        })),
      });
    }

    // ── Step 2: No roadmap tasks — run AI discovery planner ───────────────────
    console.log("[planner] planner_source: discovery | No roadmap tasks — running AI planner");

    const prompt = `
You are an autonomous roadmap planner for an AI platform called Javari AI.
Break the following system goal into 3 to 5 executable roadmap tasks.

Goal:
${goal.trim()}

Rules:
- Each task must be concrete and independently executable
- Use short, unique IDs prefixed with "plan-" followed by a slug (e.g. "plan-setup-auth")
- depends_on must only reference IDs of other tasks in this same response, or be an empty array
- No markdown, no explanation — return ONLY the JSON array

Return format (JSON array only):
[
  {
    "id": "plan-<slug>",
    "title": "Short task title",
    "description": "Detailed description of what needs to be done",
    "depends_on": []
  }
]
`.trim();

    const ai = await runAI("reasoning", prompt);

    if (!ai.output) {
      throw new Error("AI returned null output");
    }

    const cleaned = ai.output
      .replace(/\`\`\`json\s*/g, "")
      .replace(/\`\`\`\s*/g, "")
      .trim();

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      throw new Error(`AI output did not contain a valid JSON array. Got: ${cleaned.slice(0, 200)}`);
    }

    let tasks: PlannerTask[];
    try {
      tasks = JSON.parse(arrayMatch[0]);
    } catch (parseErr) {
      throw new Error(`Failed to parse AI output as JSON: ${(parseErr as Error).message}`);
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error("AI returned an empty task list");
    }

    // Remap AI-generated IDs → suffixed IDs (collision prevention)
    const idMap = new Map<string, string>();
    for (const t of tasks) {
      if (!t.id) throw new Error(`Task missing id: ${JSON.stringify(t)}`);
      idMap.set(t.id, `${t.id}-${suffix}`);
    }

    const now = Math.floor(Date.now() / 1000);
    const rows = tasks.map((t: PlannerTask) => {
      if (!t.title || !t.description) {
        throw new Error(`Task missing required fields: ${JSON.stringify(t)}`);
      }
      const newId = idMap.get(t.id) ?? `${t.id}-${suffix}`;
      const newDeps = (Array.isArray(t.depends_on) ? t.depends_on : [])
        .map((dep: string) => idMap.get(dep) ?? dep);

      return {
        id: newId,
        phase_id: resolvedPhaseId,
        ...(resolvedRoadmapId ? { roadmap_id: resolvedRoadmapId } : {}),
        title: t.title,
        description: t.description,
        depends_on: newDeps,
        source: "discovery",
        status: "pending",
        updated_at: now,
      };
    });

    console.log(`[planner] Inserting ${rows.length} discovery tasks (suffix: ${suffix})`);

    const { error: insertError } = await supabase
      .from("roadmap_tasks")
      .insert(rows);

    if (insertError) {
      throw new Error(`Supabase insert failed: ${insertError.message}`);
    }

    console.log(`[planner] ✅ Inserted ${rows.length} discovery tasks`);
    rows.forEach((r) => console.log(`[planner]  → ${r.id}: ${r.title}`));

    return NextResponse.json({
      success: true,
      goal,
      model: ai.model,
      planner_source: "discovery",
      phaseId: resolvedPhaseId,
      tasksCreated: rows.length,
      tasks: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        depends_on: r.depends_on,
        status: r.status,
        source: r.source,
      })),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[planner] ❌ Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
