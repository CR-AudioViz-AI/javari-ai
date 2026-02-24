// lib/canonical/store.ts
// CR AudioViz AI — Canonical Vector Store (Supabase REST)
// 2026-02-22 — Canonical Document Ingestion System
//
// Writes to canonical_docs + canonical_doc_chunks via Supabase REST API.
// Uses SUPABASE_SERVICE_ROLE_KEY — never anon key.
// SAFE: INSERT / UPSERT only — never DELETE rows from canonical_docs.
//        upsertDocChunks deletes OLD CHUNKS for one doc only, then re-inserts.
//        Hash comparison prevents re-embedding unchanged docs.
// No createLogger — avoids LogSubsystem type constraint.

import type { TextChunk } from "./chunker";
import type { EmbedResult } from "./embed";

function clog(level: "info" | "warn" | "error", msg: string) {
  const ts = new Date().toISOString();
  console[level](`${ts} [${level.toUpperCase()}][canonical:store] ${msg}`);
}

// ── Config ────────────────────────────────────────────────────────────────────

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY     ?? "";
  if (!url || !key) {
    throw new Error(
      "Supabase not configured. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return { url, key };
}

function headers(cfg: { key: string }): Record<string, string> {
  return {
    "Content-Type":  "application/json",
    "apikey":        cfg.key,
    "Authorization": `Bearer ${cfg.key}`,
    "Prefer":        "return=representation",
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CanonicalDocRow {
  id:               string;
  r2_key:           string;
  version:          string;
  sha256:           string;
  doc_title:        string | null;
  char_count:       number;
  chunk_count:      number;
  last_ingested_at: string;
  created_at:       string;
}

export interface UpsertDocResult {
  id:      string;
  isNew:   boolean;
  changed: boolean;  // sha256 differed → re-embed needed
}

export interface StoreStats {
  totalDocs:   number;
  totalChunks: number;
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export async function getExistingDoc(r2Key: string): Promise<CanonicalDocRow | null> {
  const cfg = getSupabaseConfig();

  const res = await fetch(
    `${cfg.url}/rest/v1/canonical_docs` +
    `?r2_key=eq.${encodeURIComponent(r2Key)}&limit=1`,
    {
      method:  "GET",
      headers: { ...headers(cfg), "Prefer": "return=representation" },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    clog("warn", `getExistingDoc(${r2Key}) → ${res.status}: ${body.slice(0, 200)}`);
    return null;
  }

  const rows = await res.json() as CanonicalDocRow[];
  return rows[0] ?? null;
}

export async function getStoreStats(): Promise<StoreStats> {
  const cfg = getSupabaseConfig();

  const [docsRes, chunksRes] = await Promise.all([
    fetch(`${cfg.url}/rest/v1/canonical_docs?select=count`, {
      method:  "HEAD",
      headers: { ...headers(cfg), "Prefer": "count=exact" },
    }),
    fetch(`${cfg.url}/rest/v1/canonical_doc_chunks?select=count`, {
      method:  "HEAD",
      headers: { ...headers(cfg), "Prefer": "count=exact" },
    }),
  ]);

  const parse = (h: Headers) =>
    parseInt(h.get("content-range")?.split("/")[1] ?? "0", 10);

  return {
    totalDocs:   parse(docsRes.headers),
    totalChunks: parse(chunksRes.headers),
  };
}

// ── Write: canonical_docs ─────────────────────────────────────────────────────

export async function upsertCanonicalDoc(opts: {
  r2Key:      string;
  version:    string;
  sha256:     string;
  docTitle?:  string;
  charCount:  number;
  chunkCount: number;
}): Promise<UpsertDocResult> {
  const cfg      = getSupabaseConfig();
  const existing = await getExistingDoc(opts.r2Key);
  const isNew    = !existing;
  const changed  = !existing || existing.sha256 !== opts.sha256;

  const payload = {
    r2_key:           opts.r2Key,
    version:          opts.version,
    sha256:           opts.sha256,
    doc_title:        opts.docTitle ?? null,
    char_count:       opts.charCount,
    chunk_count:      opts.chunkCount,
    last_ingested_at: new Date().toISOString(),
  };

  if (existing) {
    const res = await fetch(
      `${cfg.url}/rest/v1/canonical_docs?r2_key=eq.${encodeURIComponent(opts.r2Key)}`,
      {
        method:  "PATCH",
        headers: headers(cfg),
        body:    JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`upsertCanonicalDoc PATCH failed ${res.status}: ${body.slice(0, 300)}`);
    }
    const rows = await res.json() as CanonicalDocRow[];
    const row  = rows[0] ?? existing;
    clog("info", `Updated canonical_doc ${opts.r2Key} (changed=${changed})`);
    return { id: row.id, isNew: false, changed };
  }

  const res = await fetch(
    `${cfg.url}/rest/v1/canonical_docs`,
    {
      method:  "POST",
      headers: headers(cfg),
      body:    JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`upsertCanonicalDoc INSERT failed ${res.status}: ${body.slice(0, 300)}`);
  }
  const rows = await res.json() as CanonicalDocRow[];
  const row  = rows[0];
  if (!row?.id) throw new Error("upsertCanonicalDoc: INSERT returned no id");
  clog("info", `Inserted canonical_doc ${opts.r2Key} id=${row.id}`);
  return { id: row.id, isNew: true, changed: true };
}

// ── Write: canonical_doc_chunks ───────────────────────────────────────────────
// Deletes OLD CHUNKS for this doc, then inserts new ones.
// Never touches any other doc's chunks.

export async function upsertDocChunks(
  docId:  string,
  chunks: TextChunk[],
  embeds: (EmbedResult | null)[],
): Promise<{ inserted: number; skipped: number }> {
  const cfg = getSupabaseConfig();

  // Delete existing chunks for this doc only
  const delRes = await fetch(
    `${cfg.url}/rest/v1/canonical_doc_chunks?doc_id=eq.${docId}`,
    {
      method:  "DELETE",
      headers: { ...headers(cfg), "Prefer": "return=minimal" },
    }
  );
  if (!delRes.ok) {
    const body = await delRes.text().catch(() => "");
    throw new Error(`upsertDocChunks DELETE failed ${delRes.status}: ${body.slice(0, 300)}`);
  }
  clog("info", `Deleted old chunks for doc ${docId}`);

  // Build rows — skip chunks with no embedding
  let skipped = 0;
  const rows = chunks
    .map((chunk, i) => {
      const embed = embeds[i];
      if (!embed) { skipped++; return null; }
      return {
        doc_id:      docId,
        chunk_index: chunk.index,
        chunk_text:  chunk.text,
        token_count: chunk.tokenCount,
        embedding:   embed.embedding,   // float[] — Supabase REST accepts JSON array
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Batch insert — 50 rows per request
  let inserted = 0;
  const BATCH  = 50;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res   = await fetch(
      `${cfg.url}/rest/v1/canonical_doc_chunks`,
      {
        method:  "POST",
        headers: { ...headers(cfg), "Prefer": "return=minimal" },
        body:    JSON.stringify(batch),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      clog("error", `Chunk batch ${i}–${i + BATCH} failed ${res.status}: ${body.slice(0, 300)}`);
      skipped += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  clog("info", `upsertDocChunks doc=${docId} inserted=${inserted} skipped=${skipped}`);
  return { inserted, skipped };
}
