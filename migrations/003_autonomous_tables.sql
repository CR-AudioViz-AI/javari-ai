-- JAVARI AI - AUTONOMOUS SYSTEM DATABASE TABLES
-- Migration for 24x7x365 self-healing and monitoring
-- Created: January 3, 2026

-- Ecosystem Health Tracking
CREATE TABLE IF NOT EXISTS javari_ecosystem_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_projects INTEGER NOT NULL,
  healthy INTEGER NOT NULL DEFAULT 0,
  degraded INTEGER NOT NULL DEFAULT 0,
  down INTEGER NOT NULL DEFAULT 0,
  building INTEGER NOT NULL DEFAULT 0,
  alerts_sent INTEGER NOT NULL DEFAULT 0,
  rollbacks_performed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS javari_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT UNIQUE NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL,
  project_id TEXT,
  project_name TEXT,
  metadata JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Healing History (enhanced)
CREATE TABLE IF NOT EXISTS javari_healing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT,
  error_message TEXT,
  detection_method TEXT,
  fix_attempted BOOLEAN DEFAULT FALSE,
  fix_applied BOOLEAN DEFAULT FALSE,
  fix_result JSONB,
  confidence_score INTEGER,
  project_name TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT,
  errors_found INTEGER DEFAULT 0,
  errors_fixed INTEGER DEFAULT 0,
  errors_failed INTEGER DEFAULT 0,
  run_time_ms INTEGER,
  results JSONB
);

-- Manual Review Queue
CREATE TABLE IF NOT EXISTS javari_manual_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  diagnosis TEXT,
  confidence INTEGER,
  fix_strategy TEXT,
  requires_manual_review BOOLEAN DEFAULT TRUE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Patterns (for AI to learn from past fixes)
CREATE TABLE IF NOT EXISTS javari_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_signature TEXT NOT NULL,
  error_category TEXT,
  successful_fix TEXT,
  fix_confidence INTEGER,
  occurrences INTEGER DEFAULT 1,
  last_occurrence TIMESTAMPTZ DEFAULT NOW(),
  auto_fixable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ecosystem_health_timestamp ON javari_ecosystem_health(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON javari_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON javari_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON javari_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_healing_history_created ON javari_healing_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_healing_history_project ON javari_healing_history(project_name);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_signature ON javari_learning_patterns(error_signature);

-- RLS Policies (Roy-only access)
ALTER TABLE javari_ecosystem_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_healing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_manual_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_learning_patterns ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON javari_ecosystem_health FOR ALL USING (true);
CREATE POLICY "Service role full access" ON javari_alerts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON javari_healing_history FOR ALL USING (true);
CREATE POLICY "Service role full access" ON javari_manual_review FOR ALL USING (true);
CREATE POLICY "Service role full access" ON javari_learning_patterns FOR ALL USING (true);
