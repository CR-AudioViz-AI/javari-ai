// app/api/admin/clear-scheduler-lock/route.ts
// Purpose: ONE-TIME admin tool — clears stuck javari_scheduler_lock row.
// Safe: only deletes the lock row, touches nothing else.
// Date: 2026-03-09
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}
export async function POST(req: NextRequest) {
  // Require a simple admin token to prevent accidental hits
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "clear-lock-autonomous_loop") {
    return Response.json({ error: "Require confirm: clear-lock-autonomous_loop" }, { status: 400 });
  }
  // Read lock before clearing
  const { data: before } = await db()
    .from("javari_scheduler_lock")
    .select("*")
    .eq("lock_key", "autonomous_loop")
    .single();
  // Delete it
  const { error } = await db()
    .from("javari_scheduler_lock")
    .delete()
    .eq("lock_key", "autonomous_loop");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, cleared: before ?? null, message: "Scheduler lock cleared." });
}
