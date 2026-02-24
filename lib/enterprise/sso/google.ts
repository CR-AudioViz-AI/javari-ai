// lib/enterprise/sso/google.ts
// CR AudioViz AI — Google Workspace SSO (OAuth2)
// 2026-02-21 — STEP 10 Enterprise

export const GOOGLE_SSO_CONFIG = {
  authUrl:       "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl:      "https://oauth2.googleapis.com/token",
  userInfoUrl:   "https://openidconnect.googleapis.com/v1/userinfo",
  scope:         "openid email profile",
  clientId:      process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret:  process.env.GOOGLE_CLIENT_SECRET ?? "",
  redirectUri:   `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/sso/google`,
};

export interface GoogleUserInfo {
  sub:            string;
  email:          string;
  email_verified: boolean;
  name:           string;
  picture?:       string;
  hd?:            string;   // hosted domain (Google Workspace)
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     GOOGLE_SSO_CONFIG.clientId,
    redirect_uri:  GOOGLE_SSO_CONFIG.redirectUri,
    response_type: "code",
    scope:         GOOGLE_SSO_CONFIG.scope,
    state,
    access_type:   "offline",
    prompt:        "select_account",
  });
  return `${GOOGLE_SSO_CONFIG.authUrl}?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ accessToken: string; idToken: string }> {
  const res = await fetch(GOOGLE_SSO_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_SSO_CONFIG.clientId,
      client_secret: GOOGLE_SSO_CONFIG.clientSecret,
      redirect_uri:  GOOGLE_SSO_CONFIG.redirectUri,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; id_token: string };
  return { accessToken: data.access_token, idToken: data.id_token };
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_SSO_CONFIG.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`);
  return res.json() as Promise<GoogleUserInfo>;
}

export async function provisionGoogleUser(userInfo: GoogleUserInfo): Promise<{ userId: string; isNew: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");

  // Upsert via Supabase Admin API
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email:          userInfo.email,
      email_confirm:  true,
      user_metadata:  { name: userInfo.name, avatar: userInfo.picture, sso_provider: "google", google_sub: userInfo.sub },
    }),
  });
  const data = await res.json() as { id?: string; error?: string };
  if (data.error && !data.error.includes("already been registered")) {
    throw new Error(`Supabase user provisioning: ${data.error}`);
  }
  return { userId: data.id ?? "existing", isNew: res.status === 201 };
}
