import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

const db = createAdminClient();

export async function getUserPlan(userId: string): Promise<PlanTier> {
  const { data } = await db
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!data) return "free";

  return data.plan_tier as PlanTier;
}
