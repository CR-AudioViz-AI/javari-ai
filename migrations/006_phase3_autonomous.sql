-- Javari AI - Phase 3 Autonomous Systems Database Migration
-- Timestamp: Friday, December 12, 2025 - 12:40 PM EST
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════════
-- AGENT TASKS - Track agent executions
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  plan JSONB,
  results JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created ON agent_tasks(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CRON EXECUTIONS - Track scheduled job runs
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cron_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  success BOOLEAN DEFAULT TRUE,
  message TEXT,
  details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job ON cron_executions(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_created ON cron_executions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- GITHUB EVENTS - Track webhook events
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS github_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  repository TEXT,
  ref TEXT,
  action TEXT,
  commits_count INTEGER,
  pusher TEXT,
  pr_number INTEGER,
  pr_title TEXT,
  issue_number INTEGER,
  issue_title TEXT,
  workflow_name TEXT,
  workflow_status TEXT,
  workflow_conclusion TEXT,
  payload_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_type ON github_events(event_type);
CREATE INDEX IF NOT EXISTS idx_github_repo ON github_events(repository);
CREATE INDEX IF NOT EXISTS idx_github_created ON github_events(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERCEL EVENTS - Track deployment events
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vercel_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  deployment_id TEXT,
  project_name TEXT,
  deployment_url TEXT,
  status TEXT,
  payload_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vercel_type ON vercel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vercel_project ON vercel_events(project_name);
CREATE INDEX IF NOT EXISTS idx_vercel_created ON vercel_events(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VISION ANALYSES - Track image analysis
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vision_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task TEXT NOT NULL,
  image_type TEXT,
  has_context BOOLEAN DEFAULT FALSE,
  provider TEXT,
  model TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_task ON vision_analyses(task);
CREATE INDEX IF NOT EXISTS idx_vision_created ON vision_analyses(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- JAVARI MEMORY - Long-term memory storage
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS javari_memory (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('preference', 'fact', 'context', 'learning', 'pattern')),
  key TEXT NOT NULL,
  value JSONB,
  confidence REAL DEFAULT 0.8,
  source TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_memory_user ON javari_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON javari_memory(type);
CREATE INDEX IF NOT EXISTS idx_memory_key ON javari_memory(key);
CREATE INDEX IF NOT EXISTS idx_memory_expires ON javari_memory(expires_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DAILY REPORTS - Store generated reports
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE UNIQUE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_date ON daily_reports(report_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENABLE RLS ON ALL NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vercel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role access agent_tasks" ON agent_tasks FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access cron_executions" ON cron_executions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access github_events" ON github_events FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access vercel_events" ON vercel_events FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access vision_analyses" ON vision_analyses FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access javari_memory" ON javari_memory FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access daily_reports" ON daily_reports FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'Phase 3 migration complete! All autonomous systems tables created.' AS status;
