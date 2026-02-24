BEGIN;

-- Create the main table for brand color palette usage
CREATE TABLE IF NOT EXISTS creative_suite_brand_color_palette_usage (
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

-- Add comments to the table
COMMENT ON TABLE creative_suite_brand_color_palette_usage IS 'Generate harmonious brand color palettes from a seed color or description with hex codes, accessibility scores, and CSS/Tailwind export';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_color_palette_user_id ON creative_suite_brand_color_palette_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_brand_color_palette_created_at ON creative_suite_brand_color_palette_usage (created_at DESC);

-- Enable Row Level Security
ALTER TABLE creative_suite_brand_color_palette_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS select_own_brand_color_palette_usage ON creative_suite_brand_color_palette_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS insert_own_brand_color_palette_usage ON creative_suite_brand_color_palette_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS update_own_brand_color_palette_usage ON creative_suite_brand_color_palette_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS delete_own_brand_color_palette_usage ON creative_suite_brand_color_palette_usage
    FOR DELETE USING (auth.uid() = user_id);

-- Grant full access to service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON creative_suite_brand_color_palette_usage TO service_role;

-- Function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_timestamp_brand_color_palette_usage() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger to auto-update the updated_at column
CREATE TRIGGER update_timestamp_trigger_brand_color_palette_usage
    BEFORE UPDATE ON creative_suite_brand_color_palette_usage
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_brand_color_palette_usage();

COMMIT;