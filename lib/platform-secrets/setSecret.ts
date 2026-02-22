// lib/platform-secrets/setSecret.ts
// CR AudioViz AI — Platform Secret Authority: Write Path
// 2026-02-21
//
// SERVER-SIDE ONLY. Admin / migration use.
//
// Usage:
//   await setSecret("MY_KEY", "value", { category: "payments" });

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
  rotationVersion: number;
  wasUpdate:       boolean;
  error?:          string;
}

// ── Config ────────────────────────────────────────────────────────────────────

function sbConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("[secret-authority] Bootstrap Supabase vars missing");
  return { url, key };
}

// ── Existing version check ────────────────────────────────────────────────────

async function getExistingVersion(name: string, url: string, key: string): Promise<number | null> {
  const res = await fetch(
    `${url}/rest/v1/rpc/get_platform_secret`,
    {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:  JSON.stringify({ p_name: name }),
      cache: "no-store",
    }
  );
  if (res.status === 200) {
    const text = await res.text();
    return text && text !== "null" ? 1 : null; // simplified — version from audit
  }
  return null;
}

// ── Upsert via management SQL or REST ────────────────────────────────────────

async function upsertSecret(row: Record<string, unknown>, url: string, key: string): Promise<void> {
  const res = await fetch(`${url}/rest/v1/platform_secrets`, {
    method:  "POST",
    headers: {
      apikey:          key,
      Authorization:   `Bearer ${key}`,
      "Content-Type":  "application/json",
      Prefer:          "resolution=merge-duplicates,return=minimal",
    },
    body:  JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[secret-authority] Upsert HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function logAudit(
  name: string, action: string, actor: string,
  meta: Record<string, unknown>, url: string, key: string
): Promise<void> {
  await fetch(`${url}/rest/v1/platform_secret_audit`, {
    method:  "POST",
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer:         "return=minimal",
    },
    body:  JSON.stringify({ secret_name: name, action, actor, metadata: meta }),
    cache: "no-store",
  }).catch(() => {/* best-effort */});
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function setSecret(
  name:      string,
  plaintext: string,
  opts:      SetSecretOptions = {}
): Promise<SetSecretResult> {
  if (!name?.trim())      throw new Error("[secret-authority] name required");
  if (!plaintext?.trim()) throw new Error("[secret-authority] value required");

  const { url, key }    = sbConfig();
  const existingVersion = await getExistingVersion(name, url, key);
  const wasUpdate       = existingVersion !== null;
  const nextVersion     = wasUpdate ? existingVersion + 1 : 1;
  const encryptedValue  = encrypt(plaintext);
  const fp              = fingerprint(plaintext);

  const row = {
    name,
    encrypted_value:   encryptedValue,
    fingerprint:       fp,
    category:          opts.category  ?? "general",
    rotation_version:  nextVersion,
    updated_by:        opts.updatedBy ?? "system",
    notes:             opts.notes     ?? null,
    is_active:         true,
    validation_status: "unknown",
    last_validated:    null,
  };

  try {
    await upsertSecret(row, url, key);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[secret-authority] setSecret("${name}") failed: ${msg}`);
    return { ok: false, name, fingerprint: fp, rotationVersion: nextVersion, wasUpdate, error: msg };
  }

  cacheInvalidate(name);
  await logAudit(
    name,
    wasUpdate ? "rotate" : "write",
    opts.updatedBy ?? "system",
    { category: row.category, rotationVersion: nextVersion, fingerprint: fp, mask: maskSecret(plaintext) },
    url, key
  );

  return { ok: true, name, fingerprint: fp, rotationVersion: nextVersion, wasUpdate };
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
