// lib/enterprise/sso/microsoft.ts
// CR AudioViz AI — Microsoft Entra ID SSO (OAuth2 + OpenID)
// 2026-02-21 — STEP 10 Enterprise

export const MS_SSO_CONFIG = {
  tenantId:      process.env.MICROSOFT_TENANT_ID ?? "common",
  clientId:      process.env.MICROSOFT_CLIENT_ID ?? "",
  clientSecret:  process.env.MICROSOFT_CLIENT_SECRET ?? "",
  redirectUri:   `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/sso/microsoft`,
  scope:         "openid profile email User.Read",
};

export interface MicrosoftUserInfo {
  id:                string;
  displayName:       string;
  mail:              string;
  userPrincipalName: string;
  jobTitle?:         string;
  department?:       string;
}

export function buildMicrosoftAuthUrl(state: string): string {
  const tid    = MS_SSO_CONFIG.tenantId;
  const params = new URLSearchParams({
    client_id:     MS_SSO_CONFIG.clientId,
    redirect_uri:  MS_SSO_CONFIG.redirectUri,
    response_type: "code",
    scope:         MS_SSO_CONFIG.scope,
    state,
    response_mode: "query",
  });
  return `https://login.microsoftonline.com/${tid}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeMicrosoftCode(code: string): Promise<{ accessToken: string }> {
  const tid = MS_SSO_CONFIG.tenantId;
  const res = await fetch(`https://login.microsoftonline.com/${tid}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     MS_SSO_CONFIG.clientId,
      client_secret: MS_SSO_CONFIG.clientSecret,
      redirect_uri:  MS_SSO_CONFIG.redirectUri,
      grant_type:    "authorization_code",
      scope:         MS_SSO_CONFIG.scope,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return { accessToken: data.access_token };
}

export async function getMicrosoftUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Microsoft Graph failed: ${res.status}`);
  return res.json() as Promise<MicrosoftUserInfo>;
}

export async function provisionMicrosoftUser(userInfo: MicrosoftUserInfo): Promise<{ userId: string; isNew: boolean }> {
  const email = userInfo.mail ?? userInfo.userPrincipalName;
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: {
        name: userInfo.displayName, sso_provider: "microsoft",
        ms_id: userInfo.id, department: userInfo.department,
      },
    }),
  });
  const data = await res.json() as { id?: string; error?: string };
  if (data.error && !data.error.includes("already been registered")) {
    throw new Error(`Supabase user provisioning: ${data.error}`);
  }
  return { userId: data.id ?? "existing", isNew: res.status === 201 };
}
