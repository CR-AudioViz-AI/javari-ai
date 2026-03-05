import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

export async function getUserPlan(userId: string): Promise<PlanTier> {
  try {
    // Log runtime environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET';
    console.log("[subscription-service] ==========================================");
    console.log("[subscription-service] RUNTIME ENVIRONMENT CHECK");
    console.log("[subscription-service] SUPABASE_URL:", supabaseUrl);
    
    // Extract project reference
    let projectRef = 'UNKNOWN';
    if (supabaseUrl.includes('supabase.co')) {
      const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (match) {
        projectRef = match[1];
      }
    }
    
    console.log("[subscription-service] PROJECT_REF:", projectRef);
    console.log("[subscription-service] EXPECTED_REF: kteobfyferrukqeolofj");
    console.log("[subscription-service] MATCH:", projectRef === 'kteobfyferrukqeolofj' ? '✅ YES' : '❌ NO');
    console.log("[subscription-service] ==========================================");
    
    const db = createAdminClient();
    
    console.log("[subscription-service] Looking up plan for userId:", userId);
    console.log("[subscription-service] Query: SELECT plan_tier FROM user_subscriptions WHERE user_id =", userId);
    
    const { data, error } = await db
      .from("user_subscriptions")
      .select("plan_tier")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[subscription-service] Query error:", error);
      console.error("[subscription-service] Error details:", JSON.stringify(error));
      return "free";
    }

    if (!data) {
      console.log("[subscription-service] ❌ No subscription found for:", userId);
      
      // Try to get table info for debugging
      const { count, error: countError } = await db
        .from("user_subscriptions")
        .select("*", { count: 'exact', head: true });
      
      if (!countError && count !== null) {
        console.log("[subscription-service] DEBUG: Total rows in user_subscriptions:", count);
      }
      
      return "free";
    }

    const planTier = data.plan_tier as PlanTier;
    console.log("[subscription-service] ✅✅✅ FOUND SUBSCRIPTION!");
    console.log("[subscription-service] plan_tier:", planTier);
    console.log("[subscription-service] userId:", userId);
    
    return planTier;
  } catch (err) {
    console.error("[subscription-service] Unexpected error:", err);
    return "free";
  }
}
