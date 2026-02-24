// app/api/enterprise/audit/route.ts
// CR AudioViz AI — Enterprise Audit Log Viewer
// 2026-02-21 — STEP 10 Enterprise

import { NextRequest, NextResponse } from "next/server";
import { getAuditLog } from "@/lib/enterprise/audit";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";
import type { AuditAction } from "@/lib/enterprise/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = safeHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const orgId   = searchParams.get("orgId") ?? undefined;
  const userId  = searchParams.get("userId") ?? undefined;
  const action  = searchParams.get("action") as AuditAction | undefined;
  const limit   = parseInt(searchParams.get("limit") ?? "50");
  const since   = searchParams.get("since") ?? undefined;

  if (!orgId && !userId) throw ApiError.badRequest("orgId or userId required");

  const events = await getAuditLog({ orgId, userId, action, limit: Math.min(limit, 500), since });

  return NextResponse.json({
    success: true,
    count:   events.length,
    events,
  });
});
