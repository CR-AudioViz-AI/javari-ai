// lib/security/rate-limit.ts
// CR AudioViz AI — Rate Limiter
// 2026-02-20 — STEP 7 Production Hardening
//
// IP-based and user-based rate limiting with sliding window.
// Autonomous engine bypasses with INTERNAL_SERVICE_KEY.
// Returns 429 with Retry-After header.

import { NextRequest, NextResponse } from "next/server";
import { rateLimitLog } from "@/lib/observability/logger";

// ── Config ───────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs:   number;   // sliding window in ms
  maxRequests: number;  // max requests per window
  keyPrefix:  string;   // for namespacing
}

const PRESETS: Record<string, RateLimitConfig> = {
  // Public endpoints
  api_public:     { windowMs: 60_000, maxRequests: 60,  keyPrefix: "pub" },
  // Authenticated user endpoints
  api_user:       { windowMs: 60_000, maxRequests: 120, keyPrefix: "usr" },
  // AI-heavy endpoints (chat, autonomy, factory)
  api_ai:         { windowMs: 60_000, maxRequests: 30,  keyPrefix: "ai"  },
  // Billing endpoints
  api_billing:    { windowMs: 60_000, maxRequests: 20,  keyPrefix: "bil" },
  // Auth endpoints (strict)
  api_auth:       { windowMs: 60_000, maxRequests: 10,  keyPrefix: "ath" },
};

// ── Internal service key (autonomous engine bypass) ───────────────────────────

const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY ?? "javari_internal_bypass_key";

function isInternalRequest(req: NextRequest): boolean {
  const key = req.headers.get("x-internal-service-key");
  return key === INTERNAL_KEY;
}

// ── In-memory sliding window store ───────────────────────────────────────────
// Note: This resets on cold starts. For persistent rate limiting in production,
// replace with Vercel KV or Upstash Redis.

interface WindowEntry {
  count:    number;
  resetAt:  number;
}

const _store = new Map<string, WindowEntry>();

function getEntry(key: string, windowMs: number): WindowEntry {
  const now = Date.now();
  const existing = _store.get(key);
  if (existing && now < existing.resetAt) return existing;
  // New or expired window
  const entry: WindowEntry = { count: 0, resetAt: now + windowMs };
  _store.set(key, entry);
  return entry;
}

// Cleanup stale entries every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _store.entries()) {
    if (now >= v.resetAt) _store.delete(k);
  }
}, 300_000);

// ── Core check ────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:       boolean;
  remaining:     number;
  resetAt:       number;   // unix ms
  retryAfterSec: number;
}

export function checkRateLimit(
  identifier: string,      // IP or userId
  preset:     keyof typeof PRESETS | RateLimitConfig
): RateLimitResult {
  const cfg   = typeof preset === "string" ? PRESETS[preset] : preset;
  const key   = `${cfg.keyPrefix}:${identifier}`;
  const entry = getEntry(key, cfg.windowMs);

  entry.count++;

  const allowed       = entry.count <= cfg.maxRequests;
  const remaining     = Math.max(0, cfg.maxRequests - entry.count);
  const retryAfterSec = Math.ceil((entry.resetAt - Date.now()) / 1000);

  if (!allowed) {
    rateLimitLog.warn(`Rate limit hit`, {
      meta: { key, count: entry.count, max: cfg.maxRequests },
    });
  }

  return { allowed, remaining, resetAt: entry.resetAt, retryAfterSec };
}

// ── Middleware helper ─────────────────────────────────────────────────────────

export function getClientIdentifier(req: NextRequest): {
  ip:     string;
  userId: string | null;
} {
  const ip = (
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "unknown"
  ).trim();

  // Extract userId from auth header or cookie (best-effort)
  const authHeader = req.headers.get("authorization");
  const userId = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return { ip, userId };
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      success:     false,
      error:       "Too many requests",
      code:        "RATE_LIMITED",
      retryAfter:  result.retryAfterSec,
      resetAt:     new Date(result.resetAt).toISOString(),
    },
    {
      status: 429,
      headers: {
        "Retry-After":          String(result.retryAfterSec),
        "X-RateLimit-Limit":    String(0), // filled by caller
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset":    String(Math.floor(result.resetAt / 1000)),
      },
    }
  );
}

// ── Route-level guard (use in API handlers) ────────────────────────────────────

export function applyRateLimit(
  req:    NextRequest,
  preset: keyof typeof PRESETS | RateLimitConfig
): NextResponse | null {
  if (isInternalRequest(req)) return null; // bypass for internal callers

  const { ip, userId } = getClientIdentifier(req);
  const identifier     = userId ?? ip;
  const result         = checkRateLimit(identifier, preset);

  if (!result.allowed) return rateLimitResponse(result);
  return null;
}

export { PRESETS as RATE_LIMIT_PRESETS, isInternalRequest };
