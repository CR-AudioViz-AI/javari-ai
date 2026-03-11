```sql
-- Migration: Create Intelligent Data Partitioning Service
-- File: supabase/migrations/20240101000000_create_intelligent_partitioning_service.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_partman";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS partitioning;
CREATE SCHEMA IF NOT EXISTS analytics;

-- =============================================
-- PARTITION CONFIGURATION TABLES
-- =============================================

-- Partition strategies enum
CREATE TYPE partitioning.partition_strategy AS ENUM (
    'hash',
    'range',
    'list',
    'composite'
);

-- Partition status enum
CREATE TYPE partitioning.partition_status AS ENUM (
    'active',
    'migrating',
    'inactive',
    'archived'
);

-- Migration status enum
CREATE TYPE partitioning.migration_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'rolled_back'
);

-- Partition configurations
CREATE TABLE IF NOT EXISTS partitioning.partition_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'public',
    strategy partitioning.partition_strategy NOT NULL,
    partition_key TEXT NOT NULL,
    partition_count INTEGER,
    partition_size_mb INTEGER,
    retention_days INTEGER,
    auto_rebalance BOOLEAN DEFAULT true,
    config_data JSONB DEFAULT '{}',
    status partitioning.partition_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(schema_name, table_name)
);

-- Partition shards registry
CREATE TABLE IF NOT EXISTS partitioning.partition_shards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partitioning.partition_configs(id) ON DELETE CASCADE,
    shard_name TEXT NOT NULL,
    shard_index INTEGER NOT NULL,
    range_start TEXT,
    range_end TEXT,
    hash_modulus INTEGER,
    hash_remainder INTEGER,
    estimated_rows BIGINT DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    last_analyzed TIMESTAMPTZ,
    status partitioning.partition_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(config_id, shard_name)
);

-- =============================================
-- QUERY PATTERN ANALYSIS TABLES
-- =============================================

-- Query pattern categories
CREATE TYPE analytics.query_type AS ENUM (
    'select',
    'insert',
    'update',
    'delete',
    'aggregate',
    'join'
);

-- Query patterns tracking
CREATE TABLE IF NOT EXISTS analytics.query_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash TEXT NOT NULL,
    query_template TEXT NOT NULL,
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'public',
    query_type analytics.query_type NOT NULL,
    where_conditions JSONB DEFAULT '{}',
    join_tables TEXT[],
    access_columns TEXT[],
    partition_keys_used TEXT[],
    execution_count BIGINT DEFAULT 0,
    total_duration_ms BIGINT DEFAULT 0,
    avg_duration_ms NUMERIC(10,3),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(query_hash)
);

-- Access frequency metrics
CREATE TABLE IF NOT EXISTS analytics.access_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partitioning.partition_configs(id) ON DELETE CASCADE,
    shard_id UUID REFERENCES partitioning.partition_shards(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    read_count BIGINT DEFAULT 0,
    write_count BIGINT DEFAULT 0,
    scan_count BIGINT DEFAULT 0,
    index_usage_ratio NUMERIC(5,4),
    cache_hit_ratio NUMERIC(5,4),
    avg_response_time_ms NUMERIC(10,3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(config_id, shard_id, metric_date)
);

-- Performance baselines
CREATE TABLE IF NOT EXISTS analytics.performance_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partitioning.partition_configs(id) ON DELETE CASCADE,
    baseline_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
    metrics JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MIGRATION ORCHESTRATION TABLES
-- =============================================

-- Migration plans
CREATE TABLE IF NOT EXISTS partitioning.migration_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partitioning.partition_configs(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    migration_type TEXT NOT NULL, -- 'create', 'rebalance', 'split', 'merge'
    source_shards UUID[] DEFAULT '{}',
    target_shards UUID[] DEFAULT '{}',
    estimated_duration_minutes INTEGER,
    estimated_rows_affected BIGINT,
    rollback_plan JSONB DEFAULT '{}',
    safety_checks JSONB DEFAULT '{}',
    status partitioning.migration_status DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Migration steps tracking
CREATE TABLE IF NOT EXISTS partitioning.migration_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES partitioning.migration_plans(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL, -- 'validate', 'create_partition', 'migrate_data', 'update_constraints', 'cleanup'
    step_name TEXT NOT NULL,
    sql_commands TEXT[],
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    status partitioning.migration_status DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PERFORMANCE MONITORING TABLES
-- =============================================

-- Partition health metrics
CREATE TABLE IF NOT EXISTS partitioning.partition_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shard_id UUID NOT NULL REFERENCES partitioning.partition_shards(id) ON DELETE CASCADE,
    check_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cpu_usage_percent NUMERIC(5,2),
    memory_usage_mb BIGINT,
    disk_usage_mb BIGINT,
    connection_count INTEGER,
    active_queries INTEGER,
    blocked_queries INTEGER,
    lock_wait_time_ms BIGINT,
    index_scan_ratio NUMERIC(5,4),
    table_scan_ratio NUMERIC(5,4),
    health_score NUMERIC(3,2), -- 0-100 scale
    issues JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rebalancing recommendations
CREATE TABLE IF NOT EXISTS partitioning.rebalance_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID NOT NULL REFERENCES partitioning.partition_configs(id) ON DELETE CASCADE,
    recommendation_type TEXT NOT NULL, -- 'split_shard', 'merge_shards', 'redistribute'
    priority INTEGER NOT NULL DEFAULT 3, -- 1=high, 2=medium, 3=low
    reason TEXT NOT NULL,
    affected_shards UUID[],
    suggested_actions JSONB NOT NULL DEFAULT '{}',
    estimated_benefit JSONB DEFAULT '{}',
    implementation_complexity TEXT, -- 'low', 'medium', 'high'
    is_auto_approved BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'implemented'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- =============================================
-- INDEXES
-- =============================================

-- Partition configs indexes
CREATE INDEX IF NOT EXISTS idx_partition_configs_table_name ON partitioning.partition_configs(schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_partition_configs_status ON partitioning.partition_configs(status);
CREATE INDEX IF NOT EXISTS idx_partition_configs_strategy ON partitioning.partition_configs(strategy);

-- Partition shards indexes
CREATE INDEX IF NOT EXISTS idx_partition_shards_config_id ON partitioning.partition_shards(config_id);
CREATE INDEX IF NOT EXISTS idx_partition_shards_status ON partitioning.partition_shards(status);
CREATE INDEX IF NOT EXISTS idx_partition_shards_size ON partitioning.partition_shards(size_bytes);

-- Query patterns indexes
CREATE INDEX IF NOT EXISTS idx_query_patterns_table_name ON analytics.query_patterns(schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_query_patterns_query_type ON analytics.query_patterns(query_type);
CREATE INDEX IF NOT EXISTS idx_query_patterns_execution_count ON analytics.query_patterns(execution_count DESC);
CREATE INDEX IF NOT EXISTS idx_query_patterns_avg_duration ON analytics.query_patterns(avg_duration_ms DESC);
CREATE INDEX IF NOT EXISTS idx_query_patterns_last_seen ON analytics.query_patterns(last_seen);

-- Access metrics indexes
CREATE INDEX IF NOT EXISTS idx_access_metrics_config_date ON analytics.access_metrics(config_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_access_metrics_shard_date ON analytics.access_metrics(shard_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_access_metrics_response_time ON analytics.access_metrics(avg_response_time_ms);

-- Migration plans indexes
CREATE INDEX IF NOT EXISTS idx_migration_plans_config_id ON partitioning.migration_plans(config_id);
CREATE INDEX IF NOT EXISTS idx_migration_plans_status ON partitioning.migration_plans(status);
CREATE INDEX IF NOT EXISTS idx_migration_plans_scheduled ON partitioning.migration_plans(scheduled_at);

-- Migration steps indexes
CREATE INDEX IF NOT EXISTS idx_migration_steps_plan_id ON partitioning.migration_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_migration_steps_status ON partitioning.migration_steps(status);
CREATE INDEX IF NOT EXISTS idx_migration_steps_order ON partitioning.migration_steps(plan_id, step_order);

-- Partition health indexes
CREATE INDEX IF NOT EXISTS idx_partition_health_shard_timestamp ON partitioning.partition_health(shard_id, check_timestamp);
CREATE INDEX IF NOT EXISTS idx_partition_health_score ON partitioning.partition_health(health_score);
CREATE INDEX IF NOT EXISTS idx_partition_health_timestamp ON partitioning.partition_health(check_timestamp);

-- Rebalance recommendations indexes
CREATE INDEX IF NOT EXISTS idx_rebalance_recommendations_config ON partitioning.rebalance_recommendations(config_id);
CREATE INDEX IF NOT EXISTS idx_rebalance_recommendations_status ON partitioning.rebalance_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_rebalance_recommendations_priority ON partitioning.rebalance_recommendations(priority);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION partitioning.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_partition_configs_updated_at
    BEFORE UPDATE ON partitioning.partition_configs
    FOR EACH ROW EXECUTE FUNCTION partitioning.update_updated_at_column();

CREATE TRIGGER update_partition_shards_updated_at
    BEFORE UPDATE ON partitioning.partition_shards
    FOR EACH ROW EXECUTE FUNCTION partitioning.update_updated_at_column();

CREATE TRIGGER update_query_patterns_updated_at
    BEFORE UPDATE ON analytics.query_patterns
    FOR EACH ROW EXECUTE FUNCTION partitioning.update_updated_at_column();

CREATE TRIGGER update_access_metrics_updated_at
    BEFORE UPDATE ON analytics.access_metrics
    FOR EACH ROW EXECUTE FUNCTION partitioning.update_updated_at_column();

CREATE TRIGGER update_migration_plans_updated_at
    BEFORE UPDATE ON partitioning.migration_plans
    FOR EACH ROW EXECUTE FUNCTION partitioning.update_updated_at_column();

CREATE TRIGGER update_migration_steps_updated_at
    BEFORE UPDATE ON partitioning.migration_steps
    FOR EACH ROW EXECUTE FUNCTION partitioning.update_updated_at_column();

CREATE TRIGGER update_rebalance_recommendations_updated_at
    BEFORE UPDATE ON partitioning.rebalance_recommendations
    FOR EACH ROW EXECUTE FUNCTION partitioning.update_updated_at_column();

-- Query pattern aggregation function
CREATE OR REPLACE FUNCTION analytics.upsert_query_pattern(
    p_query_hash TEXT,
    p_query_template TEXT,
    p_table_name TEXT,
    p_schema_name TEXT,
    p_query_type analytics.query_type,
    p_where_conditions JSONB,
    p_join_tables TEXT[],
    p_access_columns TEXT[],
    p_partition_keys_used TEXT[],
    p_duration_ms BIGINT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO analytics.query_patterns (
        query_hash, query_template, table_name, schema_name, query_type,
        where_conditions, join_tables, access_columns, partition_keys_used,
        execution_count, total_duration_ms, avg_duration_ms, last_seen
    )
    VALUES (
        p_query_hash, p_query_template, p_table_name, p_schema_name, p_query_type,
        p_where_conditions, p_join_tables, p_access_columns, p_partition_keys_used,
        1, p_duration_ms, p_duration_ms, NOW()
    )
    ON CONFLICT (query_hash) DO UPDATE SET
        execution_count = query_patterns.execution_count + 1,
        total_duration_ms = query_patterns.total_duration_ms + p_duration_ms,
        avg_duration_ms = (query_patterns.total_duration_ms + p_duration_ms) / (query_patterns.execution_count + 1),
        last_seen = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Calculate partition health score function
CREATE OR REPLACE FUNCTION partitioning.calculate_health_score(
    p_cpu_usage NUMERIC,
    p_memory_usage BIGINT,
    p_connection_count INTEGER,
    p_blocked_queries INTEGER,
    p_lock_wait_time BIGINT,
    p_index_scan_ratio NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    health_score NUMERIC := 100;
BEGIN
    -- Deduct points based on various metrics
    IF p_cpu_usage > 80 THEN
        health_score := health_score - ((p_cpu_usage - 80) * 2);
    END IF;
    
    IF p_connection_count > 100 THEN
        health_score := health_score - ((p_connection_count - 100) * 0.1);
    END IF;
    
    IF p_blocked_queries > 0 THEN
        health_score := health_score - (p_blocked_queries * 5);
    END IF;
    
    IF p_lock_wait_time > 1000 THEN
        health_score := health_score - ((p_lock_wait_time - 1000) / 1000 * 10);
    END IF;
    
    IF p_index_scan_ratio < 0.8 THEN
        health_score := health_score - ((0.8 - p_index_scan_ratio) * 20);
    END IF;
    
    -- Ensure score stays within bounds
    RETURN GREATEST(0, LEAST(100, health_score));
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE partitioning.partition_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE partitioning.partition_shards ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.query_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.access_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.performance_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE partitioning.migration_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE partitioning.migration_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE partitioning.partition_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE partitioning.rebalance_recommendations ENABLE ROW LEVEL SECURITY;

-- Admin and service role policies
CREATE POLICY "partition_configs_admin_access" ON partitioning.partition_configs
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role') OR
        created_by = auth.uid()
    );

CREATE POLICY "partition_shards_admin_access" ON partitioning.partition_shards
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role')
    );

CREATE POLICY "query_patterns_read_access" ON analytics.query_patterns
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role', 'analyst')
    );

CREATE POLICY "access_metrics_read_access" ON analytics.access_metrics
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role', 'analyst')
    );

CREATE POLICY "performance_baselines_read_access" ON analytics.performance_baselines
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role', 'analyst')
    );

CREATE POLICY "migration_plans_access" ON partitioning.migration_plans
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role') OR
        created_by = auth.uid()
    );

CREATE POLICY "migration_steps_read_access" ON partitioning.migration_steps
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role', 'analyst')
    );

CREATE POLICY "partition_health_read_access" ON partitioning.partition_health
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role', 'analyst')
    );

CREATE POLICY "rebalance_recommendations_access" ON partitioning.rebalance_recommendations
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('admin', 'service_role')
    );

-- =============================================
-- VIEWS FOR ANALYTICS
-- =============================================

-- Partition performance overview
CREATE OR REPLACE VIEW partitioning.partition_performance_overview AS
SELECT 
    pc.id as config_id,
    pc.table_name,
    pc.schema_name,
    pc.strategy,
    COUNT(ps.id) as shard_count,
    SUM(ps.estimated_rows) as total_rows,
    SUM(ps.size_bytes) as total_size_bytes,
    AVG(ph.health_score) as avg_health_score,
    MAX(ph.check_timestamp) as last_health_check,
    COUNT(CASE WHEN rr.status = 'pending' THEN 1 END) as pending_recommendations
FROM partitioning.partition_configs pc
LEFT JOIN partitioning.partition_shards ps ON pc.id = ps.config_id
LEFT JOIN partitioning.partition_health ph ON ps.id = ph.shard_id 
    AND ph.check_timestamp >= NOW() - INTERVAL '1 hour'
LEFT JOIN partitioning.rebalance_recommendations rr ON pc.id = rr.config_id 
    AND rr.status = 'pending'
WHERE pc.status = 'active'
GROUP BY pc.id, pc.table_name, pc.schema_name, pc.strategy;

-- Query pattern insights
CREATE OR REPLACE VIEW analytics.query_pattern_insights AS
SELECT 
    qp.table_name,
    qp.schema_name,
    qp.query_type,
    COUNT(*) as pattern_count,
    SUM(qp.execution_count) as total_executions,
    AVG(qp.avg_duration_ms) as avg_duration_ms,
    MAX(qp.last_seen) as last_activity,
    ARRAY_AGG(DISTINCT unnest(qp.partition_keys_used)) FILTER (WHERE unnest(qp.partition_keys_used) IS NOT NULL) as common_partition_keys
FROM analytics.query_patterns qp
WHERE qp.last_seen >= NOW() - INTERVAL '7 days'
GROUP BY qp.table_name, qp.schema_name, qp.query_type;

-- Migration status dashboard
CREATE OR REPLACE VIEW partitioning.migration_status_dashboard AS
SELECT 
    mp.id as plan_id,
    mp.plan_name,
    pc.table_name,
    pc.schema_name,
    mp.migration_type,
    mp.status as plan_status,
    mp.estimated_duration_minutes,
    mp.estimated_rows_affected,
    COUNT(ms.id) as total_steps,
    COUNT(CASE WHEN ms.status = 'completed' THEN 1 END) as completed_steps,
    COUNT(CASE WHEN ms.status = 'failed' THEN 1 END) as failed_steps,
    mp.scheduled_at,
    mp.started_at,
    mp.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(mp.completed_at, NOW()) - mp.started_at))/60 as actual_duration_minutes
FROM partitioning.migration_plans mp
JOIN partitioning.partition_configs pc ON mp.config_id = pc.id
LEFT JOIN partitioning.migration_steps ms ON mp.id = ms.plan_id
GROUP BY mp.id, mp.plan_name, pc.table_name, pc.schema_name, mp.migration_type, 
         mp.status, mp.estimated_duration_minutes, mp.estimated_rows_affected,
         mp.scheduled_at, mp.started_at, mp.completed_at;

-- Grant permissions to service roles
GRANT USAGE ON SCHEMA partitioning TO service_role;
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA partitioning TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA analytics TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA partitioning TO service_role;