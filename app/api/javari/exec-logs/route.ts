// app/api/javari/exec-logs/route.ts
// Purpose: Direct PostgREST read/write for execution_logs table.
//          Uses raw fetch() to bypass supabase-js TypeScript generated type cache.
//          execution_logs was created after supabase gen types last ran, so
//          supabase-js .from("execution_logs") returns schema cache miss errors.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function postgrestHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    "apikey":        key,
    "Authorization": `Bearer ${key}`,
    "Content-Type":  "application/json",
  };
}

function postgrestUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${path}`;
}

// GET: Read latest execution_logs rows
export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const limit  = parseInt(url.searchParams.get("limit") ?? "10", 10);
  const taskId = url.searchParams.get("task_id");

  let endpoint = `/execution_logs?select=*&order=timestamp.desc&limit=${limit}`;
  if (taskId) endpoint += `&task_id=eq.${encodeURIComponent(taskId)}`;

  const res = await fetch(postgrestUrl(endpoint), {
    headers: postgrestHeaders(),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({
      ok: false,
      error: `PostgREST ${res.status}: ${err.slice(0, 200)}`,
    }, { status: res.status });
  }

  const rows = await res.json() as unknown[];
  return NextResponse.json({
    ok: true,
    count: rows.length,
    rows,
  });
}

// POST: Write a test execution_log row (used to verify the table is writable)
export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  if (url.searchParams.get("action") === "test-write") {
    const testRow = {
      execution_id:   `test-${Date.now()}`,
      task_id:        "test:write-verification",
      model_used:     "none",
      cost:           0,
      tokens_in:      0,
      tokens_out:     0,
      execution_time: 0,
      status:         "success",
      error_message:  null,
      timestamp:      new Date().toISOString(),
    };

    const res = await fetch(postgrestUrl("/execution_logs"), {
      method: "POST",
      headers: { ...postgrestHeaders(), "Prefer": "return=representation" },
      body: JSON.stringify(testRow),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({
        ok: false,
        error: `Write failed: ${res.status} ${err.slice(0, 200)}`,
      }, { status: res.status });
    }

    const written = await res.json();
    return NextResponse.json({ ok: true, written });
  }

  return NextResponse.json({ ok: false, error: "Use ?action=test-write" }, { status: 400 });
}
