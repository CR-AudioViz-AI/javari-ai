-- Javari Telemetry Logs Table
-- Tracks system performance, costs, and model usage

CREATE TABLE IF NOT EXISTS javari_telemetry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER,
  cost NUMERIC(10, 6) DEFAULT 0,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telemetry_model ON javari_telemetry_logs(model);
CREATE INDEX IF NOT EXISTS idx_telemetry_provider ON javari_telemetry_logs(provider);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON javari_telemetry_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_success ON javari_telemetry_logs(success);
CREATE INDEX IF NOT EXISTS idx_telemetry_task_id ON javari_telemetry_logs(task_id);

COMMENT ON TABLE javari_telemetry_logs IS 'Tracks model execution telemetry for monitoring and optimization';
