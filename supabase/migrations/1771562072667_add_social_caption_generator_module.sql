-- Create the creative_suite_social_caption_generator_usage table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'creative_suite_social_caption_generator_usage'
    ) THEN
        CREATE TABLE creative_suite_social_caption_generator_usage (
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
        COMMENT ON TABLE creative_suite_social_caption_generator_usage IS 
        'Create platform-optimized social media captions with hashtags, emojis, and tone controls for Instagram, TikTok, LinkedIn, X';
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creative_suite_social_caption_generator_usage_user_id 
ON creative_suite_social_caption_generator_usage (user_id);

CREATE INDEX IF NOT EXISTS idx_creative_suite_social_caption_generator_usage_created_at 
ON creative_suite_social_caption_generator_usage (created_at DESC);

-- Create trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_updated_at ON creative_suite_social_caption_generator_usage;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON creative_suite_social_caption_generator_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE creative_suite_social_caption_generator_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow users to insert their own rows" 
ON creative_suite_social_caption_generator_usage
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to update their own rows" 
ON creative_suite_social_caption_generator_usage
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Allow users to select their own rows" 
ON creative_suite_social_caption_generator_usage
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Allow service_role full access" 
ON creative_suite_social_caption_generator_usage
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');