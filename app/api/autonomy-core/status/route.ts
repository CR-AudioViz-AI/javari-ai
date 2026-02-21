// app/api/autonomy-core/status/route.ts
// CR AudioViz AI — Autonomy Core Status Endpoint
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// Returns:
//   - Current config (flags, ring, mode)
//   - Last N cycle reports from Supabase
//   - Last N patches
//   - Kill switch state

import { NextRequest, NextResponse } from "next/server";
import { getAutonomyCoreConfig }     from "@/lib/autonomy-core/crawler/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getRecentCycles(limit = 5): Promise<unknown[]> {
  try {
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return [];
    const res   = await fetch(
      `${url}/rest/v1/autonomy_cycle_reports?order=started_at.desc&limit=${limit}`,
      { headers: { "apikey": key, "Authorization": `Bearer ${key}` } }
    );
    return res.ok ? (await res.json() as unknown[]) : [];
  } catch { return []; }
}

async function getRecentPatches(limit = 10): Promise<unknown[]> {
  try {
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return [];
    const res   = await fetch(
      `${url}/rest/v1/autonomy_patches?order=applied_at.desc&limit=${limit}`,
      { headers: { "apikey": key, "Authorization": `Bearer ${key}` } }
    );
    return res.ok ? (await res.json() as unknown[]) : [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const cfg    = getAutonomyCoreConfig();
  const limit  = parseInt(req.nextUrl.searchParams.get("limit") ?? "5");

  const [cycles, patches] = await Promise.all([
    getRecentCycles(limit),
    getRecentPatches(limit * 2),
  ]);

  return NextResponse.json({
    config: {
      enabled:            cfg.enabled,
      mode:               cfg.mode,
      ring:               cfg.ring,
      scope:              cfg.scope,
      killSwitch:         cfg.killSwitch,
      intervalMinutes:    cfg.intervalMinutes,
      maxPatchesPerCycle: cfg.maxPatchesPerCycle,
      requireValidator:   cfg.requireValidator,
      degradedOnAnomaly:  cfg.degradedOnAnomaly,
    },
    recentCycles:  cycles,
    recentPatches: patches,
    timestamp:     new Date().toISOString(),
  });
}
