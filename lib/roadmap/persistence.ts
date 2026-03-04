import { createAdminClient } from "@/lib/supabase/server";
import type { Roadmap } from "./types";
const db = createAdminClient();
export async function saveRoadmap(roadmap: Roadmap) {
  await db.from("roadmaps").upsert({
    id: roadmap.id,
    title: roadmap.title,
    created_at: roadmap.createdAt,
    updated_at: roadmap.updatedAt,
  });
  for (const phase of roadmap.phases) {
    for (const task of phase.tasks) {
      await db.from("roadmap_tasks").upsert({
        id: task.id,
        roadmap_id: roadmap.id,
        phase_id: phase.id,
        title: task.title,
        description: task.description,
        depends_on: task.dependsOn,
        status: task.status,
        result: task.result ?? null,
        error: task.error ?? null,
        cost: task.cost ?? 0,
        updated_at: Date.now(),
      });
    }
  }
}
export async function loadRoadmap(id: string) {
  const { data: roadmapRow } = await db
    .from("roadmaps")
    .select("*")
    .eq("id", id)
    .single();
  const { data: taskRows } = await db
    .from("roadmap_tasks")
    .select("*")
    .eq("roadmap_id", id);
  if (!roadmapRow) return null;
  const phasesMap: Record<string, any> = {};
  for (const task of taskRows ?? []) {
    if (!phasesMap[task.phase_id]) {
      phasesMap[task.phase_id] = {
        id: task.phase_id,
        title: task.phase_id,
        status: "pending",
        tasks: [],
      };
    }
    phasesMap[task.phase_id].tasks.push({
      id: task.id,
      title: task.title,
      description: task.description,
      dependsOn: task.depends_on ?? [],
      status: task.status,
      result: task.result ?? undefined,
      error: task.error ?? undefined,
      cost: task.cost ?? 0,
    });
  }
  return {
    id: roadmapRow.id,
    title: roadmapRow.title,
    createdAt: roadmapRow.created_at,
    updatedAt: roadmapRow.updated_at,
    phases: Object.values(phasesMap),
  };
}
