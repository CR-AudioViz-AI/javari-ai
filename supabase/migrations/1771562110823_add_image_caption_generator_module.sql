BEGIN;

-- Create the main table for image caption generator usage
CREATE TABLE IF NOT EXISTS ai_integration_image_caption_generator_usage (
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

-- Add comments to the table for documentation
COMMENT ON TABLE ai_integration_image_caption_generator_usage IS 'Generate descriptive alt text and captions for images using computer vision AI, with SEO optimization and accessibility compliance';

-- Create indexes for user_id and created_at
CREATE INDEX IF NOT EXISTS idx_ai_integration_image_caption_generator_usage_user_id ON ai_integration_image_caption_generator_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_integration_image_caption_generator_usage_created_at ON ai_integration_image_caption_generator_usage(created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_integration_image_caption_generator_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to read/write their own rows
CREATE POLICY user_access ON ai_integration_image_caption_generator_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_modification ON ai_integration_image_caption_generator_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_update ON ai_integration_image_caption_generator_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_delete ON ai_integration_image_caption_generator_usage
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policy for service_role to have full access
CREATE POLICY service_role_access ON ai_integration_image_caption_generator_usage
    FOR ALL USING (auth.role() = 'service_role');

-- Create a trigger to auto-update the updated_at field
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_updated_at ON ai_integration_image_caption_generator_usage;
CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON ai_integration_image_caption_generator_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;