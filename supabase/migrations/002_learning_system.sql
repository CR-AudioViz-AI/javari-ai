-- ============================================================================
-- JAVARI AI LEARNING SYSTEM - Database Schema
-- ============================================================================
-- Purpose: Enable Javari to learn from ALL interactions regardless of provider
-- Created: December 29, 2025
-- ============================================================================

-- 1. User Preferences (stores default AI provider choice)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  default_ai_provider TEXT DEFAULT 'auto',
  theme TEXT DEFAULT 'system',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- 2. AI Interactions Log (raw data from every conversation)
CREATE TABLE IF NOT EXISTS ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  query TEXT NOT NULL,
  query_type TEXT, -- simple, medium, complex, search, code, vision
  response_preview TEXT, -- First 500 chars of response
  response_time_ms INTEGER,
  tokens_used INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  user_feedback TEXT, -- positive, negative, null
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_user ON ai_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_provider ON ai_interactions(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON ai_interactions(query_type);

-- 3. User Learning Patterns (aggregated insights per user)
CREATE TABLE IF NOT EXISTS user_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  patterns JSONB DEFAULT '{
    "preferredProviders": {},
    "queryTypes": {},
    "avgResponseTime": 0,
    "totalInteractions": 0,
    "topTopics": {},
    "peakUsageHours": [],
    "satisfactionScore": 0
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_patterns_user ON user_learning_patterns(user_id);

-- 4. Provider Daily Stats (performance tracking)
CREATE TABLE IF NOT EXISTS provider_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, date)
);

CREATE INDEX IF NOT EXISTS idx_provider_stats_date ON provider_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_stats_provider ON provider_daily_stats(provider);

-- 5. Global Learning Insights (system-wide patterns)
CREATE TABLE IF NOT EXISTS global_learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL, -- routing_rule, cost_optimization, quality_pattern
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_patterns ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users view own interactions" ON ai_interactions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Service can insert interactions" ON ai_interactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users view own patterns" ON user_learning_patterns
  FOR SELECT USING (auth.uid()::text = user_id);

-- Provider stats are public read
ALTER TABLE provider_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view provider stats" ON provider_daily_stats
  FOR SELECT USING (true);

CREATE POLICY "Service can manage provider stats" ON provider_daily_stats
  FOR ALL USING (true);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Daily cost summary
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT 
  date,
  SUM(total_cost) as total_cost,
  SUM(total_requests) as total_requests,
  SUM(total_tokens) as total_tokens,
  ROUND(AVG(avg_response_time)) as avg_response_time
FROM provider_daily_stats
GROUP BY date
ORDER BY date DESC;

-- Provider performance comparison
CREATE OR REPLACE VIEW provider_performance AS
SELECT 
  provider,
  SUM(total_requests) as total_requests,
  SUM(total_cost) as total_cost,
  ROUND(AVG(avg_response_time)) as avg_response_time,
  SUM(positive_feedback) as positive_feedback,
  SUM(negative_feedback) as negative_feedback,
  CASE 
    WHEN SUM(positive_feedback) + SUM(negative_feedback) > 0 
    THEN ROUND(SUM(positive_feedback)::decimal / (SUM(positive_feedback) + SUM(negative_feedback)) * 100, 1)
    ELSE 0 
  END as satisfaction_rate
FROM provider_daily_stats
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY provider
ORDER BY total_requests DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get best provider for a user based on their history
CREATE OR REPLACE FUNCTION get_recommended_provider(p_user_id TEXT)
RETURNS TABLE(provider TEXT, score DECIMAL, reason TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH user_history AS (
    SELECT 
      ai.provider,
      COUNT(*) as usage_count,
      AVG(ai.response_time_ms) as avg_time,
      SUM(CASE WHEN ai.user_feedback = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN ai.user_feedback = 'negative' THEN 1 ELSE 0 END) as negative
    FROM ai_interactions ai
    WHERE ai.user_id = p_user_id
      AND ai.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY ai.provider
  )
  SELECT 
    uh.provider,
    (uh.usage_count * 0.3 + 
     (100 - LEAST(uh.avg_time / 100, 100)) * 0.3 +
     COALESCE(uh.positive - uh.negative, 0) * 0.4
    )::DECIMAL as score,
    CONCAT('Used ', uh.usage_count, ' times, ', 
           COALESCE(uh.positive, 0), ' positive reviews') as reason
  FROM user_history uh
  ORDER BY score DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql;

