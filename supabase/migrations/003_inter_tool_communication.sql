-- ═══════════════════════════════════════════════════════════
-- CR AUDIOVIZ AI - INTER-TOOL COMMUNICATION SCHEMA
-- Shared Assets & Task Handoffs
-- 
-- @version 1.0.0
-- @date November 21, 2025 - 11:35 PM EST
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════
-- SHARED ASSETS TABLE
-- Central repository for assets shared between tools
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shared_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- logo, icon, image, pdf, document, etc.
    asset_name TEXT NOT NULL,
    asset_url TEXT NOT NULL, -- URL to the asset file (Supabase Storage, Vercel Blob, etc.)
    asset_data JSONB, -- Optional metadata (dimensions, colors, file size, etc.)
    created_by_tool TEXT NOT NULL, -- Which tool created this asset
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_shared_assets_user 
ON shared_assets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_assets_type 
ON shared_assets(user_id, asset_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_assets_tool 
ON shared_assets(created_by_tool, created_at DESC);

-- Enable Row Level Security
ALTER TABLE shared_assets ENABLE ROW LEVEL SECURITY;

-- Users can view their own assets
CREATE POLICY "Users can view own assets" ON shared_assets
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Users can insert their own assets
CREATE POLICY "Users can insert own assets" ON shared_assets
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own assets
CREATE POLICY "Users can update own assets" ON shared_assets
    FOR UPDATE
    USING (auth.uid()::text = user_id);

-- Users can delete their own assets
CREATE POLICY "Users can delete own assets" ON shared_assets
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- TASK HANDOFFS TABLE
-- Tracks task handoffs between tools
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS task_handoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_tool TEXT NOT NULL, -- Tool that initiated the handoff
    to_tool TEXT NOT NULL, -- Tool that should handle the task
    task_type TEXT NOT NULL, -- generate_logo, create_pdf, etc.
    task_params JSONB NOT NULL, -- Parameters for the task
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    result JSONB, -- Result from the receiving tool
    error TEXT, -- Error message if failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for task querying
CREATE INDEX IF NOT EXISTS idx_task_handoffs_to_tool 
ON task_handoffs(to_tool, status, created_at);

CREATE INDEX IF NOT EXISTS idx_task_handoffs_from_tool 
ON task_handoffs(from_tool, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_handoffs_status 
ON task_handoffs(status, created_at DESC);

-- Enable Row Level Security
ALTER TABLE task_handoffs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view task handoffs (tools need to coordinate)
CREATE POLICY "Authenticated users can view task handoffs" ON task_handoffs
    FOR SELECT
    TO authenticated
    USING (true);

-- All authenticated users can create task handoffs
CREATE POLICY "Authenticated users can create task handoffs" ON task_handoffs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- All authenticated users can update task handoffs (tools need to update status)
CREATE POLICY "Authenticated users can update task handoffs" ON task_handoffs
    FOR UPDATE
    TO authenticated
    USING (true);

-- ═══════════════════════════════════════════════════════════
-- TOOL USAGE TRACKING
-- Track which tools users are actively using
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tool_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    action TEXT NOT NULL, -- opened, created_asset, exported, etc.
    metadata JSONB, -- Additional context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_tool_usage_user 
ON tool_usage(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_usage_tool 
ON tool_usage(tool_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_usage_action 
ON tool_usage(action, created_at DESC);

-- Enable Row Level Security
ALTER TABLE tool_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage" ON tool_usage
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can insert own usage" ON tool_usage
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- Function to get user's recent assets
CREATE OR REPLACE FUNCTION get_user_recent_assets(
    p_user_id TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    asset_type TEXT,
    asset_name TEXT,
    asset_url TEXT,
    created_by_tool TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.id,
        sa.asset_type,
        sa.asset_name,
        sa.asset_url,
        sa.created_by_tool,
        sa.created_at
    FROM shared_assets sa
    WHERE sa.user_id = p_user_id
    ORDER BY sa.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending tasks for a tool
CREATE OR REPLACE FUNCTION get_tool_pending_tasks(
    p_tool_id TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    from_tool TEXT,
    task_type TEXT,
    task_params JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        th.id,
        th.from_tool,
        th.task_type,
        th.task_params,
        th.created_at
    FROM task_handoffs th
    WHERE th.to_tool = p_tool_id
      AND th.status = 'pending'
    ORDER BY th.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to track tool usage
CREATE OR REPLACE FUNCTION track_tool_usage(
    p_user_id TEXT,
    p_tool_id TEXT,
    p_action TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_usage_id UUID;
BEGIN
    INSERT INTO tool_usage (user_id, tool_id, action, metadata)
    VALUES (p_user_id, p_tool_id, p_action, p_metadata)
    RETURNING id INTO v_usage_id;
    
    RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ═══════════════════════════════════════════════════════════

-- View of most popular tools by usage
CREATE MATERIALIZED VIEW IF NOT EXISTS tool_popularity AS
SELECT 
    tool_id,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as last_used
FROM tool_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tool_id
ORDER BY usage_count DESC;

-- Refresh function for tool_popularity
CREATE OR REPLACE FUNCTION refresh_tool_popularity()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW tool_popularity;
END;
$$ LANGUAGE plpgsql;

-- View of most commonly shared asset types
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_asset_types AS
SELECT 
    asset_type,
    COUNT(*) as asset_count,
    COUNT(DISTINCT user_id) as unique_users
FROM shared_assets
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY asset_type
ORDER BY asset_count DESC;

-- Refresh function for popular_asset_types
CREATE OR REPLACE FUNCTION refresh_popular_asset_types()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW popular_asset_types;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp on shared_assets
CREATE OR REPLACE FUNCTION update_shared_assets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shared_assets_timestamp
BEFORE UPDATE ON shared_assets
FOR EACH ROW
EXECUTE FUNCTION update_shared_assets_timestamp();

-- ═══════════════════════════════════════════════════════════
-- GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════

GRANT ALL ON shared_assets TO authenticated;
GRANT ALL ON shared_assets TO service_role;

GRANT ALL ON task_handoffs TO authenticated;
GRANT ALL ON task_handoffs TO service_role;

GRANT ALL ON tool_usage TO authenticated;
GRANT ALL ON tool_usage TO service_role;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════

-- Verify tables were created
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'shared_assets',
    'task_handoffs',
    'tool_usage'
  )
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════════
-- DEPLOYMENT COMPLETE
-- ═══════════════════════════════════════════════════════════

SELECT 'INTER-TOOL COMMUNICATION SCHEMA DEPLOYMENT COMPLETE ✅' AS status;
