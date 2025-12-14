-- Javari AI - Phase 5 Command Center Database Migration
-- Timestamp: Saturday, December 13, 2025 - 8:50 PM EST
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUDIT LOGS - Track all system actions
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT DEFAULT 'low',
  user_id UUID,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  outcome TEXT DEFAULT 'success',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FEATURE FLAGS - Toggle system capabilities
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  category TEXT DEFAULT 'core',
  rollout_percentage INTEGER DEFAULT 100,
  allowed_users TEXT[] DEFAULT '{}',
  blocked_users TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_category ON feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_feature_enabled ON feature_flags(enabled);

-- ═══════════════════════════════════════════════════════════════════════════════
-- USER QUOTAS - Rate limiting and usage tracking
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_quotas (
  user_id UUID PRIMARY KEY,
  tier TEXT DEFAULT 'free',
  requests_per_minute INTEGER DEFAULT 20,
  requests_per_hour INTEGER DEFAULT 200,
  requests_per_day INTEGER DEFAULT 1000,
  tokens_per_day INTEGER DEFAULT 50000,
  minute_requests INTEGER DEFAULT 0,
  hour_requests INTEGER DEFAULT 0,
  day_requests INTEGER DEFAULT 0,
  day_tokens INTEGER DEFAULT 0,
  last_reset_minute TIMESTAMPTZ DEFAULT NOW(),
  last_reset_hour TIMESTAMPTZ DEFAULT NOW(),
  last_reset_day TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quota_tier ON user_quotas(tier);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RATE LIMIT LOGS - Track rate limit hits
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  remaining INTEGER,
  limit_value INTEGER,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ratelimit_client ON rate_limit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_ratelimit_endpoint ON rate_limit_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_ratelimit_allowed ON rate_limit_logs(allowed);
CREATE INDEX IF NOT EXISTS idx_ratelimit_created ON rate_limit_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENABLE RLS ON ALL NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role access audit_logs" ON audit_logs FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access feature_flags" ON feature_flags FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access user_quotas" ON user_quotas FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access rate_limit_logs" ON rate_limit_logs FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INSERT DEFAULT FEATURE FLAGS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO feature_flags (id, name, description, enabled, category) VALUES
  ('chat_enabled', 'Chat Engine', 'Enable/disable the main chat functionality', true, 'core'),
  ('streaming_enabled', 'Streaming Responses', 'Enable real-time streaming of AI responses', true, 'core'),
  ('tools_enabled', 'Tools Execution', 'Enable tool execution capabilities', true, 'core'),
  ('claude_enabled', 'Claude AI', 'Enable Anthropic Claude as AI provider', true, 'ai'),
  ('gpt4_enabled', 'GPT-4 Turbo', 'Enable OpenAI GPT-4 as AI provider', true, 'ai'),
  ('gemini_enabled', 'Google Gemini', 'Enable Google Gemini as AI provider', true, 'ai'),
  ('vision_enabled', 'Vision AI', 'Enable image analysis capabilities', true, 'ai'),
  ('voice_enabled', 'Voice Synthesis', 'Enable ElevenLabs voice synthesis', true, 'ai'),
  ('github_integration', 'GitHub Integration', 'Enable GitHub tools and webhooks', true, 'integration'),
  ('vercel_integration', 'Vercel Integration', 'Enable Vercel deployments and webhooks', true, 'integration'),
  ('agent_mode', 'Agent Mode', 'Enable multi-step autonomous task execution', true, 'experimental'),
  ('self_healing', 'Self-Healing', 'Enable automatic deployment issue detection', true, 'experimental'),
  ('memory_system', 'Memory System', 'Enable long-term memory and learning', true, 'experimental'),
  ('debug_mode', 'Debug Mode', 'Enable verbose logging and debug information', false, 'admin')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'Phase 5 migration complete! Command Center tables created.' AS status;
