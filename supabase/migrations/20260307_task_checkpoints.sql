-- supabase/migrations/20260307_task_checkpoints.sql
-- Purpose: Task checkpoint table for persistence and stall recovery
-- Date: 2026-03-07

CREATE TABLE IF NOT EXISTS task_checkpoints (
  id              BIGSERIAL    PRIMARY KEY,
  task_id         TEXT         NOT NULL UNIQUE,
  execution_id    TEXT         NOT NULL,
  phase           TEXT         NOT NULL DEFAULT 'starting'
                  CHECK (phase IN ('starting','building','validating','completing','done')),
  progress_pct    INTEGER      NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  partial_output  TEXT,
  last_heartbeat  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  locked_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  lock_expires_at TIMESTAMPTZ  NOT NULL,
  attempt         INTEGER      NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_id
  ON task_checkpoints (task_id);
CREATE INDEX IF NOT EXISTS idx_task_checkpoints_lock_expires
  ON task_checkpoints (lock_expires_at);
CREATE INDEX IF NOT EXISTS idx_task_checkpoints_phase
  ON task_checkpoints (phase);

ALTER TABLE task_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON task_checkpoints
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON task_checkpoints TO service_role;
GRANT USAGE ON SEQUENCE task_checkpoints_id_seq TO service_role;

COMMENT ON TABLE task_checkpoints IS
  'Tracks in-progress task execution state for stall recovery and resume';
