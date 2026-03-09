-- supabase/migrations/20260309_missing_autonomy_tables.sql
-- Javari AI — Missing Autonomy Infrastructure Tables
-- Purpose: Create 4 tables required by autonomy cron cycles.
-- Date: 2026-03-09

-- ── 1. autonomy_execution_log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autonomy_execution_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        TEXT NOT NULL,
  model_used     TEXT NOT NULL,
  cost_estimate  NUMERIC(10,6) DEFAULT 0,
  execution_time INTEGER NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('success','failed','skipped')),
  error_message  TEXT,
  tokens_in      INTEGER DEFAULT 0,
  tokens_out     INTEGER DEFAULT 0,
  provider       TEXT,
  task_type      TEXT,
  cycle_id       TEXT,
  logged_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ael_task_id ON autonomy_execution_log (task_id);
CREATE INDEX IF NOT EXISTS idx_ael_logged  ON autonomy_execution_log (logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_ael_status  ON autonomy_execution_log (status);
CREATE INDEX IF NOT EXISTS idx_ael_cycle   ON autonomy_execution_log (cycle_id);

-- ── 2. javari_scheduler_lock ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS javari_scheduler_lock (
  lock_key    TEXT PRIMARY KEY,
  cycle_id    TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  holder      TEXT NOT NULL DEFAULT 'unknown'
);

-- ── 3. javari_security_events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS javari_security_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,
  threat_level TEXT NOT NULL,
  detail       TEXT,
  user_id      UUID,
  endpoint     TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type
  ON javari_security_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_level
  ON javari_security_events (threat_level, occurred_at DESC);

-- ── 4. javari_model_usage_metrics ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS javari_model_usage_metrics (
  id          TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  task_type   TEXT,
  tokens_in   INTEGER DEFAULT 0,
  tokens_out  INTEGER DEFAULT 0,
  latency_ms  INTEGER DEFAULT 0,
  cost_usd    NUMERIC(10,6) DEFAULT 0,
  success     BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_model_metrics_occurred
  ON javari_model_usage_metrics (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_metrics_provider
  ON javari_model_usage_metrics (provider, model, occurred_at DESC);

-- ── Grant service_role full access (RLS off — internal autonomy tables) ───────
ALTER TABLE autonomy_execution_log    DISABLE ROW LEVEL SECURITY;
ALTER TABLE javari_scheduler_lock     DISABLE ROW LEVEL SECURITY;
ALTER TABLE javari_security_events    DISABLE ROW LEVEL SECURITY;
ALTER TABLE javari_model_usage_metrics DISABLE ROW LEVEL SECURITY;
