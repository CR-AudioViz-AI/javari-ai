/**
 * app/api/canonical/ingest/route.ts
 * Canonical Document Ingestion API Endpoint
 * 
 * POST /api/canonical/ingest
 * Triggers full ingestion of canonical documents from R2 into Supabase
 * 
 * Flow:
 * 1. Verify R2 connectivity
 * 2. List all documents in R2 cold-storage/consolidation-docs/
 * 3. For each document:
 *    - Fetch from R2
 *    - Calculate SHA-256 hash
 *    - Check if changed (skip if unchanged)
 *    - Chunk markdown into semantic sections
 *    - Generate embeddings via OpenAI
 *    - Store in canonical_documents, canonical_chunks, canonical_embeddings
 * 4. Return summary
 * 
 * Security: Requires x-canonical-secret header
 * Runtime: nodejs (for streaming and crypto)
 * Timeout: 300s (5 minutes - handles large ingestions)
 * 
 * @version 2.0.0
 * @timestamp Tuesday, February 25, 2026 at 2:00 AM EST
 */

import { NextRequest, NextResponse } from "next/server";
import { ingestAllCanonicalDocs, getStoreStats, type IngestOptions } from "@/lib/canonical/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CANONICAL_ADMIN_SECRET ?? "";
  if (!secret) {
    console.error("[canonical:ingest] CANONICAL_ADMIN_SECRET not configured");
    return false;
  }
  const providedSecret = req.headers.get("x-canonical-secret");
  return providedSecret === secret;
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { 
      ok: false, 
      error: "Unauthorized",
      message: "Missing or invalid x-canonical-secret header"
    },
    { status: 401 }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface IngestRequest {
  mode?: "full" | "incremental" | "dry-run";
  source?: "r2";
  force?: boolean;
  maxTokens?: number;
}

