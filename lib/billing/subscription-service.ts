import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

const db = createAdminClient();

export async function getUserPlan(userId: string): Promise<PlanTier> {
  try {
    // Log the exact userId being used for lookup
    console.log("[subscription-service] Subscription lookup userId:", userId);
    console.log("[subscription-service] Query: SELECT plan_tier, status FROM user_subscriptions WHERE user_id =", userId, "AND status = 'active' LIMIT 1");
    
    const { data, error } = await db
      .from("user_subscriptions")
      .select("plan_tier, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[subscription-service] Query error:", error);
      console.error("[subscription-service] Error details:", JSON.stringify(error));
      return "free";
    }

    if (!data) {
      console.log("[subscription-service] No subscription row found for:", userId);
      console.log("[subscription-service] Returning default tier: free");
      return "free";
    }

    const planTier = data.plan_tier as PlanTier;
    console.log("[subscription-service] ✅ Subscription found!");
    console.log("[subscription-service] Detected plan tier:", planTier, "for user:", userId);
    console.log("[subscription-service] Subscription status:", data.status);
    
    return planTier;
  } catch (err) {
    console.error("[subscription-service] Unexpected error:", err);
    console.error("[subscription-service] Error stack:", err instanceof Error ? err.stack : "N/A");
    return "free";
  }
}
