-- Migration: javari_embeddings
-- Purpose: Store R2 Canonical document embeddings for semantic memory retrieval
-- Timestamp: 2026-02-18 EST
-- Requires: pgvector extension (enabled in Supabase dashboard under Database > Extensions)

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the embeddings table
CREATE TABLE IF NOT EXISTS javari_embeddings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id      TEXT NOT NULL,              -- R2 document ID (e.g. "R2-070")
  chunk_id    TEXT NOT NULL,              -- Chunk identifier within document
  text        TEXT NOT NULL,              -- Raw text of the chunk
  embedding_vector vector(1536),          -- OpenAI text-embedding-3-small output
  metadata    JSONB DEFAULT '{}'::jsonb, -- Optional: title, source URL, etc.
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doc_id, chunk_id)
);

-- Index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_javari_embeddings_vector
  ON javari_embeddings
  USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);

-- Index for doc_id lookups
CREATE INDEX IF NOT EXISTS idx_javari_embeddings_doc_id
  ON javari_embeddings (doc_id);

-- RPC function for similarity search (cosine distance)
CREATE OR REPLACE FUNCTION search_javari_memory(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  doc_id TEXT,
  chunk_id TEXT,
  text TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    je.id,
    je.doc_id,
    je.chunk_id,
    je.text,
    je.metadata,
    1 - (je.embedding_vector <=> query_embedding) AS similarity
  FROM javari_embeddings je
  WHERE 1 - (je.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY je.embedding_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RLS: Server-side reads only (service role key required for writes)
ALTER TABLE javari_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "javari_embeddings_service_read"
  ON javari_embeddings
  FOR SELECT
  USING (true);

COMMENT ON TABLE javari_embeddings IS
  'R2 Canonical document embeddings for Javari AI semantic memory retrieval';
