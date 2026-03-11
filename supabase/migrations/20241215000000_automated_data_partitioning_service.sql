```sql
-- Automated Data Partitioning Service Migration
-- File: supabase/migrations/20241215000000_automated_data_partitioning_service.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Partition strategies enum
DO $$ BEGIN
    CREATE TYPE partition_strategy AS ENUM (
        'hash',
        'range',
        'list',
        'composite'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Rebalancing status enum
DO $$ BEGIN
    CREATE TYPE rebalancing_status AS ENUM (
        'pending',
        'in_progress',
        'completed',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Partition health status enum
DO $$ BEGIN
    CREATE TYPE partition_health_status AS ENUM (
        'healthy',
        'warning',
        'critical',
        'offline'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Core partition configurations table
CREATE TABLE IF NOT EXISTS partition_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    schema_name TEXT DEFAULT 'public',
    strategy partition_strategy NOT NULL,
    partition_key TEXT NOT NULL,
    partition_count INTEGER DEFAULT 4,
    max_size_mb INTEGER DEFAULT 1000,
    min_size_mb INTEGER DEFAULT 100,
    rebalance_threshold DECIMAL(3,2) DEFAULT 0.8,
    auto_rebalance BOOLEAN DEFAULT true,
    retention_days INTEGER,
    compression_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    
    CONSTRAINT unique_table_partition UNIQUE (table_name, schema_name),
    CONSTRAINT valid_thresholds CHECK (
        rebalance_threshold > 0 AND rebalance_threshold <= 1 AND
        min_size_mb <= max_size_mb AND
        partition_count > 0
    )
);

-- Partition metadata tracking table
CREATE TABLE IF NOT EXISTS partition_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partition_configurations(id) ON DELETE CASCADE,
    partition_name TEXT NOT NULL,
    partition_number INTEGER NOT NULL,
    partition_bounds JSONB,
    row_count BIGINT DEFAULT 0,
    size_mb DECIMAL(10,2) DEFAULT 0,
    last_vacuum TIMESTAMPTZ,
    last_analyze TIMESTAMPTZ,
    health_status partition_health_status DEFAULT 'healthy',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_partition_name UNIQUE (partition_name),
    CONSTRAINT valid_partition_number CHECK (partition_number >= 0)
);

-- Rebalancing jobs table
CREATE TABLE IF NOT EXISTS rebalancing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partition_configurations(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL DEFAULT 'rebalance',
    status rebalancing_status DEFAULT 'pending',
    source_partitions JSONB,
    target_partitions JSONB,
    rows_migrated BIGINT DEFAULT 0,
    total_rows BIGINT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT valid_retry_count CHECK (retry_count <= max_retries)
);

-- Query optimization statistics table
CREATE TABLE IF NOT EXISTS query_optimization_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partition_configurations(id) ON DELETE CASCADE,
    query_hash TEXT NOT NULL,
    query_text TEXT,
    execution_count BIGINT DEFAULT 1,
    avg_execution_time_ms DECIMAL(10,2),
    partition_pruning_ratio DECIMAL(3,2),
    cross_partition_joins INTEGER DEFAULT 0,
    index_usage_ratio DECIMAL(3,2),
    last_executed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_query_config UNIQUE (config_id, query_hash),
    CONSTRAINT valid_ratios CHECK (
        partition_pruning_ratio >= 0 AND partition_pruning_ratio <= 1 AND
        index_usage_ratio >= 0 AND index_usage_ratio <= 1
    )
);

-- Partition routing log table
CREATE TABLE IF NOT EXISTS partition_routing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partition_configurations(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL,
    partition_name TEXT,
    routing_key TEXT,
    execution_time_ms DECIMAL(8,2),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_operation_type CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_partition_configurations_table ON partition_configurations(table_name, schema_name);
CREATE INDEX IF NOT EXISTS idx_partition_configurations_active ON partition_configurations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_partition_metadata_config ON partition_metadata(config_id);
CREATE INDEX IF NOT EXISTS idx_partition_metadata_health ON partition_metadata(health_status);
CREATE INDEX IF NOT EXISTS idx_partition_metadata_size ON partition_metadata(size_mb DESC);
CREATE INDEX IF NOT EXISTS idx_rebalancing_jobs_status ON rebalancing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_rebalancing_jobs_config ON rebalancing_jobs(config_id);
CREATE INDEX IF NOT EXISTS idx_query_stats_config ON query_optimization_stats(config_id);
CREATE INDEX IF NOT EXISTS idx_query_stats_execution ON query_optimization_stats(last_executed DESC);
CREATE INDEX IF NOT EXISTS idx_routing_log_config ON partition_routing_log(config_id);
CREATE INDEX IF NOT EXISTS idx_routing_log_created ON partition_routing_log(created_at DESC);

-- Partition health metrics view
CREATE OR REPLACE VIEW partition_health_metrics AS
SELECT 
    pc.id as config_id,
    pc.table_name,
    pc.schema_name,
    pc.strategy,
    COUNT(pm.id) as total_partitions,
    COUNT(CASE WHEN pm.health_status = 'healthy' THEN 1 END) as healthy_partitions,
    COUNT(CASE WHEN pm.health_status = 'warning' THEN 1 END) as warning_partitions,
    COUNT(CASE WHEN pm.health_status = 'critical' THEN 1 END) as critical_partitions,
    COUNT(CASE WHEN pm.health_status = 'offline' THEN 1 END) as offline_partitions,
    COALESCE(AVG(pm.size_mb), 0) as avg_partition_size_mb,
    COALESCE(MAX(pm.size_mb), 0) as max_partition_size_mb,
    COALESCE(MIN(pm.size_mb), 0) as min_partition_size_mb,
    COALESCE(SUM(pm.row_count), 0) as total_rows,
    COALESCE(SUM(pm.size_mb), 0) as total_size_mb,
    CASE 
        WHEN COUNT(CASE WHEN pm.health_status = 'critical' THEN 1 END) > 0 THEN 'critical'
        WHEN COUNT(CASE WHEN pm.health_status = 'warning' THEN 1 END) > 0 THEN 'warning'
        WHEN COUNT(CASE WHEN pm.health_status = 'offline' THEN 1 END) > 0 THEN 'critical'
        ELSE 'healthy'
    END as overall_health,
    pc.updated_at as config_updated_at
FROM partition_configurations pc
LEFT JOIN partition_metadata pm ON pc.id = pm.config_id
WHERE pc.is_active = true
GROUP BY pc.id, pc.table_name, pc.schema_name, pc.strategy, pc.updated_at;

-- Partition performance summary view
CREATE OR REPLACE VIEW partition_performance_summary AS
SELECT 
    pc.id as config_id,
    pc.table_name,
    pc.schema_name,
    COUNT(DISTINCT qos.query_hash) as unique_queries,
    COALESCE(AVG(qos.avg_execution_time_ms), 0) as avg_query_time_ms,
    COALESCE(AVG(qos.partition_pruning_ratio), 0) as avg_pruning_ratio,
    COALESCE(SUM(qos.cross_partition_joins), 0) as total_cross_partition_joins,
    COALESCE(AVG(qos.index_usage_ratio), 0) as avg_index_usage_ratio,
    COUNT(CASE WHEN rj.status = 'completed' THEN 1 END) as successful_rebalances,
    COUNT(CASE WHEN rj.status = 'failed' THEN 1 END) as failed_rebalances,
    MAX(rj.completed_at) as last_rebalance_at
FROM partition_configurations pc
LEFT JOIN query_optimization_stats qos ON pc.id = qos.config_id
LEFT JOIN rebalancing_jobs rj ON pc.id = rj.config_id
WHERE pc.is_active = true
GROUP BY pc.id, pc.table_name, pc.schema_name;

-- Hash partition routing function
CREATE OR REPLACE FUNCTION partition_hash_router(
    p_table_name TEXT,
    p_partition_key TEXT,
    p_partition_count INTEGER DEFAULT 4
) RETURNS TEXT AS $$
DECLARE
    hash_value INTEGER;
    partition_number INTEGER;
    partition_name TEXT;
BEGIN
    -- Calculate hash value
    hash_value := hashtext(p_partition_key::TEXT);
    
    -- Calculate partition number (0-based)
    partition_number := ABS(hash_value) % p_partition_count;
    
    -- Generate partition name
    partition_name := p_table_name || '_p' || partition_number::TEXT;
    
    RETURN partition_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Range partition routing function
CREATE OR REPLACE FUNCTION partition_range_router(
    p_table_name TEXT,
    p_partition_key TEXT,
    p_partition_bounds JSONB
) RETURNS TEXT AS $$
DECLARE
    bound JSONB;
    partition_name TEXT;
    key_value DECIMAL;
BEGIN
    -- Convert partition key to numeric for range comparison
    BEGIN
        key_value := p_partition_key::DECIMAL;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Partition key must be numeric for range partitioning';
    END;
    
    -- Find appropriate partition based on bounds
    FOR bound IN SELECT jsonb_array_elements(p_partition_bounds)
    LOOP
        IF key_value >= (bound->>'min_value')::DECIMAL AND 
           key_value < (bound->>'max_value')::DECIMAL THEN
            partition_name := bound->>'partition_name';
            EXIT;
        END IF;
    END LOOP;
    
    -- Default to first partition if no match found
    IF partition_name IS NULL THEN
        partition_name := (p_partition_bounds->0->>'partition_name')::TEXT;
    END IF;
    
    RETURN partition_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update partition metadata statistics
CREATE OR REPLACE FUNCTION update_partition_statistics(
    p_config_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    config_record RECORD;
    partition_record RECORD;
    table_stats RECORD;
    partition_size DECIMAL;
    partition_rows BIGINT;
BEGIN
    -- Get configuration details
    SELECT * INTO config_record 
    FROM partition_configurations 
    WHERE id = p_config_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update statistics for each partition
    FOR partition_record IN 
        SELECT * FROM partition_metadata 
        WHERE config_id = p_config_id
    LOOP
        -- Get table statistics
        SELECT 
            pg_total_relation_size(partition_record.partition_name::regclass) / 1024 / 1024 as size_mb,
            COALESCE(n_tup_ins + n_tup_upd + n_tup_del, 0) as total_operations,
            COALESCE(reltuples, 0)::BIGINT as row_estimate
        INTO table_stats
        FROM pg_stat_user_tables pst
        JOIN pg_class pc ON pst.relname = pc.relname
        WHERE pst.relname = partition_record.partition_name;
        
        -- Update partition metadata
        UPDATE partition_metadata SET
            size_mb = COALESCE(table_stats.size_mb, 0),
            row_count = COALESCE(table_stats.row_estimate, 0),
            health_status = CASE 
                WHEN table_stats.size_mb > config_record.max_size_mb THEN 'warning'::partition_health_status
                WHEN table_stats.size_mb > config_record.max_size_mb * 1.5 THEN 'critical'::partition_health_status
                ELSE 'healthy'::partition_health_status
            END,
            updated_at = NOW()
        WHERE id = partition_record.id;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Automated rebalancing trigger function
CREATE OR REPLACE FUNCTION check_rebalancing_needed() RETURNS TRIGGER AS $$
DECLARE
    config_record RECORD;
    max_size DECIMAL;
    avg_size DECIMAL;
    rebalance_needed BOOLEAN := FALSE;
BEGIN
    -- Get configuration
    SELECT * INTO config_record 
    FROM partition_configurations 
    WHERE id = NEW.config_id;
    
    IF config_record.auto_rebalance = FALSE THEN
        RETURN NEW;
    END IF;
    
    -- Check if rebalancing is needed based on size distribution
    SELECT 
        MAX(size_mb) as max_size,
        AVG(size_mb) as avg_size
    INTO max_size, avg_size
    FROM partition_metadata 
    WHERE config_id = NEW.config_id;
    
    -- Check if imbalance exceeds threshold
    IF max_size > avg_size * (1 + config_record.rebalance_threshold) THEN
        rebalance_needed := TRUE;
    END IF;
    
    -- Create rebalancing job if needed
    IF rebalance_needed THEN
        INSERT INTO rebalancing_jobs (
            config_id,
            job_type,
            status,
            created_at
        ) VALUES (
            NEW.config_id,
            'auto_rebalance',
            'pending',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Query optimization analysis function
CREATE OR REPLACE FUNCTION analyze_query_performance(
    p_config_id UUID,
    p_query_text TEXT,
    p_execution_time_ms DECIMAL DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    query_hash TEXT;
    existing_stats RECORD;
BEGIN
    -- Generate query hash
    query_hash := md5(p_query_text);
    
    -- Check if query stats exist
    SELECT * INTO existing_stats
    FROM query_optimization_stats
    WHERE config_id = p_config_id AND query_hash = query_hash;
    
    IF FOUND THEN
        -- Update existing stats
        UPDATE query_optimization_stats SET
            execution_count = execution_count + 1,
            avg_execution_time_ms = CASE 
                WHEN p_execution_time_ms IS NOT NULL THEN
                    (avg_execution_time_ms * execution_count + p_execution_time_ms) / (execution_count + 1)
                ELSE avg_execution_time_ms
            END,
            last_executed = NOW()
        WHERE config_id = p_config_id AND query_hash = query_hash;
    ELSE
        -- Insert new stats
        INSERT INTO query_optimization_stats (
            config_id,
            query_hash,
            query_text,
            avg_execution_time_ms,
            last_executed
        ) VALUES (
            p_config_id,
            query_hash,
            p_query_text,
            COALESCE(p_execution_time_ms, 0),
            NOW()
        );
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Cross-partition query optimizer
CREATE OR REPLACE FUNCTION optimize_cross_partition_query(
    p_config_id UUID,
    p_query_text TEXT
) RETURNS JSONB AS $$
DECLARE
    config_record RECORD;
    optimization_hints JSONB := '{}';
    partition_count INTEGER;
    estimated_partitions INTEGER;
BEGIN
    -- Get configuration
    SELECT * INTO config_record
    FROM partition_configurations
    WHERE id = p_config_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "Configuration not found"}';
    END IF;
    
    -- Count total partitions
    SELECT COUNT(*) INTO partition_count
    FROM partition_metadata
    WHERE config_id = p_config_id;
    
    -- Estimate partitions that will be accessed
    -- This is a simplified heuristic - in practice, would analyze WHERE clauses
    estimated_partitions := CASE
        WHEN p_query_text ILIKE '%WHERE%' THEN GREATEST(1, partition_count / 2)
        ELSE partition_count
    END;
    
    -- Generate optimization hints
    optimization_hints := jsonb_build_object(
        'strategy', config_record.strategy,
        'total_partitions', partition_count,
        'estimated_partitions_accessed', estimated_partitions,
        'parallel_execution_recommended', estimated_partitions > 2,
        'partition_pruning_possible', p_query_text ILIKE '%WHERE%',
        'cross_partition_join_detected', p_query_text ILIKE '%JOIN%'
    );
    
    -- Log the analysis
    INSERT INTO partition_routing_log (
        config_id,
        operation_type,
        routing_key,
        execution_time_ms,
        success,
        created_at
    ) VALUES (
        p_config_id,
        'SELECT',
        'query_optimization',
        0,
        true,
        NOW()
    );
    
    RETURN optimization_hints;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trg_partition_metadata_updated_at
    BEFORE UPDATE ON partition_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_partition_configurations_updated_at
    BEFORE UPDATE ON partition_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_check_rebalancing
    AFTER UPDATE ON partition_metadata
    FOR EACH ROW
    WHEN (OLD.size_mb IS DISTINCT FROM NEW.size_mb)
    EXECUTE FUNCTION check_rebalancing_needed();

-- Update timestamp function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on all tables
ALTER TABLE partition_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE partition_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalancing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_optimization_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE partition_routing_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partition_configurations
CREATE POLICY "Users can view their partition configurations" ON partition_configurations
    FOR SELECT USING (created_by = auth.uid() OR auth.uid() IN (
        SELECT user_id FROM user_roles WHERE role = 'admin'
    ));

CREATE POLICY "Users can create partition configurations" ON partition_configurations
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their partition configurations" ON partition_configurations
    FOR UPDATE USING (created_by = auth.uid() OR auth.uid() IN (
        SELECT user_id FROM user_roles WHERE role = 'admin'
    ));

-- RLS Policies for partition_metadata (read-only for users)
CREATE POLICY "Users can view partition metadata for their configurations" ON partition_metadata
    FOR SELECT USING (config_id IN (
        SELECT id FROM partition_configurations WHERE created_by = auth.uid()
    ) OR auth.uid() IN (
        SELECT user_id FROM user_roles WHERE role = 'admin'
    ));

-- RLS Policies for rebalancing_jobs
CREATE POLICY "Users can view their rebalancing jobs" ON rebalancing_jobs
    FOR SELECT USING (created_by = auth.uid() OR config_id IN (
        SELECT id FROM partition_configurations WHERE created_by = auth.uid()
    ) OR auth.uid() IN (
        SELECT user_id FROM user_roles WHERE role = 'admin'
    ));

CREATE POLICY "Users can create rebalancing jobs for their configurations" ON rebalancing_jobs
    FOR INSERT WITH CHECK (config_id IN (
        SELECT id FROM partition_configurations WHERE created_by = auth.uid()
    ));

-- RLS Policies for query_optimization_stats
CREATE POLICY "Users can view query stats for their configurations" ON query_optimization_stats
    FOR SELECT USING (config_id IN (
        SELECT id FROM partition_configurations WHERE created_by = auth.uid()
    ) OR auth.uid() IN (
        SELECT user_id FROM user_roles WHERE role = 'admin'
    ));

-- RLS Policies for partition_routing_log
CREATE POLICY "Users can view routing logs for their configurations" ON partition_routing_log
    FOR SELECT USING (config_id IN (
        SELECT id FROM partition_configurations WHERE created_by = auth.uid()
    ) OR auth.uid() IN (
        SELECT user_id FROM user_roles WHERE role = 'admin'
    ));

-- Create a scheduled job function for maintenance (to be called by cron or edge function)
CREATE OR REPLACE FUNCTION run_partition_maintenance() RETURNS BOOLEAN AS $$
DECLARE
    config_record RECORD;
    success_count INTEGER := 0;
BEGIN
    -- Update statistics for all active configurations
    FOR config_record IN 
        SELECT id FROM partition_configurations WHERE is_active = true
    LOOP
        IF update_partition_statistics(config_record.id) THEN
            success_count := success_count + 1;
        END IF;
    END LOOP;
    
    -- Clean up old routing logs (keep last 30 days)
    DELETE FROM partition_routing_log 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Clean up old query stats