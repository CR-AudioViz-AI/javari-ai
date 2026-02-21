// app/api/billing/usage/route.ts
// Javari Billing — Usage API
// 2026-02-20 — STEP 5 implementation
//
// GET /api/billing/usage              → today's usage summary
// GET /api/billing/usage?date=YYYY-MM-DD → specific day summary

import { NextRequest } from "next/server";
import { aggregateUsageDaily } from "@/lib/javari/revenue/metering";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getAuthedUserId(): Promise<string | null> {
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ??
    new Date().toISOString().slice(0, 10); // today YYYY-MM-DD

  try {
    const summary = await aggregateUsageDaily(userId, date);
    return Response.json({ success: true, date, ...summary });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
