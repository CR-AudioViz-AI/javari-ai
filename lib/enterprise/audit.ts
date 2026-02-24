// lib/enterprise/audit.ts
// CR AudioViz AI — Enterprise Audit & Compliance Layer
// 2026-02-21 — STEP 10 Enterprise

import { createLogger } from "@/lib/observability/logger";

const log = createLogger("security");

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditAction =
  // Auth
  | "user.login" | "user.logout" | "user.signup" | "user.sso_login" | "user.mfa_enabled"
  // Workspace
  | "workspace.created" | "workspace.deleted" | "workspace.member_added" | "workspace.member_removed"
  // Module
  | "module.generated" | "module.deleted" | "module.deployed"
  // Billing
  | "billing.plan_changed" | "billing.seat_added" | "billing.credit_granted" | "billing.invoice_paid"
  // Admin
  | "admin.kill_switch" | "admin.user_suspended" | "admin.org_created" | "admin.partner_key_revoked"
  // Security
  | "security.rate_limit_hit" | "security.abuse_blocked" | "security.api_key_created";

export interface AuditEvent {
  id:         string;
  orgId?:     string;
  userId?:    string;
  action:     AuditAction;
  resource?:  string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?:  Record<string, unknown>;
  severity:   "info" | "warn" | "critical";
  createdAt:  string;
}

// ── Write audit event ─────────────────────────────────────────────────────────

export async function writeAuditEvent(opts: {
  action:      AuditAction;
  userId?:     string;
  orgId?:      string;
  resource?:   string;
  resourceId?: string;
  ipAddress?:  string;
  userAgent?:  string;
  metadata?:   Record<string, unknown>;
  severity?:   AuditEvent["severity"];
}): Promise<void> {
  const id        = `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  const severity  = opts.severity ?? "info";

  // Log to structured logger (always)
  log[severity === "critical" ? "error" : severity === "warn" ? "warn" : "info"](
    `Audit: ${opts.action}`,
    { userId: opts.userId, meta: { orgId: opts.orgId, resource: opts.resource, id } }
  );

  // Persist to Supabase audit_log (fire-and-forget)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    void fetch(`${url}/rest/v1/audit_log`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({
        id,
        org_id:      opts.orgId ?? null,
        user_id:     opts.userId ?? null,
        action:      opts.action,
        resource:    opts.resource ?? null,
        resource_id: opts.resourceId ?? null,
        ip_address:  opts.ipAddress ?? null,
        user_agent:  opts.userAgent?.slice(0, 200) ?? null,
        metadata:    opts.metadata ?? null,
        severity,
        created_at:  createdAt,
      }),
    });
  } catch {
    // Audit logging must never crash callers
  }
}

// ── Admin viewer helper ───────────────────────────────────────────────────────

export async function getAuditLog(opts: {
  orgId?:   string;
  userId?:  string;
  action?:  AuditAction;
  limit?:   number;
  since?:   string;
}): Promise<AuditEvent[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return [];

    const params = new URLSearchParams();
    if (opts.orgId)  params.set("org_id",  `eq.${opts.orgId}`);
    if (opts.userId) params.set("user_id", `eq.${opts.userId}`);
    if (opts.action) params.set("action",  `eq.${opts.action}`);
    if (opts.since)  params.set("created_at", `gte.${opts.since}`);
    params.set("order", "created_at.desc");
    params.set("limit", String(opts.limit ?? 50));

    const res = await fetch(`${url}/rest/v1/audit_log?${params}`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
    });
    if (!res.ok) return [];
    return await res.json() as AuditEvent[];
  } catch { return []; }
}
