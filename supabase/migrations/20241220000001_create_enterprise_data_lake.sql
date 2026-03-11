```sql
-- Enterprise Data Lake API Migration
-- Generated: 2024-12-20
-- Description: Comprehensive enterprise data lake schema with ingestion, processing, and querying capabilities

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Data Sources Configuration
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'database', 'api', 'file', 'stream'
    connection_config JSONB NOT NULL,
    authentication JSONB,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT unique_data_source_name UNIQUE (name)
);

-- Schema Management with Versioning
CREATE TABLE IF NOT EXISTS data_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    schema_definition JSONB NOT NULL,
    validation_rules JSONB DEFAULT '{}',
    evolution_metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT unique_schema_version UNIQUE (data_source_id, name, version)
);

-- Ingestion Jobs Management
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    schema_id UUID REFERENCES data_schemas(id),
    name VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) NOT NULL, -- 'batch', 'streaming', 'scheduled'
    configuration JSONB NOT NULL,
    schedule_config JSONB, -- for scheduled jobs
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'paused'
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    error_details JSONB,
    metrics JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Raw Data Store (Unprocessed Data)
CREATE TABLE IF NOT EXISTS raw_data_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingestion_job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    partition_key VARCHAR(255) NOT NULL, -- for partitioning strategy
    data_payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    checksum VARCHAR(64),
    file_path TEXT, -- for file-based ingestion
    record_count INTEGER,
    size_bytes BIGINT,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT false,
    processing_errors JSONB
) PARTITION BY RANGE (ingested_at);

-- Processed Data Store (Transformed Data)
CREATE TABLE IF NOT EXISTS processed_data_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_data_id UUID REFERENCES raw_data_store(id),
    pipeline_stage_id UUID,
    dataset_name VARCHAR(255) NOT NULL,
    partition_key VARCHAR(255) NOT NULL,
    processed_data JSONB NOT NULL,
    schema_version INTEGER,
    transformation_metadata JSONB DEFAULT '{}',
    quality_metrics JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[]
) PARTITION BY RANGE (processed_at);

-- Pipeline Stages for Multi-step Processing
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_name VARCHAR(255) NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    stage_order INTEGER NOT NULL,
    stage_type VARCHAR(100) NOT NULL, -- 'transform', 'validate', 'enrich', 'aggregate'
    configuration JSONB NOT NULL,
    input_schema JSONB,
    output_schema JSONB,
    dependencies UUID[], -- array of stage IDs
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT unique_pipeline_stage UNIQUE (pipeline_name, stage_name, stage_order)
);

-- Query Cache for Performance Optimization
CREATE TABLE IF NOT EXISTS query_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    query_parameters JSONB,
    result_data JSONB,
    result_metadata JSONB DEFAULT '{}',
    dataset_dependencies TEXT[],
    cache_hit_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ttl_seconds INTEGER DEFAULT 3600,
    CONSTRAINT unique_query_hash UNIQUE (query_hash)
);

-- Data Lineage for Governance and Audit
CREATE TABLE IF NOT EXISTS data_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_entity_type VARCHAR(100) NOT NULL, -- 'data_source', 'raw_data', 'processed_data'
    source_entity_id UUID NOT NULL,
    target_entity_type VARCHAR(100) NOT NULL,
    target_entity_id UUID NOT NULL,
    transformation_type VARCHAR(100), -- 'ingestion', 'transform', 'aggregate', 'query'
    transformation_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Create partitions for raw_data_store (monthly partitions for current and next 12 months)
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..12 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month' * i);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'raw_data_store_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE FORMAT('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF raw_data_store
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date);
    END LOOP;
END $$;

-- Create partitions for processed_data_store (monthly partitions)
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..12 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month' * i);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'processed_data_store_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE FORMAT('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF processed_data_store
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date);
    END LOOP;
END $$;

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
CREATE INDEX IF NOT EXISTS idx_data_sources_active ON data_sources(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_data_schemas_source ON data_schemas(data_source_id);
CREATE INDEX IF NOT EXISTS idx_data_schemas_active ON data_schemas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_data_schemas_name_version ON data_schemas(name, version DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source ON ingestion_jobs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_next_run ON ingestion_jobs(next_run_at) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_type ON ingestion_jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_raw_data_source ON raw_data_store(data_source_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_partition ON raw_data_store(partition_key);
CREATE INDEX IF NOT EXISTS idx_raw_data_processed ON raw_data_store(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_raw_data_checksum ON raw_data_store(checksum);
CREATE INDEX IF NOT EXISTS idx_raw_data_payload_gin ON raw_data_store USING gin(data_payload);

CREATE INDEX IF NOT EXISTS idx_processed_data_dataset ON processed_data_store(dataset_name);
CREATE INDEX IF NOT EXISTS idx_processed_data_partition ON processed_data_store(partition_key);
CREATE INDEX IF NOT EXISTS idx_processed_data_tags_gin ON processed_data_store USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_processed_data_payload_gin ON processed_data_store USING gin(processed_data);
CREATE INDEX IF NOT EXISTS idx_processed_data_expires ON processed_data_store(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(pipeline_name, stage_order);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_active ON pipeline_stages(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON query_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_query_cache_dependencies_gin ON query_cache USING gin(dataset_dependencies);

CREATE INDEX IF NOT EXISTS idx_data_lineage_source ON data_lineage(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_target ON data_lineage(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_transformation ON data_lineage(transformation_type);

-- Triggers for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_data_sources_updated_at
    BEFORE UPDATE ON data_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ingestion_jobs_updated_at
    BEFORE UPDATE ON ingestion_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Schema validation trigger
CREATE OR REPLACE FUNCTION validate_schema_definition()
RETURNS TRIGGER AS $$
BEGIN
    -- Basic JSONB validation
    IF NEW.schema_definition IS NULL OR NEW.schema_definition = '{}'::jsonb THEN
        RAISE EXCEPTION 'Schema definition cannot be empty';
    END IF;
    
    -- Increment version if schema definition changed
    IF TG_OP = 'UPDATE' AND OLD.schema_definition != NEW.schema_definition THEN
        NEW.version = OLD.version + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_data_schemas
    BEFORE INSERT OR UPDATE ON data_schemas
    FOR EACH ROW EXECUTE FUNCTION validate_schema_definition();

-- Query cache cleanup trigger
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM query_cache WHERE expires_at < NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_query_cache
    AFTER INSERT ON query_cache
    FOR EACH STATEMENT EXECUTE FUNCTION cleanup_expired_cache();

-- Row Level Security Policies
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_data_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lineage ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on enterprise requirements)
CREATE POLICY data_sources_access ON data_sources
    FOR ALL USING (auth.role() = 'service_role' OR created_by = auth.uid());

CREATE POLICY data_schemas_access ON data_schemas
    FOR ALL USING (auth.role() = 'service_role' OR created_by = auth.uid());

CREATE POLICY ingestion_jobs_access ON ingestion_jobs
    FOR ALL USING (auth.role() = 'service_role' OR created_by = auth.uid());

CREATE POLICY raw_data_access ON raw_data_store
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY processed_data_access ON processed_data_store
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY pipeline_stages_access ON pipeline_stages
    FOR ALL USING (auth.role() = 'service_role' OR created_by = auth.uid());

CREATE POLICY query_cache_access ON query_cache
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY data_lineage_access ON data_lineage
    FOR ALL USING (auth.role() = 'service_role' OR created_by = auth.uid());

-- Comments for documentation
COMMENT ON TABLE data_sources IS 'Configuration and metadata for external data sources';
COMMENT ON TABLE data_schemas IS 'Schema definitions with versioning support for data evolution';
COMMENT ON TABLE ingestion_jobs IS 'Management of batch and streaming data ingestion jobs';
COMMENT ON TABLE raw_data_store IS 'Storage for unprocessed data with partitioning support';
COMMENT ON TABLE processed_data_store IS 'Storage for transformed and processed data';
COMMENT ON TABLE pipeline_stages IS 'Multi-step data processing pipeline configuration';
COMMENT ON TABLE query_cache IS 'Performance optimization through query result caching';
COMMENT ON TABLE data_lineage IS 'Audit trail and governance for data transformations';
```