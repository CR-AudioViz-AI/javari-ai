// app/api/canonical/ingest/route.ts
// CR AudioViz AI — Canonical Ingest API Endpoint
// 2026-02-22 — Canonical Document Ingestion System
// Redeployed: 2026-02-22T00:17:58Z — canonical ingest deploy trigger
//
// POST /api/canonical/ingest
// Protected by CANONICAL_ADMIN_SECRET header.
// Body: { force?: boolean, dryRun?: boolean, maxTokens?: number }
//
// SAFE: read-only from R2, additive writes to Supabase only.
// Does NOT modify: chat routes, autonomy-core, unified engine, enterprise layer.

import { NextRequest, NextResponse }      from "next/server";
import { safeHandler }                    from "@/lib/errors/handler";
import { ApiError }                       from "@/lib/errors/api-error";
import { ingestAllCanonicalDocs }         from "@/lib/canonical/ingest";
import { getStoreStats }                  from "@/lib/canonical/store";
import { checkR2Connectivity }            from "@/lib/canonical/r2-client";
import { createLogger }                   from "@/lib/observability/logger";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 300;  // 5 min — large doc sets can take time

const log = createLogger("api:canonical:ingest");

// ── Feature flag ──────────────────────────────────────────────────────────────
// Set CANONICAL_INGEST_ENABLED=false to disable without code change.
// Default: true (must be explicitly disabled).

function isEnabled(): boolean {
  return process.env.CANONICAL_INGEST_ENABLED !== "false";
}

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CANONICAL_ADMIN_SECRET;
  if (!secret) {
    log.warn("CANONICAL_ADMIN_SECRET not set — all requests rejected");
    return false;
  }
  return (
    req.headers.get("x-canonical-secret") === secret ||
    req.headers.get("authorization")       === `Bearer ${secret}`
  );
}

// ── GET — status / health ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const enabled = isEnabled();
  let r2Status  = { ok: false, message: "not checked" };
  let storeStats = { totalDocs: 0, totalChunks: 0 };

  try {
    [r2Status, storeStats] = await Promise.all([
      checkR2Connectivity(),
      getStoreStats(),
    ]);
  } catch (_) { /* best-effort */ }

  return NextResponse.json({
    status:   "canonical-ingest",
    enabled,
    r2:       r2Status,
    store:    storeStats,
    config: {
      CANONICAL_INGEST_ENABLED: process.env.CANONICAL_INGEST_ENABLED ?? "true",
      R2_BUCKET:                process.env.R2_BUCKET                ?? "(not set)",
      R2_CANONICAL_PREFIX:      process.env.R2_CANONICAL_PREFIX      ?? "roadmap/",
      CANONICAL_ADMIN_SECRET:   process.env.CANONICAL_ADMIN_SECRET   ? "set" : "MISSING",
      OPENAI_API_KEY:           process.env.OPENAI_API_KEY           ? "set" : "MISSING",
      SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY? "set" : "MISSING",
    },
  });
}

// ── POST — trigger ingest ─────────────────────────────────────────────────────

export const POST = safeHandler(async (req: NextRequest) => {
  // Feature flag check
  if (!isEnabled()) {
    return NextResponse.json(
      { success: false, error: "Canonical ingest is disabled (CANONICAL_INGEST_ENABLED=false)" },
      { status: 503 }
    );
  }

  // Auth
  if (!isAuthorized(req)) {
    throw ApiError.unauthorized("Canonical ingest: admin secret required (x-canonical-secret header)");
  }

  // Parse body
  let body: { force?: boolean; dryRun?: boolean; maxTokens?: number } = {};
  try {
    body = await req.json();
  } catch (_) { /* empty body OK */ }

  const force     = body.force     === true;
  const dryRun    = body.dryRun    === true;
  const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : 800;

  log.info("Canonical ingest triggered", { meta: { force, dryRun, maxTokens } });

  const startMs = Date.now();

  // Run ingest — throws if R2 unreachable (caught by safeHandler → 500)
  const summary = await ingestAllCanonicalDocs({ force, dryRun, maxTokens });

  return NextResponse.json({
    success:        true,
    docsProcessed:  summary.docsProcessed,
    docsUpdated:    summary.docsUpdated,
    docsUnchanged:  summary.docsUnchanged,
    docsFailed:     summary.docsFailed,
    chunksCreated:  summary.chunksCreated,
    chunksSkipped:  summary.chunksSkipped,
    durationMs:     summary.durationMs,
    dryRun:         summary.dryRun,
    // Per-doc breakdown for debugging
    docs: summary.docs.map((d) => ({
      r2Key:        d.r2Key,
      status:       d.status,
      chunksCreated:d.chunksCreated,
      durationMs:   d.durationMs,
    })),
  });
});
