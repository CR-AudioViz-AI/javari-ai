// app/api/billing/checkout/route.ts
// Javari AI — Stripe Checkout Session Creator
// Purpose: Create real Stripe Checkout sessions for paid tier upgrades.
// Pulls Stripe keys from platform_secrets (AES-256-GCM encrypted vault).
// Date: 2026-03-09

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/platform-secrets/getSecret";

export const runtime = "nodejs";

const PRICE_KEY_MAP: Record<string, string> = {
  creator:    "STRIPE_CREATOR_PRICE_ID",
  pro:        "STRIPE_PRO_PRICE_ID",
  enterprise: "STRIPE_ENTERPRISE_PRICE_ID",
};

const TIER_NAMES: Record<string, string> = {
  creator:    "Creator Plan — $19/month",
  pro:        "Pro Plan — $49/month",
  enterprise: "Enterprise Plan — $199/month",
};

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let tier: string;
  try {
    const body = await req.json();
    tier = body.tier ?? "";
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!PRICE_KEY_MAP[tier]) {
    return Response.json({ error: `Invalid tier: ${tier}` }, { status: 400 });
  }

  // ── Load Stripe keys from vault ─────────────────────────────────────────────
  let stripeSecretKey: string;
  let stripePriceId: string;

  try {
    [stripeSecretKey, stripePriceId] = await Promise.all([
      getSecret("STRIPE_SECRET_KEY"),
      getSecret(PRICE_KEY_MAP[tier]),
    ]);
  } catch (err) {
    console.error("[checkout] Failed to load Stripe secrets:", err);
    return Response.json(
      { error: "Payment system temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }

  if (!stripeSecretKey || !stripePriceId) {
    console.error("[checkout] Missing Stripe keys for tier:", tier);
    return Response.json(
      { error: "Payment configuration error. Contact support." },
      { status: 503 }
    );
  }

  // ── Get or create Stripe customer ID ────────────────────────────────────────
  const { data: profile } = await db
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", user.id)
    .single();

  // ── Create Stripe Checkout Session ──────────────────────────────────────────
  const origin = req.headers.get("origin") || "https://javariai.com";

  const sessionPayload: Record<string, unknown> = {
    mode: "subscription",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${origin}/account/billing?success=1&tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/pricing?cancelled=1`,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    customer:       profile?.stripe_customer_id ?? undefined,
    metadata: {
      user_id:    user.id,
      tier,
      email:      user.email ?? "",
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      metadata: {
        user_id: user.id,
        tier,
      },
    },
  };

  // Remove undefined keys (Stripe rejects them)
  Object.keys(sessionPayload).forEach(k => {
    if (sessionPayload[k] === undefined) delete sessionPayload[k];
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: encodeStripeForm(sessionPayload),
  });

  if (!stripeRes.ok) {
    const errData = await stripeRes.json().catch(() => ({}));
    console.error("[checkout] Stripe API error:", errData);
    return Response.json(
      { error: errData?.error?.message ?? "Failed to create checkout session" },
      { status: 502 }
    );
  }

  const session = await stripeRes.json();

  return Response.json({
    success:     true,
    checkoutUrl: session.url,
    sessionId:   session.id,
    tier,
    tierName:    TIER_NAMES[tier],
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten a nested object into Stripe's form-encoded format */
function encodeStripeForm(
  obj: Record<string, unknown>,
  prefix = ""
): string {
  const parts: string[] = [];

  function encode(val: unknown, key: string): void {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      val.forEach((item, i) => encode(item, `${key}[${i}]`));
    } else if (typeof val === "object") {
      Object.entries(val as Record<string, unknown>).forEach(([k, v]) =>
        encode(v, `${key}[${k}]`)
      );
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }

  Object.entries(obj).forEach(([k, v]) => encode(v, prefix ? `${prefix}[${k}]` : k));
  return parts.join("&");
}
