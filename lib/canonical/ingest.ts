// lib/canonical/ingest.ts
// CR AudioViz AI — Canonical Document Ingest Orchestrator
// 2026-02-22 — Canonical Document Ingestion System
//
// Orchestrates: list R2 → fetch → sha256 → diff → chunk → embed → store
//
// Safety guarantees:
//   - If R2 unreachable → abort immediately, return error
//   - If individual doc fetch fails → skip, continue
//   - If embedding fails on a chunk → skip that chunk, continue
//   - Never delete canonical_docs rows
//   - Never mutate R2
//   - force=true re-embeds even if sha256 unchanged

import crypto                                    from "crypto";
import { createLogger }                          from "@/lib/observability/logger";
import { listRoadmapDocs, fetchDoc, checkR2Connectivity } from "./r2-client";
import { chunkMarkdown }                         from "./chunker";
import { embedBatch }                            from "./embed";
import { upsertCanonicalDoc, upsertDocChunks, getStoreStats } from "./store";

const log = createLogger("canonical:ingest");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestOptions {
  force?:     boolean;   // re-embed even if sha256 unchanged
  dryRun?:    boolean;   // list + hash only; no writes
  maxTokens?: number;    // chunk size override (default 800)
  prefix?:    string;    // override R2_CANONICAL_PREFIX
}

export interface DocIngestResult {
  r2Key:        string;
  status:       "unchanged" | "updated" | "new" | "fetch_failed" | "embed_failed" | "store_failed";
  chunksCreated: number;
  chunksSkipped: number;
  durationMs:   number;
}

export interface IngestSummary {
  docsProcessed:  number;
  docsUpdated:    number;
  docsUnchanged:  number;
  docsFailed:     number;
  chunksCreated:  number;
  chunksSkipped:  number;
  durationMs:     number;
  dryRun:         boolean;
  docs:           DocIngestResult[];
}

// ── SHA-256 helper ────────────────────────────────────────────────────────────

function sha256hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// ── Single doc ingest ─────────────────────────────────────────────────────────

