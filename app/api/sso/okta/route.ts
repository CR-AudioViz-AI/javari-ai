// app/api/sso/okta/route.ts
// CR AudioViz AI — Okta OIDC Callback Route
// 2026-02-21 — STEP 10 Enterprise

import { NextRequest, NextResponse } from "next/server";
import { buildOktaAuthUrl, exchangeOktaCode, getOktaUserInfo, getSAMLMetadata } from "@/lib/enterprise/sso/okta";
import { writeAuditEvent } from "@/lib/enterprise/audit";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SAML metadata endpoint (GET /api/sso/okta/metadata)
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export const GET = safeHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const meta  = searchParams.get("metadata");
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  // Serve SAML SP metadata XML
  if (meta === "1") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://craudiovizai.com";
    const xml    = getSAMLMetadata(appUrl);
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
  }

  if (!code && !error) {
    const stateToken = `okta_${Date.now().toString(36)}`;
    return NextResponse.redirect(buildOktaAuthUrl(stateToken));
  }

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/login?error=okta_sso_denied`
    );
  }

  if (!code) throw ApiError.badRequest("Missing OAuth code");

  if (!process.env.OKTA_DOMAIN) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/login?error=okta_not_configured`
    );
  }

  try {
    const { accessToken } = await exchangeOktaCode(code);
    const userInfo        = await getOktaUserInfo(accessToken);

    // Provision via Supabase
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let userId  = "provisioned";

    if (url && sbKey) {
      const res = await fetch(`${url}/auth/v1/admin/users`, {
        method:  "POST",
        headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: userInfo.email, email_confirm: true, user_metadata: { name: userInfo.name, sso_provider: "okta", okta_sub: userInfo.sub, okta_groups: userInfo.groups } }),
      });
      const data = await res.json() as { id?: string };
      if (data.id) userId = data.id;
    }

    await writeAuditEvent({
      action:   "user.sso_login",
      userId,
      metadata: { provider: "okta", email: userInfo.email, groups: userInfo.groups },
      severity: "info",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(`${appUrl}/dashboard?sso=okta`);
  } catch (e) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(
      `${appUrl}/auth/login?error=${encodeURIComponent(e instanceof Error ? e.message : "okta_error")}`
    );
  }
});
