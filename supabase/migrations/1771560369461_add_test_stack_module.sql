-- Create the developer_tools_test_stack_usage table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'developer_tools_test_stack_usage'
    ) THEN
        CREATE TABLE developer_tools_test_stack_usage (
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

        COMMENT ON TABLE developer_tools_test_stack_usage IS 'Full-stack test module validating complete pipeline: UI page, API route, DB migration, GitHub commit';

        CREATE INDEX ON developer_tools_test_stack_usage (user_id);
        CREATE INDEX ON developer_tools_test_stack_usage (created_at DESC);
    END IF;
END $$;

-- Create or replace the trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_developer_tools_test_stack_usage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for the table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = 'trigger_update_updated_at_developer_tools_test_stack_usage'
    ) THEN
        CREATE TRIGGER trigger_update_updated_at_developer_tools_test_stack_usage
        BEFORE UPDATE ON developer_tools_test_stack_usage
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_developer_tools_test_stack_usage();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE developer_tools_test_stack_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE polname = 'developer_tools_test_stack_usage_rls_select'
    ) THEN
        CREATE POLICY developer_tools_test_stack_usage_rls_select
        ON developer_tools_test_stack_usage
        FOR SELECT
        USING (auth.uid() = user_id OR auth.role() = 'service_role');
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE polname = 'developer_tools_test_stack_usage_rls_insert'
    ) THEN
        CREATE POLICY developer_tools_test_stack_usage_rls_insert
        ON developer_tools_test_stack_usage
        FOR INSERT
        WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE polname = 'developer_tools_test_stack_usage_rls_update'
    ) THEN
        CREATE POLICY developer_tools_test_stack_usage_rls_update
        ON developer_tools_test_stack_usage
        FOR UPDATE
        USING (auth.uid() = user_id OR auth.role() = 'service_role');
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE polname = 'developer_tools_test_stack_usage_rls_delete'
    ) THEN
        CREATE POLICY developer_tools_test_stack_usage_rls_delete
        ON developer_tools_test_stack_usage
        FOR DELETE
        USING (auth.uid() = user_id OR auth.role() = 'service_role');
    END IF;
END $$;