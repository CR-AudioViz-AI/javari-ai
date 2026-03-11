```sql
-- Enterprise Data Pipeline Migration
-- Created: 2024-12-01
-- Description: Complete database schema for enterprise data pipeline infrastructure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create custom enum types
DO $$ BEGIN
    CREATE TYPE connection_type AS ENUM (
        'database',
        'file_system',
        'cloud_storage',
        'api',
        'stream',
        'webhook'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pipeline_status AS ENUM (
        'draft',
        'active',
        'paused',
        'deprecated',
        'error'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE run_status AS ENUM (
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled',
        'timeout'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transformation_type AS ENUM (
        'filter',
        'map',
        'aggregate',
        'join',
        'split',
        'validate',
        'enrich',
        'normalize'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE data_quality_severity AS ENUM (
        'info',
        'warning',
        'error',
        'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Connection credentials table (encrypted storage)
CREATE TABLE IF NOT EXISTS connection_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    connection_type connection_type NOT NULL,
    encrypted_credentials JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_credential_name UNIQUE (name)
);

-- Data sources table
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    connection_type connection_type NOT NULL,
    connection_config JSONB NOT NULL,
    credential_id UUID REFERENCES connection_credentials(id),
    description TEXT,
    health_check_config JSONB,
    is_active BOOLEAN DEFAULT true,
    tags TEXT[],
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_health_check TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(50) DEFAULT 'unknown',
    
    CONSTRAINT unique_source_name UNIQUE (name)
);

-- Data schemas table for structure validation
CREATE TABLE IF NOT EXISTS data_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    schema_definition JSONB NOT NULL,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    validation_rules JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_schema_version UNIQUE (name, version)
);

-- Data quality rules table
CREATE TABLE IF NOT EXISTS data_quality_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL,
    rule_definition JSONB NOT NULL,
    severity data_quality_severity DEFAULT 'warning',
    data_schema_id UUID REFERENCES data_schemas(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    error_threshold DECIMAL(5,2) DEFAULT 5.0,
    warning_threshold DECIMAL(5,2) DEFAULT 1.0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data transformations table
CREATE TABLE IF NOT EXISTS data_transformations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    transformation_type transformation_type NOT NULL,
    transformation_config JSONB NOT NULL,
    input_schema JSONB,
    output_schema JSONB,
    is_active BOOLEAN DEFAULT true,
    execution_order INTEGER DEFAULT 0,
    error_handling_config JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_transformation_name UNIQUE (name)
);

-- Pipeline schedules table
CREATE TABLE IF NOT EXISTS pipeline_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    next_run_time TIMESTAMP WITH TIME ZONE,
    last_run_time TIMESTAMP WITH TIME ZONE,
    max_concurrent_runs INTEGER DEFAULT 1,
    timeout_minutes INTEGER DEFAULT 60,
    retry_config JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data pipelines table
CREATE TABLE IF NOT EXISTS data_pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status pipeline_status DEFAULT 'draft',
    source_id UUID REFERENCES data_sources(id),
    target_config JSONB NOT NULL,
    transformation_ids UUID[],
    schedule_id UUID REFERENCES pipeline_schedules(id),
    data_quality_rules JSONB,
    configuration JSONB DEFAULT '{}',
    error_handling JSONB DEFAULT '{}',
    notification_config JSONB,
    tags TEXT[],
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_pipeline_name UNIQUE (name),
    CONSTRAINT valid_transformation_ids CHECK (
        transformation_ids IS NULL OR 
        array_length(transformation_ids, 1) > 0
    )
);

-- Pipeline runs table
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID REFERENCES data_pipelines(id) ON DELETE CASCADE,
    run_number BIGINT NOT NULL,
    status run_status DEFAULT 'pending',
    trigger_type VARCHAR(50) DEFAULT 'manual',
    trigger_data JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    records_processed BIGINT DEFAULT 0,
    records_success BIGINT DEFAULT 0,
    records_failed BIGINT DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    metrics JSONB DEFAULT '{}',
    logs_location TEXT,
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_pipeline_run UNIQUE (pipeline_id, run_number)
);

-- Ingestion logs table for audit trail
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    log_level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    details JSONB,
    source_component VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_log_level CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'))
);

-- Pipeline metrics table for performance tracking
CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID REFERENCES data_pipelines(id) ON DELETE CASCADE,
    pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(50),
    metric_type VARCHAR(50) DEFAULT 'gauge',
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_metric_type CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'timer'))
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(connection_type);
CREATE INDEX IF NOT EXISTS idx_data_sources_active ON data_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_data_sources_health ON data_sources(health_status);
CREATE INDEX IF NOT EXISTS idx_data_sources_tags ON data_sources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_data_sources_created_by ON data_sources(created_by);

CREATE INDEX IF NOT EXISTS idx_data_pipelines_status ON data_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_active ON data_pipelines(is_active);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_source ON data_pipelines(source_id);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_schedule ON data_pipelines(schedule_id);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_tags ON data_pipelines USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_created_by ON data_pipelines(created_by);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_completed ON pipeline_runs(completed_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_trigger ON pipeline_runs(trigger_type);

CREATE INDEX IF NOT EXISTS idx_ingestion_logs_run ON ingestion_logs(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_level ON ingestion_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_timestamp ON ingestion_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_component ON ingestion_logs(source_component);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_pipeline ON pipeline_metrics(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_run ON pipeline_metrics(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_name ON pipeline_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_timestamp ON pipeline_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_data_schemas_source ON data_schemas(data_source_id);
CREATE INDEX IF NOT EXISTS idx_data_schemas_active ON data_schemas(is_active);

CREATE INDEX IF NOT EXISTS idx_data_quality_rules_schema ON data_quality_rules(data_schema_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_rules_active ON data_quality_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_data_quality_rules_severity ON data_quality_rules(severity);

CREATE INDEX IF NOT EXISTS idx_connection_credentials_type ON connection_credentials(connection_type);
CREATE INDEX IF NOT EXISTS idx_connection_credentials_active ON connection_credentials(is_active);

CREATE INDEX IF NOT EXISTS idx_pipeline_schedules_active ON pipeline_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_pipeline_schedules_next_run ON pipeline_schedules(next_run_time);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables
CREATE TRIGGER trigger_connection_credentials_updated_at
    BEFORE UPDATE ON connection_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_data_sources_updated_at
    BEFORE UPDATE ON data_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_data_schemas_updated_at
    BEFORE UPDATE ON data_schemas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_data_quality_rules_updated_at
    BEFORE UPDATE ON data_quality_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_data_transformations_updated_at
    BEFORE UPDATE ON data_transformations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_pipeline_schedules_updated_at
    BEFORE UPDATE ON pipeline_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_data_pipelines_updated_at
    BEFORE UPDATE ON data_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically generate run numbers
CREATE OR REPLACE FUNCTION generate_run_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.run_number IS NULL THEN
        SELECT COALESCE(MAX(run_number), 0) + 1
        INTO NEW.run_number
        FROM pipeline_runs
        WHERE pipeline_id = NEW.pipeline_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_run_number
    BEFORE INSERT ON pipeline_runs
    FOR EACH ROW EXECUTE FUNCTION generate_run_number();

-- Function to calculate run duration
CREATE OR REPLACE FUNCTION calculate_run_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_run_duration
    BEFORE UPDATE ON pipeline_runs
    FOR EACH ROW EXECUTE FUNCTION calculate_run_duration();

-- Create useful views for dashboard queries
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT 
    dp.id,
    dp.name,
    dp.description,
    dp.status,
    ds.name as source_name,
    ds.connection_type,
    ps.name as schedule_name,
    ps.cron_expression,
    dp.created_at,
    dp.updated_at,
    COALESCE(recent_runs.total_runs, 0) as total_runs,
    COALESCE(recent_runs.success_rate, 0) as success_rate,
    recent_runs.last_run_status,
    recent_runs.last_run_time
FROM data_pipelines dp
LEFT JOIN data_sources ds ON dp.source_id = ds.id
LEFT JOIN pipeline_schedules ps ON dp.schedule_id = ps.id
LEFT JOIN (
    SELECT 
        pipeline_id,
        COUNT(*) as total_runs,
        ROUND(
            (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)) * 100, 2
        ) as success_rate,
        MAX(started_at) as last_run_time,
        (SELECT status FROM pipeline_runs pr2 
         WHERE pr2.pipeline_id = pr.pipeline_id 
         ORDER BY started_at DESC LIMIT 1) as last_run_status
    FROM pipeline_runs pr
    WHERE started_at >= NOW() - INTERVAL '30 days'
    GROUP BY pipeline_id
) recent_runs ON dp.id = recent_runs.pipeline_id;

CREATE OR REPLACE VIEW pipeline_health_metrics AS
SELECT 
    dp.id as pipeline_id,
    dp.name as pipeline_name,
    COUNT(pr.id) as total_runs,
    COUNT(*) FILTER (WHERE pr.status = 'completed') as successful_runs,
    COUNT(*) FILTER (WHERE pr.status = 'failed') as failed_runs,
    COUNT(*) FILTER (WHERE pr.status = 'running') as running_runs,
    ROUND(AVG(pr.duration_seconds), 2) as avg_duration_seconds,
    SUM(pr.records_processed) as total_records_processed,
    ROUND(
        (COUNT(*) FILTER (WHERE pr.status = 'completed')::DECIMAL / 
         NULLIF(COUNT(*), 0)) * 100, 2
    ) as success_rate,
    MAX(pr.started_at) as last_run_time
FROM data_pipelines dp
LEFT JOIN pipeline_runs pr ON dp.id = pr.pipeline_id
    AND pr.started_at >= NOW() - INTERVAL '30 days'
GROUP BY dp.id, dp.name;

-- Enable Row Level Security
ALTER TABLE connection_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_transformations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Users can view their own connection credentials" ON connection_credentials
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own connection credentials" ON connection_credentials
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view their own data sources" ON data_sources
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own data sources" ON data_sources
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view their own data schemas" ON data_schemas
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own data schemas" ON data_schemas
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view their own quality rules" ON data_quality_rules
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own quality rules" ON data_quality_rules
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view their own transformations" ON data_transformations
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own transformations" ON data_transformations
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view their own schedules" ON pipeline_schedules
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own schedules" ON pipeline_schedules
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view their own pipelines" ON data_pipelines
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can manage their own pipelines" ON data_pipelines
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view pipeline runs for their pipelines" ON pipeline_runs
    FOR SELECT USING (
        pipeline_id IN (
            SELECT id FROM data_pipelines WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage pipeline runs for their pipelines" ON pipeline_runs
    FOR ALL USING (
        pipeline_id IN (
            SELECT id FROM data_pipelines WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view logs for their pipeline runs" ON ingestion_logs
    FOR SELECT USING (
        pipeline_run_id IN (
            SELECT pr.id FROM pipeline_runs pr
            JOIN data_pipelines dp ON pr.pipeline_id = dp.id
            WHERE dp.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create logs for their pipeline runs" ON ingestion_logs
    FOR INSERT WITH CHECK (
        pipeline_run_id IN (
            SELECT pr.id FROM pipeline_runs pr
            JOIN data_pipelines dp ON pr.pipeline_id = dp.id
            WHERE dp.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view metrics for their pipelines" ON pipeline_metrics
    FOR SELECT USING (
        pipeline_id IN (
            SELECT id FROM data_pipelines WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create metrics for their pipelines" ON pipeline_metrics
    FOR INSERT WITH CHECK (
        pipeline_id IN (
            SELECT id FROM data_pipelines WHERE created_by = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```