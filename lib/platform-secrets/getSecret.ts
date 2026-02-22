// lib/platform-secrets/getSecret.ts
// CR AudioViz AI — Platform Secret Authority: Read Path
// 2026-02-22
//
// SERVER-SIDE ONLY. Never import from client components.
//
// Lookup order:
//   1. In-process cache (TTL 5 min)
//   2. Supabase get_platform_secret(name) SECURITY DEFINER RPC → AES-256-GCM decrypt
//   3. process.env fallback (transition period only — logs warning)

import { decrypt, maskSecret } from "./crypto";

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const _cache       = new Map<string, { value: string; expiresAt: number }>();

function cacheGet(name: string): string | undefined {
  const e = _cache.get(name);
  if (!e || Date.now() > e.expiresAt) { _cache.delete(name); return undefined; }
  return e.value;
}

function cacheSet(name: string, value: string): void {
  _cache.set(name, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function cacheInvalidate(name?: string): void {
  name ? _cache.delete(name) : _cache.clear();
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: _cache.size, keys: Array.from(_cache.keys()) };
}

// ── Supabase bootstrap config (always from process.env) ───────────────────────

function sbConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url) throw new Error("[secret-authority] NEXT_PUBLIC_SUPABASE_URL not set");
  if (!key) throw new Error("[secret-authority] SUPABASE_SERVICE_ROLE_KEY not set");
  return { url, key };
}

// ── DB fetch via SECURITY DEFINER RPC ────────────────────────────────────────
// get_platform_secret(name text) — param is "name" not "p_name"

async function fetchEncrypted(secretName: string): Promise<string | null> {
  const { url, key } = sbConfig();
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_platform_secret`, {
      method:  "POST",
      headers: {
        apikey:         key,
        Authorization:  `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body:  JSON.stringify({ name: secretName }),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`[secret-authority] RPC HTTP ${res.status} for "${secretName}"`);
      return null;
    }
    const text = await res.text();
    if (!text || text === "null") return null;
    return JSON.parse(text) as string;
  } catch (err) {
    console.error(
      `[secret-authority] Network error fetching "${secretName}":`,
      (err as Error).message
    );
    return null;
  }
}

// increment_secret_access(p_name text) — this function retains p_name param
function asyncIncrement(secretName: string): void {
  const { url, key } = sbConfig();
  fetch(`${url}/rest/v1/rpc/increment_secret_access`, {
    method:  "POST",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
    },
    body:  JSON.stringify({ p_name: secretName }),
    cache: "no-store",
  }).catch(() => {/* best-effort */});
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getSecret(
  name:  string,
  opts?: { skipCache?: boolean; actor?: string }
): Promise<string> {
  if (!name) return "";

  if (!opts?.skipCache) {
    const cached = cacheGet(name);
    if (cached !== undefined) return cached;
  }

  try {
    const encrypted = await fetchEncrypted(name);
    if (encrypted) {
      const plaintext = decrypt(encrypted);
      cacheSet(name, plaintext);
      asyncIncrement(name);
      return plaintext;
    }
  } catch (err) {
    console.error(`[secret-authority] getSecret("${name}") error:`, (err as Error).message);
  }

  const envVal = process.env[name];
  if (envVal) {
    console.warn(`[secret-authority] FALLBACK env: "${name}" not in vault — ${maskSecret(envVal)}`);
    cacheSet(name, envVal);
    return envVal;
  }

  console.error(`[secret-authority] Secret not found: "${name}"`);
  return "";
}

export function getSecretSync(name: string): string | undefined {
  return cacheGet(name);
}

export async function warmSecrets(
  names: string[]
): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(names.map((n) => getSecret(n)));
  return {
    ok:     results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
