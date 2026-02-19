// app/api/javari/credentials/status/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// JAVARI OS — CREDENTIAL STATUS DIAGNOSTIC ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────
// Returns: provider name, status (ok|missing|invalid|expired)
// NEVER returns actual key values.
// Admin-protected: requires X-Admin-Key header or admin_setup_key vault credential.
// ─────────────────────────────────────────────────────────────────────────────
// Timestamp: 2026-02-18 16:45 EST

import { NextRequest, NextResponse } from "next/server";
import { vault } from "@/lib/javari/secrets/vault";
import { credentialSync } from "@/lib/javari/secrets/credential-sync";
import { listAgents } from "@/lib/javari/secrets/credential-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  // Allow in dev without auth
  if (process.env.NODE_ENV === "development") return true;

  const adminKey = vault.get("admin_setup_key");
  const cronSecret = vault.get("cron_secret");

  const headerKey =
    req.headers.get("x-admin-key") ??
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!headerKey) return false;

  // Match against known admin keys
  if (adminKey && headerKey === adminKey) return true;
  if (cronSecret && headerKey === cronSecret) return true;

  return false;
}

// ── GET: Quick status (no live validation) ────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statuses = vault.status();

  // Group by category
  const byCategory: Record<string, typeof statuses> = {};
  for (const s of statuses) {
    const entry = vault.registry().find((e) => e.provider === s.provider);
    const category = entry?.category ?? "unknown";
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(s);
  }

  const summary = {
    total: statuses.length,
    ok: statuses.filter((s) => s.status === "ok").length,
    missing: statuses.filter((s) => s.status === "missing").length,
    invalid: statuses.filter((s) => s.status === "invalid").length,
    requiredAll: statuses
      .filter((s) => vault.registry().find((e) => e.provider === s.provider)?.required)
      .every((s) => s.status === "ok"),
  };

  return NextResponse.json({
    generated: new Date().toISOString(),
    summary,
    byCategory,
    // Safe: no key values returned
    credentials: statuses.map((s) => ({
      provider: s.provider,
      envVar: s.envVar,
      status: s.status,
      present: s.present,
      required: vault.registry().find((e) => e.provider === s.provider)?.required ?? false,
      description: vault.registry().find((e) => e.provider === s.provider)?.description ?? "",
    })),
    agents: listAgents(),
    note: "Key values are NEVER included in this response.",
  });
}

// ── POST: Full sync with live provider validation ─────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { liveValidation?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body = defaults ok
  }

  const liveValidation = body.liveValidation !== false; // default: true

  try {
    const report = await credentialSync(liveValidation);

    return NextResponse.json({
      generated: new Date().toISOString(),
      syncReport: {
        timestamp: report.timestamp,
        durationMs: report.durationMs,
        totalProviders: report.totalProviders,
        ok: report.ok,
        missing: report.missing,
        invalid: report.invalid,
        allRequiredOk: report.allRequiredOk,
        // Results: no key values
        results: report.results.map((r) => ({
          provider: r.provider,
          envVar: r.envVar,
          status: r.status,
          category: r.category,
          required: r.required,
          note: r.note,
          testedAt: r.testedAt,
        })),
      },
      note: "Key values are NEVER included in this response.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
