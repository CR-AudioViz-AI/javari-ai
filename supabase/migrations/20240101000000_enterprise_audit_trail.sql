```sql
-- Enterprise Audit Trail Microservice Migration
-- Created: 2024-01-01 00:00:00
-- Description: Comprehensive audit trail tracking with immutable logging, compliance reporting, and forensic analysis

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types for audit events
CREATE TYPE audit_event_type AS ENUM (
    'authentication',
    'authorization', 
    'data_access',
    'data_modification',
    'system_configuration',
    'ai_operation',
    'model_training',
    'model_inference',
    'data_export',
    'user_management',
    'security_incident',
    'compliance_event'
);

CREATE TYPE audit_event_severity AS ENUM (
    'low',
    'medium', 
    'high',
    'critical'
);

CREATE TYPE audit_session_status AS ENUM (
    'active',
    'expired',
    'terminated',
    'suspicious'
);

CREATE TYPE compliance_report_status AS ENUM (
    'draft',
    'in_progress',
    'completed',
    'approved',
    'archived'
);

-- Core audit events table (immutable append-only)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    session_id UUID,
    user_id UUID,
    event_type audit_event_type NOT NULL,
    event_severity audit_event_severity NOT NULL DEFAULT 'medium',
    event_category TEXT NOT NULL,
    event_action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    resource_name TEXT,
    source_ip INET,
    user_agent TEXT,
    request_id TEXT,
    correlation_id TEXT,
    event_data JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    compliance_tags TEXT[] DEFAULT '{}',
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    geographic_location JSONB,
    device_fingerprint TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_hash TEXT,
    previous_event_hash TEXT,
    chain_index BIGSERIAL,
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
    retention_date DATE,
    
    -- Immutability constraints
    CONSTRAINT immutable_event CHECK (is_immutable = TRUE)
);

-- Audit sessions table for tracking user sessions
CREATE TABLE IF NOT EXISTS audit_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    session_token_hash TEXT NOT NULL,
    status audit_session_status NOT NULL DEFAULT 'active',
    start_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_timestamp TIMESTAMPTZ,
    source_ip INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    geographic_location JSONB,
    session_data JSONB DEFAULT '{}',
    risk_indicators JSONB DEFAULT '{}',
    anomaly_score INTEGER CHECK (anomaly_score >= 0 AND anomaly_score <= 100),
    events_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_session_duration CHECK (
        end_timestamp IS NULL OR end_timestamp >= start_timestamp
    )
);

-- Compliance reports table for regulatory reporting
CREATE TABLE IF NOT EXISTS audit_compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    report_name TEXT NOT NULL,
    report_type TEXT NOT NULL,
    compliance_framework TEXT NOT NULL, -- GDPR, HIPAA, SOX, etc.
    reporting_period DATERANGE NOT NULL,
    status compliance_report_status NOT NULL DEFAULT 'draft',
    query_criteria JSONB NOT NULL,
    event_count BIGINT DEFAULT 0,
    findings JSONB DEFAULT '{}',
    violations JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '{}',
    report_data JSONB DEFAULT '{}',
    generated_by UUID,
    reviewed_by UUID,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    
    CONSTRAINT valid_reporting_period CHECK (NOT isempty(reporting_period))
);

-- Retention policies table for data lifecycle management
CREATE TABLE IF NOT EXISTS audit_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    policy_name TEXT NOT NULL,
    event_types audit_event_type[] NOT NULL,
    event_categories TEXT[] DEFAULT '{}',
    compliance_tags TEXT[] DEFAULT '{}',
    retention_period INTERVAL NOT NULL,
    archive_after INTERVAL,
    delete_after INTERVAL,
    encryption_required BOOLEAN NOT NULL DEFAULT TRUE,
    geographical_restrictions JSONB DEFAULT '{}',
    legal_hold_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT valid_retention_periods CHECK (
        retention_period > INTERVAL '0' AND
        (archive_after IS NULL OR archive_after <= retention_period) AND
        (delete_after IS NULL OR delete_after >= retention_period)
    )
);

-- Forensic queries table for investigation tracking
CREATE TABLE IF NOT EXISTS audit_forensic_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    investigation_id TEXT NOT NULL,
    query_name TEXT NOT NULL,
    investigator_id UUID NOT NULL,
    query_purpose TEXT NOT NULL,
    search_criteria JSONB NOT NULL,
    time_range TSTZRANGE NOT NULL,
    result_count BIGINT DEFAULT 0,
    query_results JSONB DEFAULT '{}',
    analysis_notes TEXT,
    evidence_tags TEXT[] DEFAULT '{}',
    classification_level TEXT NOT NULL DEFAULT 'internal',
    access_log JSONB DEFAULT '[]',
    is_cached BOOLEAN NOT NULL DEFAULT FALSE,
    cache_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_time_range CHECK (NOT isempty(time_range))
);

-- Create indexes for high-performance queries
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_timestamp 
    ON audit_events (tenant_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_timestamp 
    ON audit_events (user_id, event_timestamp DESC) 
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_session_timestamp 
    ON audit_events (session_id, event_timestamp DESC) 
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_type_category 
    ON audit_events (event_type, event_category, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_severity_timestamp 
    ON audit_events (event_severity, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_compliance_tags 
    ON audit_events USING gin (compliance_tags);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_data 
    ON audit_events USING gin (event_data);

CREATE INDEX IF NOT EXISTS idx_audit_events_correlation 
    ON audit_events (correlation_id) 
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_chain_index 
    ON audit_events (chain_index);

CREATE INDEX IF NOT EXISTS idx_audit_events_resource 
    ON audit_events (resource_type, resource_id) 
    WHERE resource_type IS NOT NULL AND resource_id IS NOT NULL;

-- Full-text search index for forensic analysis
CREATE INDEX IF NOT EXISTS idx_audit_events_fulltext 
    ON audit_events USING gin (
        to_tsvector('english', 
            COALESCE(event_category, '') || ' ' ||
            COALESCE(event_action, '') || ' ' ||
            COALESCE(resource_name, '') || ' ' ||
            COALESCE(event_data::text, '')
        )
    );

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_audit_sessions_tenant_user 
    ON audit_sessions (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_status_activity 
    ON audit_sessions (status, last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_token_hash 
    ON audit_sessions (session_token_hash);

-- Compliance report indexes
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_type 
    ON audit_compliance_reports (tenant_id, report_type);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework_period 
    ON audit_compliance_reports (compliance_framework, reporting_period);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_status 
    ON audit_compliance_reports (status, created_at DESC);

-- Forensic query indexes
CREATE INDEX IF NOT EXISTS idx_forensic_queries_tenant_investigation 
    ON audit_forensic_queries (tenant_id, investigation_id);

CREATE INDEX IF NOT EXISTS idx_forensic_queries_investigator 
    ON audit_forensic_queries (investigator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forensic_queries_time_range 
    ON audit_forensic_queries USING gist (time_range);

-- Function to calculate event hash for immutability verification
CREATE OR REPLACE FUNCTION calculate_event_hash(
    p_event_data JSONB,
    p_tenant_id UUID,
    p_event_timestamp TIMESTAMPTZ,
    p_previous_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN encode(
        digest(
            p_tenant_id::text || 
            extract(epoch from p_event_timestamp)::text ||
            p_event_data::text ||
            COALESCE(p_previous_hash, ''),
            'sha256'
        ),
        'hex'
    );
END;
$$;

-- Trigger function for automatic event hash calculation
CREATE OR REPLACE FUNCTION audit_events_hash_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    prev_hash TEXT;
BEGIN
    -- Get the previous event hash for chain verification
    SELECT event_hash INTO prev_hash
    FROM audit_events 
    WHERE tenant_id = NEW.tenant_id 
    ORDER BY chain_index DESC 
    LIMIT 1;
    
    -- Calculate and set the event hash
    NEW.event_hash := calculate_event_hash(
        NEW.event_data,
        NEW.tenant_id,
        NEW.event_timestamp,
        prev_hash
    );
    
    NEW.previous_event_hash := prev_hash;
    
    RETURN NEW;
END;
$$;

-- Create trigger for event hash calculation
CREATE TRIGGER audit_events_hash_trigger
    BEFORE INSERT ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION audit_events_hash_trigger();

-- Trigger function for session activity updates
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update session last activity when new event is logged
    UPDATE audit_sessions 
    SET 
        last_activity = NEW.event_timestamp,
        events_count = events_count + 1,
        updated_at = NOW()
    WHERE id = NEW.session_id
    AND status = 'active';
    
    RETURN NEW;
END;
$$;

-- Create trigger for session activity updates
CREATE TRIGGER update_session_activity_trigger
    AFTER INSERT ON audit_events
    FOR EACH ROW
    WHEN (NEW.session_id IS NOT NULL)
    EXECUTE FUNCTION update_session_activity();

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_audit_sessions_updated_at
    BEFORE UPDATE ON audit_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_reports_updated_at
    BEFORE UPDATE ON audit_compliance_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retention_policies_updated_at
    BEFORE UPDATE ON audit_retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forensic_queries_updated_at
    BEFORE UPDATE ON audit_forensic_queries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create materialized view for compliance dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS audit_compliance_summary AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', event_timestamp) AS event_date,
    event_type,
    event_severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG(risk_score) as avg_risk_score,
    array_agg(DISTINCT compliance_tags[1:5]) FILTER (WHERE array_length(compliance_tags, 1) > 0) as top_compliance_tags
FROM audit_events
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY tenant_id, DATE_TRUNC('day', event_timestamp), event_type, event_severity;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_summary_unique
    ON audit_compliance_summary (tenant_id, event_date, event_type, event_severity);

-- Function to refresh compliance summary
CREATE OR REPLACE FUNCTION refresh_compliance_summary()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY audit_compliance_summary;
END;
$$;

-- Enable Row Level Security
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_forensic_queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY audit_events_tenant_isolation ON audit_events
    FOR ALL
    TO authenticated
    USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY audit_sessions_tenant_isolation ON audit_sessions
    FOR ALL
    TO authenticated
    USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY compliance_reports_tenant_isolation ON audit_compliance_reports
    FOR ALL
    TO authenticated
    USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY retention_policies_tenant_isolation ON audit_retention_policies
    FOR ALL
    TO authenticated
    USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY forensic_queries_tenant_isolation ON audit_forensic_queries
    FOR ALL
    TO authenticated
    USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

-- Additional RLS policies for role-based access
CREATE POLICY audit_events_read_only ON audit_events
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = (current_setting('app.current_tenant_id'))::uuid
        AND (
            current_setting('app.user_role') = 'admin'
            OR current_setting('app.user_role') = 'auditor'
            OR user_id = (current_setting('app.current_user_id'))::uuid
        )
    );

CREATE POLICY forensic_queries_investigator_access ON audit_forensic_queries
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (current_setting('app.current_tenant_id'))::uuid
        AND (
            current_setting('app.user_role') = 'admin'
            OR current_setting('app.user_role') = 'investigator'
            OR investigator_id = (current_setting('app.current_user_id'))::uuid
        )
    );

-- Grant permissions to service roles
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create indexes for RLS optimization
CREATE INDEX IF NOT EXISTS idx_audit_events_rls 
    ON audit_events (tenant_id) 
    WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_sessions_rls 
    ON audit_sessions (tenant_id) 
    WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_reports_rls 
    ON audit_compliance_reports (tenant_id) 
    WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_retention_policies_rls 
    ON audit_retention_policies (tenant_id) 
    WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forensic_queries_rls 
    ON audit_forensic_queries (tenant_id) 
    WHERE tenant_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE audit_events IS 'Immutable audit trail for all enterprise AI operations with hash chaining';
COMMENT ON TABLE audit_sessions IS 'User session tracking for audit correlation and anomaly detection';
COMMENT ON TABLE audit_compliance_reports IS 'Regulatory compliance reports and findings';
COMMENT ON TABLE audit_retention_policies IS 'Data lifecycle management and retention policies';
COMMENT ON TABLE audit_forensic_queries IS 'Investigation queries and forensic analysis tracking';

COMMENT ON COLUMN audit_events.event_hash IS 'SHA-256 hash for immutability verification';
COMMENT ON COLUMN audit_events.previous_event_hash IS 'Previous event hash for chain verification';
COMMENT ON COLUMN audit_events.chain_index IS 'Sequential index for hash chain ordering';
COMMENT ON COLUMN audit_events.compliance_tags IS 'Regulatory compliance framework tags';
COMMENT ON COLUMN audit_events.risk_score IS 'Risk assessment score (0-100)';

-- Migration completed successfully
```