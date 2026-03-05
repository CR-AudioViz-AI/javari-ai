import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

export async function getUserPlan(userId: string): Promise<PlanTier> {
  try {
    const db = createAdminClient();
    
    console.log("[subscription-service] Looking up plan for userId:", userId);
    console.log("[subscription-service] Query: SELECT plan_tier FROM user_subscriptions WHERE user_id =", userId, "LIMIT 1");
    
    // Simplified query - no status filter
    const { data, error } = await db
      .from("user_subscriptions")
      .select("plan_tier")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[subscription-service] Query error:", error);
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
