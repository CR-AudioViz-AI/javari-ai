/**
 * Javari AI — Next.js Middleware
 * STEP 7: Rate limiting + Henderson Override Protocol + Kill Switch
 *
 * @version 3.0.0
 * @date 2026-02-20 — STEP 7 Production Hardening
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Supabase (Edge-compatible, no cookies) ────────────────────────────────────
const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "https://kteobfyferrukqeolofj.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ── Internal bypass key ───────────────────────────────────────────────────────
const INTERNAL_KEY    = process.env.INTERNAL_SERVICE_KEY ?? "javari_internal_bypass_key";

// ── Rate limit store (in-memory, resets on cold start) ───────────────────────
interface RLEntry { count: number; resetAt: number; }
const _rl = new Map<string, RLEntry>();

function rlCheck(key: string, max: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let e = _rl.get(key);
  if (!e || now >= e.resetAt) { e = { count: 0, resetAt: now + windowMs }; _rl.set(key, e); }
  e.count++;
  return { ok: e.count <= max, remaining: Math.max(0, max - e.count), resetAt: e.resetAt };
}

// ── Route config ──────────────────────────────────────────────────────────────

const ADMIN_ROUTES = [
  "/api/admin/kill-switch",
  "/api/admin/kill-command",
  "/api/admin/security",
];

const KILL_PROTECTED = [
  "/api/javari/chat",
  "/api/javari/auto-heal",
  "/api/javari/build",
  "/api/javari/projects",
  "/api/developer/commit",
  "/api/developer/deploy",
  "/api/developer/generate",
  "/api/auto-fix",
  "/api/suggestions",
  "/api/review",
];

// AI-heavy routes — 30 req/min
const AI_ROUTES = [
  "/api/chat",
  "/api/autonomy",
  "/api/factory",
  "/api/javari",
];

// Auth routes — 10 req/min
const AUTH_ROUTES = ["/api/auth", "/auth"];

// Billing routes — 20 req/min
const BILLING_ROUTES = ["/api/billing"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isInternal(req: NextRequest): boolean {
  return req.headers.get("x-internal-service-key") === INTERNAL_KEY;
}

function rl429(result: { remaining: number; resetAt: number }, max: number): NextResponse {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { success: false, error: "Too many requests", code: "RATE_LIMITED", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After":           String(retryAfter),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Limit":     String(max),
        "X-RateLimit-Reset":     String(Math.floor(result.resetAt / 1000)),
      },
    }
  );
}

// ── Kill switch check ─────────────────────────────────────────────────────────

async function isKillSwitchActive(): Promise<boolean> {
  try {
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await sb.from("javari_settings").select("kill_switch_active").single();
    return data?.kill_switch_active === true;
  } catch {
    return false; // fail open
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // 1. Always allow admin routes
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // 2. Internal service bypass (no rate limiting, no kill switch)
  if (isInternal(req)) {
    return NextResponse.next();
  }

  // 3. Kill switch check for protected routes
  const isKillRoute = KILL_PROTECTED.some((r) => pathname.startsWith(r));
  if (isKillRoute && await isKillSwitchActive()) {
    return NextResponse.json(
      { error: "SYSTEM_LOCKED", message: "Platform is currently in protected mode.", code: "HENDERSON_OVERRIDE_PROTOCOL" },
      { status: 503, headers: { "X-System-Status": "LOCKED", "Retry-After": "3600" } }
    );
  }

  // 4. Rate limiting
  const ip = getIP(req);

  // Auth: 10/min
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const r = rlCheck(`auth:${ip}`, 10, 60_000);
    if (!r.ok) return rl429(r, 10);
  }

  // Billing: 20/min
  if (BILLING_ROUTES.some((r) => pathname.startsWith(r))) {
    const r = rlCheck(`bil:${ip}`, 20, 60_000);
    if (!r.ok) return rl429(r, 20);
  }

  // AI: 30/min per IP
  if (AI_ROUTES.some((r) => pathname.startsWith(r))) {
    const r = rlCheck(`ai:${ip}`, 30, 60_000);
    if (!r.ok) return rl429(r, 30);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/auth/:path*",
  ],
};
