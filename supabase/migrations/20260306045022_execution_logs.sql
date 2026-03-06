-- Create execution_logs table
CREATE TABLE IF NOT EXISTS execution_logs (
  execution_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  model_used TEXT NOT NULL,
  cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  execution_time INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_execution_logs_task_id ON execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp);

-- Add comment
COMMENT ON TABLE execution_logs IS 'Execution logs for roadmap task queue processing';

-- Create roadmap_tasks table if it doesn't exist
CREATE TABLE IF NOT EXISTS roadmap_tasks (
  task_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for roadmap_tasks
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_status ON roadmap_tasks(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_created_at ON roadmap_tasks(created_at);

-- Add updated_at trigger for roadmap_tasks
CREATE OR REPLACE FUNCTION update_roadmap_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roadmap_tasks_updated_at
  BEFORE UPDATE ON roadmap_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmap_tasks_updated_at();
