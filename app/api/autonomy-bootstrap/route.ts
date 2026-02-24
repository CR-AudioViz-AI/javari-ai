// app/api/autonomy-bootstrap/route.ts
// CR AudioViz AI — Javari OS Autonomy Bootstrap
// 2026-02-22
//
// POST /api/autonomy-bootstrap
// Header: x-javari-root: <JAVARI_ROOT_KEY from Secret Authority vault>
//
// Flow:
//   1. Auth — compare header to JAVARI_ROOT_KEY from vault (constant-time)
//   2. Validate Secret Authority RPCs are live
//   3. Warm critical secret cache
//   4. List canonical .md files from R2 cold-storage/consolidation-docs/
//   5. For each file: sha256 → skip if unchanged | embed → upsert DB
//   6. Trigger /api/autonomy-core/run?force=1&dry=0
//   7. Return structured JSON summary (no secrets, no plaintext key values)
//
// Security:
//   - Root key never logged or returned
//   - Constant-time comparison for auth header
//   - All Supabase access via service_role through the vault
//
// SERVER-SIDE ONLY. Node.js runtime required.

import { NextRequest, NextResponse }      from "next/server";
import { getSecret, warmSecrets }          from "@/lib/platform-secrets";
import { listCanonicalKeys,
         fetchCanonicalText }              from "@/lib/canonical/r2-client";
import { sha256Hex }                       from "@/lib/canonical/hasher";
import { chunkMarkdown }                   from "@/lib/canonical/chunker";
import { embedText }                       from "@/lib/canonical/embed";
import { upsertCanonicalDoc,
         upsertDocChunks,
         getExistingDoc }                  from "@/lib/canonical/store";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;   // 5-min timeout for large ingest jobs

// ── Structured logging (no secret values ever) ────────────────────────────────

function clog(level: "info" | "warn" | "error", msg: string): void {
  console[level](`${new Date().toISOString()} [${level.toUpperCase()}][autonomy-bootstrap] ${msg}`);
}

// ── Constant-time string comparison ──────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const provided = req.headers.get("x-javari-root") ?? "";
  if (!provided) return false;
  const rootKey = await getSecret("JAVARI_ROOT_KEY");
  if (!rootKey) {
    clog("error", "JAVARI_ROOT_KEY not found in vault");
    return false;
  }
  return safeEqual(provided, rootKey);
}

// ── Secret Authority health ───────────────────────────────────────────────────

