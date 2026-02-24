// app/api/platform-secrets/route.ts
// CR AudioViz AI — Platform Secret Authority: Admin API
// 2026-02-21
//
// POST /api/platform-secrets   { action: "status" | "validate" | "warm" | "invalidate" }
// GET  /api/platform-secrets   → same as status
//
// Requires: x-admin-secret header = ADMIN_SETUP_SECRET
// NEVER returns plaintext secret values. Fingerprints + metadata only.

import { NextRequest, NextResponse } from "next/server";
import { getSecret, cacheInvalidate, cacheStats } from "@/lib/platform-secrets/getSecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SETUP_SECRET ?? "";
  return !!adminSecret && req.headers.get("x-admin-secret") === adminSecret;
}

// ── Supabase direct query ─────────────────────────────────────────────────────

function sbConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleStatus() {
  const { url, key } = sbConfig();
  const res = await fetch(
    `${url}/rest/v1/platform_secrets?select=name,category,rotation_version,fingerprint,last_validated,validation_status,access_count,updated_at,is_active&order=category.asc,name.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
  );

  // RLS blocks direct REST — use RPC count instead
  let total = 0; let active = 0; let cats: string[] = [];
  if (res.ok) {
    const rows = await res.json() as Array<Record<string, unknown>>;
    total  = rows.length;
    active = rows.filter((r) => r.is_active).length;
    cats   = [...new Set(rows.map((r) => r.category as string))];
    return NextResponse.json({
      ok: true, total, active, categories: cats,
      cache: cacheStats(),
      secrets: rows.map((r) => ({
        name:             r.name,
        category:         r.category,
        rotationVersion:  r.rotation_version,
        fingerprint:      r.fingerprint,
        lastValidated:    r.last_validated,
        validationStatus: r.validation_status,
        accessCount:      r.access_count,
        updatedAt:        r.updated_at,
        isActive:         r.is_active,
      })),
    });
  }

  // Fallback: count via management is not available here, return cache info
  return NextResponse.json({
    ok: true,
    note: "RLS active — use Supabase dashboard for full list",
    cache: cacheStats(),
  });
}

async function handleValidate(name: string) {
  const value = await getSecret(name, { skipCache: true });
  return NextResponse.json({
    ok:          true,
    name,
    hasValue:    value.length > 0,
    valueLength: value.length,
    source:      value.length > 0 ? "platform_secrets" : "not_found",
  });
}

async function handleWarm() {
  const { warmSecrets } = await import("@/lib/platform-secrets/getSecret");
  const NAMES = [
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY",
    "DEEPSEEK_API_KEY", "COHERE_API_KEY", "OPENROUTER_API_KEY", "FIREWORKS_API_KEY",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET",
    "GITHUB_TOKEN", "VERCEL_API_TOKEN", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
    "ELEVENLABS_API_KEY", "HEYGEN_API_KEY", "DEEPGRAM_API_KEY",
    "TAVILY_API_KEY", "JINA_API_KEY", "NEWSAPI_API_KEY",
    "CRON_SECRET", "INTERNAL_API_SECRET", "ADMIN_SETUP_SECRET",
    "CANONICAL_ADMIN_SECRET", "AUTONOMOUS_CORE_ADMIN_SECRET", "JWT_SECRET",
  ];
  const result = await warmSecrets(NAMES);
  return NextResponse.json({ ok: true, ...result, total: NAMES.length });
}

async function handleInvalidate(name?: string) {
  cacheInvalidate(name);
  return NextResponse.json({ ok: true, invalidated: name ?? "all" });
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const action = (body.action as string) ?? "status";

  if (action === "status")     return handleStatus();
  if (action === "validate")   return handleValidate(body.name as string ?? "");
  if (action === "warm")       return handleWarm();
  if (action === "invalidate") return handleInvalidate(body.name as string | undefined);

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return handleStatus();
}
