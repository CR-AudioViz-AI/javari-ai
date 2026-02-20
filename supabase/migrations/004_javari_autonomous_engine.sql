-- supabase/migrations/004_javari_autonomous_engine.sql
-- Javari Autonomous Engine — Task State + Heartbeat Tables
-- 2026-02-20 — STEP 2 implementation
--
-- Tables:
--   javari_task_state    — persists every task node's execution state
--   javari_heartbeat_log — time-series health analytics
--
-- RLS: Service role writes; no public reads (internal only).
-- Triggers: updated_at auto-update on both tables.

-- ── Extensions ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── javari_task_state ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS javari_task_state (
  -- PK + identity
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id          TEXT NOT NULL,
  task_id          TEXT NOT NULL,

  -- Task metadata
  task_title       TEXT NOT NULL DEFAULT '',
  task_type        TEXT NOT NULL DEFAULT 'generation'
                     CHECK (task_type IN ('analysis','generation','validation',
                                         'memory','api_call','decision','aggregation')),

  -- State machine
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','running','validating','done',
                                       'failed','retrying','skipped','escalated')),
  attempt          INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 3,

  -- Output
  output           TEXT,
  error            TEXT,

  -- Provider
  provider         TEXT,
  model            TEXT,

  -- Validation
  validation_score  NUMERIC CHECK (validation_score >= 0 AND validation_score <= 100),
  validation_passed BOOLEAN,

  -- Memory linkage
  memory_chunk_id  TEXT,

  -- Routing metadata (JSON blob)
  routing_meta     JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite unique: one row per task per goal
CREATE UNIQUE INDEX IF NOT EXISTS uidx_task_state_goal_task
  ON javari_task_state (goal_id, task_id);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_task_state_goal_id   ON javari_task_state (goal_id);
CREATE INDEX IF NOT EXISTS idx_task_state_status     ON javari_task_state (status);
CREATE INDEX IF NOT EXISTS idx_task_state_started_at ON javari_task_state (started_at)
  WHERE status = 'running';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_task_state_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_state_updated_at ON javari_task_state;
CREATE TRIGGER trg_task_state_updated_at
  BEFORE UPDATE ON javari_task_state
  FOR EACH ROW EXECUTE FUNCTION update_task_state_updated_at();

-- RLS
ALTER TABLE javari_task_state ENABLE ROW LEVEL SECURITY;

-- Service role full access (server-side writes via service key bypass RLS)
-- No client reads needed — all access is server-to-server
CREATE POLICY "service_role_full_access"
  ON javari_task_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── javari_heartbeat_log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS javari_heartbeat_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stuck_tasks      TEXT[]  DEFAULT '{}',
  recovered_tasks  TEXT[]  DEFAULT '{}',
  active_goals     INTEGER DEFAULT 0,
  health_score     NUMERIC DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_created_at ON javari_heartbeat_log (created_at DESC);

-- 30-day TTL via pg_cron (optional — enable if pg_cron available):
-- SELECT cron.schedule('cleanup-heartbeat-log', '0 3 * * *',
--   $$DELETE FROM javari_heartbeat_log WHERE created_at < NOW() - INTERVAL '30 days'$$);

ALTER TABLE javari_heartbeat_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_heartbeat"
  ON javari_heartbeat_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── javari_task_state helper views ────────────────────────────────────────────

-- Active goals overview
CREATE OR REPLACE VIEW javari_active_goals AS
SELECT
  goal_id,
  COUNT(*) FILTER (WHERE status = 'done')      AS done_tasks,
  COUNT(*) FILTER (WHERE status = 'failed')    AS failed_tasks,
  COUNT(*) FILTER (WHERE status = 'running')   AS running_tasks,
  COUNT(*) FILTER (WHERE status = 'pending')   AS pending_tasks,
  COUNT(*)                                      AS total_tasks,
  MAX(started_at)                              AS last_activity,
  MIN(created_at)                              AS started_at
FROM javari_task_state
WHERE status NOT IN ('done', 'skipped')
GROUP BY goal_id;

COMMENT ON TABLE javari_task_state    IS 'Javari autonomous engine — per-task execution state';
COMMENT ON TABLE javari_heartbeat_log IS 'Javari autonomous engine — heartbeat health analytics';
