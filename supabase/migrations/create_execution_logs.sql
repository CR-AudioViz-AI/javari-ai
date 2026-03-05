-- Javari Execution Logs Table
-- Stores results of roadmap task execution for reference

CREATE TABLE IF NOT EXISTS javari_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  output TEXT,
  error TEXT,
  estimated_cost NUMERIC(10, 6) DEFAULT 0,
  roles_executed JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster task_id lookups
CREATE INDEX IF NOT EXISTS idx_execution_logs_task_id ON javari_execution_logs(task_id);

-- Index for created_at (for recent history queries)
CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON javari_execution_logs(created_at DESC);

-- Index for status
CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON javari_execution_logs(status);

COMMENT ON TABLE javari_execution_logs IS 'Stores execution results from Javari roadmap tasks for reference and learning';
