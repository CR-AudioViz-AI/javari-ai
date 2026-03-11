```sql
-- Migration: Create Data Lake Connector Tables
-- Description: Tables for enterprise data lake connections, schema discovery, and lineage tracking
-- Created: 2024-12-01

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for data lake platforms
DO $$ BEGIN
    CREATE TYPE data_lake_platform AS ENUM (
        'snowflake',
        'databricks', 
        'aws_lake_formation',
        'azure_data_lake',
        'google_bigquery'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE connection_status AS ENUM (
        'pending',
        'connected',
        'disconnected',
        'error',
        'testing'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE data_type_category AS ENUM (
        'string',
        'numeric',
        'boolean',
        'datetime',
        'json',
        'array',
        'binary',
        'unknown'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lineage_operation AS ENUM (
        'create',
        'read',
        'update',
        'delete',
        'transform',
        'aggregate',
        'join',
        'union'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Data lake connections table
CREATE TABLE IF NOT EXISTS data_lake_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    platform data_lake_platform NOT NULL,
    status connection_status DEFAULT 'pending',
    
    -- Connection configuration (encrypted)
    config_encrypted TEXT NOT NULL,
    config_iv TEXT NOT NULL,
    
    -- Connection metadata
    endpoint_url TEXT,
    region VARCHAR(50),
    warehouse_name VARCHAR(255),
    database_name VARCHAR(255),
    schema_name VARCHAR(255),
    
    -- Performance settings
    connection_timeout INTEGER DEFAULT 30,
    query_timeout INTEGER DEFAULT 300,
    max_concurrent_queries INTEGER DEFAULT 10,
    
    -- Monitoring
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    connection_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_connection_per_user_name UNIQUE (user_id, name)
);

-- Schema discovery results table
CREATE TABLE IF NOT EXISTS data_lake_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    
    -- Schema hierarchy
    catalog_name VARCHAR(255),
    database_name VARCHAR(255),
    schema_name VARCHAR(255) NOT NULL,
    table_name VARCHAR(255),
    
    -- Schema metadata
    schema_type VARCHAR(50), -- 'database', 'table', 'view', 'materialized_view'
    description TEXT,
    owner VARCHAR(255),
    location TEXT, -- S3 path, HDFS path, etc.
    
    -- Table statistics
    row_count BIGINT,
    size_bytes BIGINT,
    partition_count INTEGER,
    
    -- Discovery metadata
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    -- Full schema definition (JSON)
    schema_definition JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_schema_per_connection UNIQUE (connection_id, catalog_name, database_name, schema_name, table_name)
);

-- Column definitions table
CREATE TABLE IF NOT EXISTS data_lake_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_id UUID NOT NULL REFERENCES data_lake_schemas(id) ON DELETE CASCADE,
    
    -- Column details
    column_name VARCHAR(255) NOT NULL,
    ordinal_position INTEGER NOT NULL,
    data_type VARCHAR(255) NOT NULL,
    data_type_category data_type_category,
    
    -- Column properties
    is_nullable BOOLEAN DEFAULT true,
    is_primary_key BOOLEAN DEFAULT false,
    is_foreign_key BOOLEAN DEFAULT false,
    is_partition_key BOOLEAN DEFAULT false,
    is_clustering_key BOOLEAN DEFAULT false,
    
    -- Data quality metrics
    null_percentage DECIMAL(5,2),
    unique_count BIGINT,
    min_value TEXT,
    max_value TEXT,
    avg_length DECIMAL(10,2),
    
    -- Column metadata
    description TEXT,
    default_value TEXT,
    format_mask VARCHAR(100),
    
    -- Tags and classification
    tags JSONB DEFAULT '[]',
    sensitivity_level VARCHAR(20), -- 'public', 'internal', 'confidential', 'restricted'
    pii_classification JSONB, -- Personal Identifiable Information tags
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_column_per_schema UNIQUE (schema_id, column_name)
);

-- Data lineage tracking table
CREATE TABLE IF NOT EXISTS data_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    
    -- Source and target identification
    source_schema_id UUID REFERENCES data_lake_schemas(id) ON DELETE CASCADE,
    target_schema_id UUID REFERENCES data_lake_schemas(id) ON DELETE CASCADE,
    
    -- Lineage operation details
    operation_type lineage_operation NOT NULL,
    operation_name VARCHAR(255), -- Job name, query name, etc.
    operation_description TEXT,
    
    -- Transformation logic
    transformation_logic TEXT, -- SQL, code, or description
    transformation_type VARCHAR(100), -- 'sql', 'python', 'scala', 'spark', etc.
    
    -- Execution context
    job_id VARCHAR(255),
    run_id VARCHAR(255),
    pipeline_name VARCHAR(255),
    user_name VARCHAR(255),
    
    -- Timing information
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Data volume metrics
    rows_read BIGINT,
    rows_written BIGINT,
    bytes_read BIGINT,
    bytes_written BIGINT,
    
    -- OpenLineage integration
    openlineage_event JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connection health monitoring table
CREATE TABLE IF NOT EXISTS data_lake_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    
    -- Health check details
    check_type VARCHAR(50) NOT NULL, -- 'connectivity', 'authentication', 'performance'
    status connection_status NOT NULL,
    
    -- Performance metrics
    response_time_ms INTEGER,
    query_success_rate DECIMAL(5,2),
    error_count INTEGER DEFAULT 0,
    
    -- Error details
    error_message TEXT,
    error_code VARCHAR(50),
    stack_trace TEXT,
    
    -- Check metadata
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    next_check_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query execution history table
CREATE TABLE IF NOT EXISTS data_lake_query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Query details
    query_text TEXT NOT NULL,
    query_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of query
    query_type VARCHAR(50), -- 'select', 'insert', 'update', 'delete', 'create', 'drop'
    
    -- Execution metrics
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    rows_returned BIGINT,
    bytes_scanned BIGINT,
    
    -- Query status
    status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'failed', 'cancelled'
    error_message TEXT,
    
    -- Resource usage
    compute_credits DECIMAL(10,6),
    warehouse_size VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data lake credentials vault (encrypted storage)
CREATE TABLE IF NOT EXISTS data_lake_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    
    -- Credential metadata
    credential_type VARCHAR(50) NOT NULL, -- 'username_password', 'oauth', 'key_pair', 'iam_role'
    credential_name VARCHAR(255) NOT NULL,
    
    -- Encrypted credentials
    credentials_encrypted TEXT NOT NULL,
    credentials_iv TEXT NOT NULL,
    key_version INTEGER DEFAULT 1,
    
    -- Expiration and rotation
    expires_at TIMESTAMPTZ,
    last_rotated_at TIMESTAMPTZ,
    auto_rotate BOOLEAN DEFAULT false,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_credential_per_connection UNIQUE (connection_id, credential_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_user_id ON data_lake_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_org_id ON data_lake_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_platform ON data_lake_connections(platform);
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_status ON data_lake_connections(status);

CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_connection_id ON data_lake_schemas(connection_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_schema_name ON data_lake_schemas(schema_name);
CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_table_name ON data_lake_schemas(table_name);
CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_discovery ON data_lake_schemas(connection_id, discovered_at);

CREATE INDEX IF NOT EXISTS idx_data_lake_columns_schema_id ON data_lake_columns(schema_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_columns_name ON data_lake_columns(column_name);
CREATE INDEX IF NOT EXISTS idx_data_lake_columns_type ON data_lake_columns(data_type_category);
CREATE INDEX IF NOT EXISTS idx_data_lake_columns_pii ON data_lake_columns(sensitivity_level) WHERE sensitivity_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_lineage_connection_id ON data_lineage(connection_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_source ON data_lineage(source_schema_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_target ON data_lineage(target_schema_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_operation ON data_lineage(operation_type);
CREATE INDEX IF NOT EXISTS idx_data_lineage_timing ON data_lineage(started_at, completed_at);

CREATE INDEX IF NOT EXISTS idx_data_lake_health_checks_connection_id ON data_lake_health_checks(connection_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_health_checks_status ON data_lake_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_data_lake_health_checks_timing ON data_lake_health_checks(checked_at);

CREATE INDEX IF NOT EXISTS idx_data_lake_query_history_connection_id ON data_lake_query_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_query_history_user_id ON data_lake_query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_query_history_hash ON data_lake_query_history(query_hash);
CREATE INDEX IF NOT EXISTS idx_data_lake_query_history_timing ON data_lake_query_history(started_at);

CREATE INDEX IF NOT EXISTS idx_data_lake_credentials_connection_id ON data_lake_credentials(connection_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_credentials_type ON data_lake_credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_data_lake_credentials_expiration ON data_lake_credentials(expires_at) WHERE expires_at IS NOT NULL;

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_definition ON data_lake_schemas USING GIN (schema_definition);
CREATE INDEX IF NOT EXISTS idx_data_lake_columns_tags ON data_lake_columns USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_data_lake_columns_pii_classification ON data_lake_columns USING GIN (pii_classification);
CREATE INDEX IF NOT EXISTS idx_data_lineage_openlineage ON data_lineage USING GIN (openlineage_event);

-- Enable Row Level Security
ALTER TABLE data_lake_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lake_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lake_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lake_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lake_query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lake_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_lake_connections
CREATE POLICY "Users can view their own data lake connections" ON data_lake_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data lake connections" ON data_lake_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data lake connections" ON data_lake_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own data lake connections" ON data_lake_connections
    FOR DELETE USING (auth.uid() = user_id);

-- Organization members can view connections
CREATE POLICY "Organization members can view connections" ON data_lake_connections
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for data_lake_schemas
CREATE POLICY "Users can view schemas for their connections" ON data_lake_schemas
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM data_lake_connections 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage schemas for their connections" ON data_lake_schemas
    FOR ALL USING (
        connection_id IN (
            SELECT id FROM data_lake_connections 
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for data_lake_columns
CREATE POLICY "Users can view columns for their schemas" ON data_lake_columns
    FOR SELECT USING (
        schema_id IN (
            SELECT s.id FROM data_lake_schemas s
            JOIN data_lake_connections c ON s.connection_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage columns for their schemas" ON data_lake_columns
    FOR ALL USING (
        schema_id IN (
            SELECT s.id FROM data_lake_schemas s
            JOIN data_lake_connections c ON s.connection_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- RLS Policies for data_lineage
CREATE POLICY "Users can view lineage for their connections" ON data_lineage
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM data_lake_connections 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage lineage for their connections" ON data_lineage
    FOR ALL USING (
        connection_id IN (
            SELECT id FROM data_lake_connections 
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for health checks
CREATE POLICY "Users can view health checks for their connections" ON data_lake_health_checks
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM data_lake_connections 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage all health checks" ON data_lake_health_checks
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for query history
CREATE POLICY "Users can view their own query history" ON data_lake_query_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own query history" ON data_lake_query_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for credentials (highly restricted)
CREATE POLICY "Users can view their own credentials metadata" ON data_lake_credentials
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM data_lake_connections 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own credentials" ON data_lake_credentials
    FOR ALL USING (
        connection_id IN (
            SELECT id FROM data_lake_connections 
            WHERE user_id = auth.uid()
        )
    );

-- Create functions for automated tasks
CREATE OR REPLACE FUNCTION update_data_lake_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_data_lake_connections_updated_at
    BEFORE UPDATE ON data_lake_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_data_lake_updated_at();

CREATE TRIGGER trigger_data_lake_schemas_updated_at
    BEFORE UPDATE ON data_lake_schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_data_lake_updated_at();

CREATE TRIGGER trigger_data_lake_columns_updated_at
    BEFORE UPDATE ON data_lake_columns
    FOR EACH ROW
    EXECUTE FUNCTION update_data_lake_updated_at();

CREATE TRIGGER trigger_data_lineage_updated_at
    BEFORE UPDATE ON data_lineage
    FOR EACH ROW
    EXECUTE FUNCTION update_data_lake_updated_at();

CREATE TRIGGER trigger_data_lake_credentials_updated_at
    BEFORE UPDATE ON data_lake_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_data_lake_updated_at();

-- Create function to automatically schedule health checks
CREATE OR REPLACE FUNCTION schedule_next_health_check()
RETURNS TRIGGER AS $$
BEGIN
    NEW.next_check_at = NOW() + INTERVAL '5 minutes';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_schedule_health_check
    BEFORE INSERT ON data_lake_health_checks
    FOR EACH ROW
    EXECUTE FUNCTION schedule_next_health_check();

-- Create materialized view for connection health summary
CREATE MATERIALIZED VIEW IF NOT EXISTS data_lake_connection_health_summary AS
SELECT 
    c.id as connection_id,
    c.name as connection_name,
    c.platform,
    c.status as connection_status,
    c.last_connected_at,
    COUNT(h.id) as total_checks,
    COUNT(CASE WHEN h.status = 'connected' THEN 1 END) as successful_checks,
    AVG(h.response_time_ms) as avg_response_time_ms,
    MAX(h.checked_at) as last_health_check,
    COUNT(CASE WHEN h.error_message IS NOT NULL THEN 1 END) as error_count
FROM data_lake_connections c
LEFT JOIN data_lake_health_checks h ON c.id = h.connection_id
WHERE h.checked_at >= NOW() - INTERVAL '24 hours' OR h.checked_at IS NULL
GROUP BY c.id, c.name, c.platform, c.status, c.last_connected_at;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_lake_health_summary_connection_id 
ON data_lake_connection_health_summary(connection_id);

-- Grant permissions
GRANT SELECT ON data_lake_connections TO authenticated;
GRANT SELECT ON data_lake_schemas TO authenticated;
GRANT SELECT ON data_lake_columns TO authenticated;
GRANT SELECT ON data_lake_lineage TO authenticated;
GRANT SELECT ON data_lake_health_checks TO authenticated;
GRANT SELECT ON data_lake_query_history TO authenticated;
GRANT SELECT ON data_lake_credentials TO authenticated;
GRANT SELECT ON data_lake_connection_health_summary TO authenticated;

GRANT INSERT, UPDATE, DELETE ON data_lake_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON data_lake_schemas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON data_lake_columns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON data_lake_lineage TO authenticated;
GRANT INSERT, UPDATE, DELETE ON data_lake_query_history TO authenticated;
GRANT INSERT, UPDATE, DELETE ON data_lake_credentials TO authenticated;

-- Grant service role full access for background tasks
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Add helpful comments
COMMENT ON TABLE data_lake_connections IS 'Enterprise data lake connection configurations with encrypted credentials';
COMMENT ON TABLE data_lake_schemas IS 'Discovered schema metadata from connected data lakes';
COMMENT ON TABLE data_lake_columns IS 'Column definitions with data quality metrics and PII classification';
COMMENT ON TABLE data_lineage IS 'Data lineage tracking for audit and impact analysis';
COMMENT ON TABLE data_lake_health_checks IS 'Connection health monitoring and performance metrics';
COMMENT ON TABLE data_lake_query_history IS 'Query execution history and performance tracking';
COMMENT ON TABLE data_lake_credentials IS 'Encrypted credential storage for data lake authentication';
```