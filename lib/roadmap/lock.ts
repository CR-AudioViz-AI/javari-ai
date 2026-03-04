import { createAdminClient } from "@/lib/supabase/server";
const db = createAdminClient();
export async function acquireLock(roadmapId: string): Promise<boolean> {
  const { data } = await db
    .from("roadmap_locks")
    .select("*")
    .eq("roadmap_id", roadmapId)
    .single();
  if (data) return false;
  await db.from("roadmap_locks").insert({
    roadmap_id: roadmapId,
    locked_at: Date.now(),
  });
  return true;
}
export async function releaseLock(roadmapId: string) {
  await db.from("roadmap_locks").delete().eq("roadmap_id", roadmapId);
}
