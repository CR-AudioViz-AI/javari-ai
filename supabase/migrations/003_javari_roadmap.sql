-- Supabase Migration: Javari Roadmap Table
-- Step 3: Roadmap Engine v1

-- Create javari_roadmap table
CREATE TABLE IF NOT EXISTS javari_roadmap (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'blocked', 'completed')),
  owner TEXT,
  dependencies TEXT[],
  evidence_links TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_javari_roadmap_status ON javari_roadmap(status);

-- Create index on priority for faster queries
CREATE INDEX IF NOT EXISTS idx_javari_roadmap_priority ON javari_roadmap(priority);

-- Enable Row Level Security
ALTER TABLE javari_roadmap ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
-- Note: Adjust this based on your authentication setup
CREATE POLICY "Allow authenticated users to manage roadmap"
  ON javari_roadmap
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Alternative RLS Policy (more restrictive):
-- Only allow reads for everyone, writes for authenticated
-- CREATE POLICY "Allow read for all"
--   ON javari_roadmap
--   FOR SELECT
--   USING (true);
--
-- CREATE POLICY "Allow write for authenticated"
--   ON javari_roadmap
--   FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');
--
-- CREATE POLICY "Allow update for authenticated"
--   ON javari_roadmap
--   FOR UPDATE
--   USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');

-- Insert some initial roadmap items
INSERT INTO javari_roadmap (id, title, description, priority, status, owner) VALUES
  ('roadmap_init_1', 'Payment Integration - Stripe', 'Integrate Stripe payment processing for Invoice Generator Pro', 'critical', 'planned', 'javari'),
  ('roadmap_init_2', 'Template Expansion - Social Graphics', 'Add 20+ new templates to Social Graphics Creator', 'high', 'planned', 'javari'),
  ('roadmap_init_3', 'PDF Form Automation', 'Implement automatic form filling for PDF Builder Pro', 'high', 'planned', 'javari'),
  ('roadmap_init_4', 'Learning System Maturity', 'Enhance autonomous learning with pattern recognition', 'high', 'in_progress', 'javari'),
  ('roadmap_init_5', 'Multi-Model Coordination', 'Improve model selection and output merging', 'medium', 'in_progress', 'javari')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions
-- GRANT ALL ON javari_roadmap TO authenticated;
-- GRANT SELECT ON javari_roadmap TO anon;

COMMENT ON TABLE javari_roadmap IS 'Javari AI autonomous roadmap tracking';
