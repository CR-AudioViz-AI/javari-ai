// lib/enterprise/orgs.ts
// CR AudioViz AI — Organization & Workspace Hierarchy
// 2026-02-21 — STEP 10 Enterprise

import { createLogger } from "@/lib/observability/logger";
import { track } from "@/lib/analytics/track";

const log = createLogger("api");

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrgRole   = "owner" | "admin" | "manager" | "member" | "viewer";
export type OrgPlan   = "starter" | "business" | "enterprise" | "custom";
export type OrgStatus = "active" | "suspended" | "trial";

export interface Organization {
  id:          string;
  name:        string;
  slug:        string;
  plan:        OrgPlan;
  status:      OrgStatus;
  ssoEnabled:  boolean;
  ssoProvider: string | null;
  maxSeats:    number;
  creditPool:  number;
  createdAt:   string;
}

export interface Workspace {
  id:          string;
  orgId:       string;
  name:        string;
  slug:        string;
  creditQuota: number;          // org-level allocation
  creditUsed:  number;
  teamType:    "marketing" | "engineering" | "ops" | "support" | "general";
  isDefault:   boolean;
  createdAt:   string;
}

export interface WorkspaceMember {
  id:          string;
  workspaceId: string;
  userId:      string;
  role:        OrgRole;
  joinedAt:    string;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbFetch(path: string, method = "GET", body?: unknown): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
      "Prefer":        method === "POST" ? "return=representation" : "return=minimal",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Organization CRUD ─────────────────────────────────────────────────────────

export async function createOrg(opts: {
  name:      string;
  slug:      string;
  plan?:     OrgPlan;
  maxSeats?: number;
  ownerId:   string;
}): Promise<Organization> {
  const org = await sbFetch("organizations", "POST", {
    name:        opts.name,
    slug:        opts.slug,
    plan:        opts.plan ?? "starter",
    status:      "trial",
    sso_enabled: false,
    max_seats:   opts.maxSeats ?? 5,
    credit_pool: 10000,
    owner_id:    opts.ownerId,
  }) as Organization;

  track({ event: "signup", userId: opts.ownerId, properties: { orgId: org.id, plan: org.plan } });
  log.info(`Org created: ${org.name}`, { meta: { orgId: org.id } });
  return org;
}

export async function getOrg(orgId: string): Promise<Organization | null> {
  try {
    const data = await sbFetch(`organizations?id=eq.${orgId}&limit=1`) as Organization[];
    return data[0] ?? null;
  } catch { return null; }
}

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  try {
    const data = await sbFetch(`organizations?slug=eq.${slug}&limit=1`) as Organization[];
    return data[0] ?? null;
  } catch { return null; }
}

export async function updateOrgPlan(orgId: string, plan: OrgPlan, maxSeats: number): Promise<void> {
  await sbFetch(`organizations?id=eq.${orgId}`, "PATCH", { plan, max_seats: maxSeats });
  log.info(`Org plan updated: ${orgId} → ${plan} (${maxSeats} seats)`);
}

// ── Workspace CRUD ────────────────────────────────────────────────────────────

export async function createWorkspace(opts: {
  orgId:       string;
  name:        string;
  slug:        string;
  teamType?:   Workspace["teamType"];
  creditQuota?: number;
  isDefault?:  boolean;
}): Promise<Workspace> {
  const ws = await sbFetch("workspaces", "POST", {
    org_id:       opts.orgId,
    name:         opts.name,
    slug:         opts.slug,
    team_type:    opts.teamType ?? "general",
    credit_quota: opts.creditQuota ?? 1000,
    credit_used:  0,
    is_default:   opts.isDefault ?? false,
  }) as Workspace;
  log.info(`Workspace created: ${ws.name}`, { meta: { wsId: ws.id, orgId: ws.orgId } });
  return ws;
}

export async function getWorkspacesByOrg(orgId: string): Promise<Workspace[]> {
  try {
    return await sbFetch(`workspaces?org_id=eq.${orgId}&order=created_at.asc`) as Workspace[];
  } catch { return []; }
}

// ── Member management ─────────────────────────────────────────────────────────

export async function addMember(opts: {
  workspaceId: string;
  userId:      string;
  role:        OrgRole;
}): Promise<WorkspaceMember> {
  return await sbFetch("workspace_members", "POST", {
    workspace_id: opts.workspaceId,
    user_id:      opts.userId,
    role:         opts.role,
  }) as WorkspaceMember;
}

export async function getMemberRole(
  workspaceId: string,
  userId:      string
): Promise<OrgRole | null> {
  try {
    const data = await sbFetch(
      `workspace_members?workspace_id=eq.${workspaceId}&user_id=eq.${userId}&limit=1`
    ) as WorkspaceMember[];
    return data[0]?.role ?? null;
  } catch { return null; }
}

export async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  try {
    const org = await getOrg(orgId);
    if (!org) return false;
    // Check via workspace membership in default workspace
    const workspaces = await getWorkspacesByOrg(orgId);
    const defaultWs  = workspaces.find((w) => w.isDefault) ?? workspaces[0];
    if (!defaultWs) return false;
    const role = await getMemberRole(defaultWs.id, userId);
    return role === "owner" || role === "admin";
  } catch { return false; }
}

// ── Usage pooling ─────────────────────────────────────────────────────────────

export async function getOrgCreditUsage(orgId: string): Promise<{
  total: number; used: number; remaining: number; workspaces: Array<{ name: string; used: number; quota: number }>
}> {
  try {
    const [org, workspaces] = await Promise.all([getOrg(orgId), getWorkspacesByOrg(orgId)]);
    const totalUsed = workspaces.reduce((s, w) => s + (w.creditUsed ?? 0), 0);
    return {
      total:      org?.creditPool ?? 0,
      used:       totalUsed,
      remaining:  (org?.creditPool ?? 0) - totalUsed,
      workspaces: workspaces.map((w) => ({ name: w.name, used: w.creditUsed, quota: w.creditQuota })),
    };
  } catch { return { total: 0, used: 0, remaining: 0, workspaces: [] }; }
}
