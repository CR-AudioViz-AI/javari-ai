// lib/security/enterprise-guards.ts
// CR AudioViz AI — Enterprise Security Guards
// 2026-02-21 — STEP 10 Enterprise

import { NextRequest, NextResponse } from "next/server";
import { isOrgAdmin } from "@/lib/enterprise/orgs";
import { validatePartnerKey } from "@/lib/enterprise/partners/keys";
import { writeAuditEvent } from "@/lib/enterprise/audit";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("security");

// ── Org isolation enforcement ─────────────────────────────────────────────────

export async function enforceOrgAccess(
  req:      NextRequest,
  orgId:    string,
  userId:   string
): Promise<NextResponse | null> {
  const hasAccess = await isOrgAdmin(orgId, userId);
  if (!hasAccess) {
    log.warn(`Org access denied: user ${userId.slice(0, 8)} → org ${orgId.slice(0, 8)}`);
    await writeAuditEvent({ action: "security.rate_limit_hit", userId, orgId, severity: "warn" });
    return NextResponse.json({ error: "FORBIDDEN", code: "ORG_ACCESS_DENIED" }, { status: 403 });
  }
  return null;
}

// ── Partner API signature validation ─────────────────────────────────────────

export async function validatePartnerRequest(
  req: NextRequest
): Promise<{ valid: boolean; partnerId?: string; scopes?: string[]; response?: NextResponse }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer pk_live_")) {
    return {
      valid: false,
      response: NextResponse.json({ error: "UNAUTHORIZED", code: "INVALID_PARTNER_KEY" }, { status: 401 }),
    };
  }

  const rawKey    = authHeader.slice("Bearer ".length);
  const partnerKey = await validatePartnerKey(rawKey);

  if (!partnerKey) {
    return {
      valid: false,
      response: NextResponse.json({ error: "UNAUTHORIZED", code: "PARTNER_KEY_INVALID_OR_EXPIRED" }, { status: 401 }),
    };
  }

  return { valid: true, partnerId: partnerKey.partnerId, scopes: partnerKey.scopes };
}

// ── Enterprise rate limits ────────────────────────────────────────────────────

interface EnterpriseRLEntry { count: number; resetAt: number; }
const _entRL = new Map<string, EnterpriseRLEntry>();

export function checkEnterpriseRateLimit(
  orgId: string,
  endpoint: string,
  max = 300,
  windowMs = 60_000
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const key = `ent:${orgId}:${endpoint}`;
  const now = Date.now();
  let e     = _entRL.get(key);
  if (!e || now >= e.resetAt) { e = { count: 0, resetAt: now + windowMs }; _entRL.set(key, e); }
  e.count++;
  const allowed       = e.count <= max;
  const remaining     = Math.max(0, max - e.count);
  const retryAfterSec = Math.ceil((e.resetAt - now) / 1000);
  if (!allowed) log.warn(`Enterprise RL hit: org=${orgId.slice(0,8)} endpoint=${endpoint}`);
  return { allowed, remaining, retryAfterSec };
}

// ── SCIM provisioning validation ──────────────────────────────────────────────

export function validateScimToken(req: NextRequest): boolean {
  const token        = req.headers.get("authorization");
  const expectedToken = process.env.SCIM_BEARER_TOKEN;
  if (!expectedToken) return false;
  return token === `Bearer ${expectedToken}`;
}
