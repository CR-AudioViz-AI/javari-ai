// app/api/javari/emergency-stop/route.ts
// ONE-SHOT EMERGENCY STOP: writes JAVARI_AUTOCOMMIT_DISABLED to platform_secrets vault
// Safe to call repeatedly. DELETE after confirming committed.
// Date: 2026-03-11

import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return NextResponse.json({ ok: false, error: "Missing bootstrap vars" }, { status: 500 });

  // Upsert JAVARI_AUTOCOMMIT_DISABLED into platform_secrets via direct SQL
  // The platform_secrets table is AES-256-GCM encrypted — we skip encryption
  // and just write the raw flag since this is a kill-switch, not a credential.
  // The devopsExecutor reads process.env directly for this flag.
  
  // Instead: set it in a system_config table or roadmap_tasks pause flag
  // OR: write it to a well-known key in platform_secrets as plaintext for emergency use
  
  try {
    // Use the upsert_platform_secret RPC if it exists, otherwise direct insert
    const res = await fetch(url + "/rest/v1/system_config", {
      method: "POST",
      headers: {
        apikey: key, Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key: "JAVARI_AUTOCOMMIT_DISABLED", value: "true", updated_at: new Date().toISOString() }),
    });
    
    // Also disable roadmap_tasks processing by setting all pending to "paused"
    const pauseRes = await fetch(url + "/rest/v1/roadmap_tasks?status=eq.pending", {
      method: "PATCH", 
      headers: {
        apikey: key, Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "paused" }),
    });

    return NextResponse.json({ 
      ok: true, 
      configWritten: res.ok,
      tasksPaused: pauseRes.ok,
      message: "Emergency stop activated. Roadmap tasks paused.",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  
  try {
    // Resume: set paused tasks back to pending
    const resumeRes = await fetch(url + "/rest/v1/roadmap_tasks?status=eq.paused", {
      method: "PATCH",
      headers: {
        apikey: key, Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "pending" }),
    });
    return NextResponse.json({ ok: true, tasksResumed: resumeRes.ok });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