async function ingestOneDoc(
  r2Key:      string,
  opts:       IngestOptions,
  docVersion: string,
): Promise<DocIngestResult> {
  const start     = Date.now();
  const maxTokens = opts.maxTokens ?? 800;

  // 1. Fetch content from R2
  const content = await fetchDoc(r2Key);
  if (!content) {
    log.warn(`Skipping ${r2Key}: fetch failed`);
    return { r2Key, status: "fetch_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  const sha256 = sha256hex(content);

  // 2. Check if doc changed vs stored record
  if (!opts.dryRun && !opts.force) {
    const { getExistingDoc } = await import("./store");
    const existing = await getExistingDoc(r2Key);
    if (existing && existing.sha256 === sha256) {
      log.info(`Unchanged: ${r2Key}`);
      return { r2Key, status: "unchanged", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
    }
  }

  // 3. Chunk
  const chunks = chunkMarkdown(content, maxTokens);
  if (!chunks.length) {
    log.warn(`No chunks produced for ${r2Key} (empty doc?)`);
    return { r2Key, status: "fetch_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 4. Extract doc title from first H1
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const docTitle   = titleMatch ? titleMatch[1].trim() : r2Key.split("/").pop()?.replace(/\.md$/, "") ?? r2Key;

  if (opts.dryRun) {
    log.info(`DRY RUN: ${r2Key} → ${chunks.length} chunks (not written)`);
    return { r2Key, status: "new", chunksCreated: chunks.length, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 5. Upsert canonical_docs row first (get doc id)
  let docId: string;
  try {
    const upsertResult = await upsertCanonicalDoc({
      r2Key,
      version:    docVersion,
      sha256,
      docTitle,
      charCount:  content.length,
      chunkCount: chunks.length,
    });
    docId = upsertResult.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    log.error(`store failed for ${r2Key}: ${msg}`);
    return { r2Key, status: "store_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 6. Embed all chunks
  const chunkTexts = chunks.map((c) => c.text);
  let embeds;
  try {
    embeds = await embedBatch(chunkTexts, (done, total) => {
      if (done % 10 === 0 || done === total) {
        log.info(`  Embedding ${r2Key}: ${done}/${total}`);
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    log.error(`embedBatch failed for ${r2Key}: ${msg}`);
    return { r2Key, status: "embed_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  // 7. Store chunks
  let chunksCreated = 0;
  let chunksSkipped = 0;
  try {
    const result = await upsertDocChunks(docId, chunks, embeds);
    chunksCreated = result.inserted;
    chunksSkipped = result.skipped;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    log.error(`upsertDocChunks failed for ${r2Key}: ${msg}`);
    return { r2Key, status: "store_failed", chunksCreated: 0, chunksSkipped: 0, durationMs: Date.now() - start };
  }

  const status = chunksCreated > 0 ? "updated" : "embed_failed";
  log.info(`Ingested ${r2Key}: ${chunksCreated} chunks in ${Date.now() - start}ms`);
  return { r2Key, status, chunksCreated, chunksSkipped, durationMs: Date.now() - start };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * ingestAllCanonicalDocs — runs the full ingestion pipeline.
 *
 * Flow:
 *   1. Verify R2 connectivity (abort if unreachable)
 *   2. List all docs under R2_CANONICAL_PREFIX
 *   3. For each doc: fetch → sha256 → diff → chunk → embed → store
 *   4. Return summary stats
 *
 * Concurrency: sequential per doc to respect OpenAI embedding rate limits.
 */
export async function ingestAllCanonicalDocs(opts: IngestOptions = {}): Promise<IngestSummary> {
  const startAll = Date.now();
  log.info("Starting canonical document ingest", { meta: { force: opts.force, dryRun: opts.dryRun } });

  // Step 1: Verify R2 connectivity
  const connectivity = await checkR2Connectivity();
  if (!connectivity.ok) {
    log.error(`R2 unreachable — aborting ingest: ${connectivity.message}`);
    throw new Error(`R2 unreachable: ${connectivity.message}`);
  }
  log.info(`R2 connectivity: ${connectivity.message}`);

  // Step 2: List docs
  let docs;
  try {
    docs = await listRoadmapDocs();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    throw new Error(`Failed to list R2 docs: ${msg}`);
  }

  if (!docs.length) {
    log.warn("No canonical docs found in R2 — nothing to ingest");
    return {
      docsProcessed: 0, docsUpdated: 0, docsUnchanged: 0, docsFailed: 0,
      chunksCreated: 0, chunksSkipped: 0,
      durationMs: Date.now() - startAll,
      dryRun: opts.dryRun ?? false,
      docs: [],
    };
  }

  log.info(`Found ${docs.length} docs to process`);

  // Step 3: Ingest each doc sequentially
  const results: DocIngestResult[] = [];

  for (const doc of docs) {
    // Use lastModified as doc version (ISO date → version string)
    const docVersion = doc.lastModified.slice(0, 10); // YYYY-MM-DD
    const result     = await ingestOneDoc(doc.key, opts, docVersion);
    results.push(result);
  }

  // Step 4: Compute summary
  const docsUpdated   = results.filter((r) => r.status === "updated" || r.status === "new").length;
  const docsUnchanged = results.filter((r) => r.status === "unchanged").length;
  const docsFailed    = results.filter((r) => ["fetch_failed","embed_failed","store_failed"].includes(r.status)).length;
  const chunksCreated = results.reduce((s, r) => s + r.chunksCreated, 0);
  const chunksSkipped = results.reduce((s, r) => s + r.chunksSkipped, 0);

  const summary: IngestSummary = {
    docsProcessed: docs.length,
    docsUpdated,
    docsUnchanged,
    docsFailed,
    chunksCreated,
    chunksSkipped,
    durationMs: Date.now() - startAll,
    dryRun:     opts.dryRun ?? false,
    docs:       results,
  };

  log.info("Canonical ingest complete", { meta: summary });
  return summary;
}
