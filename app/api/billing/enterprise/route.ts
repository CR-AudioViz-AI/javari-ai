// app/api/billing/enterprise/route.ts
// CR AudioViz AI — Enterprise Billing API
// 2026-02-21 — STEP 10 Enterprise

import { NextRequest, NextResponse } from "next/server";
import { calculateSeatPrice, getOrgSeats, assignSeat } from "@/lib/enterprise/billing/seats";
import { getOrgCreditSummary, allocateDeptCredits } from "@/lib/enterprise/billing/org-credits";
import { updateOrgPlan } from "@/lib/enterprise/orgs";
import { writeAuditEvent } from "@/lib/enterprise/audit";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/billing/enterprise?orgId=xxx — org billing summary
export const GET = safeHandler(async (req: NextRequest) => {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) throw ApiError.badRequest("orgId required");

  const [seats, credits] = await Promise.all([
    getOrgSeats(orgId),
    getOrgCreditSummary(orgId),
  ]);

  return NextResponse.json({ success: true, orgId, seats, credits });
});

// POST /api/billing/enterprise — seat/credit operations
export const POST = safeHandler(async (req: NextRequest) => {
  const body = await req.json() as {
    action:       string;
    orgId?:       string;
    seats?:       number;
    annual?:      boolean;
    userId?:      string;
    seatType?:    "full" | "viewer" | "api_only";
    workspaceId?: string;
    creditQuota?: number;
    requestedBy?: string;
  };

  switch (body.action) {
    case "calculate_price": {
      if (!body.seats) throw ApiError.badRequest("seats required");
      const pricing = calculateSeatPrice(body.seats);
      return NextResponse.json({ success: true, seats: body.seats, pricing });
    }

    case "assign_seat": {
      if (!body.orgId || !body.userId) throw ApiError.badRequest("orgId + userId required");
      await assignSeat({
        orgId:      body.orgId,
        userId:     body.userId,
        seatType:   body.seatType ?? "full",
        assignedAt: new Date().toISOString(),
        assignedBy: body.requestedBy ?? "api",
      });
      await writeAuditEvent({ action: "billing.seat_added", userId: body.requestedBy, orgId: body.orgId, metadata: { targetUserId: body.userId } });
      return NextResponse.json({ success: true, message: "Seat assigned" });
    }

    case "allocate_credits": {
      if (!body.workspaceId || !body.creditQuota) throw ApiError.badRequest("workspaceId + creditQuota required");
      await allocateDeptCredits(body.workspaceId, body.creditQuota, body.requestedBy ?? "api");
      return NextResponse.json({ success: true, message: `${body.creditQuota} credits allocated to workspace` });
    }

    case "upgrade_plan": {
      if (!body.orgId || !body.seats) throw ApiError.badRequest("orgId + seats required");
      const pricing = calculateSeatPrice(body.seats);
      await updateOrgPlan(body.orgId, pricing.tier.name.toLowerCase() as "enterprise", body.seats);
      await writeAuditEvent({ action: "billing.plan_changed", orgId: body.orgId, userId: body.requestedBy, metadata: { plan: pricing.tier.name, seats: body.seats } });
      return NextResponse.json({ success: true, plan: pricing.tier.name, seats: body.seats, pricing });
    }

    default:
      throw ApiError.badRequest(`Unknown action: ${body.action}`);
  }
});
