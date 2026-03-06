// app/api/javari/vercel-config/route.ts
// Purpose: Update Vercel project production branch via REST API
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "prj_zxjzE2qvMWFWqV0AspGvago6aPV5";
const TEAM_ID    = "team_Z0yef7NlFu1coCJWz8UmUdI5";

async function tryCandidates(token: string, branch: string): Promise<{
  ok: boolean;
  productionBranch?: string;
  endpoint?: string;
  rawError?: string;
}> {
  // Candidate API calls — Vercel has changed field names across versions
  const candidates = [
    // v9 with link.productionBranch (most common in docs)
    {
      url: `https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
      body: { link: { productionBranch: branch } },
      label: "v9 link.productionBranch",
    },
    // v9 with gitRepository.productionBranch
    {
      url: `https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
      body: { gitRepository: { productionBranch: branch } },
      label: "v9 gitRepository.productionBranch",
    },
    // v2 with productionBranch
    {
      url: `https://api.vercel.com/v2/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
      body: { productionBranch: branch },
      label: "v2 productionBranch",
    },
    // v2 with link
    {
      url: `https://api.vercel.com/v2/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
      body: { link: { productionBranch: branch } },
      label: "v2 link.productionBranch",
    },
  ];

  for (const candidate of candidates) {
    console.log(`[vercel-config] Trying: ${candidate.label}`);
    const res = await fetch(candidate.url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(candidate.body),
    });

    const data = await res.json() as Record<string, unknown>;

    if (res.ok) {
      const linkBranch = (data.link as { productionBranch?: string } | undefined)?.productionBranch;
      console.log(`[vercel-config] SUCCESS via ${candidate.label}: productionBranch=${linkBranch}`);
      return { ok: true, productionBranch: linkBranch ?? branch, endpoint: candidate.label };
    }

    const errMsg = (data as { error?: { message?: string } }).error?.message ?? JSON.stringify(data).slice(0, 200);
    console.log(`[vercel-config] FAIL ${candidate.label}: ${res.status} ${errMsg}`);
  }

  return { ok: false, rawError: "All API variants failed — see logs for details" };
}

export async function POST(req: NextRequest) {
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  if (!VERCEL_TOKEN) {
    return NextResponse.json({ ok: false, error: "VERCEL_TOKEN env var not set" }, { status: 500 });
  }

  let targetBranch = "production";
  try {
    const body = await req.json() as { branch?: string };
    if (body.branch) targetBranch = body.branch;
  } catch { /* no body */ }

  const result = await tryCandidates(VERCEL_TOKEN, targetBranch);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
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
