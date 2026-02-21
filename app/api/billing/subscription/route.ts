// app/api/billing/subscription/route.ts
// Javari Billing — Subscription API
// 2026-02-20 — STEP 5 implementation
//
// GET  /api/billing/subscription → current subscription + tier definitions
// POST /api/billing/subscription → { action: "upgrade"|"cancel"|"renew", tier? }

import { NextRequest } from "next/server";
import {
  getSubscription,
  upgradeTier,
  cancelSubscription,
  renewSubscription,
  getTierDefinitions,
  createOrEnsureSubscription,
  type SubscriptionTier,
} from "@/lib/javari/revenue/subscriptions";
import { checkBalance } from "@/lib/javari/revenue/credits";
import { getUserTierAndFeatures } from "@/lib/javari/revenue/entitlements";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getAuthedUserId(): Promise<string | null> {
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

// ── GET — subscription status ─────────────────────────────────────────────────

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure subscription exists (creates free tier if first visit)
    let sub = await getSubscription(userId);
    if (!sub) {
      await createOrEnsureSubscription(userId, "free");
      sub = await getSubscription(userId);
    }

    const [balance, entitlements] = await Promise.all([
      checkBalance(userId),
      getUserTierAndFeatures(userId),
    ]);

    return Response.json({
      success:        true,
      subscription:   sub,
      balance:        balance.balance,
      tier:           entitlements.tier,
      features:       entitlements.features,
      tiers:          getTierDefinitions().map((t) => ({
        tier:            t.tier,
        label:           t.label,
        priceMonthlyUsd: t.priceMonthlyUsd,
        creditsPerCycle: t.creditsPerCycle,
        features:        t.features,
        description:     t.description,
        isCurrent:       t.tier === entitlements.tier,
        stripePriceId:   t.stripePriceId ?? null,
      })),
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ── POST — actions ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: "upgrade" | "cancel" | "renew";
    tier?:   SubscriptionTier;
    stripeCustomerId?: string;
    stripeSubId?:      string;
  };

  try { body = await req.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const { action } = body;

  if (action === "upgrade") {
    if (!body.tier) {
      return Response.json({ success: false, error: "tier required for upgrade" }, { status: 400 });
    }
    const result = await upgradeTier(userId, body.tier, {
      customerId: body.stripeCustomerId,
      subId:      body.stripeSubId,
    });
    return Response.json(result, { status: result.success ? 200 : 500 });
  }

  if (action === "cancel") {
    const ok = await cancelSubscription(userId);
    return Response.json({ success: ok, message: ok ? "Subscription cancelled" : "Cancel failed" });
  }

  if (action === "renew") {
    const ok = await renewSubscription(userId);
    return Response.json({ success: ok, message: ok ? "Renewed" : "Renewal failed" });
  }

  return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
}
