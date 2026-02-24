-- ============================================================
-- JAVARI AI AGGREGATION SYSTEM - DATABASE SCHEMA
-- The AI That Never Forgets Who Helped
-- Created: December 22, 2025
-- ============================================================

-- ============================================================
-- CONVERSATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  title TEXT,
  project_id TEXT,
  starred BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_javari_conversations_user ON javari_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_javari_conversations_updated ON javari_conversations(updated_at DESC);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT REFERENCES javari_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  task_type TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost DECIMAL(10, 6) DEFAULT 0,
  latency INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  feedback_score INTEGER CHECK (feedback_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_javari_messages_conversation ON javari_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_javari_messages_provider ON javari_messages(provider);
CREATE INDEX IF NOT EXISTS idx_javari_messages_created ON javari_messages(created_at DESC);

-- ============================================================
-- AI USAGE TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT,
  task_type TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost DECIMAL(10, 6) DEFAULT 0,
  latency INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  user_id TEXT,
  conversation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_javari_ai_usage_provider ON javari_ai_usage(provider);
CREATE INDEX IF NOT EXISTS idx_javari_ai_usage_task ON javari_ai_usage(task_type);
CREATE INDEX IF NOT EXISTS idx_javari_ai_usage_created ON javari_ai_usage(created_at DESC);

-- ============================================================
-- AI PERFORMANCE TRACKING (Learning System)
-- This is how Javari remembers who helped
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_ai_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  task_type TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_latency BIGINT DEFAULT 0,
  total_cost DECIMAL(12, 6) DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  avg_quality_score DECIMAL(3, 2) DEFAULT 0,
  routing_score DECIMAL(5, 2) DEFAULT 50,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, task_type)
);

CREATE INDEX IF NOT EXISTS idx_javari_ai_performance_provider ON javari_ai_performance(provider);
CREATE INDEX IF NOT EXISTS idx_javari_ai_performance_score ON javari_ai_performance(routing_score DESC);

-- ============================================================
-- KNOWLEDGE BASE
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  confidence_score DECIMAL(3, 2) DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  embedding VECTOR(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_javari_knowledge_category ON javari_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_javari_knowledge_topic ON javari_knowledge(topic);

-- ============================================================
-- SELF-HEALING LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_self_healing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type TEXT NOT NULL,
  issue_description TEXT,
  primary_provider TEXT,
  fallback_provider TEXT,
  resolution TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEARNING QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_javari_learning_queue_unprocessed 
  ON javari_learning_queue(processed, priority DESC) 
  WHERE processed = FALSE;

-- ============================================================
-- USER PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS javari_user_preferences (
  user_id TEXT PRIMARY KEY,
  preferred_provider TEXT,
  prefer_speed BOOLEAN DEFAULT FALSE,
  prefer_cost BOOLEAN DEFAULT FALSE,
  prefer_quality BOOLEAN DEFAULT TRUE,
  response_style TEXT DEFAULT 'balanced',
  max_tokens INTEGER DEFAULT 4096,
  temperature DECIMAL(2, 1) DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VIEWS FOR ANALYTICS
-- ============================================================

CREATE OR REPLACE VIEW javari_provider_leaderboard AS
SELECT 
  provider,
  SUM(success_count) as total_successes,
  SUM(failure_count) as total_failures,
  ROUND(SUM(success_count)::DECIMAL / NULLIF(SUM(success_count) + SUM(failure_count), 0) * 100, 2) as success_rate,
  ROUND(AVG(avg_quality_score), 2) as avg_quality,
  ROUND(SUM(total_cost), 4) as total_cost,
  ROUND(AVG(routing_score), 2) as avg_routing_score
FROM javari_ai_performance
GROUP BY provider
ORDER BY avg_routing_score DESC;

CREATE OR REPLACE VIEW javari_task_routing_stats AS
SELECT 
  task_type,
  provider,
  success_count,
  failure_count,
  ROUND(success_count::DECIMAL / NULLIF(success_count + failure_count, 0) * 100, 2) as success_rate,
  routing_score
FROM javari_ai_performance
ORDER BY task_type, routing_score DESC;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update routing score after each interaction
CREATE OR REPLACE FUNCTION update_routing_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate new routing score based on success rate and quality
  UPDATE javari_ai_performance
  SET routing_score = (
    (success_count::DECIMAL / NULLIF(success_count + failure_count, 0) * 100) * 0.6 +
    avg_quality_score * 20 * 0.4
  ),
  updated_at = NOW()
  WHERE provider = NEW.provider AND task_type = NEW.task_type;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update routing score
DROP TRIGGER IF EXISTS trg_update_routing_score ON javari_ai_performance;
CREATE TRIGGER trg_update_routing_score
AFTER UPDATE ON javari_ai_performance
FOR EACH ROW
EXECUTE FUNCTION update_routing_score();

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE javari_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_ai_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_knowledge ENABLE ROW LEVEL SECURITY;

-- Public read access for knowledge base
CREATE POLICY "Public read knowledge" ON javari_knowledge
  FOR SELECT USING (true);

-- Service role full access (for API)
CREATE POLICY "Service role full access conversations" ON javari_conversations
  FOR ALL USING (true);

CREATE POLICY "Service role full access messages" ON javari_messages
  FOR ALL USING (true);

CREATE POLICY "Service role full access usage" ON javari_ai_usage
  FOR ALL USING (true);

CREATE POLICY "Service role full access performance" ON javari_ai_performance
  FOR ALL USING (true);

-- ============================================================
-- SEED DATA: Initial routing scores
-- ============================================================

INSERT INTO javari_ai_performance (provider, task_type, routing_score, success_count)
VALUES 
  -- Claude excels at code
  ('claude-3-5-sonnet', 'code_generation', 95, 100),
  ('claude-3-5-sonnet', 'code_debugging', 94, 100),
  ('claude-3-5-sonnet', 'code_review', 93, 100),
  ('claude-3-5-sonnet', 'conversation', 90, 100),
  ('claude-3-5-sonnet', 'data_analysis', 92, 100),
  
  -- GPT-4 excels at creative
  ('gpt-4-turbo', 'creative_writing', 95, 100),
  ('gpt-4-turbo', 'math_calculation', 94, 100),
  ('gpt-4-turbo', 'code_generation', 90, 100),
  
  -- Perplexity excels at research
  ('perplexity-sonar', 'research', 96, 100),
  
  -- Mistral excels at translation
  ('mistral-large', 'translation', 95, 100),
  
  -- Gemini excels at long context
  ('gemini-1.5-pro', 'long_document', 95, 100),
  ('gemini-1.5-pro', 'image_analysis', 93, 100),
  
  -- Budget models for quick questions
  ('gpt-3.5-turbo', 'quick_question', 88, 100),
  ('claude-3-haiku', 'quick_question', 87, 100),
  ('gemini-1.5-flash', 'quick_question', 86, 100)
ON CONFLICT (provider, task_type) DO UPDATE SET
  routing_score = EXCLUDED.routing_score;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Javari AI Aggregation Schema created successfully!';
  RAISE NOTICE 'Tables: conversations, messages, ai_usage, ai_performance, knowledge, self_healing_log, learning_queue, user_preferences';
  RAISE NOTICE 'Views: provider_leaderboard, task_routing_stats';
END $$;
