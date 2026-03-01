// app/api/admin/costs/recent/route.ts
// Admin-only endpoint for cost monitoring
// CONSOLIDATED: Now reads from ai_router_executions (single source of truth)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.substring(7);
  const { data } = await supabase.auth.getUser(token);
  if (!data?.user?.id) return false;
  const { data: settings } = await supabase
    .from("user_cost_settings")
    .select("is_admin")
    .eq("user_id", data.user.id)
    .single();
  return settings?.is_admin || false;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const { data, error } = await supabase
    .from("ai_router_executions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totals = {
    count: data?.length || 0,
    totalCost: data?.reduce((sum, r) => sum + parseFloat(r.cost || "0"), 0) || 0,
    byTier: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
  };

  data?.forEach((record) => {
    totals.byTier[record.tier || "unknown"] = (totals.byTier[record.tier || "unknown"] || 0) + parseFloat(record.cost || "0");
    totals.byProvider[record.provider] =
      (totals.byProvider[record.provider] || 0) + parseFloat(record.cost || "0");
  });

  return NextResponse.json({
    success: true,
    executions: data,
    totals,
    source: "ai_router_executions",
  });
}
