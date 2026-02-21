// app/api/billing/route.ts
// Javari Billing — System Health & Tier Overview
// 2026-02-20 — STEP 5 (public endpoint, no auth required)
//
// GET /api/billing → system status + public tier summary

import { getTierDefinitions } from "@/lib/javari/revenue/subscriptions";
import { TIER_FEATURES, TIER_CREDIT_GRANT } from "@/lib/javari/revenue/entitlements";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tiers = getTierDefinitions();

    return Response.json({
      success: true,
      status:  "operational",
      version: "billing-v1",
      capabilities: [
        "credit_ledger",
        "usage_metering",
        "entitlement_enforcement",
        "subscription_management",
        "ai_cost_tracking",
        "multi_agent_cost_aggregation",
        "stripe_ready_metadata",
      ],
      tiers: tiers.map((t) => ({
        tier:            t.tier,
        label:           t.label,
        creditGrant:     t.creditGrantPerCycle,
        monthlyUsdCents: t.monthlyUsdCents,
        features:        TIER_FEATURES[t.tier] ?? [],
        maxCallsPerDay:  t.maxCallsPerDay,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
