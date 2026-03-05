import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

export async function getUserPlan(userId: string): Promise<PlanTier> {
  try {
    const db = createAdminClient();
    
    console.log("[subscription-service] Looking up plan for userId:", userId);
    
    // Query WITHOUT status filter to maximize match probability
    const { data, error } = await db
      .from("user_subscriptions")
      .select("plan_tier")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[subscription-service] Query error:", error.message);
      return "free";
    }

    if (!data) {
      console.log("[subscription-service] No subscription found for:", userId);
      return "free";
    }

    const planTier = data.plan_tier as PlanTier;
    console.log("[subscription-service] ✅ Found plan tier:", planTier, "for user:", userId);
    
    return planTier;
  } catch (err) {
    console.error("[subscription-service] Error:", err);
    return "free";
  }
}
