-- ============================================================================
-- AUTONOMOUS MONITORING SYSTEM TABLES
-- CR AudioViz AI - Master Cron Runner
-- Created: January 2, 2026
-- Purpose: Enable provable 24x7x365 self-healing with evidence artifacts
-- ============================================================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS autonomous_alerts CASCADE;
DROP TABLE IF EXISTS autonomous_actions CASCADE;
DROP TABLE IF EXISTS autonomous_runs CASCADE;
DROP TABLE IF EXISTS autonomous_jobs CASCADE;

-- ============================================================================
-- TABLE 1: autonomous_jobs
-- Defines all jobs that the master cron runner should execute
-- ============================================================================
CREATE TABLE autonomous_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    -- Schedule: cron expression (e.g., "*/5 * * * *" for every 5 minutes)
    schedule TEXT NOT NULL DEFAULT '*/5 * * * *',
    -- Job type determines execution logic
    job_type TEXT NOT NULL DEFAULT 'health_check',
    -- Target URL or endpoint to check/call
    target_url TEXT,
    -- Whether job is currently enabled
    enabled BOOLEAN DEFAULT true,
    -- Execution timing
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    -- Execution limits
    timeout_ms INTEGER DEFAULT 30000,
    max_retries INTEGER DEFAULT 3,
    retry_delay_ms INTEGER DEFAULT 5000,
    -- Priority (1=highest, 10=lowest)
    priority INTEGER DEFAULT 5,
    -- Job-specific configuration
    config JSONB DEFAULT '{}'::jsonb,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE 2: autonomous_runs
-- Records every execution of the master cron runner
-- ============================================================================
CREATE TABLE autonomous_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES autonomous_jobs(job_id) ON DELETE SET NULL,
    job_name TEXT,
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    -- Results
    status TEXT NOT NULL DEFAULT 'running', -- running, success, failed, degraded, timeout
    issues_detected_count INTEGER DEFAULT 0,
    fixes_applied_count INTEGER DEFAULT 0,
    verification_passed BOOLEAN,
    -- Evidence
    logs_url TEXT,
    logs_json JSONB DEFAULT '[]'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    -- Error tracking
    error_message TEXT,
    error_stack TEXT,
    -- Server info
    region TEXT,
    runtime_version TEXT,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE 3: autonomous_actions
-- Records every remediation action taken by the self-healing system
-- ============================================================================
CREATE TABLE autonomous_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES autonomous_runs(run_id) ON DELETE CASCADE,
    -- Action details
    action_type TEXT NOT NULL, -- rollback, restart, clear_cache, patch_env, redeploy, alert, fix_code
    target TEXT NOT NULL, -- domain, project, endpoint, service
    target_id TEXT, -- specific identifier
    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, success, failed, skipped
    -- State tracking
    before_state JSONB,
    after_state JSONB,
    -- Evidence
    evidence_url TEXT,
    evidence_json JSONB,
    -- Verification
    verification_run_id UUID,
    verification_passed BOOLEAN,
    verification_at TIMESTAMPTZ,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- TABLE 4: autonomous_alerts
-- Records all alerts sent by the monitoring system
-- ============================================================================
CREATE TABLE autonomous_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES autonomous_runs(run_id) ON DELETE SET NULL,
    action_id UUID REFERENCES autonomous_actions(action_id) ON DELETE SET NULL,
    -- Alert details
    severity TEXT NOT NULL DEFAULT 'info', -- critical, high, medium, low, info
    category TEXT NOT NULL DEFAULT 'system', -- system, security, performance, error, success
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    -- Delivery
    channels JSONB DEFAULT '[]'::jsonb, -- ["slack", "email", "database"]
    sent_to JSONB DEFAULT '[]'::jsonb, -- actual recipients
    delivery_status TEXT DEFAULT 'pending', -- pending, sent, failed, partial
    -- Context
    context JSONB DEFAULT '{}'::jsonb,
    -- Acknowledgment
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE 5: autonomous_heartbeats
-- Simple heartbeat table for proving continuous operation
-- ============================================================================
CREATE TABLE autonomous_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    region TEXT,
    status TEXT DEFAULT 'alive',
    metrics JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_autonomous_runs_started_at ON autonomous_runs(started_at DESC);
CREATE INDEX idx_autonomous_runs_status ON autonomous_runs(status);
CREATE INDEX idx_autonomous_runs_job_id ON autonomous_runs(job_id);
CREATE INDEX idx_autonomous_actions_run_id ON autonomous_actions(run_id);
CREATE INDEX idx_autonomous_actions_status ON autonomous_actions(status);
CREATE INDEX idx_autonomous_alerts_severity ON autonomous_alerts(severity);
CREATE INDEX idx_autonomous_alerts_created_at ON autonomous_alerts(created_at DESC);
CREATE INDEX idx_autonomous_heartbeats_timestamp ON autonomous_heartbeats(timestamp DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE autonomous_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_heartbeats ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to autonomous_jobs" ON autonomous_jobs FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to autonomous_runs" ON autonomous_runs FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to autonomous_actions" ON autonomous_actions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to autonomous_alerts" ON autonomous_alerts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to autonomous_heartbeats" ON autonomous_heartbeats FOR ALL TO service_role USING (true);

-- ============================================================================
-- SEED DATA: Default jobs
-- ============================================================================
INSERT INTO autonomous_jobs (name, description, schedule, job_type, target_url, priority, config) VALUES
    ('health_check', 'Check all critical endpoints', '*/5 * * * *', 'health_check', NULL, 1, '{"endpoints": ["/api/health", "/api/central", "/", "/apps"]}'),
    ('self_healing', 'Detect and fix issues automatically', '*/5 * * * *', 'self_healing', NULL, 1, '{"auto_rollback": true, "max_rollback_age_hours": 24}'),
    ('continuous_learning', 'Learn from conversations and improve', '0 */4 * * *', 'learning', NULL, 3, '{"batch_size": 100}'),
    ('alerts_check', 'Check and send pending alerts', '*/30 * * * *', 'alerts', NULL, 2, '{}'),
    ('system_metrics', 'Collect system performance metrics', '0 * * * *', 'metrics', NULL, 4, '{}'),
    ('db_maintenance', 'Clean old logs and optimize', '0 3 * * *', 'maintenance', NULL, 5, '{"retention_days": 30}')
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    schedule = EXCLUDED.schedule,
    config = EXCLUDED.config,
    updated_at = NOW();

-- ============================================================================
-- FUNCTION: Cleanup old data (called by maintenance job)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_autonomous_data(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
    
    -- Delete old heartbeats (keep last 7 days only)
    DELETE FROM autonomous_heartbeats WHERE timestamp < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old runs (respecting retention)
    DELETE FROM autonomous_runs WHERE created_at < cutoff_date;
    
    -- Delete old alerts that are resolved
    DELETE FROM autonomous_alerts WHERE resolved_at IS NOT NULL AND created_at < cutoff_date;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

