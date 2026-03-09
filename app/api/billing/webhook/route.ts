// app/api/billing/webhook/route.ts
// Javari AI — Stripe Webhook Handler
// Purpose: Process Stripe events to activate subscriptions and grant credits.
// Verifies webhook signature. Idempotent — safe to replay.
// Date: 2026-03-09

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/platform-secrets/getSecret";
import { upgradeTier } from "@/lib/javari/revenue/subscriptions";
import { grantCredits } from "@/lib/javari/revenue/credits";
import { TIER_CREDIT_GRANT, type SubscriptionTier } from "@/lib/javari/revenue/entitlements";

export const runtime = "nodejs";

// Stripe signs every webhook — verify before trusting
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});

    const timestamp = parts["t"];
    const signatures = sigHeader.split(",")
      .filter(p => p.startsWith("v1="))
      .map(p => p.slice(3));

    if (!timestamp || signatures.length === 0) return false;

    // Protect against replay attacks — reject events older than 5 minutes
    const tolerance = 300;
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > tolerance) {
      console.warn("[webhook] Stripe timestamp too old — possible replay attack");
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return signatures.some(s => s === computed);
  } catch (err) {
    console.error("[webhook] Signature verification error:", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const payload   = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  // ── Verify signature ────────────────────────────────────────────────────────
  let webhookSecret: string;
  try {
    webhookSecret = await getSecret("STRIPE_WEBHOOK_SECRET");
  } catch {
    console.error("[webhook] Could not load STRIPE_WEBHOOK_SECRET");
    return Response.json({ error: "Webhook configuration error" }, { status: 500 });
  }

  const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
  if (!valid) {
    console.warn("[webhook] Invalid Stripe signature");
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Parse event ─────────────────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type as string;
  const data      = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;

  console.log(`[webhook] ${eventType}`);

  const db = createAdminClient();

  try {
    switch (eventType) {

      // ── New subscription activated (first payment) ─────────────────────────
      case "checkout.session.completed": {
        const userId = (data.metadata as Record<string, string>)?.user_id;
        const tier   = (data.metadata as Record<string, string>)?.tier as SubscriptionTier;
        const customerId = data.customer as string;
        const subId      = data.subscription as string;

        if (!userId || !tier) {
          console.error("[webhook] checkout.session.completed missing metadata", { userId, tier });
          break;
        }

        // Activate tier
        await upgradeTier(userId, tier);

        // Store Stripe customer + subscription IDs on profile
        await db.from("profiles").update({
          stripe_customer_id:  customerId,
          stripe_sub_id:       subId,
          updated_at:          new Date().toISOString(),
        }).eq("id", userId);

        // Grant credits for this cycle
        const credits = TIER_CREDIT_GRANT[tier] ?? 0;
        if (credits > 0) {
          await grantCredits(userId, credits, `${tier} plan activation`);
        }

        // Log the payment event
        await db.from("billing_events").insert({
          user_id:    userId,
          event_type: "subscription_activated",
          tier,
          stripe_customer_id: customerId,
          stripe_sub_id:      subId,
          amount_cents:       (data.amount_total as number) ?? 0,
          currency:           (data.currency as string) ?? "usd",
          occurred_at:        new Date().toISOString(),
        }).onConflict("stripe_event_id").ignore();

        console.log(`[webhook] Activated ${tier} for user ${userId}, granted ${credits} credits`);
        break;
      }

      // ── Monthly renewal — grant new cycle credits ──────────────────────────
      case "invoice.payment_succeeded": {
        const subId      = data.subscription as string;
        const customerId = data.customer as string;
        const billing    = data.billing_reason as string;

        // Only grant credits on renewal cycles, not initial activation
        // (activation is handled by checkout.session.completed)
        if (billing !== "subscription_cycle") break;

        // Look up user by stripe_customer_id
        const { data: profile } = await db
          .from("profiles")
          .select("id, subscription_tier")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) {
          console.warn(`[webhook] No user found for customer ${customerId}`);
          break;
        }

        const tier = profile.subscription_tier as SubscriptionTier;
        const credits = TIER_CREDIT_GRANT[tier] ?? 0;

        if (credits > 0) {
          await grantCredits(profile.id, credits, `${tier} renewal`);
        }

        await db.from("billing_events").insert({
          user_id:    profile.id,
          event_type: "subscription_renewed",
          tier,
          stripe_customer_id: customerId,
          stripe_sub_id:      subId,
          amount_cents:       (data.amount_paid as number) ?? 0,
          currency:           (data.currency as string) ?? "usd",
          occurred_at:        new Date().toISOString(),
        });

        console.log(`[webhook] Renewed ${tier} for user ${profile.id}, granted ${credits} credits`);
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const customerId = data.customer as string;
        const { data: profile } = await db
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await db.from("profiles").update({
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          }).eq("id", profile.id);

          await db.from("billing_events").insert({
            user_id:    profile.id,
            event_type: "payment_failed",
            stripe_customer_id: customerId,
            occurred_at:        new Date().toISOString(),
          });
        }
        break;
      }

      // ── Subscription cancelled ─────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const customerId = data.customer as string;
        const { data: profile } = await db
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          // Downgrade to free
          await upgradeTier(profile.id, "free");
          await db.from("profiles").update({
            subscription_status: "cancelled",
            stripe_sub_id:       null,
            updated_at:          new Date().toISOString(),
          }).eq("id", profile.id);

          await db.from("billing_events").insert({
            user_id:    profile.id,
            event_type: "subscription_cancelled",
            tier:       "free",
            stripe_customer_id: customerId,
            occurred_at:        new Date().toISOString(),
          });
        }
        break;
      }

      default:
        // Unhandled event type — return 200 so Stripe stops retrying
        break;
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${eventType}:`, err);
    // Return 500 so Stripe retries
    return Response.json({ error: "Processing error" }, { status: 500 });
  }

  return Response.json({ received: true });
}
