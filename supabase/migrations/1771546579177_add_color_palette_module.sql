-- Create the main usage/results table
CREATE TABLE creative_suite_color_palette_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    image_url TEXT,
    palette JSONB NOT NULL,
    contrast_check JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE creative_suite_color_palette_usage IS 'Generate beautiful AI color palettes from text descriptions or uploaded images with accessibility contrast checking';

-- Create indexes for common query patterns
CREATE INDEX idx_color_palette_usage_user_id ON creative_suite_color_palette_usage (user_id);
CREATE INDEX idx_color_palette_usage_created_at ON creative_suite_color_palette_usage (created_at);

-- Create a trigger function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to call the function before each row update
CREATE TRIGGER update_color_palette_usage_updated_at
BEFORE UPDATE ON creative_suite_color_palette_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE creative_suite_color_palette_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can only read their own rows
CREATE POLICY select_own_color_palette_usage ON creative_suite_color_palette_usage
FOR SELECT USING (user_id = auth.uid());

-- Create RLS policy: users can only insert their own rows
CREATE POLICY insert_own_color_palette_usage ON creative_suite_color_palette_usage
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create RLS policy: users can only update their own rows
CREATE POLICY update_own_color_palette_usage ON creative_suite_color_palette_usage
FOR UPDATE USING (user_id = auth.uid());

-- Create RLS policy: users can only delete their own rows
CREATE POLICY delete_own_color_palette_usage ON creative_suite_color_palette_usage
FOR DELETE USING (user_id = auth.uid());