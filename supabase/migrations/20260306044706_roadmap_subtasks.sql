-- Create roadmap_subtasks table
CREATE TABLE IF NOT EXISTS roadmap_subtasks (
  subtask_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_roadmap_subtasks_task_id ON roadmap_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_subtasks_status ON roadmap_subtasks(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_subtasks_created_at ON roadmap_subtasks(created_at);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_roadmap_subtasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roadmap_subtasks_updated_at
  BEFORE UPDATE ON roadmap_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmap_subtasks_updated_at();

-- Add comment
COMMENT ON TABLE roadmap_subtasks IS 'Stores decomposed subtasks for roadmap items';
