// app/api/autonomy-core/rollback/route.ts
// CR AudioViz AI — Autonomy Core Rollback Endpoint
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// POST /api/autonomy-core/rollback
// Body: { patchId: string, reason: string }
// Rolls back a specific applied patch by restoring oldContent to GitHub.
// Protected by AUTONOMY_CORE_ADMIN_SECRET.

import { NextRequest, NextResponse }  from "next/server";
import { rollbackPatch }               from "@/lib/autonomy-core/fixer/ring2";
import { writeAuditEvent }             from "@/lib/enterprise/audit";
import { safeHandler }                 from "@/lib/errors/handler";
import { ApiError }                    from "@/lib/errors/api-error";
import type { CorePatch }              from "@/lib/autonomy-core/crawler/types";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 30;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.AUTONOMY_CORE_ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-autonomy-secret") === secret
      || req.headers.get("authorization")      === `Bearer ${secret}`;
}

async function getPatchFromDb(patchId: string): Promise<CorePatch | null> {
  try {
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const res   = await fetch(
      `${url}/rest/v1/autonomy_patches?id=eq.${patchId}&limit=1`,
      { headers: { "apikey": key, "Authorization": `Bearer ${key}` } }
    );
    const data  = await res.json() as unknown[];
    if (!data[0]) return null;
    return data[0] as CorePatch;
  } catch { return null; }
}

export const POST = safeHandler(async (req: NextRequest) => {
  if (!isAuthorized(req)) throw ApiError.unauthorized("Admin secret required");

  const body = await req.json() as { patchId?: string; reason?: string; oldContent?: string };
  if (!body.patchId) throw ApiError.badRequest("patchId required");

  let patch = await getPatchFromDb(body.patchId);
  if (!patch) throw ApiError.notFound(`Patch ${body.patchId} not found`);

  // oldContent may need to be supplied by caller if not stored in DB
  if (!patch.oldContent && body.oldContent) {
    patch = { ...patch, oldContent: body.oldContent };
  }

  const reason  = body.reason ?? "Manual admin rollback";
  const rolled  = await rollbackPatch(patch, reason);

  await writeAuditEvent({
    action:   "admin.kill_switch",
    metadata: { system: "autonomy-core-rollback", patchId: body.patchId, reason, status: rolled.status },
    severity: "warn",
  });

  return NextResponse.json({
    success:       rolled.status === "rolled_back",
    patchId:       body.patchId,
    status:        rolled.status,
    rolledBackAt:  rolled.rolledBackAt,
    reason:        rolled.rolledBackReason,
  });
});
