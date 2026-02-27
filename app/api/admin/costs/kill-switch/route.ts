// app/api/admin/costs/kill-switch/route.ts
// Emergency pause for autonomous operations

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

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { action } = await req.json();

  if (action === "pause") {
    // In production, this would update a system_config table
    // For now, document the pattern
    return NextResponse.json({
      success: true,
      status: "paused",
      message: "Set JAVARI_AUTONOMY_PAUSED=1 in Vercel environment variables",
      note: "All chat requests will return systemPaused: true",
    });
  }

  if (action === "resume") {
    return NextResponse.json({
      success: true,
      status: "active",
      message: "Remove JAVARI_AUTONOMY_PAUSED from Vercel environment variables",
    });
  }

  return NextResponse.json({ error: "Invalid action. Use 'pause' or 'resume'" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    paused: process.env.JAVARI_AUTONOMY_PAUSED === "1",
    message: process.env.JAVARI_AUTONOMY_PAUSED === "1" 
      ? "System is currently paused" 
      : "System is active",
  });
}
