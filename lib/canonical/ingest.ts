// lib/canonical/ingest.ts
// CR AudioViz AI — Canonical Document Ingest Orchestrator
// 2026-02-22 — Canonical Document Ingestion System
//
// Orchestrates: list R2 → fetch → sha256 → diff → chunk → embed → store
//
// Safety guarantees:
//   - R2 unreachable → throw (caller returns 500 safely)
//   - Individual doc fetch fails → skip, continue
//   - Embedding fails on a chunk → skip that chunk, continue
//   - Never deletes canonical_docs rows
//   - Never mutates R2
//   - force=true re-embeds even if sha256 unchanged
//   - dryRun=true lists and chunks but makes no writes

import crypto from "crypto";
import { listRoadmapDocs, fetchDoc, checkR2Connectivity } from "./r2-client";
import { chunkMarkdown }                                  from "./chunker";
import { embedBatch }                                     from "./embed";
import {
  upsertCanonicalDoc,
  upsertDocChunks,
  getStoreStats,
  getExistingDoc,
} from "./store";

function clog(level: "info" | "warn" | "error", msg: string, meta?: unknown) {
  const ts = new Date().toISOString();
  if (meta !== undefined) {
    console[level](`${ts} [${level.toUpperCase()}][canonical:ingest] ${msg}`, JSON.stringify(meta));
  } else {
    console[level](`${ts} [${level.toUpperCase()}][canonical:ingest] ${msg}`);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestOptions {
  force?:     boolean;  // re-embed even if sha256 unchanged
  dryRun?:    boolean;  // no writes — list + hash only
  maxTokens?: number;   // chunk size override (default 800)
}

export interface DocIngestResult {
  r2Key:         string;
  status:        "unchanged" | "updated" | "new" | "fetch_failed" | "embed_failed" | "store_failed";
  chunksCreated: number;
  chunksSkipped: number;
  durationMs:    number;
}

export interface IngestSummary {
  docsProcessed: number;
  docsUpdated:   number;
  docsUnchanged: number;
  docsFailed:    number;
  chunksCreated: number;
  chunksSkipped: number;
  durationMs:    number;
  dryRun:        boolean;
  docs:          DocIngestResult[];
}

// ── SHA-256 helper ────────────────────────────────────────────────────────────

function sha256hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// ── Single-doc ingest ─────────────────────────────────────────────────────────

async function ingestOneDoc(
  r2Key:      string,
  docVersion: string,
  opts:       IngestOptions,
): Promise<DocIngestResult> {
  const start     = Date.now();
  const maxTokens = opts.maxTokens ?? 800;

  // 1. Fetch from R2
  const content = await fetchDoc(r2Key);
  if (!content) {
    return { r2Key, status: "fetch_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  const sha256 = sha256hex(content);

  // 2. Diff check (skip if unchanged and not forced)
  if (!opts.dryRun && !opts.force) {
    const existing = await getExistingDoc(r2Key);
    if (existing && existing.sha256 === sha256) {
      clog("info", `Unchanged: ${r2Key}`);
      return { r2Key, status: "unchanged", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
    }
  }

  // 3. Chunk
  const chunks = chunkMarkdown(content, maxTokens);
  if (!chunks.length) {
    clog("warn", `No chunks for ${r2Key} — skipping`);
    return { r2Key, status: "fetch_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 4. Extract title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const docTitle   = titleMatch
    ? titleMatch[1].trim()
    : (r2Key.split("/").pop()?.replace(/\.md$/, "") ?? r2Key);

  // DRY RUN — stop here, no writes
  if (opts.dryRun) {
    clog("info", `DRY RUN ${r2Key}: ${chunks.length} chunks (not written)`);
    return { r2Key, status: "new", chunksCreated: chunks.length, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 5. Upsert canonical_docs row
  let docId: string;
  try {
    const upsert = await upsertCanonicalDoc({
      r2Key,
      version:    docVersion,
      sha256,
      docTitle,
      charCount:  content.length,
      chunkCount: chunks.length,
    });
    docId = upsert.id;
  } catch (e) {
    clog("error", `store failed for ${r2Key}: ${e instanceof Error ? e.message : e}`);
    return { r2Key, status: "store_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 6. Embed all chunks
  let embeds;
  try {
    embeds = await embedBatch(
      chunks.map((c) => c.text),
      (done, total) => { if (done % 10 === 0 || done === total) clog("info", `  ${r2Key}: embedded ${done}/${total}`); }
    );
  } catch (e) {
    clog("error", `embedBatch failed for ${r2Key}: ${e instanceof Error ? e.message : e}`);
    return { r2Key, status: "embed_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 7. Store chunks
  let chunksCreated = 0;
  let chunksSkipped = 0;
  try {
    const result  = await upsertDocChunks(docId, chunks, embeds);
    chunksCreated = result.inserted;
    chunksSkipped = result.skipped;
  } catch (e) {
    clog("error", `upsertDocChunks failed for ${r2Key}: ${e instanceof Error ? e.message : e}`);
    return { r2Key, status: "store_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  const status: DocIngestResult["status"] = chunksCreated > 0 ? "updated" : "embed_failed";
  clog("info", `Ingested ${r2Key}: ${chunksCreated} chunks in ${Date.now() - start}ms`);
  return { r2Key, status, chunksCreated, chunksSkipped, durationMs: Date.now() - start };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * ingestAllCanonicalDocs
 *
 * Flow:
 *   1. Verify R2 connectivity — throws if unreachable
 *   2. List all docs under R2_CANONICAL_PREFIX
 *   3. For each doc: fetch → sha256 → diff → chunk → embed → store
 *   4. Return IngestSummary
 *
 * Sequential processing to respect OpenAI embedding rate limits.
 */
export async function ingestAllCanonicalDocs(
  opts: IngestOptions = {}
): Promise<IngestSummary> {
  const startAll = Date.now();
  clog("info", "Starting canonical ingest", { force: opts.force, dryRun: opts.dryRun });

  // Step 1 — R2 connectivity
  const conn = await checkR2Connectivity();
  if (!conn.ok) {
    clog("error", `R2 unreachable: ${conn.message}`);
    throw new Error(`R2 unreachable: ${conn.message}`);
  }
  clog("info", `R2: ${conn.message}`);

  // Step 2 — list docs
  const docs = await listRoadmapDocs();

  if (!docs.length) {
    clog("warn", "No docs found in R2 — nothing to ingest");
    return {
      docsProcessed: 0, docsUpdated: 0, docsUnchanged: 0, docsFailed: 0,
      chunksCreated: 0, chunksSkipped: 0,
      durationMs: Date.now() - startAll,
      dryRun: opts.dryRun ?? false,
      docs: [],
    };
  }

  clog("info", `Found ${docs.length} docs to process`);

  // Step 3 — ingest sequentially
  const results: DocIngestResult[] = [];
  for (const doc of docs) {
    const docVersion = doc.lastModified.slice(0, 10); // YYYY-MM-DD
    const result     = await ingestOneDoc(doc.key, docVersion, opts);
    results.push(result);
  }

  // Step 4 — summary
  const summary: IngestSummary = {
    docsProcessed: docs.length,
    docsUpdated:   results.filter((r) => r.status === "updated" || r.status === "new").length,
    docsUnchanged: results.filter((r) => r.status === "unchanged").length,
    docsFailed:    results.filter((r) => ["fetch_failed","embed_failed","store_failed"].includes(r.status)).length,
    chunksCreated: results.reduce((s, r) => s + r.chunksCreated, 0),
    chunksSkipped: results.reduce((s, r) => s + r.chunksSkipped, 0),
    durationMs:    Date.now() - startAll,
    dryRun:        opts.dryRun ?? false,
    docs:          results,
  };

  clog("info", "Canonical ingest complete", summary);
  return summary;
}

// Re-export getStoreStats so the API route only needs to import from here
export { getStoreStats };
