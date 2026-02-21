/**
 * Javari AI — Next.js Middleware
 * STEP 9: Maintenance mode + LAUNCH_MODE + rate limiting + kill switch
 *
 * @version 4.0.0
 * @date 2026-02-21 — STEP 9 Official Launch
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Env ───────────────────────────────────────────────────────────────────────
const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "https://kteobfyferrukqeolofj.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const INTERNAL_KEY    = process.env.INTERNAL_SERVICE_KEY ?? "javari_internal_bypass_key";

// ── Launch flags (edge-compatible in-process defaults) ────────────────────────
// These reflect STEP 9 production state.
// Real-time overrides can be pushed via Supabase javari_settings table.
let _maintenanceMode = false;
let _degradedMode    = false;
let _launchMode      = true;  // LAUNCH_MODE = true (STEP 9)

// ── Rate limit store ──────────────────────────────────────────────────────────
interface RLEntry { count: number; resetAt: number; }
const _rl = new Map<string, RLEntry>();

function rlCheck(key: string, max: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let e = _rl.get(key);
  if (!e || now >= e.resetAt) { e = { count: 0, resetAt: now + windowMs }; _rl.set(key, e); }
  e.count++;
  return { ok: e.count <= max, remaining: Math.max(0, max - e.count), resetAt: e.resetAt };
}

// ── Route categories ──────────────────────────────────────────────────────────

const ADMIN_ROUTES = [
  "/api/admin/kill-switch",
  "/api/admin/kill-command",
  "/api/admin/security",
];

const HEALTH_ROUTES = [
  "/api/health",
  "/api/beta/checklist",
  "/health",
  "/live",
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

const AI_ROUTES     = ["/api/chat", "/api/autonomy", "/api/factory", "/api/javari"];
const AUTH_ROUTES   = ["/api/auth", "/auth"];
const BILLING_ROUTES = ["/api/billing"];

// ── Abuse patterns (edge-side filter) ────────────────────────────────────────

const ABUSE_UA_PATTERNS = [
  "python-requests",
  "masscan",
  "nikto",
  "sqlmap",
  "dirbuster",
  "nmap",
];

function isAbusiveRequest(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") ?? "";
  return ABUSE_UA_PATTERNS.some((p) => ua.toLowerCase().includes(p));
}

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
      },
    }
  );
}

// ── Kill switch check ─────────────────────────────────────────────────────────

async function isKillSwitchActive(): Promise<boolean> {
  try {
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await sb.from("javari_settings").select("kill_switch_active").single();
    if (data?.kill_switch_active === true) return true;
    // Also sync maintenance mode from DB
    _maintenanceMode = data?.maintenance_mode === true;
    _degradedMode    = data?.degraded_mode    === true;
    return false;
  } catch {
    return false;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // 1. Always allow admin + health routes
  if (
    ADMIN_ROUTES.some((r) => pathname.startsWith(r)) ||
    HEALTH_ROUTES.some((r) => pathname.startsWith(r))
  ) {
    return NextResponse.next();
  }

  // 2. Internal service bypass — no limits, no maintenance check
  if (isInternal(req)) {
    return NextResponse.next();
  }

  // 3. Abuse prevention (edge-side, no DB needed)
  if (isAbusiveRequest(req)) {
    return NextResponse.json(
      { error: "FORBIDDEN", code: "ABUSE_DETECTED" },
      { status: 403 }
    );
  }

  // 4. Maintenance mode — block all non-health routes
  if (_maintenanceMode) {
    return NextResponse.json(
      {
        error:   "MAINTENANCE",
        message: "CRAudioVizAI is currently undergoing scheduled maintenance. Please try again shortly.",
        code:    "MAINTENANCE_MODE",
      },
      {
        status:  503,
        headers: {
          "X-System-Status": "MAINTENANCE",
          "Retry-After":     "900",
          "Cache-Control":   "no-store",
        },
      }
    );
  }

  // 5. Kill switch check for AI-heavy protected routes
  const isKillRoute = KILL_PROTECTED.some((r) => pathname.startsWith(r));
  if (isKillRoute && await isKillSwitchActive()) {
    return NextResponse.json(
      { error: "SYSTEM_LOCKED", message: "Platform is currently in protected mode.", code: "HENDERSON_OVERRIDE_PROTOCOL" },
      { status: 503, headers: { "X-System-Status": "LOCKED", "Retry-After": "3600" } }
    );
  }

  // 6. Degraded mode — inject header for downstream handlers
  const response = NextResponse.next();
  if (_degradedMode) {
    response.headers.set("X-Javari-Degraded", "1");
  }
  if (_launchMode) {
    response.headers.set("X-Launch-Mode", "1");
  }

  // 7. Rate limiting
  const ip = getIP(req);

  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const r = rlCheck(`auth:${ip}`, 10, 60_000);
    if (!r.ok) return rl429(r, 10);
  }

  if (BILLING_ROUTES.some((r) => pathname.startsWith(r))) {
    const r = rlCheck(`bil:${ip}`, 20, 60_000);
    if (!r.ok) return rl429(r, 20);
  }

  if (AI_ROUTES.some((r) => pathname.startsWith(r))) {
    const r = rlCheck(`ai:${ip}`, 30, 60_000);
    if (!r.ok) return rl429(r, 30);
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/auth/:path*",
  ],
};
