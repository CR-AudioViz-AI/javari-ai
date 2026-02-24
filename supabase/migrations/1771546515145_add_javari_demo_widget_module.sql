-- Create the main table for Javari Demo Widget usage
CREATE TABLE ai_integration_javari_demo_widget_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    input_params JSONB NOT NULL,
    output_result JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE ai_integration_javari_demo_widget_usage IS 'A demonstration widget showing Javari AI Module Factory capabilities with real-time AI generation preview and credit tracking dashboard';

-- Create indexes for common query patterns
CREATE INDEX idx_javari_demo_widget_user_id ON ai_integration_javari_demo_widget_usage (user_id);
CREATE INDEX idx_javari_demo_widget_created_at ON ai_integration_javari_demo_widget_usage (created_at);

-- Create a trigger function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before each row update
CREATE TRIGGER update_ai_integration_javari_demo_widget_usage_updated_at
BEFORE UPDATE ON ai_integration_javari_demo_widget_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE ai_integration_javari_demo_widget_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can only read their own rows
CREATE POLICY select_own_javari_demo_widget_usage ON ai_integration_javari_demo_widget_usage
    FOR SELECT
    USING (user_id = auth.uid());

-- Create RLS policy: users can only insert their own rows
CREATE POLICY insert_own_javari_demo_widget_usage ON ai_integration_javari_demo_widget_usage
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Create RLS policy: users can only update their own rows
CREATE POLICY update_own_javari_demo_widget_usage ON ai_integration_javari_demo_widget_usage
    FOR UPDATE
    USING (user_id = auth.uid());

-- Create RLS policy: users can only delete their own rows
CREATE POLICY delete_own_javari_demo_widget_usage ON ai_integration_javari_demo_widget_usage
    FOR DELETE
    USING (user_id = auth.uid());