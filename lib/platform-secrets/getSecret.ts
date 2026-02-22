// lib/platform-secrets/getSecret.ts
// CR AudioViz AI — Platform Secret Authority: Read Path
// 2026-02-21
//
// SERVER-SIDE ONLY. Never import from client components.
//
// Usage:
//   const key = await getSecret("STRIPE_SECRET_KEY");
//
// Lookup order:
//   1. In-process cache (TTL 5 min)
//   2. Supabase get_platform_secret() SECURITY DEFINER RPC
//   3. AES-256-GCM decrypt
//   4. process.env fallback (transition period — logs warning in prod)

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
  return { size: _cache.size, keys: [..._cache.keys()] };
}

// ── Supabase config ───────────────────────────────────────────────────────────

function sbConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url) throw new Error("[secret-authority] NEXT_PUBLIC_SUPABASE_URL not set");
  if (!key) throw new Error("[secret-authority] SUPABASE_SERVICE_ROLE_KEY not set");
  return { url, key };
}

// ── DB fetch via SECURITY DEFINER RPC (bypasses RLS safely) ──────────────────

async function fetchEncrypted(name: string): Promise<string | null> {
  const { url, key } = sbConfig();
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_platform_secret`, {
      method: "POST",
      headers: {
        apikey:          key,
        Authorization:   `Bearer ${key}`,
        "Content-Type":  "application/json",
      },
      body:  JSON.stringify({ p_name: name }),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`[secret-authority] RPC error for ${name}: HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    if (!text || text === "null") return null;
    // Response is JSON-quoted string: "base64..."
    return JSON.parse(text) as string;
  } catch (err) {
    console.error(`[secret-authority] Network error fetching ${name}:`, (err as Error).message);
    return null;
  }
}

// ── Async side effects (fire-and-forget) ──────────────────────────────────────

function asyncIncrement(name: string): void {
  const { url, key } = sbConfig();
  fetch(`${url}/rest/v1/rpc/increment_secret_access`, {
    method: "POST",
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body:  JSON.stringify({ p_name: name }),
    cache: "no-store",
  }).catch(() => {/* best-effort */});
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getSecret — retrieve decrypted secret by name.
 * Returns "" if not found. Never throws on missing secret.
 */
export async function getSecret(
  name:     string,
  opts?:    { skipCache?: boolean; actor?: string }
): Promise<string> {
  if (!name) return "";

  // 1. Cache
  if (!opts?.skipCache) {
    const cached = cacheGet(name);
    if (cached !== undefined) return cached;
  }

  // 2. DB → decrypt
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

  // 3. process.env fallback (transition)
  const envVal = process.env[name];
  if (envVal) {
    const isDev = process.env.NODE_ENV === "development";
    console[isDev ? "warn" : "warn"](
      `[secret-authority] FALLBACK env: "${name}" not in DB — ${maskSecret(envVal)}`
    );
    cacheSet(name, envVal);
    return envVal;
  }

  console.error(`[secret-authority] Secret not found: "${name}"`);
  return "";
}

/**
 * getSecretSync — returns cached value only. undefined if not warmed.
 * Use only after warmSecrets() has been called.
 */
export function getSecretSync(name: string): string | undefined {
  return cacheGet(name);
}

/**
 * warmSecrets — pre-load a list of secrets into cache.
 * Call at startup to eliminate cold-path latency.
 */
export async function warmSecrets(names: string[]): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(names.map((n) => getSecret(n)));
  const ok     = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { ok, failed };
}
