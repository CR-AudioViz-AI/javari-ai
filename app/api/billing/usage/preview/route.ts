// app/api/billing/usage/preview/route.ts
// Javari Billing — Usage Forecast Preview
// 2026-02-20 — STEP 6 Productization
//
// GET /api/billing/usage/preview
// Returns: credits_used_today, credits_remaining, forecast_days_remaining,
//          daily_average, top_features, top_models

import { NextRequest } from "next/server";
import { checkBalance }        from "@/lib/javari/revenue/credits";
import { aggregateUsageDaily } from "@/lib/javari/revenue/metering";
import { getSubscription }     from "@/lib/javari/revenue/subscriptions";
import { createClient }        from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  let userId: string | null = null;
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* no session */ }

  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [bal, todayUsage, sub] = await Promise.all([
      checkBalance(userId),
      aggregateUsageDaily(userId, today),
      getSubscription(userId),
    ]);

    const creditsBalance     = bal.balance;
    const creditsUsedToday   = todayUsage.totalCredits ?? 0;
    const creditsPerCycle    = sub?.creditsPerCycle ?? 100;
    const cycleEnd           = sub?.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd)
      : new Date(Date.now() + 30 * 86400_000);

    const daysLeft = Math.max(1, Math.ceil((cycleEnd.getTime() - Date.now()) / 86400_000));
    const dailyAvg = creditsUsedToday; // simple: today's usage as baseline

    // Forecast: if usage stays at daily average, how many days until 0?
    const forecastDaysRemaining = dailyAvg > 0
      ? Math.floor(creditsBalance / dailyAvg)
      : daysLeft;

    const forecastWillExhaust   = forecastDaysRemaining < daysLeft;
    const projectedEndCredits   = Math.max(0, creditsBalance - dailyAvg * daysLeft);
    const usagePercent          = Math.min(100, Math.round(((creditsPerCycle - creditsBalance) / creditsPerCycle) * 100));

    return Response.json({
      success:              true,
      date:                 today,
      creditsBalance,
      creditsUsedToday,
      creditsPerCycle,
      usagePercent,
      dailyAverage:         dailyAvg,
      daysLeftInCycle:      daysLeft,
      forecastDaysRemaining,
      forecastWillExhaust,
      projectedEndCredits,
      renewalDate:          cycleEnd.toISOString().slice(0, 10),
      topFeatures:          Object.entries(todayUsage.byFeature ?? {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([feature, calls]) => ({ feature, calls })),
      topModels: Object.entries(todayUsage.byModel ?? {})
        .sort(([, a], [, b]) => (b as { credits: number }).credits - (a as { credits: number }).credits)
        .slice(0, 5)
        .map(([model, data]) => ({ model, ...(data as object) })),
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
