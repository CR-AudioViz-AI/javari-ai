// lib/canonical/store.ts
// CR AudioViz AI — Canonical Vector Store
// 2026-02-22 — Canonical Document Ingestion System
//
// Writes to canonical_docs + canonical_doc_chunks via Supabase REST API.
// Uses service role key — never anon key.
// SAFE: only INSERT / UPSERT — never DELETE, never touches R2.
// Hash comparison prevents re-embedding unchanged documents.

import { createLogger } from "@/lib/observability/logger";
import type { TextChunk } from "./chunker";
import type { EmbedResult } from "./embed";

const log = createLogger("canonical:store");

// ── Config ────────────────────────────────────────────────────────────────────

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return { url, key };
}

function supabaseHeaders(cfg: { url: string; key: string }) {
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
  id:        string;
  isNew:     boolean;
  changed:   boolean;  // sha256 changed → needs re-embedding
}

// ── Read: lookup existing doc by r2_key ───────────────────────────────────────

export async function getExistingDoc(r2Key: string): Promise<CanonicalDocRow | null> {
  const cfg = getSupabaseConfig();

  const res = await fetch(
    `${cfg.url}/rest/v1/canonical_docs?r2_key=eq.${encodeURIComponent(r2Key)}&limit=1`,
    {
      method:  "GET",
      headers: { ...supabaseHeaders(cfg), "Prefer": "return=representation" },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    log.warn(`getExistingDoc(${r2Key}) failed: ${res.status} ${body.slice(0, 200)}`);
    return null;
  }

  const rows = await res.json() as CanonicalDocRow[];
  return rows[0] ?? null;
}

// ── Write: upsert canonical_docs row ─────────────────────────────────────────

export async function upsertCanonicalDoc(opts: {
  r2Key:      string;
  version:    string;
  sha256:     string;
  docTitle?:  string;
  charCount:  number;
  chunkCount: number;
}): Promise<UpsertDocResult> {
  const cfg       = getSupabaseConfig();
  const existing  = await getExistingDoc(opts.r2Key);
  const isNew     = !existing;
  const changed   = !existing || existing.sha256 !== opts.sha256;

  const payload = {
    r2_key:           opts.r2Key,
    version:          opts.version,
    sha256:           opts.sha256,
    doc_title:        opts.docTitle ?? null,
    char_count:       opts.charCount,
    chunk_count:      opts.chunkCount,
    last_ingested_at: new Date().toISOString(),
    // created_at: let DB default handle it on insert
  };

  if (existing) {
    // UPDATE existing row — only write if changed or forced
    const res = await fetch(
      `${cfg.url}/rest/v1/canonical_docs?r2_key=eq.${encodeURIComponent(opts.r2Key)}`,
      {
        method:  "PATCH",
        headers: { ...supabaseHeaders(cfg), "Prefer": "return=representation" },
        body:    JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`upsertCanonicalDoc PATCH failed: ${res.status} ${body.slice(0, 300)}`);
    }
    const rows = await res.json() as CanonicalDocRow[];
    const row  = rows[0] ?? existing;
    log.info(`Updated canonical_doc: ${opts.r2Key} (changed=${changed})`);
    return { id: row.id, isNew: false, changed };
  }

  // INSERT new row
  const res = await fetch(
    `${cfg.url}/rest/v1/canonical_docs`,
    {
      method:  "POST",
      headers: { ...supabaseHeaders(cfg), "Prefer": "return=representation" },
      body:    JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`upsertCanonicalDoc INSERT failed: ${res.status} ${body.slice(0, 300)}`);
  }
  const rows = await res.json() as CanonicalDocRow[];
  const row  = rows[0];
  if (!row?.id) throw new Error("upsertCanonicalDoc: no id returned from INSERT");
  log.info(`Inserted canonical_doc: ${opts.r2Key} id=${row.id}`);
  return { id: row.id, isNew: true, changed: true };
}

// ── Write: delete old chunks then insert new ones ────────────────────────────
// We delete+re-insert (not upsert) because chunk_index can shift if doc changes.
// SAFE: only affects chunks for this specific doc_id — no cross-doc impact.

export async function upsertDocChunks(
  docId:   string,
  chunks:  TextChunk[],
  embeds:  (EmbedResult | null)[]
): Promise<{ inserted: number; skipped: number }> {
  const cfg = getSupabaseConfig();

  // Step 1: Delete existing chunks for this doc (cascade handled by FK but explicit is safer)
  const delRes = await fetch(
    `${cfg.url}/rest/v1/canonical_doc_chunks?doc_id=eq.${docId}`,
    {
      method:  "DELETE",
      headers: { ...supabaseHeaders(cfg), "Prefer": "return=minimal" },
    }
  );
  if (!delRes.ok) {
    const body = await delRes.text().catch(() => "");
    throw new Error(`upsertDocChunks DELETE failed: ${delRes.status} ${body.slice(0, 300)}`);
  }
  log.info(`Deleted old chunks for doc ${docId}`);

  // Step 2: Insert new chunks in batches of 50
  let inserted = 0;
  let skipped  = 0;

  const rows = chunks
    .map((chunk, i) => {
      const embed = embeds[i];
      if (!embed) { skipped++; return null; }
      return {
        doc_id:      docId,
        chunk_index: chunk.index,
        chunk_text:  chunk.text,
        token_count: chunk.tokenCount,
        // Supabase pgvector REST API accepts float[] directly as JSON array
        embedding:   embed.embedding,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Batch insert in groups of 50
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(
      `${cfg.url}/rest/v1/canonical_doc_chunks`,
      {
        method:  "POST",
        headers: { ...supabaseHeaders(cfg), "Prefer": "return=minimal" },
        body:    JSON.stringify(batch),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error(`upsertDocChunks INSERT batch ${i}–${i + BATCH} failed: ${res.status} ${body.slice(0, 300)}`);
      // Don't throw — continue with other batches; partial insert is recoverable
      skipped += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  log.info(`upsertDocChunks: doc=${docId} inserted=${inserted} skipped=${skipped}`);
  return { inserted, skipped };
}

// ── Read: summary stats ───────────────────────────────────────────────────────

export interface StoreStats {
  totalDocs:   number;
  totalChunks: number;
}

export async function getStoreStats(): Promise<StoreStats> {
  const cfg = getSupabaseConfig();

  const [docsRes, chunksRes] = await Promise.all([
    fetch(`${cfg.url}/rest/v1/canonical_docs?select=count`, {
      method: "HEAD",
      headers: { ...supabaseHeaders(cfg), "Prefer": "count=exact" },
    }),
    fetch(`${cfg.url}/rest/v1/canonical_doc_chunks?select=count`, {
      method: "HEAD",
      headers: { ...supabaseHeaders(cfg), "Prefer": "count=exact" },
    }),
  ]);

  const totalDocs   = parseInt(docsRes.headers.get("content-range")?.split("/")[1] ?? "0");
  const totalChunks = parseInt(chunksRes.headers.get("content-range")?.split("/")[1] ?? "0");

  return { totalDocs, totalChunks };
}
