-- ============================================================================
-- JAVARI AI BUILDER ENHANCEMENT - DATABASE SCHEMA
-- ============================================================================
-- Version: 1.0.0
-- Created: 2025-11-14
-- Author: CR AudioViz AI, LLC
--
-- This schema adds tables to support Javari's builder capabilities:
-- - javari_builds: Track all build requests and results
-- - javari_knowledge_base: Store learned knowledge from various sources
-- - javari_learning_feedback: Track user feedback for continuous improvement
-- ============================================================================

-- ============================================================================
-- TABLE: javari_builds
-- Stores all build requests and their outcomes
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL UNIQUE,
  task_type TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB DEFAULT '[]'::jsonb,
  
  -- Execution details
  success BOOLEAN NOT NULL DEFAULT FALSE,
  ai_provider TEXT, -- 'openai', 'claude', 'gemini', 'perplexity'
  ai_model TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  execution_time_ms INTEGER,
  
  -- Results
  files_generated INTEGER DEFAULT 0,
  repo_url TEXT,
  deployment_url TEXT,
  documentation TEXT,
  next_steps JSONB DEFAULT '[]'::jsonb,
  
  -- Error tracking
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  quality_level TEXT DEFAULT 'balanced', -- 'fast', 'balanced', 'premium'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_javari_builds_user_id ON javari_builds(user_id);
CREATE INDEX IF NOT EXISTS idx_javari_builds_task_type ON javari_builds(task_type);
CREATE INDEX IF NOT EXISTS idx_javari_builds_created_at ON javari_builds(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_javari_builds_success ON javari_builds(success);
CREATE INDEX IF NOT EXISTS idx_javari_builds_ai_provider ON javari_builds(ai_provider);

-- Row Level Security
ALTER TABLE javari_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own builds"
  ON javari_builds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own builds"
  ON javari_builds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE: javari_knowledge_base
-- Stores knowledge Javari learns from documentation, web, interactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source information
  source_type TEXT NOT NULL, -- 'documentation', 'web', 'interaction', 'api_docs'
  source_url TEXT,
  source_title TEXT,
  
  -- Content
  content TEXT NOT NULL,
  content_type TEXT, -- 'code', 'text', 'tutorial', 'reference'
  language TEXT, -- Programming language if applicable
  framework TEXT, -- Framework name if applicable
  topic TEXT, -- General topic category
  
  -- Search optimization
  embedding VECTOR(1536), -- For semantic search (requires pgvector extension)
  keywords TEXT[], -- Array of keywords for quick filtering
  
  -- Quality metrics
  quality_score DECIMAL(3, 2) DEFAULT 0.50, -- 0.00 to 1.00
  usage_count INTEGER DEFAULT 0, -- How many times this knowledge was used
  success_rate DECIMAL(3, 2) DEFAULT 0.50, -- Success rate when used
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_source_type ON javari_knowledge_base(source_type);
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_language ON javari_knowledge_base(language);
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_framework ON javari_knowledge_base(framework);
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_topic ON javari_knowledge_base(topic);
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_quality ON javari_knowledge_base(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_keywords ON javari_knowledge_base USING GIN(keywords);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_content_fts 
  ON javari_knowledge_base USING GIN(to_tsvector('english', content));

-- Vector similarity search index (requires pgvector)
-- CREATE INDEX IF NOT EXISTS idx_javari_knowledge_embedding 
--   ON javari_knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Row Level Security
ALTER TABLE javari_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read knowledge
CREATE POLICY "Anyone can read knowledge"
  ON javari_knowledge_base FOR SELECT
  USING (true);

-- Only service role can insert/update knowledge
CREATE POLICY "Service role can manage knowledge"
  ON javari_knowledge_base FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- TABLE: javari_learning_feedback
-- Tracks user feedback on builds for continuous improvement
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES javari_builds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 stars
  helpful BOOLEAN,
  accurate BOOLEAN,
  complete BOOLEAN,
  
  -- Detailed feedback
  what_worked TEXT,
  what_didnt_work TEXT,
  suggestions TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_javari_feedback_build_id ON javari_learning_feedback(build_id);
CREATE INDEX IF NOT EXISTS idx_javari_feedback_user_id ON javari_learning_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_javari_feedback_rating ON javari_learning_feedback(rating);

-- Row Level Security
ALTER TABLE javari_learning_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON javari_learning_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON javari_learning_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE: javari_task_routes
-- Stores optimal AI provider routing decisions learned over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS javari_task_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  complexity_level TEXT, -- 'simple', 'medium', 'complex'
  
  -- Routing decision
  ai_provider TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  
  -- Performance metrics
  avg_execution_time_ms INTEGER,
  avg_cost_usd DECIMAL(10, 6),
  avg_quality_score DECIMAL(3, 2),
  success_rate DECIMAL(3, 2),
  usage_count INTEGER DEFAULT 1,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_javari_routes_task_type ON javari_task_routes(task_type);
CREATE INDEX IF NOT EXISTS idx_javari_routes_success_rate ON javari_task_routes(success_rate DESC);

-- Row Level Security
ALTER TABLE javari_task_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read routes"
  ON javari_task_routes FOR SELECT
  USING (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update knowledge quality based on usage
CREATE OR REPLACE FUNCTION update_knowledge_quality()
RETURNS TRIGGER AS $$
BEGIN
  -- Update quality score based on success rate and usage
  NEW.quality_score = LEAST(1.0, GREATEST(0.0, 
    (NEW.success_rate * 0.7) + ((NEW.usage_count::DECIMAL / 100.0) * 0.3)
  ));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_knowledge_quality
  BEFORE UPDATE ON javari_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_quality();

-- Function to update task routes based on builds
CREATE OR REPLACE FUNCTION update_task_routes()
RETURNS TRIGGER AS $$
DECLARE
  route_record RECORD;
BEGIN
  -- Only process successful builds
  IF NEW.success = TRUE THEN
    -- Check if route exists
    SELECT * INTO route_record
    FROM javari_task_routes
    WHERE task_type = NEW.task_type
      AND ai_provider = NEW.ai_provider
      AND ai_model = NEW.ai_model;
    
    IF FOUND THEN
      -- Update existing route
      UPDATE javari_task_routes
      SET 
        usage_count = usage_count + 1,
        avg_execution_time_ms = ((avg_execution_time_ms * usage_count) + NEW.execution_time_ms) / (usage_count + 1),
        avg_cost_usd = ((avg_cost_usd * usage_count) + NEW.cost_usd) / (usage_count + 1),
        success_rate = ((success_rate * usage_count) + 1.0) / (usage_count + 1),
        updated_at = NOW()
      WHERE id = route_record.id;
    ELSE
      -- Insert new route
      INSERT INTO javari_task_routes (
        task_type,
        ai_provider,
        ai_model,
        avg_execution_time_ms,
        avg_cost_usd,
        success_rate
      ) VALUES (
        NEW.task_type,
        NEW.ai_provider,
        NEW.ai_model,
        NEW.execution_time_ms,
        NEW.cost_usd,
        1.0
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_routes
  AFTER INSERT ON javari_builds
  FOR EACH ROW
  EXECUTE FUNCTION update_task_routes();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Build statistics by user
CREATE OR REPLACE VIEW javari_user_build_stats AS
SELECT 
  user_id,
  COUNT(*) as total_builds,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_builds,
  ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate_pct,
  SUM(files_generated) as total_files_generated,
  SUM(cost_usd) as total_cost_usd,
  AVG(execution_time_ms) as avg_execution_time_ms,
  MAX(created_at) as last_build_at
FROM javari_builds
GROUP BY user_id;

-- View: Task type performance
CREATE OR REPLACE VIEW javari_task_performance AS
SELECT 
  task_type,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_attempts,
  ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate_pct,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(cost_usd) as avg_cost_usd,
  AVG(confidence) as avg_confidence
FROM javari_builds
GROUP BY task_type
ORDER BY total_attempts DESC;

-- View: AI provider performance
CREATE OR REPLACE VIEW javari_provider_performance AS
SELECT 
  ai_provider,
  ai_model,
  COUNT(*) as total_uses,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_uses,
  ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate_pct,
  AVG(execution_time_ms) as avg_execution_time_ms,
  AVG(cost_usd) as avg_cost_usd,
  SUM(cost_usd) as total_cost_usd
FROM javari_builds
WHERE ai_provider IS NOT NULL
GROUP BY ai_provider, ai_model
ORDER BY total_uses DESC;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON javari_builds TO authenticated;
GRANT INSERT ON javari_builds TO authenticated;
GRANT SELECT ON javari_knowledge_base TO authenticated;
GRANT SELECT, INSERT ON javari_learning_feedback TO authenticated;
GRANT SELECT ON javari_task_routes TO authenticated;

GRANT SELECT ON javari_user_build_stats TO authenticated;
GRANT SELECT ON javari_task_performance TO authenticated;
GRANT SELECT ON javari_provider_performance TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE javari_builds IS 'Tracks all build requests made to Javari AI and their outcomes';
COMMENT ON TABLE javari_knowledge_base IS 'Stores knowledge Javari learns from various sources for continuous improvement';
COMMENT ON TABLE javari_learning_feedback IS 'User feedback on builds for machine learning and improvement';
COMMENT ON TABLE javari_task_routes IS 'Learned optimal AI provider routing for different task types';

COMMENT ON COLUMN javari_builds.confidence IS 'AI confidence score in the build output (0.00 to 1.00)';
COMMENT ON COLUMN javari_knowledge_base.embedding IS 'Vector embedding for semantic search (requires pgvector extension)';
COMMENT ON COLUMN javari_knowledge_base.quality_score IS 'Computed quality score based on usage and success rate';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
