// app/api/credits/balance/route.ts
// Javari AI — Credit Balance Endpoint
// Purpose: Returns authenticated user's current credit balance.
// Date: 2026-03-09

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Try user_credits table first, fall back to users_profile
  const { data: credits } = await admin
    .from("user_credits")
    .select("balance, lifetime_earned, lifetime_spent")
    .eq("user_id", user.id)
    .single();

  if (credits) {
    return Response.json({
      credits: {
        balance:         credits.balance,
        lifetime_earned: credits.lifetime_earned ?? credits.balance,
        lifetime_spent:  credits.lifetime_spent  ?? 0,
      },
    });
  }

  // Fallback to users_profile.credits column
  const { data: profile } = await admin
    .from("users_profile")
    .select("credits")
    .eq("id", user.id)
    .single();

  return Response.json({
    credits: {
      balance:         profile?.credits ?? 0,
      lifetime_earned: profile?.credits ?? 0,
      lifetime_spent:  0,
    },
  });
}
