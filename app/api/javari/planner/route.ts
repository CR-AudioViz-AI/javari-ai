// app/api/javari/planner/route.ts
// Purpose: Autonomous roadmap planner — accepts a goal, generates 3-5 tasks via AI, inserts into roadmap_tasks
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

// Generate a short cycle suffix (base-36, 5 chars) from the current timestamp.
// Appended to every task ID so repeated planning cycles never collide on the
// roadmap_tasks primary key, even when the AI generates the same slugs.
function cycleSuffix(): string {
  return Date.now().toString(36).slice(-5);
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

    // Suffix shared across all tasks in this cycle so depends_on references stay valid
    const suffix = cycleSuffix();

    console.log("[planner] Goal:", goal.slice(0, 120));
    console.log("[planner] Phase:", resolvedPhaseId, "| Roadmap:", resolvedRoadmapId, "| Suffix:", suffix);

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
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
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

    // Build a remapping of original AI IDs → suffixed IDs so depends_on
    // references are updated consistently within this cycle.
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
      // Remap any depends_on references to their suffixed equivalents
      const newDeps = (Array.isArray(t.depends_on) ? t.depends_on : [])
        .map((dep: string) => idMap.get(dep) ?? dep);

      return {
        id: newId,
        phase_id: resolvedPhaseId,
        ...(resolvedRoadmapId ? { roadmap_id: resolvedRoadmapId } : {}),
        title: t.title,
        description: t.description,
        depends_on: newDeps,
        status: "pending",
        updated_at: now,
      };
    });

    console.log(`[planner] Inserting ${rows.length} tasks (cycle suffix: ${suffix})`);

    const { error: insertError } = await supabase
      .from("roadmap_tasks")
      .insert(rows);

    if (insertError) {
      throw new Error(`Supabase insert failed: ${insertError.message}`);
    }

    console.log(`[planner] ✅ Inserted ${rows.length} tasks`);
    rows.forEach(r => console.log(`[planner]  → ${r.id}: ${r.title}`));

    return NextResponse.json({
      success: true,
      goal,
      model: ai.model,
      phaseId: resolvedPhaseId,
      created: rows.length,
      tasks: rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        depends_on: r.depends_on,
        status: r.status,
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
