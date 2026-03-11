-- Oracle Database Integration API Migration
-- File: migrations/001_oracle_integration.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create enum types
CREATE TYPE oracle_connection_type AS ENUM ('oci', 'on_premise');
CREATE TYPE oracle_connection_status AS ENUM ('connected', 'disconnected', 'error', 'connecting');
CREATE TYPE transaction_status AS ENUM ('pending', 'committed', 'rolled_back', 'failed');
CREATE TYPE query_status AS ENUM ('pending', 'running', 'completed', 'failed', 'timeout');

-- Oracle connections table
CREATE TABLE IF NOT EXISTS oracle_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    connection_type oracle_connection_type NOT NULL,
    
    -- Connection configuration
    host VARCHAR(255),
    port INTEGER DEFAULT 1521,
    service_name VARCHAR(255),
    sid VARCHAR(255),
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    
    -- OCI specific fields
    oci_config_profile VARCHAR(255),
    oci_region VARCHAR(100),
    oci_compartment_id VARCHAR(255),
    oci_autonomous_database_id VARCHAR(255),
    
    -- Connection pool settings
    pool_min INTEGER DEFAULT 1,
    pool_max INTEGER DEFAULT 10,
    pool_increment INTEGER DEFAULT 1,
    pool_timeout INTEGER DEFAULT 60000,
    
    -- Connection status
    status oracle_connection_status DEFAULT 'disconnected',
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    health_check_interval INTEGER DEFAULT 300,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_connection_name UNIQUE(name)
);

-- Oracle queries table
CREATE TABLE IF NOT EXISTS oracle_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id) ON DELETE CASCADE,
    
    -- Query information
    query_text TEXT NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    query_type VARCHAR(50) NOT NULL, -- SELECT, INSERT, UPDATE, DELETE, DDL
    
    -- Execution details
    status query_status DEFAULT 'pending',
    execution_plan JSONB,
    bind_variables JSONB,
    result_count INTEGER,
    rows_affected INTEGER,
    
    -- Performance metrics
    execution_time_ms INTEGER,
    cpu_time_ms INTEGER,
    logical_reads BIGINT,
    physical_reads BIGINT,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Error handling
    error_code VARCHAR(20),
    error_message TEXT,
    
    -- Metadata
    executed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oracle transactions table
CREATE TABLE IF NOT EXISTS oracle_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_id VARCHAR(255) NOT NULL,
    status transaction_status DEFAULT 'pending',
    isolation_level VARCHAR(50),
    
    -- Queries in transaction
    query_count INTEGER DEFAULT 0,
    queries JSONB DEFAULT '[]',
    
    -- Performance
    duration_ms INTEGER,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    committed_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    rollback_reason TEXT,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_transaction_id UNIQUE(transaction_id)
);

-- Connection health monitoring table
CREATE TABLE IF NOT EXISTS oracle_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id) ON DELETE CASCADE,
    
    -- Health metrics
    is_healthy BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    connection_count INTEGER,
    active_sessions INTEGER,
    blocked_sessions INTEGER,
    
    -- Database metrics
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_percent DECIMAL(5,2),
    storage_usage_percent DECIMAL(5,2),
    
    -- Additional metrics
    tablespace_usage JSONB,
    wait_events JSONB,
    
    -- Error information
    error_message TEXT,
    warning_messages TEXT[],
    
    -- Timing
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    check_type VARCHAR(50) DEFAULT 'scheduled'
);

-- Query optimization cache table
CREATE TABLE IF NOT EXISTS oracle_query_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id) ON DELETE CASCADE,
    
    -- Query identification
    query_hash VARCHAR(64) NOT NULL,
    query_signature TEXT NOT NULL,
    
    -- Optimization data
    execution_plan JSONB NOT NULL,
    cost_estimate DECIMAL(10,2),
    cardinality_estimate BIGINT,
    
    -- Statistics
    execution_count INTEGER DEFAULT 0,
    average_execution_time_ms DECIMAL(10,2),
    last_execution_time_ms INTEGER,
    
    -- Cache metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT unique_query_cache UNIQUE(connection_id, query_hash)
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS oracle_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id) ON DELETE CASCADE,
    
    -- Migration details
    migration_name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Migration content
    up_script TEXT NOT NULL,
    down_script TEXT,
    checksum VARCHAR(64) NOT NULL,
    
    -- Execution status
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, rolled_back
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    execution_time_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    
    -- Metadata
    applied_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_migration_version UNIQUE(connection_id, version)
);

