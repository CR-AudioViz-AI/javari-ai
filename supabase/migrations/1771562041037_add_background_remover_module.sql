BEGIN;

-- Create the main table for background remover usage
CREATE TABLE IF NOT EXISTS creative_suite_background_remover_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    input TEXT NOT NULL,
    result TEXT,
    credits_used INTEGER NOT NULL,
    processing_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE creative_suite_background_remover_usage IS 'Remove image backgrounds instantly with AI, supports batch processing, transparent PNG export, and custom background replacement';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_creative_suite_background_remover_usage_user_id ON creative_suite_background_remover_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_creative_suite_background_remover_usage_created_at ON creative_suite_background_remover_usage (created_at DESC);

-- Enable Row Level Security
ALTER TABLE creative_suite_background_remover_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS select_own_background_remover_usage ON creative_suite_background_remover_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS insert_own_background_remover_usage ON creative_suite_background_remover_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS update_own_background_remover_usage ON creative_suite_background_remover_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS delete_own_background_remover_usage ON creative_suite_background_remover_usage
    FOR DELETE USING (auth.uid() = user_id);

-- Allow service_role full access
GRANT ALL ON TABLE creative_suite_background_remover_usage TO service_role;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column_creative_suite_background_remover_usage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_updated_at_creative_suite_background_remover_usage ON creative_suite_background_remover_usage;
CREATE TRIGGER trigger_update_updated_at_creative_suite_background_remover_usage
BEFORE UPDATE ON creative_suite_background_remover_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_creative_suite_background_remover_usage();

COMMIT;