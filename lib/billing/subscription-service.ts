import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

export async function getUserPlan(userId: string): Promise<PlanTier> {
  try {
    // Create admin client with service role (bypasses RLS)
    const db = createAdminClient();
    
    console.log("[subscription-service] ====== SUBSCRIPTION LOOKUP ======");
    console.log("[subscription-service] Looking up userId:", userId);
    console.log("[subscription-service] Using SERVICE_ROLE_KEY (bypasses RLS)");
    
    const { data, error } = await db
      .from("user_subscriptions")
      .select("plan_tier, status, user_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[subscription-service] ❌ Query error:", error);
      console.error("[subscription-service] Error code:", error.code);
      console.error("[subscription-service] Error message:", error.message);
      return "free";
    }

    if (!data) {
      console.log("[subscription-service] ⚠️  No subscription row found for userId:", userId);
      console.log("[subscription-service] Returning default tier: free");
      
      // Debug: Try to count total rows to verify table access
      const { count, error: countError } = await db
        .from("user_subscriptions")
        .select("*", { count: 'exact', head: true });
      
      if (!countError) {
        console.log("[subscription-service] DEBUG: Total rows in table:", count);
      }
      
      return "free";
    }

    const planTier = data.plan_tier as PlanTier;
    console.log("[subscription-service] ✅✅✅ SUBSCRIPTION FOUND! ✅✅✅");
    console.log("[subscription-service] user_id:", data.user_id);
    console.log("[subscription-service] plan_tier:", planTier);
    console.log("[subscription-service] status:", data.status);
    
    return planTier;
  } catch (err) {
    console.error("[subscription-service] ❌ Unexpected error:", err);
    if (err instanceof Error) {
      console.error("[subscription-service] Error name:", err.name);
      console.error("[subscription-service] Error message:", err.message);
      console.error("[subscription-service] Error stack:", err.stack?.split('\n')[0]);
    }
    return "free";
  }
}
