-- Create the creative_suite_ai_copywriter_usage table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'creative_suite_ai_copywriter_usage') THEN
        CREATE TABLE public.creative_suite_ai_copywriter_usage (
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

        COMMENT ON TABLE public.creative_suite_ai_copywriter_usage IS 'Generate compelling marketing copy, product descriptions, headlines, and CTAs using AI with tone and brand voice controls';

        CREATE INDEX ON public.creative_suite_ai_copywriter_usage (user_id);
        CREATE INDEX ON public.creative_suite_ai_copywriter_usage (created_at DESC);
    END IF;
END $$;

-- Create trigger function to auto-update updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creative_suite_ai_copywriter_usage_update_timestamp') THEN
        CREATE OR REPLACE FUNCTION public.creative_suite_ai_copywriter_usage_update_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END $$;

-- Create trigger for auto-updating updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'creative_suite_ai_copywriter_usage_update_trigger') THEN
        CREATE TRIGGER creative_suite_ai_copywriter_usage_update_trigger
        BEFORE UPDATE ON public.creative_suite_ai_copywriter_usage
        FOR EACH ROW EXECUTE FUNCTION public.creative_suite_ai_copywriter_usage_update_timestamp();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.creative_suite_ai_copywriter_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to read/write their own rows
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'user_access_policy' AND tablename = 'creative_suite_ai_copywriter_usage') THEN
        CREATE POLICY user_access_policy ON public.creative_suite_ai_copywriter_usage
        FOR SELECT, UPDATE, DELETE
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- Create RLS policy for service_role to have full access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'service_role_access_policy' AND tablename = 'creative_suite_ai_copywriter_usage') THEN
        CREATE POLICY service_role_access_policy ON public.creative_suite_ai_copywriter_usage
        FOR ALL
        USING (auth.role() = 'service_role');
    END IF;
END $$;