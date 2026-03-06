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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { goal } = body;

    if (!goal || typeof goal !== "string" || !goal.trim()) {
      return NextResponse.json(
        { success: false, error: "goal is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    console.log("[planner] Goal received:", goal.slice(0, 120));

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

    // Strip markdown fences if present
    const cleaned = ai.output
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Extract JSON array even if wrapped in text
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

    // Validate and normalise each task
    const now = Math.floor(Date.now() / 1000);
    const rows = tasks.map((t: PlannerTask) => {
      if (!t.id || !t.title || !t.description) {
        throw new Error(`Task missing required fields: ${JSON.stringify(t)}`);
      }
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        depends_on: Array.isArray(t.depends_on) ? t.depends_on : [],
        status: "pending",
        updated_at: now,
      };
    });

    console.log(`[planner] Inserting ${rows.length} tasks for goal: "${goal.slice(0, 60)}"`);

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