async function checkSecretAuthority(): Promise<{ ok: boolean; keyCount: number; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return { ok: false, keyCount: 0, error: "Bootstrap vars missing" };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/list_platform_secrets`, {
      method:  "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:  "{}",
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, keyCount: 0, error: `RPC HTTP ${res.status}` };
    const rows = await res.json() as unknown[];
    return { ok: true, keyCount: Array.isArray(rows) ? rows.length : 0 };
  } catch (err) {
    return { ok: false, keyCount: 0, error: (err as Error).message };
  }
}

// ── Per-doc ingestion ─────────────────────────────────────────────────────────

interface DocResult {
  key:         string;
  status:      "skipped" | "ingested" | "error";
  sha256?:     string;
  chunks?:     number;
  tokens?:     number;
  elapsedMs?:  number;
  error?:      string;
}

async function ingestDoc(key: string): Promise<DocResult> {
  const t0 = Date.now();
  try {
    // 1. Fetch text
    const text = await fetchCanonicalText(key);

    // 2. Hash
    const hash = sha256Hex(text);

    // 3. Skip unchanged
    const existing = await getExistingDoc(key);
    if (existing && existing.sha256 === hash) {
      clog("info", `SKIP ${key.split("/").pop()} (unchanged)`);
      return { key, status: "skipped", sha256: hash.slice(0, 16) };
    }

    // 4. Chunk
    const rawChunks = chunkMarkdown(text);

    // 5. Embed each chunk sequentially (no concurrent open awaits in loop body)
    //    store.ts expects TextChunk shape: { index, text, tokenCount }
    //    and EmbedResult[]: parallel arrays, not zip
    const textChunks = rawChunks.map((c) => ({
      index:      c.chunkIndex,
      text:       c.chunkText,
      tokenCount: c.approxTokens,
    }));

    const embedResults: Array<{ embedding: number[]; tokenCount: number } | null> = [];
    for (const chunk of textChunks) {
      try {
        const result = await embedText(chunk.text);
        embedResults.push(result);
      } catch (err) {
        clog("warn", `Embed failed for chunk ${chunk.index}: ${(err as Error).message}`);
        embedResults.push(null);
      }
      // 60ms delay — ~1000 RPM, well under OpenAI 3000 RPM limit
      await new Promise((r) => setTimeout(r, 60));
    }

    const totalTokens = embedResults.reduce(
      (s, e) => s + (e?.tokenCount ?? 0), 0
    );

    // 6. Upsert canonical_docs
    //    version = sha256[:8] — deterministic, human-readable
    const docTitle   = key.split("/").pop()?.replace(/\.md$/, "") ?? key;
    const upsertResult = await upsertCanonicalDoc({
      r2Key:      key,
      version:    hash.slice(0, 8),
      sha256:     hash,
      docTitle,
      charCount:  text.length,
      chunkCount: textChunks.length,
    });

    // 7. Upsert chunks — positional args: (docId, chunks, embeds)
    await upsertDocChunks(upsertResult.id, textChunks, embedResults);

    clog("info",
      `INGESTED ${docTitle}: ${textChunks.length} chunks, ${totalTokens} tokens, ${Date.now() - t0}ms`
    );
    return {
      key,
      status:   "ingested",
      sha256:   hash.slice(0, 16),
      chunks:   textChunks.length,
      tokens:   totalTokens,
      elapsedMs: Date.now() - t0,
    };
  } catch (err) {
    const msg = (err as Error).message;
    clog("error", `ERROR ${key}: ${msg}`);
    return { key, status: "error", error: msg, elapsedMs: Date.now() - t0 };
  }
}

// ── Autonomy-core trigger ─────────────────────────────────────────────────────

async function triggerAutonomyCore(
  baseUrl: string
): Promise<{ triggered: boolean; status: number; error?: string }> {
  try {
    const coreSecret = await getSecret("AUTONOMY_CORE_ADMIN_SECRET");
    if (!coreSecret) return { triggered: false, status: 0, error: "AUTONOMY_CORE_ADMIN_SECRET not in vault" };
    const res = await fetch(`${baseUrl}/api/autonomy-core/run?force=1&dry=0`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-autonomy-secret": coreSecret,
      },
      body:   JSON.stringify({ source: "autonomy-bootstrap", triggeredAt: new Date().toISOString() }),
      cache:  "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return { triggered: res.ok || res.status === 202, status: res.status };
  } catch (err) {
    return { triggered: false, status: 0, error: (err as Error).message };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  // 1. Auth
  if (!(await isAuthorized(req))) {
    clog("warn", "Unauthorized — root key mismatch or missing");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  clog("info", "Auth OK — starting bootstrap");

  // 2. Secret Authority health
  const saStatus = await checkSecretAuthority();
  if (!saStatus.ok) {
    clog("error", `Secret Authority unhealthy: ${saStatus.error}`);
    return NextResponse.json(
      { ok: false, phase: "secret_authority", error: saStatus.error }, { status: 503 }
    );
  }
  clog("info", `Secret Authority OK — ${saStatus.keyCount} secrets`);

  // 3. Warm cache
  const warmKeys = [
    "JAVARI_ROOT_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
    "AUTONOMY_CORE_ADMIN_SECRET", "CANONICAL_ADMIN_SECRET",
    "GITHUB_TOKEN", "STRIPE_SECRET_KEY",
  ];
  const warmResult = await warmSecrets(warmKeys);
  clog("info", `Cache warm: ${warmResult.ok}/${warmKeys.length}`);

  // 4. List R2 files
  let r2Keys: string[];
  try {
    const all = await listCanonicalKeys("consolidation-docs/");
    r2Keys = all.filter((k) => k.endsWith(".md"));
    clog("info", `R2: ${r2Keys.length} .md files in consolidation-docs/`);
  } catch (err) {
    const msg = (err as Error).message;
    clog("error", `R2 list failed: ${msg}`);
    return NextResponse.json({ ok: false, phase: "r2_list", error: msg }, { status: 503 });
  }

  if (r2Keys.length === 0) {
    return NextResponse.json(
      { ok: false, phase: "r2_list", error: "No .md files found — check R2_CANONICAL_BUCKET env var" },
      { status: 404 }
    );
  }

  // 5. Ingest docs sequentially
  const docs: DocResult[] = [];
  for (const key of r2Keys) {
    docs.push(await ingestDoc(key));
  }

  const ingested = docs.filter((d) => d.status === "ingested").length;
  const skipped  = docs.filter((d) => d.status === "skipped").length;
  const errors   = docs.filter((d) => d.status === "error").length;
  clog("info", `Ingestion done: ${ingested} ingested, ${skipped} skipped, ${errors} errors`);

  // 6. Trigger autonomy-core
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://craudiovizai.com";
  const coreResult = await triggerAutonomyCore(baseUrl);
  clog(coreResult.triggered ? "info" : "warn",
    `autonomy-core: triggered=${coreResult.triggered} status=${coreResult.status}`
  );

  // 7. Summary (no secrets, no raw embeddings)
  return NextResponse.json({
    ok: true,
    summary: {
      totalFiles:  r2Keys.length,
      ingested,
      skipped,
      errors,
      elapsedMs: Date.now() - t0,
    },
    secretAuthority: {
      ok:        saStatus.ok,
      keyCount:  saStatus.keyCount,
      cacheWarm: warmResult,
    },
    autonomyCore: {
      triggered:  coreResult.triggered,
      httpStatus: coreResult.status,
      ...(coreResult.error ? { error: coreResult.error } : {}),
    },
    docs: docs.map((d) => ({
      file:      d.key.split("/").pop(),
      status:    d.status,
      sha256:    d.sha256,
      chunks:    d.chunks,
      tokens:    d.tokens,
      elapsedMs: d.elapsedMs,
      ...(d.error ? { error: d.error } : {}),
    })),
  });
}
