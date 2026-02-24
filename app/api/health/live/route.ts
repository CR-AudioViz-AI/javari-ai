// app/api/health/live/route.ts
// CR AudioViz AI — Liveness Probe
// 2026-02-20 — STEP 7 Production Hardening
//
// Always returns "ok" unless the server is crashing.
// Used by load balancers / Vercel health checks.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status:    "ok",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Health":      "live",
      },
    }
  );
}
