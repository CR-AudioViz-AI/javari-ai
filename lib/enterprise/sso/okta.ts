// lib/enterprise/sso/okta.ts
// CR AudioViz AI — Okta SAML Stub (Phase 1)
// 2026-02-21 — STEP 10 Enterprise

// Phase 1: SAML metadata + basic OAuth2 OIDC
// Phase 2: Full SAML assertion parsing (requires xml2js / samlify)

export const OKTA_CONFIG = {
  domain:       process.env.OKTA_DOMAIN ?? "",          // e.g. company.okta.com
  clientId:     process.env.OKTA_CLIENT_ID ?? "",
  clientSecret: process.env.OKTA_CLIENT_SECRET ?? "",
  redirectUri:  `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/sso/okta`,
};

export function buildOktaAuthUrl(state: string): string {
  if (!OKTA_CONFIG.domain) return "/auth/login?error=okta_not_configured";
  const params = new URLSearchParams({
    client_id:     OKTA_CONFIG.clientId,
    redirect_uri:  OKTA_CONFIG.redirectUri,
    response_type: "code",
    scope:         "openid email profile",
    state,
  });
  return `https://${OKTA_CONFIG.domain}/oauth2/v1/authorize?${params}`;
}

export async function exchangeOktaCode(code: string): Promise<{ accessToken: string }> {
  const res = await fetch(`https://${OKTA_CONFIG.domain}/oauth2/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     OKTA_CONFIG.clientId,
      client_secret: OKTA_CONFIG.clientSecret,
      redirect_uri:  OKTA_CONFIG.redirectUri,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Okta token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return { accessToken: data.access_token };
}

export async function getOktaUserInfo(accessToken: string): Promise<{
  sub: string; email: string; name: string; groups?: string[]
}> {
  const res = await fetch(`https://${OKTA_CONFIG.domain}/oauth2/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Okta userinfo failed: ${res.status}`);
  return res.json();
}

// SAML metadata endpoint (Phase 1 — returns SP metadata for Okta to consume)
export function getSAMLMetadata(baseUrl: string): string {
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${baseUrl}/api/sso/okta/metadata">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="${baseUrl}/api/sso/okta"
                              index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}
