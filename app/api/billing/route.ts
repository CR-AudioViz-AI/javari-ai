// app/api/billing/route.ts
// Javari Billing — System Health & Tier Overview
// 2026-02-20 — STEP 5 (public endpoint, no auth required)
//
// GET /api/billing → system status + public tier summary

import { getTierDefinitions } from "@/lib/javari/revenue/subscriptions";

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
        tier:             t.tier,
        label:            t.label,
        priceMonthlyUsd:  t.priceMonthlyUsd,
        creditsPerCycle:  t.creditsPerCycle,
        features:         t.features,
        stripePriceId:    t.stripePriceId ?? null,
        description:      t.description,
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
