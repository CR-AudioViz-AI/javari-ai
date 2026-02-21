// app/api/autonomy-core/run/route.ts
// CR AudioViz AI — Autonomy Core Run Endpoint
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// Triggers an autonomy cycle. Accepts:
//   POST /api/autonomy-core/run          → full cycle (respects env flags)
//   POST /api/autonomy-core/run?dry=1    → dry run only
//   POST /api/autonomy-core/run?force=1  → bypass enabled check (admin only)
//
// Protected by AUTONOMY_CORE_ADMIN_SECRET header.
// Called by Vercel Cron job OR manual admin trigger.

import { NextRequest, NextResponse } from "next/server";
import { runAutonomyCycle }          from "@/lib/autonomy-core/scheduler/cycle";
import { getAutonomyCoreConfig }     from "@/lib/autonomy-core/crawler/types";
import { writeAuditEvent }           from "@/lib/enterprise/audit";
import { safeHandler }               from "@/lib/errors/handler";
import { ApiError }                  from "@/lib/errors/api-error";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 120;  // cycles can take up to 2 minutes

// ── Auth guard ─────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  // 1. Internal Vercel cron: X-Vercel-Cron header (set by Vercel automatically)
  if (req.headers.get("x-vercel-cron") === "1") return true;
  // 2. Admin secret for manual trigger
  const secret = process.env.AUTONOMY_CORE_ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-autonomy-secret") === secret
      || req.headers.get("authorization")      === `Bearer ${secret}`;
}

// ── GET — status ───────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const cfg = getAutonomyCoreConfig();
  return NextResponse.json({
    status:     "autonomy-core",
    enabled:    cfg.enabled,
    mode:       cfg.mode,
    ring:       cfg.ring,
    scope:      cfg.scope,
    killSwitch: cfg.killSwitch,
    intervalMinutes:    cfg.intervalMinutes,
    maxPatchesPerCycle: cfg.maxPatchesPerCycle,
    requireValidator:   cfg.requireValidator,
    degradedOnAnomaly:  cfg.degradedOnAnomaly,
    flags: {
      AUTONOMOUS_CORE_ENABLED:             process.env.AUTONOMOUS_CORE_ENABLED            ?? "false",
      AUTONOMOUS_CORE_MODE:                process.env.AUTONOMOUS_CORE_MODE               ?? "continuous",
      AUTONOMOUS_CORE_RING:                process.env.AUTONOMOUS_CORE_RING               ?? "2",
      AUTONOMOUS_CORE_SCOPE:               process.env.AUTONOMOUS_CORE_SCOPE              ?? "core_only",
      AUTONOMOUS_CORE_INTERVAL_MINUTES:    process.env.AUTONOMOUS_CORE_INTERVAL_MINUTES   ?? "15",
      AUTONOMOUS_CORE_MAX_PATCHES_PER_CYCLE: process.env.AUTONOMOUS_CORE_MAX_PATCHES_PER_CYCLE ?? "3",
      AUTONOMOUS_CORE_KILL_SWITCH:         process.env.AUTONOMOUS_CORE_KILL_SWITCH        ?? "false",
      AUTONOMOUS_CORE_REQUIRE_VALIDATOR:   process.env.AUTONOMOUS_CORE_REQUIRE_VALIDATOR  ?? "true",
      AUTONOMOUS_CORE_DEGRADED_ON_ANOMALY: process.env.AUTONOMOUS_CORE_DEGRADED_ON_ANOMALY ?? "true",
    },
  });
}

// ── POST — trigger cycle ───────────────────────────────────────────────────────

export const POST = safeHandler(async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    throw ApiError.unauthorized("Autonomy Core: admin secret required");
  }

  const { searchParams } = req.nextUrl;
  const dryRun  = searchParams.get("dry")   === "1" || searchParams.get("dryRun") === "true";
  const force   = searchParams.get("force") === "1";

  await writeAuditEvent({
    action:   "admin.kill_switch",
    metadata: { system: "autonomy-core", trigger: "manual", dryRun, force },
    severity: "warn",
  });

  const report = await runAutonomyCycle({ dryRun, force });

  return NextResponse.json({
    success:        true,
    cycleId:        report.id,
    status:         report.status,
    durationMs:     report.durationMs,
    anomaliesFound: report.anomaliesFound,
    patchesApplied: report.patchesApplied,
    patchesRejected:report.patchesRejected,
    haltReason:     report.haltReason ?? null,
    dryRun,
    report,
  });
});
