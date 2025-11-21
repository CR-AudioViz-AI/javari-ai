-- Javari AI Document Storage Tables
-- Created: November 21, 2025 - 2:20 PM EST

-- Main documents table
CREATE TABLE IF NOT EXISTS javari_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bible', 'documentation', 'credentials', 'guide')),
  source TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks for RAG
CREATE TABLE IF NOT EXISTS javari_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES javari_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_javari_docs_type ON javari_documents(type);
CREATE INDEX IF NOT EXISTS idx_javari_docs_created ON javari_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_javari_chunks_doc_id ON javari_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_javari_chunks_embedding ON javari_document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE javari_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow service role full access)
CREATE POLICY "Service role can do everything on javari_documents"
  ON javari_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on javari_document_chunks"
  ON javari_document_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_javari_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_javari_documents_updated_at_trigger
BEFORE UPDATE ON javari_documents
FOR EACH ROW
EXECUTE FUNCTION update_javari_documents_updated_at();
