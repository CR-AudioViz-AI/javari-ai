// app/api/beta/waitlist/route.ts
// CR AudioViz AI — Beta Waitlist Signup Endpoint
// 2026-02-21 — STEP 8 Go-Live

import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/beta/invites";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";

export const runtime = "nodejs";

const handlePost = safeHandler(async (req: NextRequest) => {
  const body = await req.json() as { email?: string; name?: string; source?: string };

  if (!body.email?.includes("@")) throw ApiError.badRequest("Valid email required");

  const result = await addToWaitlist({
    email:  body.email.trim().toLowerCase(),
    name:   body.name?.trim(),
    source: body.source ?? "beta_page",
  });

  return NextResponse.json({
    success:       result.success,
    message:       result.message,
    alreadyExists: result.alreadyExists,
  }, { status: result.success ? 200 : 500 });
});

export const POST = handlePost;
