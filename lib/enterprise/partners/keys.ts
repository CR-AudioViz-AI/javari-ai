// lib/enterprise/partners/keys.ts
// CR AudioViz AI — Partner API Keys
// 2026-02-21 — STEP 10 Enterprise

import { createLogger } from "@/lib/observability/logger";
import { writeAuditEvent } from "@/lib/enterprise/audit";

const log = createLogger("api");

export type PartnerScope = "modules:read" | "modules:write" | "ai:chat" | "billing:read" | "admin:read";

export interface PartnerKey {
  id:         string;
  partnerId:  string;
  keyHash:    string;        // SHA-256 of actual key, never stored plain
  keyPrefix:  string;        // First 8 chars for display (pk_live_XXXXXX)
  scopes:     PartnerScope[];
  rateLimit:  number;        // requests per minute
  expiresAt?: string;
  active:     boolean;
  createdAt:  string;
  lastUsedAt?: string;
}

// ── Key generation ────────────────────────────────────────────────────────────

function generateRawKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "pk_live_";
  for (let i = 0; i < 40; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

async function hashKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(rawKey);
  const hash    = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createPartnerKey(opts: {
  partnerId: string;
  scopes:    PartnerScope[];
  rateLimit?: number;
  expiresAt?: string;
  createdBy:  string;
}): Promise<{ key: PartnerKey; rawKey: string }> {
  const rawKey   = generateRawKey();
  const keyHash  = await hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 14);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const id = `pk_${Date.now().toString(36)}`;
  const partnerKey: Omit<PartnerKey, "lastUsedAt"> = {
    id,
    partnerId:  opts.partnerId,
    keyHash,
    keyPrefix,
    scopes:     opts.scopes,
    rateLimit:  opts.rateLimit ?? 60,
    expiresAt:  opts.expiresAt,
    active:     true,
    createdAt:  new Date().toISOString(),
  };

  if (url && sbKey) {
    await fetch(`${url}/rest/v1/partner_keys`, {
      method: "POST",
      headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ ...partnerKey, key_hash: keyHash, key_prefix: keyPrefix, partner_id: opts.partnerId, rate_limit: opts.rateLimit ?? 60, expires_at: opts.expiresAt ?? null, created_at: new Date().toISOString() }),
    });
  }

  await writeAuditEvent({ action: "security.api_key_created", userId: opts.createdBy, metadata: { partnerId: opts.partnerId, scopes: opts.scopes } });
  log.info(`Partner key created: ${keyPrefix}`, { meta: { partnerId: opts.partnerId } });

  return { key: partnerKey, rawKey };
}

export async function validatePartnerKey(rawKey: string): Promise<PartnerKey | null> {
  try {
    const keyHash = await hashKey(rawKey);
    const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !sbKey) return null;

    const res  = await fetch(`${url}/rest/v1/partner_keys?key_hash=eq.${keyHash}&active=eq.true&limit=1`, {
      headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}` },
    });
    const data = await res.json() as PartnerKey[];
    if (!data[0]) return null;

    // Check expiry
    if (data[0].expiresAt && new Date(data[0].expiresAt) < new Date()) return null;

    // Update last_used_at (fire-and-forget)
    void fetch(`${url}/rest/v1/partner_keys?id=eq.${data[0].id}`, {
      method: "PATCH",
      headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    });

    return data[0];
  } catch { return null; }
}

export async function revokePartnerKey(keyId: string, revokedBy: string): Promise<void> {
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && sbKey) {
    await fetch(`${url}/rest/v1/partner_keys?id=eq.${keyId}`, {
      method: "PATCH",
      headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ active: false }),
    });
  }
  await writeAuditEvent({ action: "admin.partner_key_revoked", userId: revokedBy, resourceId: keyId });
}
