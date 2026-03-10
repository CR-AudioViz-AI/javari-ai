-- supabase/migrations/20260310_canonical_ecosystem_tables.sql
-- Purpose: Create canonical_documents (Step 2), knowledge_graph_nodes/edges (Step 3)
--          tables for full ecosystem ingestion pipeline.
--          Idempotent — safe to run multiple times.
-- Date: 2026-03-10

-- ── 1. canonical_documents ────────────────────────────────────────────────────
-- Primary vector store for ingested R2 corpus chunks.
-- Matches Step 2 schema: id, title, source, chunk_index, content, embedding, created_at

CREATE TABLE IF NOT EXISTS canonical_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  source      TEXT        NOT NULL,                  -- R2 key / file path
  chunk_index INTEGER     NOT NULL DEFAULT 0,
  content     TEXT        NOT NULL,
  content_hash TEXT       NOT NULL DEFAULT '',       -- SHA-256 of content
  embedding   JSONB,                                 -- float[] stored as JSON array
  doc_type    TEXT        DEFAULT 'markdown',
  token_count INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_canonical_documents_source
  ON canonical_documents(source);
CREATE INDEX IF NOT EXISTS idx_canonical_documents_title
  ON canonical_documents(title);
CREATE INDEX IF NOT EXISTS idx_canonical_documents_created
  ON canonical_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_documents_hash
  ON canonical_documents(content_hash);

-- Grant service_role full access
ALTER TABLE canonical_documents DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE canonical_documents TO service_role;
GRANT SELECT ON TABLE canonical_documents TO authenticated;
GRANT SELECT ON TABLE canonical_documents TO anon;

-- ── 2. knowledge_graph_nodes ──────────────────────────────────────────────────
-- Platform components extracted from canonical corpus.

CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type   TEXT        NOT NULL,  -- platform_component | service | application | integration | infrastructure | workflow
  name        TEXT        NOT NULL,
  description TEXT,
  source_doc  TEXT,                  -- R2 key this node was extracted from
  metadata    JSONB       DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(node_type, name)
);

CREATE INDEX IF NOT EXISTS idx_kgn_type   ON knowledge_graph_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_kgn_name   ON knowledge_graph_nodes(name);
CREATE INDEX IF NOT EXISTS idx_kgn_source ON knowledge_graph_nodes(source_doc);

ALTER TABLE knowledge_graph_nodes DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE knowledge_graph_nodes TO service_role;
GRANT SELECT ON TABLE knowledge_graph_nodes TO authenticated;
GRANT SELECT ON TABLE knowledge_graph_nodes TO anon;

-- ── 3. knowledge_graph_edges ──────────────────────────────────────────────────
-- Relationships between platform components.

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id    UUID        NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  to_node_id      UUID        NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  relationship    TEXT        NOT NULL,  -- depends_on | integrates_with | extends | contains | requires
  weight          FLOAT       DEFAULT 1.0,
  metadata        JSONB       DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_node_id, to_node_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_kge_from ON knowledge_graph_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_kge_to   ON knowledge_graph_edges(to_node_id);

ALTER TABLE knowledge_graph_edges DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE knowledge_graph_edges TO service_role;
GRANT SELECT ON TABLE knowledge_graph_edges TO authenticated;
GRANT SELECT ON TABLE knowledge_graph_edges TO anon;

-- ── 4. canonical_ingest_runs ──────────────────────────────────────────────────
-- Audit log of every ingestion run.

CREATE TABLE IF NOT EXISTS canonical_ingest_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type        TEXT        NOT NULL DEFAULT 'r2_full',
  docs_found      INTEGER     DEFAULT 0,
  docs_ingested   INTEGER     DEFAULT 0,
  chunks_created  INTEGER     DEFAULT 0,
  nodes_created   INTEGER     DEFAULT 0,
  tasks_generated INTEGER     DEFAULT 0,
  status          TEXT        DEFAULT 'running',  -- running | completed | failed
  error           TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

ALTER TABLE canonical_ingest_runs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE canonical_ingest_runs TO service_role;
GRANT SELECT ON TABLE canonical_ingest_runs TO authenticated;
