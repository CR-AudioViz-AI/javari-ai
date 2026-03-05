import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

const db = createAdminClient();

export async function getUserPlan(userId: string): Promise<PlanTier> {
  try {
    const { data, error } = await db
      .from("user_subscriptions")
      .select("plan_tier, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[subscription-service] Query error:", error);
      return "free";
    }

    if (!data) {
      console.log("[subscription-service] No active subscription for user:", userId);
      return "free";
    }

    const planTier = data.plan_tier as PlanTier;
    console.log("[subscription-service] Detected plan tier:", planTier, "for user:", userId);
    
    return planTier;
  } catch (err) {
    console.error("[subscription-service] Unexpected error:", err);
    return "free";
  }
}
