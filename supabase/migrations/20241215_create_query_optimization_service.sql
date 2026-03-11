```sql
-- Deploy Database Query Optimization Service
-- Migration: 20241215_create_query_optimization_service.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create custom types
DO $$ BEGIN
    CREATE TYPE optimization_status AS ENUM ('pending', 'analyzing', 'optimizing', 'completed', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE query_category AS ENUM ('select', 'insert', 'update', 'delete', 'ddl', 'utility');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE optimization_type AS ENUM ('index_creation', 'query_rewrite', 'parameter_tuning', 'partition_suggestion', 'materialized_view');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Query Performance Logs (Partitioned by date)
CREATE TABLE IF NOT EXISTS query_performance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_id BIGINT NOT NULL,
    query_hash TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    raw_query TEXT,
    database_name TEXT NOT NULL,
    user_name TEXT,
    application_name TEXT,
    query_category query_category NOT NULL DEFAULT 'select',
    execution_time_ms DECIMAL(10,3) NOT NULL,
    rows_examined BIGINT,
    rows_returned BIGINT,
    buffer_hits BIGINT,
    buffer_misses BIGINT,
    temp_files_created INTEGER DEFAULT 0,
    temp_bytes_used BIGINT DEFAULT 0,
    calls_count INTEGER DEFAULT 1,
    mean_exec_time_ms DECIMAL(10,3),
    cpu_time_ms DECIMAL(10,3),
    io_time_ms DECIMAL(10,3),
    lock_wait_time_ms DECIMAL(10,3),
    query_plan JSONB,
    table_scans JSONB,
    index_scans JSONB,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (captured_at);

-- Create partitions for current and next month
CREATE TABLE IF NOT EXISTS query_performance_logs_current PARTITION OF query_performance_logs
    FOR VALUES FROM (date_trunc('month', CURRENT_DATE)) TO (date_trunc('month', CURRENT_DATE + INTERVAL '1 month'));

CREATE TABLE IF NOT EXISTS query_performance_logs_next PARTITION OF query_performance_logs
    FOR VALUES FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month')) TO (date_trunc('month', CURRENT_DATE + INTERVAL '2 months'));

-- Query Optimization Recommendations
CREATE TABLE IF NOT EXISTS query_optimization_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_hash TEXT NOT NULL,
    query_pattern TEXT NOT NULL,
    optimization_type optimization_type NOT NULL,
    priority_score INTEGER NOT NULL DEFAULT 50 CHECK (priority_score BETWEEN 1 AND 100),
    estimated_improvement_pct DECIMAL(5,2),
    recommendation_title TEXT NOT NULL,
    recommendation_description TEXT NOT NULL,
    implementation_sql TEXT,
    rollback_sql TEXT,
    affected_tables TEXT[],
    estimated_cost DECIMAL(10,2),
    risk_assessment JSONB,
    performance_impact JSONB,
    auto_apply_eligible BOOLEAN DEFAULT false,
    applied_at TIMESTAMPTZ,
    applied_by TEXT,
    application_result JSONB,
    status optimization_status DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Query Rewrite Rules
CREATE TABLE IF NOT EXISTS query_rewrite_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_name TEXT NOT NULL UNIQUE,
    pattern_regex TEXT NOT NULL,
    replacement_template TEXT NOT NULL,
    rule_description TEXT,
    rule_category TEXT DEFAULT 'performance',
    priority INTEGER DEFAULT 100,
    conditions JSONB,
    transformations JSONB,
    performance_impact JSONB,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_improvement_ms DECIMAL(10,3),
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Service Configuration
CREATE TABLE IF NOT EXISTS optimization_service_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    config_type TEXT DEFAULT 'system',
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database Indexes Tracking
CREATE TABLE IF NOT EXISTS database_indexes_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    index_name TEXT NOT NULL,
    index_definition TEXT NOT NULL,
    index_type TEXT,
    is_unique BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,
    columns TEXT[],
    size_bytes BIGINT,
    scans_count BIGINT DEFAULT 0,
    tuples_read BIGINT DEFAULT 0,
    tuples_fetched BIGINT DEFAULT 0,
    blocks_read BIGINT DEFAULT 0,
    blocks_hit BIGINT DEFAULT 0,
    usage_ratio DECIMAL(5,4),
    last_used_at TIMESTAMPTZ,
    maintenance_cost_score INTEGER,
    recommendation_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(schema_name, table_name, index_name)
);

-- Performance Baseline Metrics
CREATE TABLE IF NOT EXISTS performance_baseline_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_category TEXT NOT NULL,
    database_name TEXT,
    table_name TEXT,
    baseline_value DECIMAL(15,6) NOT NULL,
    current_value DECIMAL(15,6),
    threshold_warning DECIMAL(15,6),
    threshold_critical DECIMAL(15,6),
    measurement_unit TEXT,
    trend_direction TEXT CHECK (trend_direction IN ('improving', 'degrading', 'stable')),
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    sample_size INTEGER,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_measurement_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query Execution Plans
CREATE TABLE IF NOT EXISTS query_execution_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_hash TEXT NOT NULL,
    plan_hash TEXT NOT NULL,
    execution_plan JSONB NOT NULL,
    plan_summary JSONB,
    total_cost DECIMAL(15,6),
    startup_cost DECIMAL(15,6),
    estimated_rows BIGINT,
    actual_rows BIGINT,
    execution_time_ms DECIMAL(10,3),
    planning_time_ms DECIMAL(10,3),
    node_types TEXT[],
    scan_operations JSONB,
    join_operations JSONB,
    sort_operations JSONB,
    inefficiencies JSONB,
    optimization_suggestions TEXT[],
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Job Queue
CREATE TABLE IF NOT EXISTS optimization_job_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL,
    job_priority INTEGER DEFAULT 50 CHECK (job_priority BETWEEN 1 AND 100),
    job_payload JSONB NOT NULL,
    target_query_hash TEXT,
    target_tables TEXT[],
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status optimization_status DEFAULT 'pending',
    worker_id TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    execution_log JSONB,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_query_performance_logs_hash ON query_performance_logs (query_hash);
CREATE INDEX IF NOT EXISTS idx_query_performance_logs_captured_at ON query_performance_logs (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_logs_execution_time ON query_performance_logs (execution_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_logs_category ON query_performance_logs (query_category);
CREATE INDEX IF NOT EXISTS idx_query_performance_logs_composite ON query_performance_logs (database_name, query_category, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_optimization_recommendations_hash ON query_optimization_recommendations (query_hash);
CREATE INDEX IF NOT EXISTS idx_optimization_recommendations_status ON query_optimization_recommendations (status);
CREATE INDEX IF NOT EXISTS idx_optimization_recommendations_priority ON query_optimization_recommendations (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_recommendations_type ON query_optimization_recommendations (optimization_type);

CREATE INDEX IF NOT EXISTS idx_query_rewrite_rules_active ON query_rewrite_rules (is_active, priority);
CREATE INDEX IF NOT EXISTS idx_query_rewrite_rules_pattern ON query_rewrite_rules USING gin (pattern_regex gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_database_indexes_tracking_table ON database_indexes_tracking (schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_database_indexes_tracking_usage ON database_indexes_tracking (usage_ratio DESC);

CREATE INDEX IF NOT EXISTS idx_performance_baseline_metrics_name ON performance_baseline_metrics (metric_name, metric_category);
CREATE INDEX IF NOT EXISTS idx_performance_baseline_metrics_measured ON performance_baseline_metrics (measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_execution_plans_hash ON query_execution_plans (query_hash);
CREATE INDEX IF NOT EXISTS idx_query_execution_plans_cost ON query_execution_plans (total_cost DESC);
CREATE INDEX IF NOT EXISTS idx_query_execution_plans_captured ON query_execution_plans (captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_optimization_job_queue_status ON optimization_job_queue (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_optimization_job_queue_priority ON optimization_job_queue (job_priority DESC, scheduled_at);

-- Insert default service configuration
INSERT INTO optimization_service_config (config_key, config_value, description, config_type)
VALUES 
    ('analysis_interval_minutes', '15', 'How often to run query analysis', 'system'),
    ('slow_query_threshold_ms', '1000', 'Threshold for identifying slow queries', 'performance'),
    ('auto_optimization_enabled', 'false', 'Enable automatic optimization application', 'system'),
    ('max_concurrent_jobs', '5', 'Maximum concurrent optimization jobs', 'system'),
    ('retention_days', '90', 'Days to retain performance logs', 'system'),
    ('index_suggestion_min_scans', '100', 'Minimum scans before suggesting index', 'optimization'),
    ('query_rewrite_confidence_threshold', '0.8', 'Confidence threshold for auto-rewrite', 'optimization')
ON CONFLICT (config_key) DO NOTHING;

-- Insert default rewrite rules
INSERT INTO query_rewrite_rules (rule_name, pattern_regex, replacement_template, rule_description, rule_category, priority)
VALUES 
    ('eliminate_distinct_with_limit', 
     'SELECT DISTINCT (.+) FROM (.+) LIMIT (\d+)', 
     'SELECT $1 FROM $2 GROUP BY $1 LIMIT $3',
     'Replace DISTINCT with GROUP BY for better performance with LIMIT',
     'performance', 90),
    ('optimize_count_star',
     'SELECT COUNT\(\*\) FROM ([^\s]+) WHERE (.+)',
     'SELECT COUNT(1) FROM $1 WHERE $2',
     'Use COUNT(1) instead of COUNT(*) for better performance',
     'performance', 80),
    ('eliminate_unnecessary_subquery',
     'SELECT (.+) FROM \(SELECT (.+) FROM ([^\)]+)\) AS (.+)',
     'SELECT $2 FROM $3',
     'Remove unnecessary subquery wrapper',
     'simplification', 70)
ON CONFLICT (rule_name) DO NOTHING;

-- Create views for monitoring
CREATE OR REPLACE VIEW query_performance_summary AS
SELECT 
    query_hash,
    COUNT(*) as execution_count,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(execution_time_ms) as max_execution_time_ms,
    MIN(execution_time_ms) as min_execution_time_ms,
    SUM(rows_examined) as total_rows_examined,
    SUM(rows_returned) as total_rows_returned,
    AVG(buffer_hits::DECIMAL / NULLIF(buffer_hits + buffer_misses, 0)) as avg_hit_ratio,
    query_category,
    MAX(captured_at) as last_executed_at
FROM query_performance_logs 
WHERE captured_at >= NOW() - INTERVAL '24 hours'
GROUP BY query_hash, query_category
ORDER BY avg_execution_time_ms DESC;

CREATE OR REPLACE VIEW optimization_effectiveness AS
SELECT 
    r.optimization_type,
    COUNT(*) as recommendations_count,
    COUNT(CASE WHEN r.applied_at IS NOT NULL THEN 1 END) as applied_count,
    AVG(r.estimated_improvement_pct) as avg_estimated_improvement,
    AVG(CASE WHEN r.application_result IS NOT NULL 
        THEN (r.application_result->>'actual_improvement_pct')::DECIMAL 
        END) as avg_actual_improvement
FROM query_optimization_recommendations r
WHERE r.created_at >= NOW() - INTERVAL '30 days'
GROUP BY r.optimization_type
ORDER BY applied_count DESC;

-- Create functions for query analysis
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(query_hash TEXT, recommendation_count BIGINT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Analyze slow queries and generate recommendations
    INSERT INTO query_optimization_recommendations (
        query_hash, query_pattern, optimization_type, priority_score,
        estimated_improvement_pct, recommendation_title, recommendation_description,
        implementation_sql, affected_tables
    )
    SELECT DISTINCT
        qpl.query_hash,
        SUBSTRING(qpl.normalized_query, 1, 200) as query_pattern,
        'index_creation'::optimization_type,
        CASE 
            WHEN qpl.execution_time_ms > 5000 THEN 90
            WHEN qpl.execution_time_ms > 2000 THEN 70
            ELSE 50
        END as priority_score,
        CASE 
            WHEN qpl.buffer_misses > qpl.buffer_hits THEN 60.0
            ELSE 30.0
        END as estimated_improvement_pct,
        'Create index for slow query' as recommendation_title,
        'Query shows high execution time and buffer misses, consider adding appropriate indexes' as recommendation_description,
        '-- Index suggestion based on query analysis' as implementation_sql,
        ARRAY[]::TEXT[] as affected_tables
    FROM query_performance_logs qpl
    WHERE qpl.execution_time_ms > (
        SELECT config_value::TEXT::INTEGER 
        FROM optimization_service_config 
        WHERE config_key = 'slow_query_threshold_ms'
    )
    AND qpl.captured_at >= NOW() - INTERVAL '1 hour'
    AND NOT EXISTS (
        SELECT 1 FROM query_optimization_recommendations r
        WHERE r.query_hash = qpl.query_hash
        AND r.created_at >= NOW() - INTERVAL '24 hours'
    );

    -- Return summary
    RETURN QUERY
    SELECT qpl.query_hash, COUNT(*)::BIGINT as recommendation_count
    FROM query_performance_logs qpl
    JOIN query_optimization_recommendations r ON r.query_hash = qpl.query_hash
    WHERE r.created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY qpl.query_hash;
END;
$$;

-- Function to capture query statistics
CREATE OR REPLACE FUNCTION capture_query_statistics()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rows_inserted INTEGER := 0;
BEGIN
    -- Insert new query statistics from pg_stat_statements
    INSERT INTO query_performance_logs (
        query_id, query_hash, normalized_query, execution_time_ms,
        rows_examined, rows_returned, calls_count, mean_exec_time_ms,
        query_category, database_name, captured_at
    )
    SELECT 
        pss.queryid,
        encode(digest(pss.query, 'sha256'), 'hex') as query_hash,
        pss.query as normalized_query,
        pss.total_exec_time as execution_time_ms,
        pss.rows as rows_examined,
        pss.rows as rows_returned,
        pss.calls as calls_count,
        pss.mean_exec_time as mean_exec_time_ms,
        CASE 
            WHEN UPPER(pss.query) LIKE 'SELECT%' THEN 'select'::query_category
            WHEN UPPER(pss.query) LIKE 'INSERT%' THEN 'insert'::query_category
            WHEN UPPER(pss.query) LIKE 'UPDATE%' THEN 'update'::query_category
            WHEN UPPER(pss.query) LIKE 'DELETE%' THEN 'delete'::query_category
            ELSE 'utility'::query_category
        END as query_category,
        current_database() as database_name,
        NOW() as captured_at
    FROM pg_stat_statements pss
    WHERE pss.calls > 0
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$;

-- Function to clean old data
CREATE OR REPLACE FUNCTION cleanup_old_performance_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    retention_days INTEGER;
    rows_deleted INTEGER := 0;
BEGIN
    -- Get retention period from config
    SELECT (config_value::TEXT)::INTEGER INTO retention_days
    FROM optimization_service_config 
    WHERE config_key = 'retention_days';
    
    -- Clean old performance logs
    DELETE FROM query_performance_logs 
    WHERE captured_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    -- Clean expired recommendations
    DELETE FROM query_optimization_recommendations
    WHERE expires_at < NOW();
    
    RETURN rows_deleted;
END;
$$;

-- Enable Row Level Security
ALTER TABLE query_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_optimization_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_rewrite_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_service_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_indexes_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_baseline_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_job_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service access
CREATE POLICY "Service can access all query performance logs" ON query_performance_logs
    FOR ALL USING (true);

CREATE POLICY "Service can access all optimization recommendations" ON query_optimization_recommendations
    FOR ALL USING (true);

CREATE POLICY "Service can access all rewrite rules" ON query_rewrite_rules
    FOR ALL USING (true);

CREATE POLICY "Service can access configuration" ON optimization_service_config
    FOR ALL USING (true);

CREATE POLICY "Service can access index tracking" ON database_indexes_tracking
    FOR ALL USING (true);

CREATE POLICY "Service can access baseline metrics" ON performance_baseline_metrics
    FOR ALL USING (true);

CREATE POLICY "Service can access execution plans" ON query_execution_plans
    FOR ALL USING (true);

CREATE POLICY "Service can access job queue" ON optimization_job_queue
    FOR ALL USING (true);

-- Schedule periodic jobs using pg_cron
SELECT cron.schedule('query-statistics-capture', '*/5 minutes', 'SELECT capture_query_statistics();');
SELECT cron.schedule('query-performance-analysis', '*/15 minutes', 'SELECT analyze_query_performance();');
SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_performance_data();');

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_query_performance_logs_updated_at
    BEFORE UPDATE ON query_performance_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_query_optimization_recommendations_updated_at
    BEFORE UPDATE ON query_optimization_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_query_rewrite_rules_updated_at
    BEFORE UPDATE ON query_rewrite_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimization_service_config_updated_at
    BEFORE UPDATE ON optimization_service_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_database_indexes_tracking_updated_at
    BEFORE UPDATE ON database_indexes_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performance_baseline_metrics_updated_at
    BEFORE UPDATE ON performance_baseline_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimization_job_queue_updated_at
    BEFORE UPDATE ON optimization_job_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```