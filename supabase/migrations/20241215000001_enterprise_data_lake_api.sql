```sql
-- Enterprise Data Lake API Migration
-- Generated: 2024-12-15
-- Purpose: Database schema for enterprise data lake connections with multi-format support, schema evolution, and real-time streaming

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_format_type') THEN
        CREATE TYPE data_format_type AS ENUM (
            'parquet',
            'delta',
            'iceberg', 
            'json',
            'csv',
            'avro',
            'orc',
            'arrow'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_status') THEN
        CREATE TYPE connection_status AS ENUM (
            'active',
            'inactive', 
            'testing',
            'error',
            'pending'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'streaming_mode') THEN
        CREATE TYPE streaming_mode AS ENUM (
            'real_time',
            'micro_batch',
            'batch',
            'change_data_capture'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schema_evolution_type') THEN
        CREATE TYPE schema_evolution_type AS ENUM (
            'column_added',
            'column_removed',
            'column_renamed',
            'data_type_changed',
            'constraint_added',
            'constraint_removed',
            'index_added',
            'index_removed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_metric_type') THEN
        CREATE TYPE quality_metric_type AS ENUM (
            'completeness',
            'accuracy',
            'consistency',
            'validity',
            'uniqueness',
            'timeliness',
            'anomaly_score'
        );
    END IF;
END $$;

-- Data Lake Connections Table
CREATE TABLE IF NOT EXISTS data_lake_connections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    provider VARCHAR(100) NOT NULL, -- aws_s3, azure_datalake, gcp_bigquery, databricks, snowflake
    connection_string TEXT NOT NULL,
    encrypted_credentials BYTEA NOT NULL, -- pgp_sym_encrypt for credentials
    region VARCHAR(100),
    bucket_name VARCHAR(255),
    base_path VARCHAR(1000),
    status connection_status DEFAULT 'pending',
    default_format data_format_type DEFAULT 'parquet',
    compression_type VARCHAR(50) DEFAULT 'snappy',
    partition_columns TEXT[], -- array of column names for partitioning
    configuration JSONB DEFAULT '{}', -- provider-specific config
    health_check_endpoint TEXT,
    last_health_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_tenant_connection_name UNIQUE(tenant_id, name)
);

-- Data Lake Schemas Table
CREATE TABLE IF NOT EXISTS data_lake_schemas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    schema_name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    schema_definition JSONB NOT NULL, -- JSON schema definition
    format data_format_type NOT NULL,
    table_path VARCHAR(1000) NOT NULL,
    partition_spec JSONB, -- partitioning specification
    sort_order JSONB, -- sort order specification
    table_properties JSONB DEFAULT '{}',
    row_count BIGINT,
    file_count INTEGER,
    total_size_bytes BIGINT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_schema_version UNIQUE(connection_id, schema_name, version)
);

-- Schema Evolution Log Table
CREATE TABLE IF NOT EXISTS schema_evolution_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    schema_id UUID NOT NULL REFERENCES data_lake_schemas(id) ON DELETE CASCADE,
    evolution_type schema_evolution_type NOT NULL,
    old_version INTEGER,
    new_version INTEGER NOT NULL,
    changes JSONB NOT NULL, -- detailed change description
    backward_compatible BOOLEAN DEFAULT false,
    migration_script TEXT,
    impact_assessment JSONB,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by UUID REFERENCES auth.users(id),
    rollback_script TEXT,
    
    INDEX idx_evolution_log_schema_id ON schema_evolution_log(schema_id),
    INDEX idx_evolution_log_timestamp ON schema_evolution_log(applied_at DESC)
);

-- Streaming Configurations Table
CREATE TABLE IF NOT EXISTS streaming_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    config_name VARCHAR(255) NOT NULL,
    mode streaming_mode NOT NULL,
    source_paths TEXT[] NOT NULL,
    target_path VARCHAR(1000),
    batch_size INTEGER DEFAULT 1000,
    batch_interval_seconds INTEGER DEFAULT 60,
    checkpoint_location VARCHAR(1000),
    watermark_column VARCHAR(255),
    watermark_delay_seconds INTEGER DEFAULT 30,
    trigger_settings JSONB DEFAULT '{}',
    stream_processing_options JSONB DEFAULT '{}',
    error_handling_policy JSONB DEFAULT '{"mode": "skip", "dead_letter_path": null}',
    monitoring_enabled BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_config_name_per_connection UNIQUE(connection_id, config_name)
);

-- Data Quality Metrics Table  
CREATE TABLE IF NOT EXISTS data_quality_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    schema_id UUID NOT NULL REFERENCES data_lake_schemas(id) ON DELETE CASCADE,
    metric_type quality_metric_type NOT NULL,
    column_name VARCHAR(255),
    metric_value DECIMAL(10,6) NOT NULL,
    threshold_min DECIMAL(10,6),
    threshold_max DECIMAL(10,6),
    is_within_threshold BOOLEAN,
    measurement_timestamp TIMESTAMPTZ DEFAULT NOW(),
    measurement_details JSONB DEFAULT '{}',
    data_sample_size BIGINT,
    
    INDEX idx_quality_metrics_schema_timestamp ON data_quality_metrics(schema_id, measurement_timestamp DESC),
    INDEX idx_quality_metrics_type ON data_quality_metrics(metric_type)
);

-- AI Training Datasets Table
CREATE TABLE IF NOT EXISTS ai_training_datasets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dataset_name VARCHAR(255) NOT NULL,
    description TEXT,
    schema_ids UUID[] NOT NULL, -- array of schema IDs
    training_query TEXT, -- SQL or query for data selection
    feature_columns TEXT[] NOT NULL,
    label_columns TEXT[],
    data_split_config JSONB DEFAULT '{"train": 0.8, "validation": 0.1, "test": 0.1}',
    preprocessing_steps JSONB DEFAULT '[]',
    sampling_strategy JSONB DEFAULT '{"type": "random", "fraction": 1.0}',
    refresh_schedule VARCHAR(100), -- cron expression
    last_refresh TIMESTAMPTZ,
    next_refresh TIMESTAMPTZ,
    row_count BIGINT,
    feature_count INTEGER,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_tenant_dataset_name UNIQUE(tenant_id, dataset_name, version)
);

-- Connection Health Monitoring Table
CREATE TABLE IF NOT EXISTS connection_health_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES data_lake_connections(id) ON DELETE CASCADE,
    check_timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_healthy BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    health_details JSONB DEFAULT '{}',
    
    INDEX idx_health_log_connection_timestamp ON connection_health_log(connection_id, check_timestamp DESC)
);

-- Streaming Job Status Table
CREATE TABLE IF NOT EXISTS streaming_job_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    config_id UUID NOT NULL REFERENCES streaming_configs(id) ON DELETE CASCADE,
    job_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- running, stopped, failed, completed
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    processed_records BIGINT DEFAULT 0,
    error_records BIGINT DEFAULT 0,
    last_checkpoint TIMESTAMPTZ,
    error_details JSONB,
    metrics JSONB DEFAULT '{}',
    
    INDEX idx_streaming_status_config ON streaming_job_status(config_id),
    INDEX idx_streaming_status_timestamp ON streaming_job_status(start_time DESC)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_tenant ON data_lake_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_status ON data_lake_connections(status);
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_provider ON data_lake_connections(provider);

CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_connection ON data_lake_schemas(connection_id);
CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_active ON data_lake_schemas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_format ON data_lake_schemas(format);

CREATE INDEX IF NOT EXISTS idx_streaming_configs_connection ON streaming_configs(connection_id);
CREATE INDEX IF NOT EXISTS idx_streaming_configs_active ON streaming_configs(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ai_training_datasets_tenant ON ai_training_datasets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_datasets_active ON ai_training_datasets(is_active) WHERE is_active = true;

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_data_lake_connections_config_gin ON data_lake_connections USING GIN (configuration);
CREATE INDEX IF NOT EXISTS idx_data_lake_schemas_definition_gin ON data_lake_schemas USING GIN (schema_definition);
CREATE INDEX IF NOT EXISTS idx_streaming_configs_options_gin ON streaming_configs USING GIN (stream_processing_options);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE data_lake_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lake_schemas ENABLE ROW LEVEL SECURITY;  
ALTER TABLE schema_evolution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_job_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_lake_connections
CREATE POLICY IF NOT EXISTS "Users can only access their own connections" 
    ON data_lake_connections FOR ALL 
    USING (tenant_id = auth.uid());

-- RLS Policies for data_lake_schemas
CREATE POLICY IF NOT EXISTS "Users can only access schemas for their connections" 
    ON data_lake_schemas FOR ALL 
    USING (
        connection_id IN (
            SELECT id FROM data_lake_connections WHERE tenant_id = auth.uid()
        )
    );

-- RLS Policies for schema_evolution_log
CREATE POLICY IF NOT EXISTS "Users can only access evolution log for their schemas" 
    ON schema_evolution_log FOR ALL 
    USING (
        schema_id IN (
            SELECT s.id FROM data_lake_schemas s 
            JOIN data_lake_connections c ON s.connection_id = c.id 
            WHERE c.tenant_id = auth.uid()
        )
    );

-- RLS Policies for streaming_configs
CREATE POLICY IF NOT EXISTS "Users can only access their streaming configs" 
    ON streaming_configs FOR ALL 
    USING (
        connection_id IN (
            SELECT id FROM data_lake_connections WHERE tenant_id = auth.uid()
        )
    );

-- RLS Policies for data_quality_metrics
CREATE POLICY IF NOT EXISTS "Users can only access quality metrics for their schemas" 
    ON data_quality_metrics FOR ALL 
    USING (
        schema_id IN (
            SELECT s.id FROM data_lake_schemas s 
            JOIN data_lake_connections c ON s.connection_id = c.id 
            WHERE c.tenant_id = auth.uid()
        )
    );

-- RLS Policies for ai_training_datasets
CREATE POLICY IF NOT EXISTS "Users can only access their own training datasets" 
    ON ai_training_datasets FOR ALL 
    USING (tenant_id = auth.uid());

-- RLS Policies for connection_health_log
CREATE POLICY IF NOT EXISTS "Users can only access health logs for their connections" 
    ON connection_health_log FOR ALL 
    USING (
        connection_id IN (
            SELECT id FROM data_lake_connections WHERE tenant_id = auth.uid()
        )
    );

-- RLS Policies for streaming_job_status
CREATE POLICY IF NOT EXISTS "Users can only access status for their streaming jobs" 
    ON streaming_job_status FOR ALL 
    USING (
        config_id IN (
            SELECT sc.id FROM streaming_configs sc 
            JOIN data_lake_connections c ON sc.connection_id = c.id 
            WHERE c.tenant_id = auth.uid()
        )
    );

-- Database Functions

-- Function to encrypt connection credentials
CREATE OR REPLACE FUNCTION encrypt_connection_credentials(credentials TEXT, key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN pgp_sym_encrypt(credentials, key);
END;
$$;

-- Function to decrypt connection credentials  
CREATE OR REPLACE FUNCTION decrypt_connection_credentials(encrypted_credentials BYTEA, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_credentials, key);
END;
$$;

-- Function to validate schema definition
CREATE OR REPLACE FUNCTION validate_schema_definition(schema_def JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Basic validation - ensure required fields exist
    IF NOT (schema_def ? 'fields' AND jsonb_typeof(schema_def->'fields') = 'array') THEN
        RETURN FALSE;
    END IF;
    
    -- Additional validation logic can be added here
    RETURN TRUE;
END;
$$;

-- Function to detect data format from file extension
CREATE OR REPLACE FUNCTION detect_data_format(file_path TEXT)
RETURNS data_format_type
LANGUAGE plpgsql
AS $$
DECLARE
    extension TEXT;
BEGIN
    extension := lower(split_part(file_path, '.', -1));
    
    CASE extension
        WHEN 'parquet' THEN RETURN 'parquet'::data_format_type;
        WHEN 'json' THEN RETURN 'json'::data_format_type;
        WHEN 'csv' THEN RETURN 'csv'::data_format_type;
        WHEN 'avro' THEN RETURN 'avro'::data_format_type;
        WHEN 'orc' THEN RETURN 'orc'::data_format_type;
        ELSE RETURN 'parquet'::data_format_type; -- default
    END CASE;
END;
$$;

-- Function to calculate schema compatibility score
CREATE OR REPLACE FUNCTION calculate_schema_compatibility(old_schema JSONB, new_schema JSONB)
RETURNS DECIMAL(3,2)
LANGUAGE plpgsql
AS $$
DECLARE
    compatibility_score DECIMAL(3,2) := 1.0;
    old_fields JSONB;
    new_fields JSONB;
BEGIN
    old_fields := old_schema->'fields';
    new_fields := new_schema->'fields';
    
    -- Simple compatibility check - can be enhanced
    IF jsonb_array_length(old_fields) != jsonb_array_length(new_fields) THEN
        compatibility_score := compatibility_score * 0.8;
    END IF;
    
    RETURN compatibility_score;
END;
$$;

-- Triggers for audit and automation

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_data_lake_connections_updated_at 
    BEFORE UPDATE ON data_lake_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_streaming_configs_updated_at 
    BEFORE UPDATE ON streaming_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_training_datasets_updated_at 
    BEFORE UPDATE ON ai_training_datasets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to log schema evolution
CREATE OR REPLACE FUNCTION log_schema_evolution()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.schema_definition != NEW.schema_definition THEN
        INSERT INTO schema_evolution_log (
            schema_id, evolution_type, old_version, new_version, 
            changes, backward_compatible, applied_by
        ) VALUES (
            NEW.id, 'column_added', OLD.version, NEW.version,
            jsonb_build_object('old_schema', OLD.schema_definition, 'new_schema', NEW.schema_definition),
            calculate_schema_compatibility(OLD.schema_definition, NEW.schema_definition) >= 0.9,
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_data_lake_schema_changes
    AFTER UPDATE ON data_lake_schemas
    FOR EACH ROW EXECUTE FUNCTION log_schema_evolution();

-- Comments for documentation
COMMENT ON TABLE data_lake_connections IS 'Stores enterprise data lake connection configurations with encrypted credentials';
COMMENT ON TABLE data_lake_schemas IS 'Tracks data lake table schemas with versioning support';
COMMENT ON TABLE schema_evolution_log IS 'Logs all schema changes for auditing and compatibility tracking';
COMMENT ON TABLE streaming_configs IS 'Configuration for real-time data streaming pipelines';
COMMENT ON TABLE data_quality_metrics IS 'Stores data quality measurements and monitoring results';
COMMENT ON TABLE ai_training_datasets IS 'Defines datasets for AI model training with preprocessing configuration';
COMMENT ON TABLE connection_health_log IS 'Tracks connection health status over time';
COMMENT ON TABLE streaming_job_status IS 'Monitors streaming job execution status and metrics';

-- Grant permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
```