BEGIN;

-- Create the table if it does not exist
CREATE TABLE IF NOT EXISTS creative_suite_test_stack_usage (
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

-- Add comments to the table
COMMENT ON TABLE creative_suite_test_stack_usage IS 'A full-stack test module combining UI, API processing, and database logging for validation';

-- Create indexes if they do not exist
CREATE INDEX IF NOT EXISTS idx_creative_suite_test_stack_usage_user_id ON creative_suite_test_stack_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_creative_suite_test_stack_usage_created_at ON creative_suite_test_stack_usage (created_at DESC);

-- Create or replace the trigger function for auto-updating the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column_creative_suite_test_stack_usage() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_creative_suite_test_stack_usage') THEN
        CREATE TRIGGER set_updated_at_creative_suite_test_stack_usage
        BEFORE UPDATE ON creative_suite_test_stack_usage
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column_creative_suite_test_stack_usage();
    END IF;
END;
$$;

-- Enable Row Level Security
ALTER TABLE creative_suite_test_stack_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY IF NOT EXISTS user_can_access_own_creative_suite_test_stack_usage ON creative_suite_test_stack_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS user_can_modify_own_creative_suite_test_stack_usage ON creative_suite_test_stack_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS user_can_insert_creative_suite_test_stack_usage ON creative_suite_test_stack_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant full access to service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON creative_suite_test_stack_usage TO service_role;

COMMIT;