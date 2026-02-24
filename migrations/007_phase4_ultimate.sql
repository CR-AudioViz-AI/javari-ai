-- Javari AI - Phase 4 Ultimate Power Mode Database Migration
-- Timestamp: Saturday, December 13, 2025 - 7:15 PM EST
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════════
-- VOICE SYNTHESIS - Track voice generation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS voice_synthesis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text_length INTEGER NOT NULL,
  voice_id TEXT,
  format TEXT DEFAULT 'mp3',
  streaming BOOLEAN DEFAULT FALSE,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_created ON voice_synthesis(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- EMAIL NOTIFICATIONS - Track sent notifications
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  recipients TEXT[] NOT NULL,
  subject TEXT,
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_type ON email_notifications(type);
CREATE INDEX IF NOT EXISTS idx_email_created ON email_notifications(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PLUGIN EXECUTIONS - Track plugin usage
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plugin_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  parameters JSONB,
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_id ON plugin_executions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_action ON plugin_executions(action);
CREATE INDEX IF NOT EXISTS idx_plugin_created ON plugin_executions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- BULK OPERATIONS - Track cross-project operations
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bulk_operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation TEXT NOT NULL,
  projects TEXT[] NOT NULL,
  results JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_operation ON bulk_operations(operation);
CREATE INDEX IF NOT EXISTS idx_bulk_status ON bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_bulk_created ON bulk_operations(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENABLE RLS ON ALL NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE voice_synthesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role access voice_synthesis" ON voice_synthesis FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access email_notifications" ON email_notifications FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access plugin_executions" ON plugin_executions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role access bulk_operations" ON bulk_operations FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'Phase 4 migration complete! Ultimate power mode tables created.' AS status;
