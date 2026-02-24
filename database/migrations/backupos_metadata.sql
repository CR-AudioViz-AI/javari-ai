-- ============================================================================
-- BackupOS Phase 1: Optional Backup Metadata Table
-- ============================================================================
-- Purpose: Track backup verification and metadata (OPTIONAL for Phase 1)
-- Status: Optional - provides manual backup tracking capability
-- Note: Does NOT create automated backups - only tracks verification
-- ============================================================================

-- Create backup_metadata table for tracking backup verification
CREATE TABLE IF NOT EXISTS backup_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('database', 'storage', 'full')),
  backup_source TEXT NOT NULL DEFAULT 'supabase_auto', -- 'supabase_auto', 'manual', 'cron'
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id),
  backup_date TIMESTAMP WITH TIME ZONE NOT NULL,
  backup_size_bytes BIGINT,
  retention_until TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'expired', 'deleted', 'unknown')),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE backup_metadata IS 'Optional table for tracking backup verification (Phase 1 - manual tracking only)';
COMMENT ON COLUMN backup_metadata.backup_type IS 'Type of backup: database, storage, or full system backup';
COMMENT ON COLUMN backup_metadata.backup_source IS 'Source of backup: supabase_auto (default), manual, or cron';
COMMENT ON COLUMN backup_metadata.verified_at IS 'When this backup was last verified to exist';
COMMENT ON COLUMN backup_metadata.verified_by IS 'User who verified backup existence';
COMMENT ON COLUMN backup_metadata.backup_date IS 'Date/time when the backup was created';
COMMENT ON COLUMN backup_metadata.backup_size_bytes IS 'Size of backup in bytes (if known)';
COMMENT ON COLUMN backup_metadata.retention_until IS 'Date when backup will be deleted per retention policy';
COMMENT ON COLUMN backup_metadata.status IS 'Current status of backup';
COMMENT ON COLUMN backup_metadata.notes IS 'Free-form notes about this backup';
COMMENT ON COLUMN backup_metadata.metadata IS 'Additional metadata in JSON format';

-- Enable Row Level Security
ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can manage backup metadata
-- This prevents regular users from viewing or manipulating backup records
CREATE POLICY "Service role can manage backup_metadata" ON backup_metadata
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_backup_metadata_date ON backup_metadata(backup_date DESC);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_status ON backup_metadata(status);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_type ON backup_metadata(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_verified ON backup_metadata(verified_at DESC NULLS LAST);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_backup_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backup_metadata_updated_at
  BEFORE UPDATE ON backup_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_backup_metadata_updated_at();

-- ============================================================================
-- USAGE EXAMPLES (for manual backup verification tracking)
-- ============================================================================

-- Example 1: Record that you verified Supabase backup exists
-- INSERT INTO backup_metadata (backup_type, backup_source, backup_date, verified_at, verified_by, notes)
-- VALUES (
--   'database',
--   'supabase_auto',
--   '2026-01-29 00:00:00+00',
--   NOW(),
--   auth.uid(),
--   'Verified backup exists in Supabase dashboard'
-- );

-- Example 2: Query recent backups
-- SELECT backup_date, backup_type, verified_at, status, notes
-- FROM backup_metadata
-- WHERE backup_type = 'database'
-- ORDER BY backup_date DESC
-- LIMIT 10;

-- Example 3: Check for backups older than retention period
-- SELECT * FROM backup_metadata
-- WHERE retention_until < NOW()
-- AND status = 'available';

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 
-- 1. This table is OPTIONAL for Phase 1
-- 2. This table does NOT create backups - it only tracks verification
-- 3. Actual backups are managed by Supabase automated system
-- 4. This table is for manual record-keeping and future automation (Phase 2)
-- 5. Phase 2 will add automated population of this table via cron jobs
-- 
-- ============================================================================
