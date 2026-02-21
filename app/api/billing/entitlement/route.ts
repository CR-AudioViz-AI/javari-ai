// app/api/billing/entitlement/route.ts
// Javari Billing — Entitlement Check Endpoint
// 2026-02-20 — STEP 6 Productization
//
// GET /api/billing/entitlement?userId=...&feature=...
// Returns: { allowed, tier, balance, requiredTier, message }
// Public-ish: returns allowed:true for unknown users (fail-open for UI)

import { NextRequest } from "next/server";
import { checkEntitlement } from "@/lib/javari/revenue/entitlements";
import { checkBalance }      from "@/lib/javari/revenue/credits";
import { createClient }      from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const feature = searchParams.get("feature") ?? "";

  // Try to get userId from session first, fall back to query param
  let userId = searchParams.get("userId") ?? "";
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (user?.id) userId = user.id;
  } catch { /* no session — use query param */ }

  // No user → fail open (don't block UI for guests)
  if (!userId) {
    return Response.json({ allowed: true, tier: "guest", balance: 0, message: "Guest access" });
  }

  if (!feature) {
    return Response.json({ success: false, error: "feature param required" }, { status: 400 });
  }

  try {
    const [entitle, bal] = await Promise.all([
      checkEntitlement(userId, feature as Parameters<typeof checkEntitlement>[1]),
      checkBalance(userId),
    ]);

    return Response.json({
      allowed:      entitle.allowed,
      tier:         entitle.tier,
      balance:      bal.balance,
      requiredTier: entitle.requiredTier,
      message:      entitle.message,
      sufficient:   bal.sufficient,
    });
  } catch (err) {
    // Fail open on errors
    return Response.json({ allowed: true, tier: "unknown", balance: 0 });
  }
}
