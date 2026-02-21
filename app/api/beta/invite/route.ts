// app/api/beta/invite/route.ts
// CR AudioViz AI — Beta Invite API
// 2026-02-21 — STEP 8 Go-Live

import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist, validateInviteCode, createInviteCode, redeemInviteCode } from "@/lib/beta/invites";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";

export const runtime = "nodejs";

// GET /api/beta/invite?code=CR-XXXX-YYYY — validate a code (public)
const handleGet = safeHandler(async (req: NextRequest) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) throw ApiError.badRequest("Missing ?code parameter");

  const result = await validateInviteCode(code.toUpperCase());
  return NextResponse.json({
    success: result.valid,
    valid:   result.valid,
    message: result.message,
  });
});

// POST /api/beta/invite — waitlist signup or invite redemption
const handlePost = safeHandler(async (req: NextRequest) => {
  const body = await req.json() as {
    action?:     string;
    email?:      string;
    name?:       string;
    inviteCode?: string;
    userId?:     string;
  };

  const action = body.action ?? "waitlist";

  // ── Waitlist signup ──────────────────────────────────────────────────────────
  if (action === "waitlist") {
    if (!body.email?.includes("@")) throw ApiError.badRequest("Valid email required");
    const result = await addToWaitlist({
      email:  body.email.trim().toLowerCase(),
      name:   body.name?.trim(),
      source: "api",
    });
    return NextResponse.json({
      success:       result.success,
      message:       result.message,
      alreadyExists: result.alreadyExists,
    }, { status: result.success ? 200 : 500 });
  }

  // ── Redeem invite code ──────────────────────────────────────────────────────
  if (action === "redeem") {
    if (!body.inviteCode) throw ApiError.badRequest("inviteCode required");
    if (!body.userId)     throw ApiError.badRequest("userId required");
    const result = await redeemInviteCode(body.inviteCode.toUpperCase(), body.userId);
    return NextResponse.json({ success: result.success, message: result.message },
                             { status: result.success ? 200 : 400 });
  }

  // ── Create invite code (admin) ───────────────────────────────────────────────
  if (action === "create") {
    const adminKey = req.headers.get("x-admin-key");
    if (adminKey !== process.env.ADMIN_API_KEY) throw ApiError.forbidden("Admin key required");
    const result = await createInviteCode({
      email:   body.email,
      usesMax: 1,
    });
    return NextResponse.json({ success: !result.error, code: result.code },
                             { status: result.error ? 500 : 201 });
  }

  throw ApiError.badRequest(`Unknown action: ${action}`);
});

export const GET  = handleGet;
export const POST = handlePost;
