// app/api/javari/planner/route.ts
// Purpose: Roadmap-only planner — serves pending tasks from MASTER_ROADMAP_v3.1.
//          Discovery/synthetic task generation is permanently disabled.
// Date: 2026-03-06

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Roadmap task loader ──────────────────────────────────────────────────────
// Loads up to 5 pending roadmap tasks in phase priority order.
// Phase priority: core_platform → autonomy_engine → multi_ai_chat →
//                 payments → creator_tools → ecosystem_modules
const PHASE_ORDER = [
  "core_platform",
  "autonomy_engine",
  "multi_ai_chat",
  "payments",
  "creator_tools",
  "ecosystem_modules",
];

async function loadRoadmapTasks(): Promise<Array<{
  id: string;
  title: string;
  description: string;
  phase_id: string;
  depends_on: string[];
}>> {
  // Fetch all pending roadmap tasks with their dependencies satisfied
  const { data: allTasks, error } = await supabase
    .from("roadmap_tasks")
    .select("id, title, description, phase_id, depends_on, status, source")
    .eq("source", "roadmap")
    .in("status", ["pending", "retry"]);

  if (error) {
    console.error("[planner] Roadmap task load error:", error.message);
    return [];
  }

  if (!allTasks || allTasks.length === 0) return [];

  // Get completed task IDs to resolve dependencies
  const { data: completedRaw } = await supabase
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "completed");

  const completedIds = new Set((completedRaw ?? []).map((t: { id: string }) => t.id));

  // Filter to tasks whose dependencies are all satisfied
  const executable = allTasks.filter((task: {
    depends_on: string[] | null;
    status: string;
  }) => {
    const deps = task.depends_on ?? [];
    return deps.every((depId: string) => completedIds.has(depId));
  });

  // Sort by phase priority, then by id (stable within phase)
  executable.sort((a: { phase_id: string; id: string }, b: { phase_id: string; id: string }) => {
    const aPhase = PHASE_ORDER.indexOf(a.phase_id);
    const bPhase = PHASE_ORDER.indexOf(b.phase_id);
    const aPriority = aPhase === -1 ? 999 : aPhase;
    const bPriority = bPhase === -1 ? 999 : bPhase;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.id.localeCompare(b.id);
  });

  return executable.slice(0, 5).map((t: {
    id: string;
    title: string;
    description: string;
    phase_id: string;
    depends_on: string[] | null;
  }) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    phase_id: t.phase_id,
    depends_on: Array.isArray(t.depends_on) ? t.depends_on : [],
  }));
}

export async function POST(req: Request) {
  try {
    // Accept goal as optional context — it does not control task selection
    const body = await req.json().catch(() => ({})) as { goal?: string; limit?: number };
    const goal = body.goal ?? "Execute next roadmap tasks";

    console.log("[planner] Request received — roadmap-only mode");
    console.log("[planner] Goal context:", goal.slice(0, 80));

    const tasks = await loadRoadmapTasks();

    if (tasks.length === 0) {
      console.log("[planner] No executable roadmap tasks available");
      return NextResponse.json({
        success: true,
        planner_source: "roadmap",
        planner_mode: "roadmap_only",
        goal,
        tasksAvailable: 0,
        tasks: [],
        message: "All roadmap tasks are complete or blocked by unmet dependencies",
      });
    }

    console.log(`[planner] Returning ${tasks.length} roadmap task(s)`);
    tasks.forEach(t => console.log(`[planner]  → ${t.id} [${t.phase_id}]: ${t.title}`));

    return NextResponse.json({
      success: true,
      planner_source: "roadmap",
      planner_mode: "roadmap_only",
      goal,
      model: null,
      tasksCreated: 0,
      tasksAvailable: tasks.length,
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        phase_id: t.phase_id,
        depends_on: t.depends_on,
        status: "pending",
        source: "roadmap",
      })),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[planner] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET: planner health + current state
export async function GET() {
  const tasks = await loadRoadmapTasks();
  return NextResponse.json({
    ok: true,
    planner_mode: "roadmap_only",
    discovery_enabled: false,
    executable_tasks: tasks.length,
    next_tasks: tasks.slice(0, 3).map(t => ({
      id: t.id,
      title: t.title,
      phase_id: t.phase_id,
    })),
  });
}
