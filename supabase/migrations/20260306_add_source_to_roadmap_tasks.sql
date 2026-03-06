-- Add source column to roadmap_tasks
-- Distinguishes manually-seeded roadmap tasks from AI-generated discovery tasks.
-- Values: 'roadmap' (human-authored) | 'discovery' (AI planner) | NULL (legacy)

ALTER TABLE roadmap_tasks
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;

-- Index for efficient planner query: WHERE status='pending' AND source='roadmap'
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_source
  ON roadmap_tasks (source)
  WHERE source IS NOT NULL;

COMMENT ON COLUMN roadmap_tasks.source IS
  'Task origin: roadmap = human-seeded, discovery = AI-generated';
