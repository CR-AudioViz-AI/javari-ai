// lib/canonical/ingest.ts
// CR AudioViz AI — Canonical Document Ingest Orchestrator
// 2026-02-22 — Canonical Document Ingestion System
// Orchestrates: list R2 → fetch → sha256 → diff → chunk → embed → store
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
// ── Types ─────────────────────────────────────────────────────────────────────
export interface IngestOptions {
export interface DocIngestResult {
export interface IngestSummary {
// ── SHA-256 helper ────────────────────────────────────────────────────────────
// ── Single-doc ingest ─────────────────────────────────────────────────────────
  // 1. Fetch from R2 — catch HTTP errors (403/404/etc) and skip this doc rather than aborting the run
  // 2. Diff check (skip if unchanged and not forced)
  // 3. Chunk
  // 4. Extract title
  // DRY RUN — stop here, no writes
  // 5. Upsert canonical_docs row
  // 6. Embed all chunks
  // 7. Store chunks
// ── Main entry point ──────────────────────────────────────────────────────────
  // Step 1 — R2 connectivity
  // Step 2 — list docs (filter to .md and .txt only — skip ZIP/binary placeholders)
  // Step 3 — ingest sequentially
  // Step 4 — summary
// Re-export getStoreStats so the API route only needs to import from here
export default {}
