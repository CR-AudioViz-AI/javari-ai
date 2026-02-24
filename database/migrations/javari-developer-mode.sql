-- JAVARI DEVELOPER MODE DATABASE SCHEMA
-- Created: October 30, 2025
-- Purpose: Enable autonomous code generation, GitHub commits, and deployment tracking

-- =============================================================================
-- TABLE 1: JAVARI GENERATIONS
-- Tracks all code generation requests and results
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Request Details
  component_type TEXT NOT NULL, -- 'component', 'api', 'schema', 'page', 'util'
  description TEXT NOT NULL,
  requirements JSONB, -- Detailed requirements object
  
  -- Generation Results
  generated_code TEXT,
  file_path TEXT,
  file_name TEXT,
  lines_of_code INTEGER,
  
  -- Quality Metrics
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  has_typescript BOOLEAN DEFAULT true,
  has_error_handling BOOLEAN DEFAULT false,
  has_accessibility BOOLEAN DEFAULT false,
  has_tests BOOLEAN DEFAULT false,
  issues JSONB DEFAULT '[]'::jsonb,
  
  -- AI Provider Details
  provider TEXT DEFAULT 'openai',
  model TEXT DEFAULT 'gpt-4',
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 4),
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'generated', 'committed', 'deployed', 'failed'
  error_message TEXT,
  
  -- GitHub Integration
  commit_sha TEXT,
  commit_url TEXT,
  branch TEXT DEFAULT 'main',
  
  -- Vercel Integration
  deployment_id TEXT,
  deployment_url TEXT,
  deployment_status TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_javari_generations_user_id ON javari_generations(user_id);
CREATE INDEX idx_javari_generations_status ON javari_generations(status);
CREATE INDEX idx_javari_generations_created_at ON javari_generations(created_at DESC);
CREATE INDEX idx_javari_generations_component_type ON javari_generations(component_type);

-- Row Level Security
ALTER TABLE javari_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations" ON javari_generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create generations" ON javari_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generations" ON javari_generations
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- TABLE 2: JAVARI KNOWLEDGE
-- Stores knowledge base for context-aware code generation
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL, -- 'bible', 'codebase', 'company', 'technical', 'brand'
  subcategory TEXT,
  
  -- Metadata
  source TEXT, -- Where this knowledge came from
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Vector Embeddings (for semantic search)
  embedding VECTOR(1536), -- OpenAI ada-002 embedding size
  
  -- Usage Tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  
  -- Version Control
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_javari_knowledge_category ON javari_knowledge(category);
CREATE INDEX idx_javari_knowledge_tags ON javari_knowledge USING GIN(tags);
CREATE INDEX idx_javari_knowledge_priority ON javari_knowledge(priority DESC);
CREATE INDEX idx_javari_knowledge_is_active ON javari_knowledge(is_active);

-- Vector similarity search index
CREATE INDEX idx_javari_knowledge_embedding ON javari_knowledge 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- TABLE 3: JAVARI FILES
-- Tracks all generated files and their relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES javari_generations(id) ON DELETE CASCADE,
  
  -- File Details
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'tsx', 'ts', 'sql', 'json', 'md'
  file_size_bytes INTEGER,
  
  -- Content
  content TEXT NOT NULL,
  content_hash TEXT, -- SHA-256 hash for deduplication
  
  -- Relationships
  imports JSONB DEFAULT '[]'::jsonb, -- Array of imported files
  exports JSONB DEFAULT '[]'::jsonb, -- Array of exported items
  dependencies JSONB DEFAULT '[]'::jsonb, -- npm packages used
  
  -- Status
  is_deployed BOOLEAN DEFAULT false,
  deployment_status TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_javari_files_generation_id ON javari_files(generation_id);
CREATE INDEX idx_javari_files_file_path ON javari_files(file_path);
CREATE INDEX idx_javari_files_is_deployed ON javari_files(is_deployed);
CREATE UNIQUE INDEX idx_javari_files_content_hash ON javari_files(content_hash);

