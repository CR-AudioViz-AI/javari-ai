// lib/platform-secrets/env-shim.ts
// CR AudioViz AI — Platform Secret Authority: process.env Shim
// 2026-02-22
//
// Wraps process.env with a Proxy at Node.js startup.
// Any read of a non-bootstrap key transparently returns the cached
// vault value — meaning all 318+ existing files using process.env
// automatically get vault-sourced values with zero file changes.
//
// Bootstrap keys (required before vault is reachable) are always
// passed through directly to the real process.env without interception.
//
// Call installEnvShim() once from instrumentation.ts register().
// Call warmEnvShim() after the shim is installed to pre-populate cache.

import { getSecretSync, warmSecrets, cacheStats } from "./getSecret";

// ── Bootstrap keys — never intercepted ───────────────────────────────────────
// These must come from Vercel env vars to bootstrap the vault connection itself.

const BOOTSTRAP_PREFIXES = [
  "NEXT_PUBLIC_",
  "VERCEL_",
  "__NEXT_",
];

const BOOTSTRAP_EXACT = new Set([
  "NODE_ENV",
  "PORT",
  "PATH",
  "HOME",
  "USER",
  "PWD",
  "SHELL",
  "HOSTNAME",
  "DATABASE_URL",
  // Vault bootstrap — must be in Vercel env vars, not in the vault itself
  "NEXTAUTH_SECRET",
  "SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function isBootstrap(key: string): boolean {
  if (BOOTSTRAP_EXACT.has(key)) return true;
  return BOOTSTRAP_PREFIXES.some((p) => key.startsWith(p));
}

// ── Shim state ────────────────────────────────────────────────────────────────

let _shimInstalled = false;
let _originalEnv   = process.env;

// ── Install ───────────────────────────────────────────────────────────────────

export function installEnvShim(): void {
  if (_shimInstalled) return;
  if (typeof process === "undefined") return;

  _originalEnv = { ...process.env };

  const proxy = new Proxy(process.env, {
    get(target, prop: string) {
      // Non-string keys (Symbol, etc.) — pass through
      if (typeof prop !== "string") return Reflect.get(target, prop);

      // Bootstrap keys — always real env
      if (isBootstrap(prop)) return target[prop];

      // Try vault cache first (synchronous — populated by warmEnvShim)
      const cached = getSecretSync(prop);
      if (cached !== undefined) return cached;

      // Fall through to real process.env during warm-up / transition
      return target[prop];
    },

    set(target, prop: string, value: unknown) {
      return Reflect.set(target, prop, value);
    },

    has(target, prop: string) {
      return Reflect.has(target, prop);
    },

    ownKeys(target) {
      return Reflect.ownKeys(target);
    },

    getOwnPropertyDescriptor(target, prop: string) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  // Replace the global process.env reference
  Object.defineProperty(process, "env", {
    value:        proxy,
    writable:     false,
    configurable: true,
    enumerable:   true,
  });

  _shimInstalled = true;
  console.info("[secret-authority] env-shim installed");
}

// ── Warm ──────────────────────────────────────────────────────────────────────
// Pre-populates the in-process cache for the most critical secrets.
// After this runs, shim reads are cache hits — zero DB latency.

const CRITICAL_KEYS = [
  // AI routing
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY",
  "MISTRAL_API_KEY",   "DEEPSEEK_API_KEY", "OPENROUTER_API_KEY",
  "COHERE_API_KEY",    "XAI_API_KEY",
  // Payments
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "PAYPAL_CLIENT_ID",  "PAYPAL_CLIENT_SECRET",
  // Infrastructure
  "GITHUB_TOKEN", "VERCEL_API_TOKEN",
  "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
  // Auth + internal
  "JWT_SECRET", "CRON_SECRET", "INTERNAL_API_SECRET",
  "ADMIN_SETUP_SECRET", "CANONICAL_ADMIN_SECRET",
  "AUTONOMOUS_CORE_ADMIN_SECRET",
  // Media
  "ELEVENLABS_API_KEY", "DEEPGRAM_API_KEY", "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  // Analytics
  "RESEND_API_KEY",
];

export async function warmEnvShim(): Promise<{ ok: number; failed: number }> {
  if (!_shimInstalled) {
    console.warn("[secret-authority] warmEnvShim called before installEnvShim");
  }
  const result = await warmSecrets(CRITICAL_KEYS);
  const stats  = cacheStats();
  console.info(
    `[secret-authority] env-shim warm: ${result.ok}/${CRITICAL_KEYS.length} ok, ` +
    `${result.failed} fallback, cache.size=${stats.size}`
  );
  return result;
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function shimStatus(): {
  installed: boolean;
  cacheSize: number;
  cacheKeys: string[];
} {
  const stats = cacheStats();
  return {
    installed: _shimInstalled,
    cacheSize: stats.size,
    cacheKeys: stats.keys,
  };
}
