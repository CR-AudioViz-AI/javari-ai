// app/api/sso/google/route.ts
// CR AudioViz AI — Google SSO Callback Route
// 2026-02-21 — STEP 10 Enterprise

import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, exchangeGoogleCode, getGoogleUserInfo, provisionGoogleUser } from "@/lib/enterprise/sso/google";
import { writeAuditEvent } from "@/lib/enterprise/audit";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const GET = safeHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Step 1: Initiate — no code present, redirect to Google
  if (!code && !error) {
    const stateToken = `google_${Date.now().toString(36)}`;
    return NextResponse.redirect(buildGoogleAuthUrl(stateToken));
  }

  // Step 2: Error from Google
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/login?error=google_sso_denied`
    );
  }

  if (!code) throw ApiError.badRequest("Missing OAuth code");

  try {
    const { accessToken }  = await exchangeGoogleCode(code);
    const userInfo         = await getGoogleUserInfo(accessToken);

    if (!userInfo.email_verified) {
      throw ApiError.forbidden("Google account email not verified");
    }

    const { userId, isNew } = await provisionGoogleUser(userInfo);

    await writeAuditEvent({
      action:    "user.sso_login",
      userId,
      ipAddress: getIP(req),
      metadata:  { provider: "google", email: userInfo.email, hd: userInfo.hd, isNew },
      severity:  "info",
    });

    // Redirect to app — Supabase session handled by client
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const dest   = isNew ? `${appUrl}/account/onboarding?sso=google` : `${appUrl}/dashboard?sso=google`;
    return NextResponse.redirect(dest);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SSO error";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      `${appUrl}/auth/login?error=${encodeURIComponent(msg)}`
    );
  }
});
