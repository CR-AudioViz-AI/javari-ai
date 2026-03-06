// app/api/javari/vercel-config/route.ts
// Purpose: One-shot endpoint to update Vercel project production branch via REST API
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "prj_zxjzE2qvMWFWqV0AspGvago6aPV5";
const TEAM_ID    = "team_Z0yef7NlFu1coCJWz8UmUdI5";

export async function POST(req: NextRequest) {
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  if (!VERCEL_TOKEN) {
    return NextResponse.json({ ok: false, error: "VERCEL_TOKEN env var not set" }, { status: 500 });
  }

  // Parse optional target branch from body (default: "production")
  let targetBranch = "production";
  try {
    const body = await req.json() as { branch?: string };
    if (body.branch) targetBranch = body.branch;
  } catch { /* no body — use default */ }

  try {
    // Vercel REST API: PATCH /v9/projects/{id} with productionBranch at top level
    const url = `https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productionBranch: targetBranch }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      // Log the full error for debugging
      console.error("[vercel-config] API error:", JSON.stringify(data).slice(0, 400));
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: (data as { error?: { message?: string } }).error?.message ?? JSON.stringify(data).slice(0, 300),
      }, { status: 500 });
    }

    const branch = (data as { link?: { productionBranch?: string } }).link?.productionBranch ?? targetBranch;
    console.log(`[vercel-config] productionBranch updated to: ${branch}`);

    return NextResponse.json({
      ok: true,
      productionBranch: branch,
      projectId: PROJECT_ID,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[vercel-config] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  if (!VERCEL_TOKEN) {
    return NextResponse.json({ ok: false, error: "VERCEL_TOKEN not set" });
  }

  const res  = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  const data = await res.json() as { link?: { productionBranch?: string } };
  return NextResponse.json({
    ok: true,
    productionBranch: data.link?.productionBranch ?? "unknown",
    projectId: PROJECT_ID,
  });
}
