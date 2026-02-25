-- supabase/migrations/20260225_canonical_search_function.sql
-- Canonical Vector Search RPC Function
-- Optimized pgvector search with cosine similarity

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS search_canonical_chunks(vector(1536), int);

-- Create search function
CREATE OR REPLACE FUNCTION search_canonical_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  doc_id uuid,
  doc_key text,
  chunk_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.doc_id,
    d.r2_key AS doc_key,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM canonical_doc_chunks c
  JOIN canonical_docs d ON c.doc_id = d.id
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated and service role
GRANT EXECUTE ON FUNCTION search_canonical_chunks(vector(1536), int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_canonical_chunks(vector(1536), int) TO service_role;

-- Add comment
COMMENT ON FUNCTION search_canonical_chunks IS 'Search canonical documentation chunks using pgvector cosine similarity. Returns top N matches with similarity scores.';
