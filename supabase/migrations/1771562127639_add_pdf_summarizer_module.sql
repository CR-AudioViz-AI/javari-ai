-- Create the ai_integration_pdf_summarizer_usage table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ai_integration_pdf_summarizer_usage') THEN
        CREATE TABLE ai_integration_pdf_summarizer_usage (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users ON DELETE CASCADE,
            input TEXT NOT NULL,
            result JSONB,
            credits_used INTEGER NOT NULL,
            processing_ms INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        COMMENT ON TABLE ai_integration_pdf_summarizer_usage IS 'Upload PDFs and get AI-generated summaries, key points extraction, chapter breakdowns, and Q&A capabilities';
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_integration_pdf_summarizer_usage_user_id ON ai_integration_pdf_summarizer_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_integration_pdf_summarizer_usage_created_at ON ai_integration_pdf_summarizer_usage (created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_integration_pdf_summarizer_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'user_read_own_rows' AND tablename = 'ai_integration_pdf_summarizer_usage') THEN
        CREATE POLICY user_read_own_rows ON ai_integration_pdf_summarizer_usage
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'user_write_own_rows' AND tablename = 'ai_integration_pdf_summarizer_usage') THEN
        CREATE POLICY user_write_own_rows ON ai_integration_pdf_summarizer_usage
            FOR INSERT, UPDATE, DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'service_role_full_access' AND tablename = 'ai_integration_pdf_summarizer_usage') THEN
        CREATE POLICY service_role_full_access ON ai_integration_pdf_summarizer_usage
            FOR ALL
            USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_ai_integration_pdf_summarizer_usage() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ai_integration_pdf_summarizer_usage') THEN
        CREATE TRIGGER set_updated_at_ai_integration_pdf_summarizer_usage
        BEFORE UPDATE ON ai_integration_pdf_summarizer_usage
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_ai_integration_pdf_summarizer_usage();
    END IF;
END $$;