-- Connection usage statistics table
CREATE TABLE IF NOT EXISTS oracle_connection_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES oracle_connections(id) ON DELETE CASCADE,
    
    -- Usage metrics
    total_queries INTEGER DEFAULT 0,
    successful_queries INTEGER DEFAULT 0,
    failed_queries INTEGER DEFAULT 0,
    
    -- Performance metrics
    average_response_time_ms DECIMAL(10,2),
    max_response_time_ms INTEGER,
    min_response_time_ms INTEGER,
    
    -- Connection pool metrics
    max_connections_used INTEGER DEFAULT 0,
    average_connections_used DECIMAL(5,2),
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_connection_period UNIQUE(connection_id, period_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oracle_connections_status ON oracle_connections(status);
CREATE INDEX IF NOT EXISTS idx_oracle_connections_type ON oracle_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_oracle_connections_created_by ON oracle_connections(created_by);

CREATE INDEX IF NOT EXISTS idx_oracle_queries_connection_id ON oracle_queries(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_status ON oracle_queries(status);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_query_hash ON oracle_queries(query_hash);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_executed_by ON oracle_queries(executed_by);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_created_at ON oracle_queries(created_at);

CREATE INDEX IF NOT EXISTS idx_oracle_transactions_connection_id ON oracle_transactions(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_transactions_status ON oracle_transactions(status);
CREATE INDEX IF NOT EXISTS idx_oracle_transactions_transaction_id ON oracle_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_oracle_transactions_created_by ON oracle_transactions(created_by);

CREATE INDEX IF NOT EXISTS idx_oracle_health_checks_connection_id ON oracle_health_checks(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_health_checks_checked_at ON oracle_health_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_oracle_health_checks_is_healthy ON oracle_health_checks(is_healthy);

CREATE INDEX IF NOT EXISTS idx_oracle_query_cache_connection_id ON oracle_query_cache(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_query_cache_query_hash ON oracle_query_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_oracle_query_cache_last_used ON oracle_query_cache(last_used_at);

CREATE INDEX IF NOT EXISTS idx_oracle_migrations_connection_id ON oracle_migrations(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_migrations_status ON oracle_migrations(status);
CREATE INDEX IF NOT EXISTS idx_oracle_migrations_version ON oracle_migrations(version);

CREATE INDEX IF NOT EXISTS idx_oracle_connection_stats_connection_id ON oracle_connection_stats(connection_id);
CREATE INDEX IF NOT EXISTS idx_oracle_connection_stats_period ON oracle_connection_stats(period_start, period_end);

-- Create functions for automated tasks
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating updated_at
CREATE TRIGGER update_oracle_connections_updated_at 
    BEFORE UPDATE ON oracle_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old health checks
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS void AS $$
BEGIN
    DELETE FROM oracle_health_checks 
    WHERE checked_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old query logs
CREATE OR REPLACE FUNCTION cleanup_old_query_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM oracle_queries 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to expire query cache entries
CREATE OR REPLACE FUNCTION expire_query_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM oracle_query_cache 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    -- Also clean up unused cache entries
    DELETE FROM oracle_query_cache 
    WHERE last_used_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE oracle_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_query_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_connection_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own connections" ON oracle_connections
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create connections" ON oracle_connections
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own connections" ON oracle_connections
    FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own connections" ON oracle_connections
    FOR DELETE USING (created_by = auth.uid());

CREATE POLICY "Users can view queries for their connections" ON oracle_queries
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create queries for their connections" ON oracle_queries
    FOR INSERT WITH CHECK (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view transactions for their connections" ON oracle_transactions
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create transactions for their connections" ON oracle_transactions
    FOR INSERT WITH CHECK (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view health checks for their connections" ON oracle_health_checks
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "System can create health checks" ON oracle_health_checks
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view query cache for their connections" ON oracle_query_cache
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "System can manage query cache" ON oracle_query_cache
    FOR ALL USING (true);

CREATE POLICY "Users can view migrations for their connections" ON oracle_migrations
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create migrations for their connections" ON oracle_migrations
    FOR INSERT WITH CHECK (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view stats for their connections" ON oracle_connection_stats
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM oracle_connections WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "System can create connection stats" ON oracle_connection_stats
    FOR INSERT WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create view for connection summary
CREATE OR REPLACE VIEW oracle_connection_summary AS
SELECT 
    c.id,
    c.name,
    c.connection_type,
    c.status,
    c.last_connected_at,
    c.created_at,
    COALESCE(q.query_count, 0) as total_queries,
    COALESCE(t.transaction_count, 0) as total_transactions,
    h.last_health_check,
    h.is_healthy
FROM oracle_connections c
LEFT JOIN (
    SELECT connection_id, COUNT(*) as query_count
    FROM oracle_queries
    GROUP BY connection_id
) q ON c.id = q.connection_id
LEFT JOIN (
    SELECT connection_id, COUNT(*) as transaction_count
    FROM oracle_transactions
    GROUP BY connection_id
) t ON c.id = t.connection_id
LEFT JOIN (
    SELECT DISTINCT ON (connection_id) connection_id, checked_at as last_health_check, is_healthy
    FROM oracle_health_checks
    ORDER BY connection_id, checked_at DESC
) h ON c.id = h.connection_id;

-- Comment on tables
COMMENT ON TABLE oracle_connections IS 'Oracle database connection configurations';
COMMENT ON TABLE oracle_queries IS 'Oracle query execution logs and metrics';
COMMENT ON TABLE oracle_transactions IS 'Oracle transaction tracking and management';
COMMENT ON TABLE oracle_health_checks IS 'Oracle database health monitoring data';
COMMENT ON TABLE oracle_query_cache IS 'Query execution plan cache for optimization';
COMMENT ON TABLE oracle_migrations IS 'Database migration tracking and execution';
COMMENT ON TABLE oracle_connection_stats IS 'Connection usage statistics and metrics';