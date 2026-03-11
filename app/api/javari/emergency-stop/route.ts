// app/api/javari/emergency-stop/route.ts
// EMERGENCY: pauses all pending roadmap tasks to stop autonomous commit loop
// Call POST to pause. Call DELETE to resume.
// Date: 2026-03-11
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, key };
}

export async function POST(): Promise<NextResponse> {
  const { url, key } = db();
  if (!url || !key) return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
  try {
    // Pause all pending roadmap tasks
    const r = await fetch(url + "/rest/v1/roadmap_tasks?status=eq.pending", {
      method: "PATCH",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "paused" }),
    });
    // Also pause in_progress and retry tasks
    const r2 = await fetch(url + "/rest/v1/roadmap_tasks?status=in.(in_progress,retry)", {
      method: "PATCH",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "paused" }),
    });
    return NextResponse.json({ ok: true, paused: r.ok, paused2: r2.ok, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const { url, key } = db();
  try {
    const r = await fetch(url + "/rest/v1/roadmap_tasks?status=eq.paused", {
      method: "PATCH",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "pending" }),
    });
    return NextResponse.json({ ok: true, resumed: r.ok, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
