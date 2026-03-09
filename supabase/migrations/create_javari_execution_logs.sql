-- lib/javari/telemetry: javari_execution_logs
-- Persists structured execution telemetry from every autonomy worker cycle.
-- Populated by flushTelemetry() called at the end of runAutonomousLoop().
-- Migration: 2026-03-10

CREATE TABLE IF NOT EXISTS javari_execution_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           text,
  title             text,
  phase             text,
  status            text,
  started_at        bigint,
  completed_at      bigint,
  duration_ms       bigint,
  model_used        text,
  tokens_prompt     int,
  tokens_completion int,
  cost_usd          numeric,
  error             text,
  created_at        timestamptz DEFAULT now()
);

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_exec_logs_task_id    ON javari_execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_exec_logs_status     ON javari_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_exec_logs_phase      ON javari_execution_logs(phase);
CREATE INDEX IF NOT EXISTS idx_exec_logs_created_at ON javari_execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_logs_model      ON javari_execution_logs(model_used);

-- RLS: service role only — telemetry is internal
ALTER TABLE javari_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON javari_execution_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE javari_execution_logs IS
  'Structured execution telemetry flushed from telemetryStore at the end of each autonomous worker cycle.';
