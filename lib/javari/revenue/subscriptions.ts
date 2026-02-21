// lib/javari/revenue/subscriptions.ts
// Javari Subscription Engine v1
// 2026-02-20 — STEP 5 implementation
//
// Manages subscription lifecycle: create, upgrade, cancel.
// Stripe integration is metadata-ready (IDs stored, hooks planned).
// Credit grants happen on tier assignment.

import { createAdminClient } from "@/lib/supabase/server";
import {
  TIER_FEATURES,
  TIER_CREDIT_GRANT,
  TIER_LABELS,
  provisionEntitlements,
  invalidateEntitlementCache,
  type SubscriptionTier,
} from "./entitlements";
import { grantCredits } from "./credits";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubscriptionRecord {
  id:                  string;
  userId:              string;
  tier:                SubscriptionTier;
  status:              "active" | "cancelled" | "past_due" | "paused";
  stripeCustomerId?:   string;
  stripeSubId?:        string;
  currentPeriodStart:  string;
  currentPeriodEnd:    string;
  creditsPerCycle:     number;
  cancelAtPeriodEnd:   boolean;
  createdAt:           string;
  updatedAt:           string;
}

export interface TierDefinition {
  tier:           SubscriptionTier;
  label:          string;
  priceMonthlyUsd: number;
  creditsPerCycle: number;
  features:       string[];
  stripePriceId?: string;   // set when Stripe products are created
  description:    string;
}

export interface UpgradeResult {
  success:        boolean;
  previousTier:   SubscriptionTier;
  newTier:        SubscriptionTier;
  creditsGranted: number;
  error?:         string;
}

// ── Tier definitions ──────────────────────────────────────────────────────────

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierDefinition> = {
  free: {
    tier:            "free",
    label:           "Free",
    priceMonthlyUsd: 0,
    creditsPerCycle: 100,
    features:        TIER_FEATURES.free,
    description:     "100 AI credits/month. Chat + basic autonomy.",
  },
  creator: {
    tier:            "creator",
    label:           "Creator",
    priceMonthlyUsd: 19,
    creditsPerCycle: 1_000,
    features:        TIER_FEATURES.creator,
    stripePriceId:   process.env.STRIPE_CREATOR_PRICE_ID,
    description:     "1,000 credits/month. Multi-AI team + module factory.",
  },
  pro: {
    tier:            "pro",
    label:           "Pro",
    priceMonthlyUsd: 49,
    creditsPerCycle: 5_000,
    features:        TIER_FEATURES.pro,
    stripePriceId:   process.env.STRIPE_PRO_PRICE_ID,
    description:     "5,000 credits/month. Full platform + DB schema generation.",
  },
  enterprise: {
    tier:            "enterprise",
    label:           "Enterprise",
    priceMonthlyUsd: 199,
    creditsPerCycle: 25_000,
    features:        TIER_FEATURES.enterprise,
    description:     "25,000 credits/month. White-label + SLA + all features.",
  },
};

// ── Subscription CRUD ─────────────────────────────────────────────────────────

/**
 * getSubscription — fetch current subscription for a user.
 * Returns free tier placeholder if no record exists.
 */
export async function getSubscription(userId: string): Promise<SubscriptionRecord | null> {
  if (!userId) return null;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("user_subscription")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    return {
      id:                 data.id,
      userId:             data.user_id,
      tier:               data.tier as SubscriptionTier,
      status:             data.status,
      stripeCustomerId:   data.stripe_customer_id ?? undefined,
      stripeSubId:        data.stripe_sub_id      ?? undefined,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd:   data.current_period_end,
      creditsPerCycle:    data.credits_per_cycle,
      cancelAtPeriodEnd:  data.cancel_at_period_end,
      createdAt:          data.created_at,
      updatedAt:          data.updated_at,
    };
  } catch (err) {
    console.error("[Subscriptions] getSubscription failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * createOrEnsureSubscription — idempotent subscription creation.
 * Called on first user login or signup.
 */
export async function createOrEnsureSubscription(
  userId: string,
  tier:   SubscriptionTier = "free"
): Promise<SubscriptionRecord | null> {
  try {
    const db = createAdminClient();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const { data, error } = await db
      .from("user_subscription")
      .upsert({
        user_id:               userId,
        tier,
        status:                "active",
        credits_per_cycle:     TIER_CREDIT_GRANT[tier],
        current_period_start:  new Date().toISOString(),
        current_period_end:    periodEnd.toISOString(),
        credits_granted_at:    new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Provision entitlements
    await provisionEntitlements(userId, tier);

    // Grant initial credits if this is truly new
    await grantCredits(userId, TIER_CREDIT_GRANT[tier], "grant",
      `${TIER_LABELS[tier]} plan — ${TIER_CREDIT_GRANT[tier]} credits`
    );

    return getSubscription(userId);
  } catch (err) {
    console.error("[Subscriptions] createOrEnsure failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * upgradeTier — change subscription tier, grant pro-rated credits, update entitlements.
 */
export async function upgradeTier(
  userId:  string,
  newTier: SubscriptionTier,
  stripeMetadata?: { customerId?: string; subId?: string }
): Promise<UpgradeResult> {
  const current = await getSubscription(userId);
  const previousTier = current?.tier ?? "free";

  try {
    const db = createAdminClient();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const { error } = await db
      .from("user_subscription")
      .upsert({
        user_id:              userId,
        tier:                 newTier,
        status:               "active",
        credits_per_cycle:    TIER_CREDIT_GRANT[newTier],
        current_period_start: new Date().toISOString(),
        current_period_end:   periodEnd.toISOString(),
        credits_granted_at:   new Date().toISOString(),
        stripe_customer_id:   stripeMetadata?.customerId ?? null,
        stripe_sub_id:        stripeMetadata?.subId      ?? null,
      }, { onConflict: "user_id" });

    if (error) throw new Error(error.message);

    // Grant new tier credits
    const creditsGranted = TIER_CREDIT_GRANT[newTier];
    await grantCredits(userId, creditsGranted, "grant",
      `Upgrade to ${TIER_LABELS[newTier]} — ${creditsGranted} credits`
    );

    // Provision new entitlements
    await provisionEntitlements(userId, newTier);
    invalidateEntitlementCache(userId);

    return { success: true, previousTier, newTier, creditsGranted };
  } catch (err) {
    return {
      success:        false,
      previousTier,
      newTier,
      creditsGranted: 0,
      error:          err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * cancelSubscription — mark as cancelled; access continues until period end.
 */
export async function cancelSubscription(userId: string): Promise<boolean> {
  try {
    const db = createAdminClient();
    const { error } = await db
      .from("user_subscription")
      .update({
        cancel_at_period_end: true,
        status:               "cancelled",
      })
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[Subscriptions] cancel failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * renewSubscription — called by cron/webhook on period renewal.
 * Grants new cycle credits.
 */
export async function renewSubscription(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  if (!sub || sub.status !== "active") return false;

  try {
    const db = createAdminClient();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    await db
      .from("user_subscription")
      .update({
        current_period_start: new Date().toISOString(),
        current_period_end:   periodEnd.toISOString(),
        credits_granted_at:   new Date().toISOString(),
      })
      .eq("user_id", userId);

    await grantCredits(
      userId, sub.creditsPerCycle, "grant",
      `${TIER_LABELS[sub.tier]} renewal — ${sub.creditsPerCycle} credits`
    );

    return true;
  } catch (err) {
    console.error("[Subscriptions] renew failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * getTierDefinitions — return all tiers for pricing page display.
 */
export function getTierDefinitions(): TierDefinition[] {
  return Object.values(TIER_DEFINITIONS);
}