-- =============================================================================
-- TABLE 4: JAVARI DEPLOYMENTS
-- Tracks Vercel deployments triggered by Javari
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES javari_generations(id) ON DELETE CASCADE,
  
  -- Vercel Details
  deployment_id TEXT NOT NULL UNIQUE,
  deployment_url TEXT NOT NULL,
  project_id TEXT NOT NULL,
  
  -- Build Details
  build_status TEXT DEFAULT 'pending', -- 'pending', 'building', 'ready', 'error', 'canceled'
  build_duration_ms INTEGER,
  build_logs TEXT,
  
  -- Environment
  environment TEXT DEFAULT 'preview', -- 'preview', 'production'
  branch TEXT DEFAULT 'main',
  commit_sha TEXT,
  
  -- Metrics
  page_load_time_ms INTEGER,
  lighthouse_score INTEGER CHECK (lighthouse_score BETWEEN 0 AND 100),
  
  -- Error Tracking
  error_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ready_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_javari_deployments_generation_id ON javari_deployments(generation_id);
CREATE INDEX idx_javari_deployments_status ON javari_deployments(build_status);
CREATE INDEX idx_javari_deployments_created_at ON javari_deployments(created_at DESC);

-- =============================================================================
-- TABLE 5: JAVARI LEARNING LOG
-- Tracks patterns and learns from every interaction
-- =============================================================================

CREATE TABLE IF NOT EXISTS javari_learning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pattern Detection
  pattern_type TEXT NOT NULL, -- 'request', 'error', 'success', 'optimization'
  pattern_data JSONB NOT NULL,
  
  -- Context
  component_type TEXT,
  user_experience_level TEXT, -- 'beginner', 'intermediate', 'advanced'
  
  -- Learning
  lesson_learned TEXT,
  suggested_improvement TEXT,
  confidence_score DECIMAL(3, 2) CHECK (confidence_score BETWEEN 0 AND 1),
  
  -- Implementation
  is_implemented BOOLEAN DEFAULT false,
  implementation_notes TEXT,
  
  -- Impact
  impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 10),
  occurrences INTEGER DEFAULT 1,
  
  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  implemented_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_javari_learning_pattern_type ON javari_learning_log(pattern_type);
CREATE INDEX idx_javari_learning_is_implemented ON javari_learning_log(is_implemented);
CREATE INDEX idx_javari_learning_impact ON javari_learning_log(impact_score DESC);
CREATE INDEX idx_javari_learning_occurrences ON javari_learning_log(occurrences DESC);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_javari_generations_updated_at 
  BEFORE UPDATE ON javari_generations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_javari_knowledge_updated_at 
  BEFORE UPDATE ON javari_knowledge 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_javari_files_updated_at 
  BEFORE UPDATE ON javari_files 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Track knowledge access
CREATE OR REPLACE FUNCTION track_knowledge_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE javari_knowledge 
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INITIAL DATA SEEDING (Optional)
-- =============================================================================

-- Seed some basic knowledge categories
INSERT INTO javari_knowledge (title, content, category, subcategory, priority) VALUES
('Component Standards', 'All React components must use TypeScript, include prop types, have error boundaries, and follow accessibility guidelines (WCAG 2.2 AA).', 'technical', 'standards', 10),
('API Route Standards', 'All API routes must include try-catch error handling, rate limiting, authentication checks, and proper HTTP status codes.', 'technical', 'standards', 10),
('Database Standards', 'All database schemas must include Row Level Security policies, proper indexes, foreign key constraints, and timestamps.', 'technical', 'standards', 10),
('Company Mission', 'Your Story. Our Design. - CR AudioViz AI democratizes professional creative tools through AI-powered automation.', 'company', 'mission', 9),
('Brand Colors', 'Primary: Navy #002B5B, Red #FD201D, Cyan #00BCD4. Use consistently across all interfaces.', 'brand', 'colors', 8)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SCHEMA COMPLETE
-- =============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Javari Developer Mode Database Schema Created Successfully!';
  RAISE NOTICE '📊 Tables: 5 (generations, knowledge, files, deployments, learning_log)';
  RAISE NOTICE '🔒 Row Level Security: Enabled on all user tables';
  RAISE NOTICE '⚡ Indexes: Optimized for performance';
  RAISE NOTICE '🚀 Ready for autonomous code generation!';
END $$;
