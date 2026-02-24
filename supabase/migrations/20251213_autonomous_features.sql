-- =============================================================================
-- JAVARI AI - AUTONOMOUS FEATURES DATABASE MIGRATION
-- =============================================================================
-- Tables for:
--   1. Health Check Logs (Simple)
--   2. Error Patterns & Logs (Moderate)  
--   3. Learning Feedback Loop (Difficult)
--
-- Created: Saturday, December 13, 2025 - 6:32 PM EST
-- Run this in Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SIMPLE: Health Check Logs
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS health_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    checks JSONB NOT NULL DEFAULT '{}',
    summary JSONB NOT NULL DEFAULT '{}',
    response_time_ms INTEGER,
    triggered_by VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_health_logs_created 
ON health_check_logs(created_at DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_health_logs_status 
ON health_check_logs(status);

-- Cleanup old logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM health_check_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. MODERATE: Error Logs & Patterns
-- -----------------------------------------------------------------------------

-- Error Logs Table
CREATE TABLE IF NOT EXISTS error_logs (
    id VARCHAR(100) PRIMARY KEY,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    error_code VARCHAR(50),
    stack_trace TEXT,
    context JSONB DEFAULT '{}',
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' 
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    pattern_id VARCHAR(100),
    pattern_key VARCHAR(100),
    suggested_fixes JSONB DEFAULT '[]',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_pattern ON error_logs(pattern_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON error_logs(resolved) WHERE resolved = FALSE;

-- Error Patterns Table
CREATE TABLE IF NOT EXISTS error_patterns (
    pattern_id VARCHAR(100) PRIMARY KEY,
    error_type VARCHAR(100) NOT NULL,
    pattern_key VARCHAR(100),
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    frequency_per_hour NUMERIC(10,2) DEFAULT 0,
    suggested_fixes JSONB DEFAULT '[]',
    auto_heal_available BOOLEAN DEFAULT FALSE,
    auto_heal_success_count INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'resolved', 'ignored', 'investigating')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for error_patterns
CREATE INDEX IF NOT EXISTS idx_error_patterns_status ON error_patterns(status);
CREATE INDEX IF NOT EXISTS idx_error_patterns_count ON error_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_last_seen ON error_patterns(last_seen DESC);

-- Function to increment error pattern count
CREATE OR REPLACE FUNCTION increment_error_pattern(
    p_pattern_id VARCHAR(100),
    p_error_type VARCHAR(100),
    p_pattern_key VARCHAR(100) DEFAULT 'unknown'
)
RETURNS void AS $$
BEGIN
    INSERT INTO error_patterns (pattern_id, error_type, pattern_key, occurrence_count, first_seen, last_seen)
    VALUES (p_pattern_id, p_error_type, p_pattern_key, 1, NOW(), NOW())
    ON CONFLICT (pattern_id) DO UPDATE SET
        occurrence_count = error_patterns.occurrence_count + 1,
        last_seen = NOW(),
        -- Calculate frequency (occurrences per hour since first seen)
        frequency_per_hour = (error_patterns.occurrence_count + 1) / 
            GREATEST(EXTRACT(EPOCH FROM (NOW() - error_patterns.first_seen)) / 3600, 1),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3. DIFFICULT: Learning Feedback Loop
-- -----------------------------------------------------------------------------

-- Learning Feedback Table
CREATE TABLE IF NOT EXISTS learning_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id VARCHAR(100) NOT NULL,
    interaction_type VARCHAR(50) NOT NULL 
        CHECK (interaction_type IN ('chat', 'code_gen', 'analysis', 'search', 'tool_use', 'other')),
    outcome VARCHAR(20) NOT NULL 
        CHECK (outcome IN ('success', 'partial', 'failure', 'abandoned')),
    context JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{}',
    feedback JSONB DEFAULT '{}',
    user_id UUID,
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for learning_feedback
CREATE INDEX IF NOT EXISTS idx_learning_interaction ON learning_feedback(interaction_id);
CREATE INDEX IF NOT EXISTS idx_learning_type ON learning_feedback(interaction_type);
CREATE INDEX IF NOT EXISTS idx_learning_outcome ON learning_feedback(outcome);
CREATE INDEX IF NOT EXISTS idx_learning_created ON learning_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_user ON learning_feedback(user_id) WHERE user_id IS NOT NULL;

-- Model Performance Aggregates (materialized view for faster queries)
CREATE TABLE IF NOT EXISTS model_performance_stats (
    model_name VARCHAR(100) PRIMARY KEY,
    total_interactions INTEGER NOT NULL DEFAULT 0,
    successful_interactions INTEGER NOT NULL DEFAULT 0,
    success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_response_time_ms NUMERIC(10,2) DEFAULT 0,
    avg_cost_usd NUMERIC(10,6) DEFAULT 0,
    avg_satisfaction NUMERIC(3,2) DEFAULT 0,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to update model performance stats
CREATE OR REPLACE FUNCTION update_model_performance()
RETURNS TRIGGER AS $$
DECLARE
    v_model VARCHAR(100);
    v_success INTEGER;
BEGIN
    -- Extract model from context
    v_model := NEW.context->>'model_used';
    
    IF v_model IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Determine if success
    v_success := CASE WHEN NEW.outcome = 'success' THEN 1 ELSE 0 END;
    
    -- Upsert into stats table
    INSERT INTO model_performance_stats (
        model_name, 
        total_interactions, 
        successful_interactions,
        success_rate,
        avg_response_time_ms,
        avg_cost_usd,
        last_used,
        updated_at
    )
    VALUES (
        v_model,
        1,
        v_success,
        v_success * 100,
        COALESCE((NEW.metrics->>'response_time_ms')::NUMERIC, 0),
        COALESCE((NEW.metrics->>'cost_usd')::NUMERIC, 0),
        NOW(),
        NOW()
    )
    ON CONFLICT (model_name) DO UPDATE SET
        total_interactions = model_performance_stats.total_interactions + 1,
        successful_interactions = model_performance_stats.successful_interactions + v_success,
        success_rate = (model_performance_stats.successful_interactions + v_success)::NUMERIC / 
                       (model_performance_stats.total_interactions + 1) * 100,
        avg_response_time_ms = (
            model_performance_stats.avg_response_time_ms * model_performance_stats.total_interactions +
            COALESCE((NEW.metrics->>'response_time_ms')::NUMERIC, 0)
        ) / (model_performance_stats.total_interactions + 1),
        avg_cost_usd = (
            model_performance_stats.avg_cost_usd * model_performance_stats.total_interactions +
            COALESCE((NEW.metrics->>'cost_usd')::NUMERIC, 0)
        ) / (model_performance_stats.total_interactions + 1),
        last_used = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update stats
DROP TRIGGER IF EXISTS trg_update_model_performance ON learning_feedback;
CREATE TRIGGER trg_update_model_performance
    AFTER INSERT ON learning_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_model_performance();

-- Learning Insights Table (for caching generated insights)
CREATE TABLE IF NOT EXISTS learning_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    data_points INTEGER NOT NULL DEFAULT 0,
    recommendation TEXT,
    impact VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high')),
    actionable BOOLEAN NOT NULL DEFAULT FALSE,
    suggested_action JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'applied', 'dismissed')),
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_insights_type ON learning_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_status ON learning_insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_impact ON learning_insights(impact);

-- Experiments Table
CREATE TABLE IF NOT EXISTS learning_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    hypothesis TEXT,
    variants JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
    sample_size_target INTEGER NOT NULL DEFAULT 100,
    current_sample_size INTEGER NOT NULL DEFAULT 0,
    winner VARCHAR(100),
    statistical_significance NUMERIC(5,2),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_status ON learning_experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_id ON learning_experiments(experiment_id);

-- -----------------------------------------------------------------------------
-- Views for Easy Querying
-- -----------------------------------------------------------------------------

-- Recent errors with patterns
CREATE OR REPLACE VIEW v_recent_errors AS
SELECT 
    e.id,
    e.error_type,
    e.error_message,
    e.severity,
    e.created_at,
    p.occurrence_count,
    p.frequency_per_hour,
    p.status as pattern_status,
    e.suggested_fixes
FROM error_logs e
LEFT JOIN error_patterns p ON e.pattern_id = p.pattern_id
WHERE e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC;

-- Model leaderboard
CREATE OR REPLACE VIEW v_model_leaderboard AS
SELECT 
    model_name,
    total_interactions,
    success_rate,
    avg_response_time_ms,
    avg_cost_usd,
    -- Calculate efficiency score (success per dollar)
    CASE 
        WHEN avg_cost_usd > 0 THEN (success_rate / avg_cost_usd)::NUMERIC(10,2)
        ELSE success_rate 
    END as efficiency_score,
    last_used
FROM model_performance_stats
WHERE total_interactions >= 5
ORDER BY success_rate DESC, efficiency_score DESC;

-- Active insights needing attention
CREATE OR REPLACE VIEW v_active_insights AS
SELECT *
FROM learning_insights
WHERE status = 'active'
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY 
    impact DESC,
    confidence DESC,
    created_at DESC;

-- -----------------------------------------------------------------------------
-- Row Level Security (Optional - Enable if needed)
-- -----------------------------------------------------------------------------

-- Enable RLS on sensitive tables
-- ALTER TABLE learning_feedback ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE learning_experiments ENABLE ROW LEVEL SECURITY;

-- Example policy (uncomment and modify as needed):
-- CREATE POLICY "Users can view their own feedback"
--     ON learning_feedback FOR SELECT
--     USING (auth.uid() = user_id OR user_id IS NULL);

-- -----------------------------------------------------------------------------
-- Cleanup Functions
-- -----------------------------------------------------------------------------

-- Cleanup old data (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_learning_data()
RETURNS void AS $$
BEGIN
    -- Keep 90 days of feedback
    DELETE FROM learning_feedback 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Keep 30 days of error logs
    DELETE FROM error_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Remove expired insights
    DELETE FROM learning_insights 
    WHERE expires_at < NOW() AND status = 'active';
    
    -- Reset inactive error patterns
    UPDATE error_patterns 
    SET status = 'resolved'
    WHERE last_seen < NOW() - INTERVAL '7 days'
      AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Grant Permissions (adjust as needed)
-- -----------------------------------------------------------------------------

-- For service role (full access)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- For anon/authenticated (limited)
-- GRANT SELECT, INSERT ON health_check_logs TO authenticated;
-- GRANT SELECT, INSERT ON error_logs TO authenticated;
-- GRANT SELECT, INSERT ON learning_feedback TO authenticated;
-- GRANT SELECT ON model_performance_stats TO authenticated;
-- GRANT SELECT ON v_model_leaderboard TO authenticated;
-- GRANT SELECT ON v_active_insights TO authenticated;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- 
-- Tables Created:
--   ✓ health_check_logs
--   ✓ error_logs  
--   ✓ error_patterns
--   ✓ learning_feedback
--   ✓ model_performance_stats
--   ✓ learning_insights
--   ✓ learning_experiments
--
-- Views Created:
--   ✓ v_recent_errors
--   ✓ v_model_leaderboard
--   ✓ v_active_insights
--
-- Functions Created:
--   ✓ cleanup_old_health_logs()
--   ✓ increment_error_pattern()
--   ✓ update_model_performance()
--   ✓ cleanup_old_learning_data()
--
-- =============================================================================
