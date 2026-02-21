// app/api/billing/credits/route.ts
// Javari Billing — Credits API
// 2026-02-20 — STEP 5 implementation
//
// GET  /api/billing/credits?userId=...  → balance
// POST /api/billing/credits             → { action: "deduct"|"grant", amount, userId, ... }

import { NextRequest } from "next/server";
import { checkBalance, deductCredits, grantCredits } from "@/lib/javari/revenue/credits";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

// ── GET — balance ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId(req);
  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const bal = await checkBalance(userId);
  return Response.json({
    success:    true,
    userId,
    balance:    bal.balance,
    sufficient: bal.sufficient,
    floor:      bal.floor,
  });
}

// ── POST — deduct or grant ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId(req);
  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?:         "deduct" | "grant";
    amount?:         number;
    description?:    string;
    traceId?:        string;
    idempotencyKey?: string;
    type?:           "grant" | "purchase" | "promo" | "adjustment";
  };

  try { body = await req.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const { action = "deduct", amount, description = "API credit operation" } = body;

  if (!amount || amount <= 0) {
    return Response.json({ success: false, error: "amount must be > 0" }, { status: 400 });
  }

  if (action === "deduct") {
    const result = await deductCredits(userId, amount, description, {
      traceId:        body.traceId,
      idempotencyKey: body.idempotencyKey,
    });
    return Response.json({
      success:        result.success,
      newBalance:     result.newBalance,
      amountDeducted: result.amountDeducted,
      error:          result.error,
    }, { status: result.success ? 200 : 402 });
  }

  if (action === "grant") {
    const result = await grantCredits(userId, amount, body.type ?? "adjustment", description);
    return Response.json({ success: result.success, newBalance: result.newBalance });
  }

  return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
}
