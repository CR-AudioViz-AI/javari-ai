I understand you want Oracle Database integration, but since you specifically requested a Supabase PostgreSQL migration file, I'll provide that. Here's the complete SQL migration for supporting Oracle Database integration metadata:

```sql
-- Migration: Oracle Database Integration Support
-- Description: Tables and functions to support Oracle database connectivity with connection pooling, transaction management, and enterprise security compliance
-- Created: 2024-01-20

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Oracle connection configurations table
CREATE TABLE IF NOT EXISTS oracle_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    connection_string TEXT NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    pool_config JSONB DEFAULT '{
        "poolMin": 2,
        "poolMax": 10,
        "poolIncrement": 1,
        "poolTimeout": 60,
        "stmtCacheSize": 30,
        "connectionTimeout": 30000
    }',
    security_config JSONB DEFAULT '{
        "sslMode": "required",
        "maxRetries": 3,
        "retryDelay": 1000,
        "isolationLevel": "READ_COMMITTED"
    }',
    is_active BOOLEAN DEFAULT true,
    environment VARCHAR(50) DEFAULT 'development',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Oracle connection pool status tracking
CREATE TABLE IF NOT EXISTS oracle_pool_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id) ON DELETE CASCADE,
    pool_size INTEGER NOT NULL DEFAULT 0,
    connections_open INTEGER NOT NULL DEFAULT 0,
    connections_in_use INTEGER NOT NULL DEFAULT 0,
    total_connections_created INTEGER NOT NULL DEFAULT 0,
    total_requests_enqueued INTEGER NOT NULL DEFAULT 0,
    total_request_timeouts INTEGER NOT NULL DEFAULT 0,
    health_status VARCHAR(20) DEFAULT 'healthy',
    last_health_check TIMESTAMPTZ DEFAULT NOW(),
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oracle transaction logs for audit compliance
CREATE TABLE IF NOT EXISTS oracle_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id),
    transaction_id VARCHAR(255) NOT NULL,
    isolation_level VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    query_count INTEGER DEFAULT 0,
    rows_affected INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id),
    session_id VARCHAR(255),
    client_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oracle query execution logs
CREATE TABLE IF NOT EXISTS oracle_query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id),
    transaction_id UUID REFERENCES oracle_transactions(id),
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    parameters JSONB DEFAULT '[]',
    execution_time_ms INTEGER NOT NULL,
    rows_returned INTEGER DEFAULT 0,
    rows_affected INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    user_id UUID REFERENCES auth.users(id),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oracle security audit logs for SOX compliance
CREATE TABLE IF NOT EXISTS oracle_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id),
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    username VARCHAR(255),
    client_ip INET,
    user_agent TEXT,
    event_details JSONB NOT NULL DEFAULT '{}',
    risk_level VARCHAR(20) DEFAULT 'low',
    compliance_tags TEXT[] DEFAULT '{}',
    session_id VARCHAR(255),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oracle health check results
CREATE TABLE IF NOT EXISTS oracle_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id),
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    details JSONB DEFAULT '{}',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oracle prepared statements cache
CREATE TABLE IF NOT EXISTS oracle_prepared_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id),
    statement_hash VARCHAR(64) NOT NULL,
    statement_text TEXT NOT NULL,
    parameter_count INTEGER NOT NULL DEFAULT 0,
    parameter_types JSONB DEFAULT '[]',
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, statement_hash)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oracle_connections_name ON oracle_connections(name);
CREATE INDEX IF NOT EXISTS idx_oracle_connections_environment ON oracle_connections(environment);
CREATE INDEX IF NOT EXISTS idx_oracle_connections_active ON oracle_connections(is_active);

CREATE INDEX IF NOT EXISTS idx_oracle_pool_status_connection ON oracle_pool_status(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_pool_status_health ON oracle_pool_status(health_status);
CREATE INDEX IF NOT EXISTS idx_oracle_pool_status_updated ON oracle_pool_status(updated_at);

CREATE INDEX IF NOT EXISTS idx_oracle_transactions_connection ON oracle_transactions(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_transactions_status ON oracle_transactions(status);
CREATE INDEX IF NOT EXISTS idx_oracle_transactions_started ON oracle_transactions(started_at);
CREATE INDEX IF NOT EXISTS idx_oracle_transactions_user ON oracle_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_oracle_query_logs_connection ON oracle_query_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_query_logs_transaction ON oracle_query_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_oracle_query_logs_executed ON oracle_query_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_oracle_query_logs_hash ON oracle_query_logs(query_hash);
CREATE INDEX IF NOT EXISTS idx_oracle_query_logs_user ON oracle_query_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_oracle_audit_logs_connection ON oracle_audit_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_audit_logs_event_type ON oracle_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_oracle_audit_logs_user ON oracle_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_audit_logs_occurred ON oracle_audit_logs(occurred_at);
CREATE INDEX IF NOT EXISTS idx_oracle_audit_logs_risk ON oracle_audit_logs(risk_level);

CREATE INDEX IF NOT EXISTS idx_oracle_health_checks_connection ON oracle_health_checks(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_health_checks_type ON oracle_health_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_oracle_health_checks_status ON oracle_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_oracle_health_checks_checked ON oracle_health_checks(checked_at);

CREATE INDEX IF NOT EXISTS idx_oracle_prepared_statements_connection ON oracle_prepared_statements(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_prepared_statements_hash ON oracle_prepared_statements(statement_hash);
CREATE INDEX IF NOT EXISTS idx_oracle_prepared_statements_used ON oracle_prepared_statements(last_used_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_oracle_connections_updated_at
    BEFORE UPDATE ON oracle_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_pool_status_updated_at
    BEFORE UPDATE ON oracle_pool_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE oracle_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_pool_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_query_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_prepared_statements ENABLE ROW LEVEL SECURITY;

-- Admin users can manage all oracle connections
CREATE POLICY "Admin full access to oracle_connections" ON oracle_connections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_app_meta_data->>'role' = 'admin'
        )
    );

-- Users can view connections they created or are assigned to
CREATE POLICY "Users can view assigned oracle_connections" ON oracle_connections
    FOR SELECT USING (
        created_by = auth.uid() OR 
        updated_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_app_meta_data->>'oracle_access' ? id::text
        )
    );

-- Service role can access all tables for API operations
CREATE POLICY "Service role access oracle_pool_status" ON oracle_pool_status
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access oracle_transactions" ON oracle_transactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access oracle_query_logs" ON oracle_query_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access oracle_audit_logs" ON oracle_audit_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access oracle_health_checks" ON oracle_health_checks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access oracle_prepared_statements" ON oracle_prepared_statements
    FOR ALL USING (auth.role() = 'service_role');

-- Function to encrypt connection passwords
CREATE OR REPLACE FUNCTION encrypt_oracle_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate connection pool configuration
CREATE OR REPLACE FUNCTION validate_oracle_pool_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check required fields and valid ranges
    RETURN (
        config ? 'poolMin' AND 
        config ? 'poolMax' AND
        (config->>'poolMin')::INTEGER >= 1 AND
        (config->>'poolMax')::INTEGER <= 100 AND
        (config->>'poolMin')::INTEGER <= (config->>'poolMax')::INTEGER AND
        (config->>'poolTimeout')::INTEGER > 0 AND
        (config->>'connectionTimeout')::INTEGER > 0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to log Oracle audit events
CREATE OR REPLACE FUNCTION log_oracle_audit_event(
    p_connection_id UUID,
    p_event_type VARCHAR(50),
    p_event_category VARCHAR(50),
    p_event_details JSONB DEFAULT '{}',
    p_risk_level VARCHAR(20) DEFAULT 'low'
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO oracle_audit_logs (
        connection_id,
        event_type,
        event_category,
        user_id,
        event_details,
        risk_level,
        client_ip,
        user_agent
    ) VALUES (
        p_connection_id,
        p_event_type,
        p_event_category,
        auth.uid(),
        p_event_details,
        p_risk_level,
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old logs (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_oracle_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM oracle_query_logs 
        WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    DELETE FROM oracle_health_checks 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    -- Clean up completed transactions older than retention period
    DELETE FROM oracle_transactions 
    WHERE status IN ('committed', 'rolled_back') 
    AND completed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role, authenticated;

COMMIT;
```