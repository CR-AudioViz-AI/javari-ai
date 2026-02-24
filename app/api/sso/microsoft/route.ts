// app/api/sso/microsoft/route.ts
// CR AudioViz AI — Microsoft Entra SSO Callback Route
// 2026-02-21 — STEP 10 Enterprise

import { NextRequest, NextResponse } from "next/server";
import { buildMicrosoftAuthUrl, exchangeMicrosoftCode, getMicrosoftUserInfo, provisionMicrosoftUser } from "@/lib/enterprise/sso/microsoft";
import { writeAuditEvent } from "@/lib/enterprise/audit";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = safeHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (!code && !error) {
    const stateToken = `ms_${Date.now().toString(36)}`;
    return NextResponse.redirect(buildMicrosoftAuthUrl(stateToken));
  }

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/login?error=microsoft_sso_denied`
    );
  }

  if (!code) throw ApiError.badRequest("Missing OAuth code");

  try {
    const { accessToken } = await exchangeMicrosoftCode(code);
    const userInfo        = await getMicrosoftUserInfo(accessToken);
    const { userId, isNew } = await provisionMicrosoftUser(userInfo);

    await writeAuditEvent({
      action:   "user.sso_login",
      userId,
      metadata: { provider: "microsoft", upn: userInfo.userPrincipalName, isNew },
      severity: "info",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      isNew ? `${appUrl}/account/onboarding?sso=microsoft` : `${appUrl}/dashboard?sso=microsoft`
    );
  } catch (e) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      `${appUrl}/auth/login?error=${encodeURIComponent(e instanceof Error ? e.message : "sso_error")}`
    );
  }
});
