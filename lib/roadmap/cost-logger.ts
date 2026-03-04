import { createAdminClient } from "@/lib/supabase/server";
const db = createAdminClient();
export async function logCost({
  roadmapId,
  taskId,
  model,
  provider,
  tokens,
  cost,
}: {
  roadmapId: string;
  taskId: string;
  model: string;
  provider: string;
  tokens: number;
  cost: number;
}) {
  await db.from("roadmap_costs").insert({
    roadmap_id: roadmapId,
    task_id: taskId,
    model,
    provider,
    tokens_used: tokens,
    estimated_cost: cost,
    created_at: Date.now(),
  });
}
