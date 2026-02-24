-- supabase/migrations/20260222_canonical_vector_memory.sql
-- CR AudioViz AI — Canonical Document Vector Memory
-- 2026-02-22 PART 1 — DB schema only. Additive. No existing tables touched.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS canonical_doc_chunks;
--   DROP TABLE IF EXISTS canonical_docs;
--   (Do NOT drop the vector extension — it is shared platform-wide.)

-- ─── pgvector ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── canonical_docs ──────────────────────────────────────────────────────────
-- One row per (r2_key, version) pair.
-- Stores metadata + content hash only — R2 is the source of truth for content.

CREATE TABLE IF NOT EXISTS canonical_docs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  r2_key     text        NOT NULL,
  version    text        NOT NULL,
  sha256     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (r2_key, version)
);

ALTER TABLE canonical_docs ENABLE ROW LEVEL SECURITY;

-- Service role: full access. No anon/authenticated access.
CREATE POLICY "canonical_docs_service_role_only"
  ON canonical_docs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── canonical_doc_chunks ────────────────────────────────────────────────────
-- One row per text chunk. embedding vector is 1536-dim (text-embedding-3-small).
-- chunk_text stored here for retrieval context — not a full document copy.

CREATE TABLE IF NOT EXISTS canonical_doc_chunks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      uuid        NOT NULL REFERENCES canonical_docs (id) ON DELETE CASCADE,
  chunk_index int         NOT NULL,
  chunk_text  text        NOT NULL,
  token_count int         NOT NULL,
  embedding   vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast doc-level lookups
CREATE INDEX IF NOT EXISTS canonical_doc_chunks_doc_id_idx
  ON canonical_doc_chunks (doc_id);

-- Approximate nearest-neighbour search (cosine similarity)
-- ivfflat with lists=100 is suitable for up to ~1 M rows.
-- Rebuild with higher lists value if chunk count exceeds 1 M.
CREATE INDEX IF NOT EXISTS canonical_doc_chunks_embedding_idx
  ON canonical_doc_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE canonical_doc_chunks ENABLE ROW LEVEL SECURITY;

-- Service role: full access. No anon/authenticated access.
CREATE POLICY "canonical_doc_chunks_service_role_only"
  ON canonical_doc_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
