-- Create the main usage/results table
CREATE TABLE creative_suite_subtitle_generator_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    language VARCHAR(10) NOT NULL,
    subtitle_format VARCHAR(3) CHECK (subtitle_format IN ('SRT', 'VTT')) NOT NULL,
    subtitles TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE creative_suite_subtitle_generator_usage IS 'Automatically generate accurate subtitles and captions for videos using AI speech recognition, with SRT and VTT export formats';

-- Create indexes for common query patterns
CREATE INDEX idx_subtitle_generator_user_id ON creative_suite_subtitle_generator_usage (user_id);
CREATE INDEX idx_subtitle_generator_created_at ON creative_suite_subtitle_generator_usage (created_at);

-- Create a trigger function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before each row update
CREATE TRIGGER update_subtitle_generator_updated_at
BEFORE UPDATE ON creative_suite_subtitle_generator_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE creative_suite_subtitle_generator_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can only read their own rows
CREATE POLICY select_own_subtitle_generator_usage ON creative_suite_subtitle_generator_usage
FOR SELECT USING (user_id = auth.uid());

-- Create RLS policy: users can only insert their own rows
CREATE POLICY insert_own_subtitle_generator_usage ON creative_suite_subtitle_generator_usage
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create RLS policy: users can only update their own rows
CREATE POLICY update_own_subtitle_generator_usage ON creative_suite_subtitle_generator_usage
FOR UPDATE USING (user_id = auth.uid());

-- Create RLS policy: users can only delete their own rows
CREATE POLICY delete_own_subtitle_generator_usage ON creative_suite_subtitle_generator_usage
FOR DELETE USING (user_id = auth.uid());