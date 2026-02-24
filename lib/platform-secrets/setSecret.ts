// lib/platform-secrets/setSecret.ts
// CR AudioViz AI — Platform Secret Authority: Write Path
// 2026-02-22
//
// SERVER-SIDE ONLY. Admin / migration use.
//
// Calls set_platform_secret(p_name, p_encrypted_value, p_fingerprint,
//   p_category, p_updated_by, p_notes) SECURITY DEFINER RPC.
// The DB function handles upsert + rotation_version increment + audit log.
// Returns HTTP 204 (void) on success.

import { encrypt, fingerprint, maskSecret } from "./crypto";
import { cacheInvalidate }                  from "./getSecret";

export type SecretCategory =
  | "ai" | "payments" | "infrastructure" | "media"
  | "data" | "social" | "analytics" | "general";

export interface SetSecretOptions {
  category?:  SecretCategory;
  updatedBy?: string;
  notes?:     string;
}

export interface SetSecretResult {
  ok:              boolean;
  name:            string;
  fingerprint:     string;
  wasUpdate:       boolean;
  error?:          string;
}

// ── Bootstrap Supabase config ─────────────────────────────────────────────────

function sbConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("[secret-authority] Bootstrap Supabase vars missing");
  return { url, key };
}

// ── Check if key already exists (to determine wasUpdate) ─────────────────────

async function exists(name: string, url: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_platform_secret`, {
      method:  "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
      },
      body:  JSON.stringify({ name }),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.trim() !== "null" && text.trim() !== "";
  } catch {
    return false;
  }
}

// ── Upsert via set_platform_secret SECURITY DEFINER RPC ──────────────────────
// All params use p_ prefix matching the DB function signature exactly.

async function callSetRpc(
  p_name:            string,
  p_encrypted_value: string,
  p_fingerprint:     string,
  p_category:        string,
  p_updated_by:      string,
  p_notes:           string | null,
  url:               string,
  key:               string
): Promise<void> {
  const body: Record<string, unknown> = {
    p_name,
    p_encrypted_value,
    p_fingerprint,
    p_category,
    p_updated_by,
  };
  if (p_notes !== null) body.p_notes = p_notes;

  const res = await fetch(`${url}/rest/v1/rpc/set_platform_secret`, {
    method:  "POST",
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body:  JSON.stringify(body),
    cache: "no-store",
  });

  // 204 = void function success (PostgREST standard for RETURNS void)
  if (res.status !== 204 && res.status !== 200) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[secret-authority] set_platform_secret HTTP ${res.status}: ${text.slice(0, 300)}`
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function setSecret(
  name:      string,
  plaintext: string,
  opts:      SetSecretOptions = {}
): Promise<SetSecretResult> {
  if (!name?.trim())      throw new Error("[secret-authority] name required");
  if (!plaintext?.trim()) throw new Error("[secret-authority] value required");

  const { url, key }   = sbConfig();
  const wasUpdate      = await exists(name, url, key);
  const encryptedValue = encrypt(plaintext);
  const fp             = fingerprint(plaintext);
  const category       = opts.category  ?? "general";
  const updatedBy      = opts.updatedBy ?? "system";
  const notes          = opts.notes     ?? null;

  try {
    await callSetRpc(name, encryptedValue, fp, category, updatedBy, notes, url, key);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[secret-authority] setSecret("${name}") failed: ${msg}`);
    console.error(`[secret-authority] Value preview: ${maskSecret(plaintext)}`);
    return { ok: false, name, fingerprint: fp, wasUpdate, error: msg };
  }

  cacheInvalidate(name);
  return { ok: true, name, fingerprint: fp, wasUpdate };
}

export async function setSecrets(
  secrets:   Array<{ name: string; value: string; category?: SecretCategory; notes?: string }>,
  updatedBy = "migration"
): Promise<SetSecretResult[]> {
  const results: SetSecretResult[] = [];
  for (const s of secrets) {
    results.push(await setSecret(s.name, s.value, {
      category: s.category, updatedBy, notes: s.notes,
    }));
    await new Promise((r) => setTimeout(r, 50));
  }
  return results;
}
