// app/api/admin/costs/recent/route.ts
// Admin-only endpoint for cost monitoring
// Shows provider_internal + model_internal (forbidden in user responses)

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
  const userId = searchParams.get("user_id");

  let query = supabase
    .from("llm_execution_costs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate totals
  const totals = {
    count: data?.length || 0,
    totalCost: data?.reduce((sum, r) => sum + parseFloat(r.actual_cost_usd || "0"), 0) || 0,
    byTier: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
  };

  data?.forEach((record) => {
    totals.byTier[record.tier] = (totals.byTier[record.tier] || 0) + parseFloat(record.actual_cost_usd || "0");
    totals.byProvider[record.provider_internal] = 
      (totals.byProvider[record.provider_internal] || 0) + parseFloat(record.actual_cost_usd || "0");
  });

  return NextResponse.json({
    success: true,
    executions: data,
    totals,
    adminNote: "Provider/model data visible in admin endpoint only",
  });
}
