BEGIN;

-- Create the table if it does not exist
CREATE TABLE IF NOT EXISTS creative_suite_logo_generator_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    input JSONB NOT NULL,
    result JSONB,
    credits_used INT NOT NULL,
    processing_ms INT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments to the table
COMMENT ON TABLE creative_suite_logo_generator_usage IS 'AI-powered logo creation with style customization, color palette selection, and SVG/PNG export for brands and businesses';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_logo_generator_user_id ON creative_suite_logo_generator_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_logo_generator_created_at ON creative_suite_logo_generator_usage (created_at DESC);

-- Create or replace function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_logo_generator() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trg_update_updated_at_logo_generator ON creative_suite_logo_generator_usage;
CREATE TRIGGER trg_update_updated_at_logo_generator
BEFORE UPDATE ON creative_suite_logo_generator_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_logo_generator();

-- Enable Row Level Security
ALTER TABLE creative_suite_logo_generator_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS select_own_logo_generator_usage ON creative_suite_logo_generator_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS insert_own_logo_generator_usage ON creative_suite_logo_generator_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS update_own_logo_generator_usage ON creative_suite_logo_generator_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS delete_own_logo_generator_usage ON creative_suite_logo_generator_usage
    FOR DELETE USING (auth.uid() = user_id);

-- Grant full access to service_role
GRANT ALL ON creative_suite_logo_generator_usage TO service_role;

COMMIT;