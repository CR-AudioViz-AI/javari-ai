// app/api/javari/debug-tasks/route.ts
// Temp: surface exact Supabase error from fetchNextPendingTask query
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Test 1: select all columns to see what exists
  const t1 = await db.from("roadmap_tasks").select("*").eq("status","pending").limit(1);

  // Test 2: select only confirmed columns
  const t2 = await db.from("roadmap_tasks")
    .select("id, title, description")
    .eq("status","pending")
    .order("updated_at", { ascending: true })
    .limit(1);

  // Test 3: raw count
  const t3 = await db.from("roadmap_tasks").select("id", { count: "exact", head: true }).eq("status","pending");

  return NextResponse.json({
    t1_error: t1.error?.message ?? null,
    t1_cols: t1.data?.[0] ? Object.keys(t1.data[0]) : null,
    t1_count: t1.data?.length ?? 0,
    t2_error: t2.error?.message ?? null,
    t2_row: t2.data?.[0] ? { id: (t2.data[0] as {id:string}).id, title: (t2.data[0] as {title:string}).title } : null,
    t3_count: t3.count ?? 0,
    t3_error: t3.error?.message ?? null,
  });
}
