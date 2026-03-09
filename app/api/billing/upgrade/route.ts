// app/api/billing/upgrade/route.ts
// Javari Billing — Upgrade Endpoint
// 2026-02-20 — STEP 6 Productization
//
// POST /api/billing/upgrade  { tier }
// → If Stripe price ID set: returns checkoutUrl
// → Otherwise: directly upgrades tier (dev/placeholder mode)

// app/api/billing/upgrade/route.ts
// Javari Billing — Upgrade Endpoint
// Purpose: Routes paid tier upgrades to Stripe Checkout; free tier downgrades directly.
// Date: 2026-03-09 — wired to real Stripe checkout

import { NextRequest } from "next/server";
import { upgradeTier } from "@/lib/javari/revenue/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/platform-secrets/getSecret";

export const runtime = "nodejs";

function encodeStripeForm(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  function encode(val: unknown, key: string): void {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) { val.forEach((item, i) => encode(item, `${key}[${i}]`)); }
    else if (typeof val === "object") { Object.entries(val as Record<string, unknown>).forEach(([k, v]) => encode(v, `${key}[${k}]`)); }
    else { parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`); }
  }
  Object.entries(obj).forEach(([k, v]) => encode(v, prefix ? `${prefix}[${k}]` : k));
  return parts.join("&");
}

const PRICE_KEY_MAP: Record<string, string> = {
  creator:    "STRIPE_CREATOR_PRICE_ID",
  pro:        "STRIPE_PRO_PRICE_ID",
  enterprise: "STRIPE_ENTERPRISE_PRICE_ID",
};

export async function POST(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: { tier?: string };
  try { body = await req.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const tier = (body.tier ?? "") as "free" | "creator" | "pro" | "enterprise";
  if (!tier) return Response.json({ success: false, error: "tier is required" }, { status: 400 });

  // Free tier — direct downgrade, no Stripe needed
  if (tier === "free") {
    const result = await upgradeTier(user.id, "free");
    return Response.json(result);
  }

  // Paid tiers — create real Stripe Checkout session
  let stripeSecretKey: string | null = null;
  let stripePriceId:   string | null = null;

  try {
    [stripeSecretKey, stripePriceId] = await Promise.all([
      getSecret("STRIPE_SECRET_KEY"),
      getSecret(PRICE_KEY_MAP[tier] ?? ""),
    ]);
  } catch { /* fall through to direct upgrade */ }

  if (stripeSecretKey && stripePriceId) {
    const { data: profile } = await db
      .from("users_profile")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    const origin = req.headers.get("origin") || "https://javariai.com";

    const payload: Record<string, unknown> = {
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${origin}/account/billing?success=1&tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/pricing?cancelled=1`,
      allow_promotion_codes: true,
      metadata: { user_id: user.id, tier, email: user.email ?? "" },
      subscription_data: { metadata: { user_id: user.id, tier } },
    };

    if (profile?.stripe_customer_id) {
      payload.customer = profile.stripe_customer_id;
    } else {
      payload.customer_email = user.email;
    }

    // Remove undefined
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: encodeStripeForm(payload),
    });

    if (stripeRes.ok) {
      const session = await stripeRes.json();
      return Response.json({ success: true, checkoutUrl: session.url, sessionId: session.id });
    }

    const stripeErr = await stripeRes.json().catch(() => ({}));
    console.error("[upgrade] Stripe error:", stripeErr);
    // Fall through to direct upgrade if Stripe fails
  }

  // Fallback: direct upgrade (dev mode or Stripe not configured)
  const result = await upgradeTier(user.id, tier);
  return Response.json(result);
}

