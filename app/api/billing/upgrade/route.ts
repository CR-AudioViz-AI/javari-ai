// app/api/billing/upgrade/route.ts
// Javari Billing — Upgrade Endpoint
// 2026-02-20 — STEP 6 Productization
//
// POST /api/billing/upgrade  { tier }
// → If Stripe price ID set: returns checkoutUrl
// → Otherwise: directly upgrades tier (dev/placeholder mode)

import { NextRequest } from "next/server";
import { upgradeTier } from "@/lib/javari/revenue/subscriptions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* no session */ }

  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { tier?: string };
  try { body = await req.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const tier = body.tier as "free" | "creator" | "pro" | "enterprise" | undefined;
  if (!tier) {
    return Response.json({ success: false, error: "tier is required" }, { status: 400 });
  }

  // If Stripe price IDs are configured, redirect to Stripe Checkout
  const stripePriceMap: Record<string, string | undefined> = {
    creator:    process.env.STRIPE_CREATOR_PRICE_ID,
    pro:        process.env.STRIPE_PRO_PRICE_ID,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
  };

  const stripePriceId = stripePriceMap[tier];
  if (stripePriceId) {
    // TODO: Create Stripe checkout session
    // For now return a placeholder redirect
    return Response.json({
      success:     true,
      checkoutUrl: `/pricing?plan=${tier}&checkout=1`,
      message:     "Stripe Checkout — integration pending",
    });
  }

  // Dev mode: directly upgrade
  try {
    const result = await upgradeTier(userId, tier);
    return Response.json({
      success:        result.success,
      previousTier:   result.previousTier,
      newTier:        result.newTier,
      creditsGranted: result.creditsGranted,
      error:          result.error,
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
