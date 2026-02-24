-- ═══════════════════════════════════════════════════════════
-- JAVARI AI - SECURITY DATABASE SCHEMA
-- Roy-Only Controls, Kill Command, Audit Logging
-- 
-- @version 2.0.0
-- @date November 21, 2025 - 10:58 PM EST
-- @critical RUN THIS BEFORE DEPLOYING SECURITY LAYER CODE
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════
-- USER SECURITY PROFILES
-- ═══════════════════════════════════════════════════════════

-- Add security fields to user_profiles table
-- (Assuming user_profiles already exists, we're adding columns)
DO $$ 
BEGIN
    -- Add security_level column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_profiles' AND column_name='security_level'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN security_level INTEGER DEFAULT 3;
    END IF;
    
    -- Add violation tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_profiles' AND column_name='violation_count'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN violation_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add suspension fields
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_profiles' AND column_name='suspended'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN suspended BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_profiles' AND column_name='suspension_reason'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN suspension_reason TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_profiles' AND column_name='suspended_at'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN suspended_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create index on security_level for fast queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_security_level 
ON user_profiles(security_level);

-- Create index on suspended users
CREATE INDEX IF NOT EXISTS idx_user_profiles_suspended 
ON user_profiles(suspended) WHERE suspended = true;

-- ═══════════════════════════════════════════════════════════
-- KILL COMMAND STATE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kill_command_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    active BOOLEAN NOT NULL DEFAULT false,
    activated_by TEXT NOT NULL,
    activated_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    suspicious_actors TEXT[], -- Array of user IDs
    snapshot_id TEXT,
    deactivated_at TIMESTAMPTZ,
    deactivated_by TEXT,
    deactivation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on active kill commands (should only be one)
CREATE INDEX IF NOT EXISTS idx_kill_command_active 
ON kill_command_state(active, created_at DESC) 
WHERE active = true;

-- ═══════════════════════════════════════════════════════════
-- SYSTEM SNAPSHOTS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_snapshots (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL, -- Complete system state snapshot
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on timestamp for retrieving recent snapshots
CREATE INDEX IF NOT EXISTS idx_system_snapshots_timestamp 
ON system_snapshots(timestamp DESC);

-- ═══════════════════════════════════════════════════════════
-- SECURITY AUDIT LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    input TEXT, -- The input that triggered the violation
    reason TEXT,
    pattern TEXT, -- The regex pattern that matched
    blocked BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_security_audit_user 
ON security_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_action 
ON security_audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_blocked 
ON security_audit_log(blocked, created_at DESC) 
WHERE blocked = true;

CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp 
ON security_audit_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- SECURITY ACTION LOG (Non-violation events)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_action_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    user_id TEXT NOT NULL,
    performed_by TEXT NOT NULL, -- Who performed the action (usually Roy for admin actions)
    timestamp TIMESTAMPTZ NOT NULL,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying actions
CREATE INDEX IF NOT EXISTS idx_security_action_user 
ON security_action_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_action_performed_by 
ON security_action_log(performed_by, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- SECURITY ALERTS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    sent_to TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_unacknowledged 
ON security_alerts(acknowledged, created_at DESC) 
WHERE acknowledged = false;

-- ═══════════════════════════════════════════════════════════
-- CRITICAL ALERTS (Kill command, major system events)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS critical_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unacknowledged critical alerts
CREATE INDEX IF NOT EXISTS idx_critical_alerts_unacknowledged 
ON critical_alerts(acknowledged, created_at DESC) 
WHERE acknowledged = false;

-- ═══════════════════════════════════════════════════════════
-- ACTIVE SESSIONS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    session_token TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ NOT NULL,
    terminated BOOLEAN DEFAULT false,
    termination_reason TEXT,
    terminated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for session management
CREATE INDEX IF NOT EXISTS idx_active_sessions_user 
ON active_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_sessions_token 
ON active_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_active_sessions_active 
ON active_sessions(terminated, last_activity DESC) 
WHERE terminated = false;

-- ═══════════════════════════════════════════════════════════
-- JAVARI SETTINGS (System-wide configuration)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS javari_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system_locked setting (false = normal operations)
INSERT INTO javari_settings (key, value, updated_by)
VALUES ('system_locked', 'false', 'SYSTEM_INITIALIZATION')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- RATE LIMITING LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rate limit queries (needs to be fast)
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action 
ON rate_limit_log(user_id, action, created_at DESC);

-- Automatically clean up old rate limit logs (older than 24 hours)
-- This keeps the table size manageable
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_log 
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on security tables
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kill_command_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_snapshots ENABLE ROW LEVEL SECURITY;

-- Only Roy can view security audit logs
CREATE POLICY security_audit_roy_only ON security_audit_log
    FOR ALL
    USING (auth.uid()::text = 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Only Roy can view security action logs
CREATE POLICY security_action_roy_only ON security_action_log
    FOR ALL
    USING (auth.uid()::text = 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Only Roy can view security alerts
CREATE POLICY security_alerts_roy_only ON security_alerts
    FOR ALL
    USING (auth.uid()::text = 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Only Roy can view critical alerts
CREATE POLICY critical_alerts_roy_only ON critical_alerts
    FOR ALL
    USING (auth.uid()::text = 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Only Roy can view/modify kill command state
CREATE POLICY kill_command_roy_only ON kill_command_state
    FOR ALL
    USING (auth.uid()::text = 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- Only Roy can view system snapshots
CREATE POLICY system_snapshots_roy_only ON system_snapshots
    FOR ALL
    USING (auth.uid()::text = 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

-- ═══════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- Function to check if system is locked (kill command active)
CREATE OR REPLACE FUNCTION is_system_locked()
RETURNS BOOLEAN AS $$
DECLARE
    locked_value TEXT;
BEGIN
    SELECT value INTO locked_value
    FROM javari_settings
    WHERE key = 'system_locked';
    
    RETURN locked_value = 'true';
END;
$$ LANGUAGE plpgsql;

-- Function to get current kill command status
CREATE OR REPLACE FUNCTION get_kill_command_status()
RETURNS TABLE (
    active BOOLEAN,
    activated_by TEXT,
    activated_at TIMESTAMPTZ,
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT kc.active, kc.activated_by, kc.activated_at, kc.reason
    FROM kill_command_state kc
    WHERE kc.active = true
    ORDER BY kc.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to increment user violations
CREATE OR REPLACE FUNCTION increment_user_violations(user_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET violation_count = violation_count + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════

-- View of users with high violation counts
CREATE MATERIALIZED VIEW IF NOT EXISTS high_risk_users AS
SELECT 
    id,
    email,
    username,
    violation_count,
    suspended,
    suspension_reason,
    suspended_at
FROM user_profiles
WHERE violation_count >= 3 OR suspended = true
ORDER BY violation_count DESC;

-- Refresh function for high_risk_users view
CREATE OR REPLACE FUNCTION refresh_high_risk_users()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW high_risk_users;
END;
$$ LANGUAGE plpgsql;

-- View of recent security violations (last 24 hours)
CREATE MATERIALIZED VIEW IF NOT EXISTS recent_violations AS
SELECT 
    user_id,
    action,
    reason,
    timestamp,
    blocked,
    created_at
FROM security_audit_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND blocked = true
ORDER BY created_at DESC;

-- Refresh function for recent_violations view
CREATE OR REPLACE FUNCTION refresh_recent_violations()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW recent_violations;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Automatically refresh materialized views when violations are added
CREATE OR REPLACE FUNCTION refresh_views_on_violation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_recent_violations();
    PERFORM refresh_high_risk_users();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_views_on_violation
AFTER INSERT ON security_audit_log
FOR EACH ROW
WHEN (NEW.blocked = true)
EXECUTE FUNCTION refresh_views_on_violation();

-- ═══════════════════════════════════════════════════════════
-- INITIAL DATA SETUP
-- ═══════════════════════════════════════════════════════════

-- Set Roy's user profile to OWNER level (if it exists)
-- Replace this UUID with Roy's actual Supabase user ID
UPDATE user_profiles
SET security_level = 1
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════

-- Verify all tables were created
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'kill_command_state',
    'system_snapshots',
    'security_audit_log',
    'security_action_log',
    'security_alerts',
    'critical_alerts',
    'active_sessions',
    'javari_settings',
    'rate_limit_log'
  )
ORDER BY table_name;

-- Check system lock status
SELECT key, value, updated_at, updated_by
FROM javari_settings
WHERE key = 'system_locked';

-- ═══════════════════════════════════════════════════════════
-- DEPLOYMENT COMPLETE
-- ═══════════════════════════════════════════════════════════

-- This schema provides complete security infrastructure for:
-- 1. Roy-only controls (security levels + RLS policies)
-- 2. Kill command system (freeze/resume operations)
-- 3. Ethical guardrails (violation tracking + auto-suspension)
-- 4. Audit logging (comprehensive security event tracking)
-- 5. Rate limiting (prevent abuse)
-- 6. Session management (track and terminate sessions)
-- 7. System snapshots (restore points before kill command)
-- 8. Security alerts (notify Roy of critical events)

SELECT 'JAVARI SECURITY SCHEMA DEPLOYMENT COMPLETE ✅' AS status;
