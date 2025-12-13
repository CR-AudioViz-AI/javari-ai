-- Javari AI - Autonomous Systems Database Migration
-- Timestamp: Friday, December 12, 2025 - 11:55 AM EST
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════════
-- HEALING LOGS - Track self-healing activity
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS healing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id TEXT NOT NULL,
  project TEXT NOT NULL,
  diagnosis JSONB,
  fix_applied BOOLEAN DEFAULT FALSE,
  fix_commit TEXT,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'healed', 'failed', 'manual_required')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_logs_project ON healing_logs(project);
CREATE INDEX IF NOT EXISTS idx_healing_logs_status ON healing_logs(status);
CREATE INDEX IF NOT EXISTS idx_healing_logs_created_at ON healing_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TOOL EXECUTIONS - Track tool usage
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_name TEXT NOT NULL,
  parameters JSONB,
  result_preview TEXT,
  success BOOLEAN DEFAULT TRUE,
  duration_ms INTEGER,
  error TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_user ON tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_created_at ON tool_executions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PROACTIVE SUGGESTIONS - Track suggestions generated
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS proactive_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('improvement', 'warning', 'opportunity', 'insight', 'action')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_type ON proactive_suggestions(type);
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON proactive_suggestions(priority);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON proactive_suggestions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONVERSATION LEARNINGS - Track what Javari learns
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID,
  user_query TEXT,
  response_preview TEXT,
  was_code_generation BOOLEAN DEFAULT FALSE,
  app_type TEXT,
  provider_used TEXT,
  appears_successful BOOLEAN DEFAULT TRUE,
  has_code_output BOOLEAN DEFAULT FALSE,
  feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learnings_conversation ON conversation_learnings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_learnings_app_type ON conversation_learnings(app_type);
CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON conversation_learnings(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- USAGE LOGS - Enhanced tracking (add missing columns if needed)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS app_type TEXT;
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS request_id TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ERROR PATTERNS - For self-healing
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS error_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_pattern TEXT NOT NULL,
  error_type TEXT NOT NULL,
  fix_description TEXT,
  fix_code TEXT,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_patterns_type ON error_patterns(error_type);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INSERT COMMON ERROR PATTERNS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO error_patterns (error_pattern, error_type, fix_description, fix_code) VALUES
  ('Module not found', 'missing_module', 'Add the missing package to package.json and run npm install', NULL),
  ('TypeError: Cannot read properties of undefined', 'type_error', 'Add null checks or optional chaining', NULL),
  ('ReferenceError: is not defined', 'reference_error', 'Import or declare the missing variable', NULL),
  ('Property does not exist on type', 'typescript_error', 'Add the property to the type definition or use type assertion', NULL),
  ('Binding element implicitly has an any type', 'typescript_error', 'Add explicit type annotations to function parameters', NULL),
  ('Cannot find module', 'missing_module', 'Install the missing package with npm install', NULL)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENABLE RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE healing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;

-- Service role policies (allow all for service role)
CREATE POLICY IF NOT EXISTS "Service role access healing_logs" ON healing_logs FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access tool_executions" ON tool_executions FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access proactive_suggestions" ON proactive_suggestions FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access conversation_learnings" ON conversation_learnings FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access error_patterns" ON error_patterns FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'Migration complete! Javari autonomous systems tables created.' AS status;
