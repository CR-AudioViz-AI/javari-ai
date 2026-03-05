import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

/**
 * Get user's plan tier from database
 */
export async function getUserPlan(userId: string): Promise<PlanTier> {
  // DEV BYPASS: System users always get PRO tier
  const devUsers = [
    "roy_test_user",
    "strategic-planner", 
    "roadmap-intelligence",
    "outcome-intelligence",
    "self-repair-system",
    "command_center",
    "command_center_auto",
    "api-user",
    "anonymous"
  ];
  
  if (devUsers.includes(userId)) {
    console.log("[subscription-service] 🔧 DEV BYPASS → forcing PRO tier for", userId);
    return "pro" as PlanTier;
  }

  console.log("[subscription-service] Fetching plan for user:", userId);

  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("user_subscriptions")
      .select("plan_tier, status")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("[subscription-service] Database error:", error.message);
      console.log("[subscription-service] Defaulting to FREE tier");
      return "free";
    }

    if (!data) {
      console.log("[subscription-service] No subscription found, defaulting to FREE");
      return "free";
    }

    if (data.status !== "active") {
      console.log("[subscription-service] Subscription not active, defaulting to FREE");
      return "free";
    }

    console.log("[subscription-service] ✅ Plan tier:", data.plan_tier);
    return data.plan_tier as PlanTier;
  } catch (err: any) {
    console.error("[subscription-service] Unexpected error:", err.message);
    console.log("[subscription-service] Defaulting to FREE tier");
    return "free";
  }
}
