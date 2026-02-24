// lib/javari/revenue/entitlements.ts
// Javari Entitlement Engine
// 2026-02-20 — STEP 5 implementation
//
// Maps subscription tier → feature matrix.
// Checks and enforces feature access before execution.
// Blocking: throws EntitlementError for unlicensed features.

import { createAdminClient } from "@/lib/supabase/server";

// ── Feature matrix ────────────────────────────────────────────────────────────

export type Feature =
  | "chat"
  | "autonomy"
  | "multi_ai_team"
  | "module_factory"
  | "factory_schema"
  | "realtime"
  | "file_upload"
  | "api_access"
  | "white_label"
  | "enterprise_sla";

export type SubscriptionTier = "free" | "creator" | "pro" | "enterprise";

/** Feature matrix — which features each tier includes */
export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  free: [
    "chat",
    "autonomy",
    "api_access",
  ],
  creator: [
    "chat",
    "autonomy",
    "multi_ai_team",
    "module_factory",
    "api_access",
    "file_upload",
  ],
  pro: [
    "chat",
    "autonomy",
    "multi_ai_team",
    "module_factory",
    "factory_schema",
    "realtime",
    "file_upload",
    "api_access",
  ],
  enterprise: [
    "chat",
    "autonomy",
    "multi_ai_team",
    "module_factory",
    "factory_schema",
    "realtime",
    "file_upload",
    "api_access",
    "white_label",
    "enterprise_sla",
  ],
};

/** Credit multipliers per tier (higher tier = more credits included in price) */
export const TIER_CREDIT_GRANT: Record<SubscriptionTier, number> = {
  free:       100,
  creator:    1_000,
  pro:        5_000,
  enterprise: 25_000,
};

/** Human-readable tier labels */
export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free:       "Free",
  creator:    "Creator ($19/mo)",
  pro:        "Pro ($49/mo)",
  enterprise: "Enterprise ($199/mo)",
};

// ── Custom error ──────────────────────────────────────────────────────────────

export class EntitlementError extends Error {
  public readonly feature:  Feature;
  public readonly userId:   string;
  public readonly tier:     SubscriptionTier;
  public readonly upgradeUrl: string;

  constructor(feature: Feature, userId: string, tier: SubscriptionTier) {
    const label = TIER_LABELS[tier];
    const requiredTier = lowestTierForFeature(feature);
    const requiredLabel = requiredTier ? TIER_LABELS[requiredTier] : "a paid plan";
    super(
      `ENTITLEMENT_DENIED: feature="${feature}" requires ${requiredLabel} (current: ${label})`
    );
    this.name        = "EntitlementError";
    this.feature     = feature;
    this.userId      = userId;
    this.tier        = tier;
    this.upgradeUrl  = `/billing/upgrade?feature=${feature}`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lowestTierForFeature(feature: Feature): SubscriptionTier | null {
  for (const tier of (["free", "creator", "pro", "enterprise"] as SubscriptionTier[])) {
    if (TIER_FEATURES[tier].includes(feature)) return tier;
  }
  return null;
}

/** In-memory cache: userId → { tier, features, expiresAt } */
const entitlementCache = new Map<string, {
  tier:      SubscriptionTier;
  features:  Feature[];
  expiresAt: number;
}>();

const CACHE_TTL_MS = 60_000; // 1 minute

// ── Core engine ───────────────────────────────────────────────────────────────

/**
 * getUserTierAndFeatures — fetch user subscription + entitlements from DB.
 * Cached for 1 minute to reduce DB round-trips.
 */
export async function getUserTierAndFeatures(
  userId: string
): Promise<{ tier: SubscriptionTier; features: Feature[] }> {
  // System/anonymous = all features, no billing
  if (!userId || userId === "system" || userId === "anonymous") {
    return { tier: "enterprise", features: Object.keys(TIER_FEATURES.enterprise) as Feature[] };
  }

  // Cache hit
  const cached = entitlementCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return { tier: cached.tier, features: cached.features };
  }

  try {
    const db = createAdminClient();

    // Get subscription tier
    const { data: sub } = await db
      .from("user_subscription")
      .select("tier")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    const tier = (sub?.tier as SubscriptionTier) ?? "free";

    // Get tier base features + any manual overrides from user_entitlements
    const { data: entRows = [] } = await db
      .from("user_entitlements")
      .select("feature, expires_at")
      .eq("user_id", userId);

    // Combine tier defaults + active manual grants
    const now = new Date().toISOString();
    const manualFeatures = (entRows as Array<{ feature: string; expires_at: string | null }>)
      .filter((r) => !r.expires_at || r.expires_at > now)
      .map((r) => r.feature as Feature);

    const allFeatures = [...new Set([...TIER_FEATURES[tier], ...manualFeatures])];

    // Cache
    entitlementCache.set(userId, {
      tier,
      features:  allFeatures,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return { tier, features: allFeatures };
  } catch (err) {
    console.warn("[Entitlements] DB read failed, defaulting to free tier:",
      err instanceof Error ? err.message : err
    );
    // Fail open: grant free tier features to avoid blocking users on DB errors
    return { tier: "free", features: TIER_FEATURES.free };
  }
}

/**
 * checkEntitlement — returns true/false for a feature check.
 * Does NOT throw. Use enforceEntitlement() if you want to throw.
 */
export async function checkEntitlement(
  userId:  string,
  feature: Feature
): Promise<{ allowed: boolean; tier: SubscriptionTier; upgradeUrl: string }> {
  const { tier, features } = await getUserTierAndFeatures(userId);
  const allowed = features.includes(feature);
  return {
    allowed,
    tier,
    upgradeUrl: allowed ? "" : `/billing/upgrade?feature=${feature}`,
  };
}

/**
 * enforceEntitlement — throws EntitlementError if feature not allowed.
 * Call at the start of any gated operation.
 */
export async function enforceEntitlement(
  userId:  string,
  feature: Feature
): Promise<void> {
  const { tier, features } = await getUserTierAndFeatures(userId);
  if (!features.includes(feature)) {
    throw new EntitlementError(feature, userId, tier);
  }
}

/**
 * enforceEntitlements — check multiple features at once.
 * Throws on the first denied feature.
 */
export async function enforceEntitlements(
  userId:   string,
  features: Feature[]
): Promise<void> {
  const { tier, features: allowed } = await getUserTierAndFeatures(userId);
  for (const feature of features) {
    if (!allowed.includes(feature)) {
      throw new EntitlementError(feature, userId, tier);
    }
  }
}

/**
 * invalidateEntitlementCache — call after subscription upgrades/downgrades.
 */
export function invalidateEntitlementCache(userId: string): void {
  entitlementCache.delete(userId);
}

/**
 * provisionEntitlements — write tier features to user_entitlements table.
 * Called after subscription creation/upgrade.
 */
export async function provisionEntitlements(
  userId: string,
  tier:   SubscriptionTier
): Promise<void> {
  const features = TIER_FEATURES[tier];
  const db = createAdminClient();

  const rows = features.map((feature) => ({
    user_id:    userId,
    feature,
    granted_by: "subscription",
  }));

  const { error } = await db
    .from("user_entitlements")
    .upsert(rows, { onConflict: "user_id,feature" });

  if (error) {
    console.error("[Entitlements] provisionEntitlements failed:", error.message);
  }

  invalidateEntitlementCache(userId);
}
