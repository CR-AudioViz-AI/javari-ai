-- =============================================================================
-- JAVARI PHASE 1 MIGRATION: KNOWLEDGE + DECISIONS TABLES
-- =============================================================================
-- Migration: 20260108_javari_phase1_knowledge_brain.sql
-- Created: January 8, 2026 - 11:20 AM EST
-- Purpose: Create tables for Javari's knowledge ingestion and decision tracking
-- =============================================================================

-- =============================================================================
-- TABLE: javari_knowledge_items
-- Stores all ingested knowledge with full provenance
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_type TEXT NOT NULL CHECK (source_type IN ('chat', 'doc', 'repo', 'api', 'web')),
  source_name TEXT NOT NULL,
  source_url TEXT,
  license_url TEXT,
  
  -- Content storage
  content_json JSONB,
  content_text TEXT,
  content_hash TEXT NOT NULL UNIQUE,
  
  -- Classification
  tags TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON javari_knowledge_items(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_source_name ON javari_knowledge_items(source_name);
CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash ON javari_knowledge_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON javari_knowledge_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_created_at ON javari_knowledge_items(created_at DESC);

-- Full-text search index on content_text
CREATE INDEX IF NOT EXISTS idx_knowledge_content_fts 
  ON javari_knowledge_items 
  USING GIN(to_tsvector('english', COALESCE(content_text, '')));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_knowledge_updated_at ON javari_knowledge_items;
CREATE TRIGGER trigger_knowledge_updated_at
  BEFORE UPDATE ON javari_knowledge_items
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_updated_at();

-- =============================================================================
-- TABLE: javari_decisions
-- Tracks all decisions made by Javari for learning and accountability
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relation to knowledge items (optional)
  related_item_id UUID REFERENCES javari_knowledge_items(id) ON DELETE SET NULL,
  
  -- Decision details
  decision TEXT NOT NULL,
  adopted BOOLEAN NOT NULL,
  rationale TEXT NOT NULL,
  links TEXT[] DEFAULT '{}',
  
  -- Classification
  category TEXT,
  impact_level TEXT NOT NULL DEFAULT 'medium' 
    CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Additional context
  context JSONB DEFAULT '{}',
  
  -- Outcome tracking
  outcome TEXT,
  outcome_recorded_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decisions_adopted ON javari_decisions(adopted);
CREATE INDEX IF NOT EXISTS idx_decisions_category ON javari_decisions(category);
CREATE INDEX IF NOT EXISTS idx_decisions_impact ON javari_decisions(impact_level);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON javari_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_related_item ON javari_decisions(related_item_id);

-- =============================================================================
-- TABLE: javari_ingestion_logs
-- Audit trail for all ingestion attempts (success, failure, duplicate)
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ingestion details
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('success', 'rejected', 'duplicate', 'error')),
  reason TEXT,
  
  -- Content reference
  content_hash TEXT,
  
  -- Who/what triggered the ingestion
  ingested_by TEXT NOT NULL DEFAULT 'api'
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_timestamp ON javari_ingestion_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status ON javari_ingestion_logs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_source ON javari_ingestion_logs(source_name);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE javari_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_ingestion_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for API operations)
CREATE POLICY "Service role full access on knowledge" 
  ON javari_knowledge_items 
  FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on decisions" 
  ON javari_decisions 
  FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on ingestion_logs" 
  ON javari_ingestion_logs 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Policy: Authenticated users can read (for dashboard viewing)
CREATE POLICY "Authenticated read on knowledge" 
  ON javari_knowledge_items 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated read on decisions" 
  ON javari_decisions 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to search knowledge items with full-text search
CREATE OR REPLACE FUNCTION search_knowledge(
  search_query TEXT,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_name TEXT,
  source_url TEXT,
  snippet TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.id,
    k.source_type,
    k.source_name,
    k.source_url,
    substring(k.content_text FROM 1 FOR 300) AS snippet,
    k.tags,
    k.created_at,
    ts_rank(to_tsvector('english', COALESCE(k.content_text, '')), plainto_tsquery('english', search_query)) AS rank
  FROM javari_knowledge_items k
  WHERE to_tsvector('english', COALESCE(k.content_text, '')) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get decision statistics
CREATE OR REPLACE FUNCTION get_decision_stats()
RETURNS TABLE (
  total_decisions BIGINT,
  adopted_count BIGINT,
  rejected_count BIGINT,
  with_outcomes BIGINT,
  by_category JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_decisions,
    COUNT(*) FILTER (WHERE adopted = true)::BIGINT AS adopted_count,
    COUNT(*) FILTER (WHERE adopted = false)::BIGINT AS rejected_count,
    COUNT(*) FILTER (WHERE outcome IS NOT NULL)::BIGINT AS with_outcomes,
    (
      SELECT jsonb_object_agg(COALESCE(category, 'uncategorized'), cnt)
      FROM (
        SELECT category, COUNT(*)::BIGINT as cnt
        FROM javari_decisions
        GROUP BY category
      ) sub
    ) AS by_category
  FROM javari_decisions;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE javari_knowledge_items IS 'Stores all ingested knowledge with full provenance tracking';
COMMENT ON TABLE javari_decisions IS 'Tracks all decisions made by Javari for learning and accountability';
COMMENT ON TABLE javari_ingestion_logs IS 'Audit trail for all knowledge ingestion attempts';

COMMENT ON COLUMN javari_knowledge_items.content_hash IS 'SHA-256 hash for deduplication';
COMMENT ON COLUMN javari_knowledge_items.license_url IS 'Legal basis for using this content';
COMMENT ON COLUMN javari_decisions.impact_level IS 'low/medium/high/critical - importance of decision';
COMMENT ON COLUMN javari_decisions.outcome IS 'What actually happened after the decision (filled in later)';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
