// lib/beta/invites.ts
// CR AudioViz AI — Beta Invite Code System
// 2026-02-21 — STEP 8 Go-Live

import { analyticsLog } from "@/lib/observability/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BetaPhase = "closed" | "invite_only" | "open_beta" | "general";

export interface InviteCode {
  id:          string;
  code:        string;
  email?:      string | null;
  usesMax:     number;
  usesCurrent: number;
  expiresAt?:  string | null;
  isActive:    boolean;
  createdAt:   string;
}

export interface WaitlistEntry {
  id:        string;
  email:     string;
  name?:     string | null;
  invited:   boolean;
  source:    string;
  createdAt: string;
}

// ── Supabase REST helper ──────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return { url, key };
}

async function sbFetch(
  path:    string,
  method:  string,
  body?:   unknown,
  urlParams?: Record<string, string>
): Promise<{ data: unknown; error: string | null }> {
  const { url, key } = getServiceClient();
  const qs = urlParams ? "?" + new URLSearchParams(urlParams).toString() : "";
  const res = await fetch(`${url}/rest/v1/${path}${qs}`, {
    method,
    headers: {
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
      "Prefer":        method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    return { data: null, error: `${res.status}: ${err}` };
  }
  const data = res.status !== 204 ? await res.json() : null;
  return { data, error: null };
}

// ── Code generation ───────────────────────────────────────────────────────────

export function generateInviteCode(prefix = "CR"): string {
  const chars  = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4)}`;
}

// ── Create invite code ────────────────────────────────────────────────────────

export async function createInviteCode(opts: {
  email?:     string;
  usesMax?:   number;
  expiresAt?: Date;
  createdBy?: string;
}): Promise<{ code: string; error: string | null }> {
  const code = generateInviteCode();

  const { data, error } = await sbFetch("invite_codes", "POST", {
    code,
    email:      opts.email      ?? null,
    uses_max:   opts.usesMax    ?? 1,
    expires_at: opts.expiresAt?.toISOString() ?? null,
    created_by: opts.createdBy  ?? null,
    is_active:  true,
  });

  if (error) {
    analyticsLog.error("createInviteCode failed", { meta: { error } });
    return { code: "", error };
  }

  analyticsLog.info("Invite code created", { meta: { code, email: opts.email } });
  return { code, error: null };
}

// ── Validate invite code (read-only) ─────────────────────────────────────────

export async function validateInviteCode(code: string): Promise<{
  valid:    boolean;
  message:  string;
  codeData: InviteCode | null;
}> {
  const { data, error } = await sbFetch(
    "invite_codes", "GET", undefined,
    { "code": `eq.${code}`, "is_active": "eq.true", "select": "*" }
  );

  if (error || !Array.isArray(data) || data.length === 0) {
    return { valid: false, message: "Invalid or inactive invite code", codeData: null };
  }

  const row = data[0] as Record<string, unknown>;

  if (row.expires_at && new Date(row.expires_at as string) < new Date()) {
    return { valid: false, message: "Invite code has expired", codeData: null };
  }
  if ((row.uses_current as number) >= (row.uses_max as number)) {
    return { valid: false, message: "Invite code has reached its usage limit", codeData: null };
  }

  return {
    valid: true,
    message: "Valid invite code",
    codeData: {
      id:          row.id          as string,
      code:        row.code        as string,
      email:       row.email       as string | null,
      usesMax:     row.uses_max    as number,
      usesCurrent: row.uses_current as number,
      expiresAt:   row.expires_at  as string | null,
      isActive:    row.is_active   as boolean,
      createdAt:   row.created_at  as string,
    },
  };
}

// ── Redeem invite code ────────────────────────────────────────────────────────

export async function redeemInviteCode(code: string, userId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const { data, error } = await sbFetch("rpc/redeem_invite_code", "POST", {
    p_code:    code,
    p_user_id: userId,
  });

  if (error) {
    analyticsLog.error("redeemInviteCode failed", { userId, meta: { code, error } });
    return { success: false, message: error };
  }

  const result = data as { success: boolean; message?: string; error?: string };
  analyticsLog.info("Invite redeemed", { userId, meta: { code, success: result.success } });
  return {
    success: result.success,
    message: result.message ?? result.error ?? "Unknown result",
  };
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

export async function addToWaitlist(opts: {
  email:   string;
  name?:   string;
  source?: string;
}): Promise<{ success: boolean; message: string; alreadyExists: boolean }> {
  // Check if already on waitlist
  const { data: existing } = await sbFetch(
    "waitlist", "GET", undefined,
    { "email": `eq.${opts.email}`, "select": "id,invited" }
  );

  if (Array.isArray(existing) && existing.length > 0) {
    const row = existing[0] as Record<string, unknown>;
    return {
      success:       true,
      alreadyExists: true,
      message:       row.invited
        ? "You already have access! Check your email for your invite link."
        : "You're already on the waitlist. We'll notify you when your spot is ready.",
    };
  }

  // Insert new entry
  const { error } = await sbFetch("waitlist", "POST", {
    email:  opts.email,
    name:   opts.name   ?? null,
    source: opts.source ?? "beta_page",
  });

  if (error) {
    analyticsLog.error("addToWaitlist failed", { meta: { email: opts.email, error } });
    return { success: false, message: "Failed to join waitlist. Please try again.", alreadyExists: false };
  }

  analyticsLog.info("Waitlist signup", { meta: { email: opts.email, source: opts.source } });
  return { success: true, message: "You're on the list!", alreadyExists: false };
}

// ── Beta phase check ──────────────────────────────────────────────────────────

let _cachedPhase: BetaPhase | null = null;
let _cacheExpiry = 0;

export async function getBetaPhase(): Promise<BetaPhase> {
  if (_cachedPhase && Date.now() < _cacheExpiry) return _cachedPhase;

  try {
    const { data, error } = await sbFetch(
      "beta_config", "GET", undefined, { "select": "phase", "limit": "1" }
    );
    if (!error && Array.isArray(data) && data.length > 0) {
      _cachedPhase = (data[0] as Record<string, unknown>).phase as BetaPhase;
      _cacheExpiry = Date.now() + 60_000; // 1-minute cache
      return _cachedPhase;
    }
  } catch { /* fallback */ }

  return "open_beta"; // safe default
}

export async function isAccessAllowed(opts: {
  inviteCode?: string;
  email?:      string;
}): Promise<{ allowed: boolean; reason: string }> {
  const phase = await getBetaPhase();

  if (phase === "general")   return { allowed: true,  reason: "General availability" };
  if (phase === "open_beta") return { allowed: true,  reason: "Open beta — all welcome" };
  if (phase === "closed")    return { allowed: false, reason: "Beta is currently closed" };

  // invite_only
  if (!opts.inviteCode) {
    return { allowed: false, reason: "An invite code is required during this phase" };
  }
  const { valid, message } = await validateInviteCode(opts.inviteCode);
  return { allowed: valid, reason: message };
}
