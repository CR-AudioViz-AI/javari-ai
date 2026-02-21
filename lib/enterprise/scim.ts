// lib/enterprise/scim.ts
// CR AudioViz AI — SCIM 2.0 Provisioning Scaffold
// 2026-02-21 — STEP 10 Enterprise

// SCIM 2.0: System for Cross-domain Identity Management
// Allows enterprise IdPs (Okta, Azure AD) to auto-provision/deprovision users

export interface ScimUser {
  id?:       string;
  userName:  string;
  name: {
    givenName:  string;
    familyName: string;
  };
  emails: Array<{ value: string; primary: boolean }>;
  active:  boolean;
  groups?: Array<{ value: string; display: string }>;
}

export interface ScimGroup {
  id?:         string;
  displayName: string;
  members:     Array<{ value: string; display?: string }>;
}

export interface ScimResponse<T> {
  schemas:      string[];
  id?:          string;
  totalResults?: number;
  Resources?:   T[];
}

const SCIM_SCHEMA_USER  = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_SCHEMA_LIST  = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

// ── SCIM user provisioning ────────────────────────────────────────────────────

export async function scimProvisionUser(scimUser: ScimUser): Promise<{ id: string; created: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");

  const email = scimUser.emails.find((e) => e.primary)?.value ?? scimUser.userName;

  // Check if user exists first
  const checkRes = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { "apikey": key, "Authorization": `Bearer ${key}` },
  });
  const existing = await checkRes.json() as { users?: Array<{ id: string }> };
  if (existing.users?.[0]) {
    return { id: existing.users[0].id, created: false };
  }

  // Create new user
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: {
        name:          `${scimUser.name.givenName} ${scimUser.name.familyName}`,
        scim_provisioned: true,
        scim_groups:   scimUser.groups?.map((g) => g.display) ?? [],
      },
    }),
  });
  const created = await createRes.json() as { id: string };
  return { id: created.id, created: true };
}

export async function scimDeprovisionUser(userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  // Disable rather than delete — preserves audit trail
  await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ban_duration: "876000h" }), // effectively disabled
  });
}

export function buildScimListResponse<T>(resources: T[], totalResults: number): ScimResponse<T> {
  return {
    schemas:      [SCIM_SCHEMA_LIST],
    totalResults,
    Resources:    resources,
  };
}

export function buildScimUserResponse(userId: string, scimUser: ScimUser): object {
  return {
    schemas: [SCIM_SCHEMA_USER],
    id:      userId,
    ...scimUser,
  };
}
