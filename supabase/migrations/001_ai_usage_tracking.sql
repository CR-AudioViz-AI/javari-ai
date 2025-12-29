-- AI Usage Tracking Table
-- Tracks every AI call for billing, analytics, and cost optimization

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  complexity TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes for fast queries
  CONSTRAINT valid_provider CHECK (provider IN ('anthropic', 'openai', 'perplexity', 'google'))
);

-- Index for user billing queries
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON ai_usage_logs (user_id, created_at DESC);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_usage_provider ON ai_usage_logs (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_complexity ON ai_usage_logs (complexity, created_at DESC);

-- View for daily costs
CREATE OR REPLACE VIEW daily_ai_costs AS
SELECT 
  DATE(created_at) as date,
  provider,
  COUNT(*) as calls,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(response_time_ms) as avg_response_ms
FROM ai_usage_logs
GROUP BY DATE(created_at), provider
ORDER BY date DESC, provider;

-- View for user billing
CREATE OR REPLACE VIEW user_ai_usage AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_calls,
  SUM(cost_usd) as total_cost_usd,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens
FROM ai_usage_logs
GROUP BY user_id, DATE_TRUNC('month', created_at)
ORDER BY month DESC, total_cost_usd DESC;

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own usage
CREATE POLICY "Users can view own usage" ON ai_usage_logs
  FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: Service role can insert
CREATE POLICY "Service can insert usage" ON ai_usage_logs
  FOR INSERT WITH CHECK (true);