function validateRequest(body: unknown): { valid: true; data: IngestRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const req = body as Record<string, unknown>;

  // Validate mode
  if (req.mode && !["full", "incremental", "dry-run"].includes(req.mode as string)) {
    return { valid: false, error: "mode must be 'full', 'incremental', or 'dry-run'" };
  }

  // Validate source
  if (req.source && req.source !== "r2") {
    return { valid: false, error: "source must be 'r2'" };
  }

  // Validate force
  if (req.force !== undefined && typeof req.force !== "boolean") {
    return { valid: false, error: "force must be a boolean" };
  }

  // Validate maxTokens
  if (req.maxTokens !== undefined) {
    if (typeof req.maxTokens !== "number" || req.maxTokens < 100 || req.maxTokens > 2000) {
      return { valid: false, error: "maxTokens must be a number between 100 and 2000" };
    }
  }

  return {
    valid: true,
    data: {
      mode: (req.mode as "full" | "incremental" | "dry-run") ?? "full",
      source: (req.source as "r2") ?? "r2",
      force: req.force as boolean,
      maxTokens: req.maxTokens as number,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENVIRONMENT VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function validateEnvironment(): { valid: true } | { valid: false; missing: string[] } {
  const required = [
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ACCOUNT_ID",
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGGING UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function log(level: "info" | "warn" | "error", message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} [${level.toUpperCase()}][canonical:api]`;
  
  if (meta) {
    console[level](`${prefix} ${message}`, JSON.stringify(meta, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN POST HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  log("info", "═══════════════════════════════════════════════════════════════");
  log("info", "CANONICAL INGESTION REQUEST");
  log("info", "═══════════════════════════════════════════════════════════════");

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────────────────

  if (!isAuthorized(req)) {
    log("warn", "Unauthorized access attempt");
    return unauthorized();
  }
  log("info", "✓ Authentication passed");

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: ENVIRONMENT VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  const envCheck = validateEnvironment();
  if (!envCheck.valid) {
    log("error", "Missing required environment variables", { missing: envCheck.missing });
    return NextResponse.json(
      {
        ok: false,
        error: "Configuration error",
        message: "Missing required environment variables",
        missing: envCheck.missing,
      },
      { status: 500 }
    );
  }
  log("info", "✓ Environment variables validated");

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: REQUEST VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch (error) {
    log("error", "Failed to parse request body", { error });
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON",
        message: "Request body must be valid JSON",
      },
      { status: 400 }
    );
  }

  const validation = validateRequest(requestBody);
  if (!validation.valid) {
    log("warn", "Invalid request", { error: validation.error });
    return NextResponse.json(
      {
        ok: false,
        error: "Validation error",
        message: validation.error,
      },
      { status: 400 }
    );
  }

  const { mode, source, force, maxTokens } = validation.data;
  log("info", "✓ Request validated", { mode, source, force, maxTokens });

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: GET PRE-INGESTION STATS
  // ─────────────────────────────────────────────────────────────────────────────

  let priorStats;
  try {
    priorStats = await getStoreStats();
    log("info", "Pre-ingestion stats", priorStats);
  } catch (error) {
    log("error", "Failed to get pre-ingestion stats", { error });
    priorStats = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: EXECUTE INGESTION
  // ─────────────────────────────────────────────────────────────────────────────

  log("info", "───────────────────────────────────────────────────────────────");
  log("info", "STARTING CANONICAL INGESTION");
  log("info", "───────────────────────────────────────────────────────────────");

  const ingestOptions: IngestOptions = {
    force: force ?? false,
    dryRun: mode === "dry-run",
    maxTokens: maxTokens,
  };

  let summary;
  try {
    summary = await ingestAllCanonicalDocs(ingestOptions);
    
    log("info", "───────────────────────────────────────────────────────────────");
    log("info", "INGESTION COMPLETE", summary);
    log("info", "───────────────────────────────────────────────────────────────");
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log("error", "Ingestion failed", { error: errorMessage, stack: errorStack });
    
    return NextResponse.json(
      {
        ok: false,
        error: "Ingestion failed",
        message: errorMessage,
        details: {
          mode,
          source,
          durationMs: Date.now() - startTime,
        },
      },
      { status: 500 }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: GET POST-INGESTION STATS
  // ─────────────────────────────────────────────────────────────────────────────

  let postStats;
  try {
    postStats = await getStoreStats();
    log("info", "Post-ingestion stats", postStats);
  } catch (error) {
    log("error", "Failed to get post-ingestion stats", { error });
    postStats = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7: BUILD RESPONSE
  // ─────────────────────────────────────────────────────────────────────────────

  const totalDurationMs = Date.now() - startTime;
  
  const response = {
    ok: true,
    message: mode === "dry-run" 
      ? "Dry run completed successfully (no writes performed)"
      : "Canonical ingestion completed successfully",
    mode,
    source,
    summary: {
      docsProcessed: summary.docsProcessed,
      docsUpdated: summary.docsUpdated,
      docsUnchanged: summary.docsUnchanged,
      docsFailed: summary.docsFailed,
      chunksCreated: summary.chunksCreated,
      chunksSkipped: summary.chunksSkipped,
      ingestionDurationMs: summary.durationMs,
      totalDurationMs,
    },
    stats: {
      before: priorStats,
      after: postStats,
      delta: postStats && priorStats ? {
        documents: postStats.documentCount - priorStats.documentCount,
        chunks: postStats.chunkCount - priorStats.chunkCount,
        embeddings: postStats.embeddingCount - priorStats.embeddingCount,
      } : null,
    },
    details: {
      force: force ?? false,
      dryRun: mode === "dry-run",
      maxTokens: maxTokens ?? 800,
    },
    timestamp: new Date().toISOString(),
  };

  log("info", "═══════════════════════════════════════════════════════════════");
  log("info", `CANONICAL INGESTION ${mode === "dry-run" ? "DRY RUN" : "COMPLETE"}`);
  log("info", "═══════════════════════════════════════════════════════════════");
  log("info", "Response", response);

  return NextResponse.json(response, { status: 200 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER (Status Check)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await getStoreStats();
    
    return NextResponse.json({
      ok: true,
      status: "ready",
      stats,
      endpoints: {
        ingest: "POST /api/canonical/ingest",
        inspect: "POST /api/canonical/ingest/inspect",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      ok: false,
      status: "error",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
