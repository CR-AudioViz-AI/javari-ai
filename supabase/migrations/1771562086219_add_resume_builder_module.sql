BEGIN;

-- Create the business_intelligence_resume_builder_usage table
CREATE TABLE IF NOT EXISTS business_intelligence_resume_builder_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    input TEXT NOT NULL,
    result TEXT,
    credits_used INT NOT NULL,
    processing_ms INT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments to the table
COMMENT ON TABLE business_intelligence_resume_builder_usage IS 'Build ATS-optimized resumes with AI content suggestions, multiple professional templates, and PDF/DOCX export';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_business_intelligence_resume_builder_usage_user_id ON business_intelligence_resume_builder_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_business_intelligence_resume_builder_usage_created_at ON business_intelligence_resume_builder_usage (created_at DESC);

-- Create or replace function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column_birb() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_business_intelligence_resume_builder_usage_updated_at
BEFORE UPDATE ON business_intelligence_resume_builder_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_birb();

-- Enable Row Level Security
ALTER TABLE business_intelligence_resume_builder_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to read/write their own rows
CREATE POLICY user_access_policy_birb ON business_intelligence_resume_builder_usage
FOR SELECT, UPDATE, DELETE USING (auth.uid() = user_id);

-- Create RLS policy for service_role to have full access
CREATE POLICY service_role_access_policy_birb ON business_intelligence_resume_builder_usage
FOR ALL USING (auth.role() = 'service_role');

COMMIT;