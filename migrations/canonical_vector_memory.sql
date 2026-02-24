CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS canonical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  document_type TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  indexed_at TIMESTAMPTZ,
  search_vector tsvector
);

CREATE INDEX idx_canonical_documents_key ON canonical_documents(document_key);
CREATE INDEX idx_canonical_documents_source ON canonical_documents(source_type, source_path);
CREATE INDEX idx_canonical_documents_hash ON canonical_documents(content_hash);
CREATE INDEX idx_canonical_documents_status ON canonical_documents(status);
CREATE INDEX idx_canonical_documents_type ON canonical_documents(document_type);
CREATE INDEX idx_canonical_documents_metadata ON canonical_documents USING GIN(metadata);
CREATE INDEX idx_canonical_documents_search ON canonical_documents USING GIN(search_vector);
CREATE INDEX idx_canonical_documents_created ON canonical_documents(created_at DESC);

CREATE TABLE IF NOT EXISTS canonical_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES canonical_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  section_title TEXT,
  section_path TEXT[],
  start_offset INTEGER,
  end_offset INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  search_vector tsvector,
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX idx_canonical_chunks_document ON canonical_chunks(document_id);
CREATE INDEX idx_canonical_chunks_hash ON canonical_chunks(chunk_hash);
CREATE INDEX idx_canonical_chunks_metadata ON canonical_chunks USING GIN(metadata);
CREATE INDEX idx_canonical_chunks_search ON canonical_chunks USING GIN(search_vector);
CREATE INDEX idx_canonical_chunks_section ON canonical_chunks(section_title);

CREATE TABLE IF NOT EXISTS canonical_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES canonical_chunks(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chunk_id, model)
);

CREATE INDEX idx_canonical_embeddings_chunk ON canonical_embeddings(chunk_id);
CREATE INDEX idx_canonical_embeddings_model ON canonical_embeddings(model);
CREATE INDEX idx_canonical_embeddings_vector ON canonical_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS canonical_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL,
  node_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  source_document_id UUID REFERENCES canonical_documents(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES canonical_chunks(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canonical_nodes_type ON canonical_graph_nodes(node_type);
CREATE INDEX idx_canonical_nodes_key ON canonical_graph_nodes(node_key);
CREATE INDEX idx_canonical_nodes_label ON canonical_graph_nodes(label);
CREATE INDEX idx_canonical_nodes_properties ON canonical_graph_nodes USING GIN(properties);
CREATE INDEX idx_canonical_nodes_source_doc ON canonical_graph_nodes(source_document_id);
CREATE INDEX idx_canonical_nodes_source_chunk ON canonical_graph_nodes(source_chunk_id);

CREATE TABLE IF NOT EXISTS canonical_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID NOT NULL REFERENCES canonical_graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES canonical_graph_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  properties JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_node_id, target_node_id, edge_type)
);

CREATE INDEX idx_canonical_edges_source ON canonical_graph_edges(source_node_id);
CREATE INDEX idx_canonical_edges_target ON canonical_graph_edges(target_node_id);
CREATE INDEX idx_canonical_edges_type ON canonical_graph_edges(edge_type);
CREATE INDEX idx_canonical_edges_weight ON canonical_graph_edges(weight DESC);
CREATE INDEX idx_canonical_edges_properties ON canonical_graph_edges USING GIN(properties);
CREATE INDEX idx_canonical_edges_bidirectional ON canonical_graph_edges(source_node_id, target_node_id);

CREATE TABLE IF NOT EXISTS canonical_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_key TEXT NOT NULL UNIQUE,
  metadata_value JSONB NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canonical_metadata_key ON canonical_metadata(metadata_key);
CREATE INDEX idx_canonical_metadata_value ON canonical_metadata USING GIN(metadata_value);

CREATE TABLE IF NOT EXISTS canonical_chunk_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  chunk_id UUID NOT NULL REFERENCES canonical_chunks(id) ON DELETE CASCADE,
  term_frequency INTEGER DEFAULT 1,
  document_id UUID NOT NULL REFERENCES canonical_documents(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(term, chunk_id)
);

CREATE INDEX idx_canonical_index_term ON canonical_chunk_index(term);
CREATE INDEX idx_canonical_index_chunk ON canonical_chunk_index(chunk_id);
CREATE INDEX idx_canonical_index_document ON canonical_chunk_index(document_id);
CREATE INDEX idx_canonical_index_frequency ON canonical_chunk_index(term_frequency DESC);
CREATE INDEX idx_canonical_index_term_trgm ON canonical_chunk_index USING GIN(term gin_trgm_ops);

CREATE OR REPLACE FUNCTION update_canonical_documents_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.raw_content, ''));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_canonical_chunks_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.section_title, '') || ' ' || COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_canonical_nodes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_canonical_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_canonical_documents_search_vector
  BEFORE INSERT OR UPDATE ON canonical_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_documents_search_vector();

CREATE TRIGGER trg_canonical_chunks_search_vector
  BEFORE INSERT OR UPDATE ON canonical_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_chunks_search_vector();

CREATE TRIGGER trg_canonical_nodes_timestamp
  BEFORE UPDATE ON canonical_graph_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_nodes_timestamp();

CREATE TRIGGER trg_canonical_metadata_timestamp
  BEFORE UPDATE ON canonical_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_metadata_timestamp();

CREATE OR REPLACE FUNCTION search_canonical_chunks_by_embedding(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  chunk_text TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id AS chunk_id,
    cc.document_id,
    cc.chunk_text,
    1 - (ce.embedding <=> query_embedding) AS similarity,
    cc.metadata
  FROM canonical_embeddings ce
  JOIN canonical_chunks cc ON ce.chunk_id = cc.id
  WHERE 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_canonical_documents_by_text(
  search_query TEXT,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  document_id UUID,
  title TEXT,
  rank FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.id AS document_id,
    cd.title,
    ts_rank(cd.search_vector, plainto_tsquery('english', search_query)) AS rank,
    cd.metadata
  FROM canonical_documents cd
  WHERE cd.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_connected_nodes(
  start_node_id UUID,
  max_depth INTEGER DEFAULT 3
)
RETURNS TABLE (
  node_id UUID,
  node_type TEXT,
  label TEXT,
  depth INTEGER,
  path UUID[]
) AS $$
WITH RECURSIVE node_traversal AS (
  SELECT
    gn.id AS node_id,
    gn.node_type,
    gn.label,
    0 AS depth,
    ARRAY[gn.id] AS path
  FROM canonical_graph_nodes gn
  WHERE gn.id = start_node_id
  
  UNION ALL
  
  SELECT
    gn.id,
    gn.node_type,
    gn.label,
    nt.depth + 1,
    nt.path || gn.id
  FROM node_traversal nt
  JOIN canonical_graph_edges ge ON ge.source_node_id = nt.node_id
  JOIN canonical_graph_nodes gn ON gn.id = ge.target_node_id
  WHERE nt.depth < max_depth
    AND NOT gn.id = ANY(nt.path)
)
SELECT * FROM node_traversal;
$$ LANGUAGE sql;
