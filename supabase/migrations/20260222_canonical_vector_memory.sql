-- supabase/migrations/20260222_canonical_vector_memory.sql
-- CR AudioViz AI — Canonical Document Vector Memory
-- 2026-02-22 — R2 is source of truth; Supabase stores embeddings + metadata only.
-- SAFE: additive only — no existing tables modified.

-- ── pgvector extension ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── canonical_docs ────────────────────────────────────────────────────────────
-- One row per R2 canonical document. Tracks version + content hash.
-- Never stores full doc text — R2 is the source of truth.

CREATE TABLE IF NOT EXISTS canonical_docs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  r2_key      text        NOT NULL,          -- e.g. roadmap/MASTER_ROADMAP.md
  version     text        NOT NULL,          -- semver or ISO date string
  sha256      text        NOT NULL,          -- hex SHA-256 of raw content
  doc_title   text,                          -- extracted from first H1 or filename
  char_count  int,                           -- raw content length
  chunk_count int,                           -- number of chunks produced
  last_ingested_at timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

-- Unique constraint: one row per R2 key
CREATE UNIQUE INDEX IF NOT EXISTS canonical_docs_r2_key_idx ON canonical_docs(r2_key);

-- Enable RLS — service role can read/write; authenticated users read-only
ALTER TABLE canonical_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_canonical_docs"
  ON canonical_docs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_canonical_docs"
  ON canonical_docs FOR SELECT
  TO authenticated USING (true);

-- ── canonical_doc_chunks ──────────────────────────────────────────────────────
-- One row per text chunk. Stores embedding vector + metadata only.
-- chunk_text kept for RAG retrieval context; never mirrors the full doc.

CREATE TABLE IF NOT EXISTS canonical_doc_chunks (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id       uuid    NOT NULL REFERENCES canonical_docs(id) ON DELETE CASCADE,
  chunk_index  int     NOT NULL,           -- 0-based position within doc
  chunk_text   text    NOT NULL,           -- the chunk text (for retrieval context)
  token_count  int     NOT NULL DEFAULT 0, -- estimated token count
  embedding    vector(1536),               -- OpenAI text-embedding-3-small
  created_at   timestamptz DEFAULT now()
);

-- Index for efficient similarity search (ivfflat — approximate, fast)
-- lists=100 is appropriate for up to ~1M rows; increase to 200 for >1M
CREATE INDEX IF NOT EXISTS canonical_chunks_embedding_idx
  ON canonical_doc_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for doc-level lookups
CREATE INDEX IF NOT EXISTS canonical_chunks_doc_id_idx
  ON canonical_doc_chunks(doc_id);

-- Composite unique: one chunk per (doc, index)
CREATE UNIQUE INDEX IF NOT EXISTS canonical_chunks_doc_chunk_idx
  ON canonical_doc_chunks(doc_id, chunk_index);

-- Enable RLS
ALTER TABLE canonical_doc_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_canonical_chunks"
  ON canonical_doc_chunks FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_canonical_chunks"
  ON canonical_doc_chunks FOR SELECT
  TO authenticated USING (true);

-- ── Helper function: similarity search ───────────────────────────────────────
-- Returns top-k chunks with their doc metadata via a single RPC call.
-- Used by Javari memory retrieval (future integration point).

CREATE OR REPLACE FUNCTION match_canonical_chunks(
  query_embedding vector(1536),
  match_threshold float   DEFAULT 0.7,
  match_count     int     DEFAULT 5,
  r2_prefix       text    DEFAULT NULL  -- optional: filter by R2 key prefix
)
RETURNS TABLE (
  chunk_id    uuid,
  doc_id      uuid,
  r2_key      text,
  doc_title   text,
  chunk_index int,
  chunk_text  text,
  token_count int,
  similarity  float
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id                                                 AS chunk_id,
    c.doc_id,
    d.r2_key,
    d.doc_title,
    c.chunk_index,
    c.chunk_text,
    c.token_count,
    1 - (c.embedding <=> query_embedding)               AS similarity
  FROM canonical_doc_chunks c
  JOIN canonical_docs d ON d.id = c.doc_id
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (r2_prefix IS NULL OR d.r2_key LIKE r2_prefix || '%')
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── Rollback instructions (comment — never auto-executed) ─────────────────────
-- To fully roll back this migration:
--   DROP FUNCTION IF EXISTS match_canonical_chunks;
--   DROP TABLE IF EXISTS canonical_doc_chunks;
--   DROP TABLE IF EXISTS canonical_docs;
-- Note: pgvector extension is shared — do NOT drop it.
