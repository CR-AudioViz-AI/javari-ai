BEGIN;

-- Create the ai_integration_voice_transcriber_usage table
CREATE TABLE IF NOT EXISTS ai_integration_voice_transcriber_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    input TEXT NOT NULL,
    result JSONB,
    credits_used INT NOT NULL,
    processing_ms INT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE ai_integration_voice_transcriber_usage IS 'Transcribe audio and video files to text with speaker identification, timestamps, and multi-language support';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_integration_voice_transcriber_usage_user_id ON ai_integration_voice_transcriber_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_integration_voice_transcriber_usage_created_at ON ai_integration_voice_transcriber_usage (created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_integration_voice_transcriber_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow users to insert their own voice transcriber usage" ON ai_integration_voice_transcriber_usage
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to update their own voice transcriber usage" ON ai_integration_voice_transcriber_usage
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Allow users to select their own voice transcriber usage" ON ai_integration_voice_transcriber_usage
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Allow service_role full access" ON ai_integration_voice_transcriber_usage
    USING (auth.role() = 'service_role');

-- Create a trigger to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column_voice_transcriber_usage() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_updated_at_trigger_voice_transcriber_usage ON ai_integration_voice_transcriber_usage;

CREATE TRIGGER update_updated_at_trigger_voice_transcriber_usage
    BEFORE UPDATE ON ai_integration_voice_transcriber_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_voice_transcriber_usage();

COMMIT;