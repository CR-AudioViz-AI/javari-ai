// lib/canonical/store.ts
// CR AudioViz AI — Canonical Vector Store (Supabase REST)
// 2026-02-22 — Canonical Document Ingestion System
// Writes to canonical_docs + canonical_doc_chunks via Supabase REST API.
// Uses SUPABASE_SERVICE_ROLE_KEY — never anon key.
// SAFE: INSERT / UPSERT only — never DELETE rows from canonical_docs.
//        upsertDocChunks deletes OLD CHUNKS for one doc only, then re-inserts.
//        Hash comparison prevents re-embedding unchanged docs.
// No createLogger — avoids LogSubsystem type constraint.
import type { TextChunk } from "./chunker";
import type { EmbedResult } from "./embed";
// ── Config ────────────────────────────────────────────────────────────────────
// ── Types ─────────────────────────────────────────────────────────────────────
export interface CanonicalDocRow {
export interface UpsertDocResult {
export interface StoreStats {
// ── Read helpers ──────────────────────────────────────────────────────────────
// ── Write: canonical_docs ─────────────────────────────────────────────────────
// ── Write: canonical_doc_chunks ───────────────────────────────────────────────
// Deletes OLD CHUNKS for this doc, then inserts new ones.
// Never touches any other doc's chunks.
  // Delete existing chunks for this doc only
  // Build rows — skip chunks with no embedding
  // Batch insert — 50 rows per request
export default {}
