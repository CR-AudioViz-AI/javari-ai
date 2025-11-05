-- Javari AI - Learning System Database Schema
-- Created: November 4, 2025 - 7:05 PM EST
-- Enables continuous learning from multiple sources

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Javari self-answers table for storing learnings
CREATE TABLE IF NOT EXISTS javari_self_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_pattern TEXT NOT NULL,
  answer TEXT NOT NULL,
  confidence_score DECIMAL NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL NOT NULL DEFAULT 1.0 CHECK (success_rate >= 0 AND success_rate <= 1),
  source TEXT NOT NULL CHECK (source IN ('admin_dashboard', 'conversation', 'code_generation', 'web_crawl')),
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_javari_self_answers_source 
  ON javari_self_answers(source);

-- Create index on confidence_score for filtering high-quality learnings
CREATE INDEX IF NOT EXISTS idx_javari_self_answers_confidence 
  ON javari_self_answers(confidence_score DESC);

-- Create index on usage_count for finding popular learnings
CREATE INDEX IF NOT EXISTS idx_javari_self_answers_usage 
  ON javari_self_answers(usage_count DESC);

-- Create vector similarity index using ivfflat
CREATE INDEX IF NOT EXISTS javari_self_answers_embedding_idx 
  ON javari_self_answers 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_javari_learnings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  question_pattern TEXT,
  answer TEXT,
  confidence_score DECIMAL,
  usage_count INTEGER,
  success_rate DECIMAL,
  source TEXT,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    javari_self_answers.id,
    javari_self_answers.question_pattern,
    javari_self_answers.answer,
    javari_self_answers.confidence_score,
    javari_self_answers.usage_count,
    javari_self_answers.success_rate,
    javari_self_answers.source,
    javari_self_answers.embedding,
    javari_self_answers.created_at,
    javari_self_answers.updated_at,
    1 - (javari_self_answers.embedding <=> query_embedding) AS similarity
  FROM javari_self_answers
  WHERE 1 - (javari_self_answers.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Anti-patterns table for storing things that don't work
CREATE TABLE IF NOT EXISTS javari_anti_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  why_failed TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Healing history table for tracking self-healing actions
CREATE TABLE IF NOT EXISTS javari_healing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_context JSONB,
  diagnosis JSONB,
  fix_applied BOOLEAN DEFAULT FALSE,
  fix_result JSONB,
  auto_fixed BOOLEAN DEFAULT FALSE,
  escalated BOOLEAN DEFAULT FALSE,
  deployment_id TEXT,
  commit_sha TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying healing history
CREATE INDEX IF NOT EXISTS idx_javari_healing_history_created 
  ON javari_healing_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_javari_healing_history_auto_fixed 
  ON javari_healing_history(auto_fixed);

-- Web crawl tracking table
CREATE TABLE IF NOT EXISTS javari_web_crawls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ai_news', 'best_practices', 'competitor', 'grants')),
  content_summary TEXT,
  learnings_extracted INTEGER DEFAULT 0,
  last_crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on URL to prevent duplicate crawls
CREATE UNIQUE INDEX IF NOT EXISTS idx_javari_web_crawls_url 
  ON javari_web_crawls(url);

-- Comments for documentation
COMMENT ON TABLE javari_self_answers IS 'Stores learnings from conversations, code generation, admin dashboard, and web crawls';
COMMENT ON TABLE javari_anti_patterns IS 'Stores patterns that failed to help avoid them in the future';
COMMENT ON TABLE javari_healing_history IS 'Tracks all self-healing actions and their outcomes';
COMMENT ON TABLE javari_web_crawls IS 'Tracks web crawling activity and extracted learnings';

COMMENT ON COLUMN javari_self_answers.embedding IS 'Vector embedding for semantic similarity search using OpenAI text-embedding-3-small';
COMMENT ON COLUMN javari_self_answers.confidence_score IS 'Confidence in this learning (0-1), higher means more reliable';
COMMENT ON COLUMN javari_self_answers.usage_count IS 'How many times this learning has been used';
COMMENT ON COLUMN javari_self_answers.success_rate IS 'Success rate when this learning is applied (0-1)';

-- Grant necessary permissions (adjust based on your setup)
-- GRANT ALL ON javari_self_answers TO authenticated;
-- GRANT ALL ON javari_anti_patterns TO authenticated;
-- GRANT ALL ON javari_healing_history TO authenticated;
-- GRANT ALL ON javari_web_crawls TO authenticated;

-- Example seed data for testing
INSERT INTO javari_self_answers (question_pattern, answer, confidence_score, source, usage_count, success_rate) 
VALUES 
  ('Roy prefers TypeScript over JavaScript', 'Always use TypeScript for new projects. Roy values type safety and prefers strict mode.', 0.95, 'admin_dashboard', 0, 1.0),
  ('Fortune 50 quality standards', 'Build features to Fortune 50 quality standards - complete, tested, documented, and production-ready. No shortcuts.', 0.95, 'admin_dashboard', 0, 1.0),
  ('Full automation mode', 'Operate in full automation mode - no permission needed for actions, build and deploy autonomously.', 0.95, 'admin_dashboard', 0, 1.0)
ON CONFLICT DO NOTHING;

SELECT 'Javari Learning System schema created successfully!' AS status;
