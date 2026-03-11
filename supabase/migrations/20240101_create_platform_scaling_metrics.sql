```sql
-- Platform Scaling Metrics Database Migration
-- Optimized time-series schema for high-frequency scaling metrics
-- Created: 2024-01-01

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create enum types for better data consistency
CREATE TYPE IF NOT EXISTS metric_type AS ENUM (
    'cpu_usage',
    'memory_usage',
    'disk_usage',
    'network_io',
    'response_time',
    'throughput',
    'error_rate',
    'active_connections',
    'queue_depth',
    'cache_hit_rate'
);

CREATE TYPE IF NOT EXISTS resource_type AS ENUM (
    'cpu',
    'memory',
    'disk',
    'network',
    'database',
    'cache',
    'queue',
    'api'
);

CREATE TYPE IF NOT EXISTS scaling_event_type AS ENUM (
    'scale_up',
    'scale_down',
    'auto_scale',
    'manual_scale',
    'failover',
    'recovery'
);

CREATE TYPE IF NOT EXISTS alert_severity AS ENUM (
    'info',
    'warning',
    'critical',
    'emergency'
);

-- Main scaling metrics hypertable for high-frequency data
CREATE TABLE IF NOT EXISTS scaling_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    instance_id VARCHAR(100) NOT NULL,
    metric_type metric_type NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20),
    labels JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable with 1-hour time partitioning
SELECT create_hypertable(
    'scaling_metrics', 
    'timestamp',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scaling_metrics_tenant_time 
ON scaling_metrics (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_metrics_service_time 
ON scaling_metrics (service_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_metrics_type_time 
ON scaling_metrics (metric_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_metrics_instance_time 
ON scaling_metrics (instance_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_metrics_labels 
ON scaling_metrics USING GIN (labels);

-- Performance snapshots for point-in-time analysis
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    snapshot_type VARCHAR(50) NOT NULL DEFAULT 'periodic',
    cpu_usage DOUBLE PRECISION,
    memory_usage DOUBLE PRECISION,
    disk_usage DOUBLE PRECISION,
    network_in DOUBLE PRECISION,
    network_out DOUBLE PRECISION,
    response_time_p50 DOUBLE PRECISION,
    response_time_p95 DOUBLE PRECISION,
    response_time_p99 DOUBLE PRECISION,
    throughput DOUBLE PRECISION,
    error_rate DOUBLE PRECISION,
    active_connections INTEGER,
    queue_depth INTEGER,
    cache_hit_rate DOUBLE PRECISION,
    custom_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_tenant_time 
ON performance_snapshots (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_service_time 
ON performance_snapshots (service_name, timestamp DESC);

-- Resource utilization table for detailed resource tracking
CREATE TABLE IF NOT EXISTS resource_utilization (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID NOT NULL,
    resource_type resource_type NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    instance_id VARCHAR(100),
    utilization_percent DOUBLE PRECISION NOT NULL,
    allocated_amount DOUBLE PRECISION,
    used_amount DOUBLE PRECISION,
    available_amount DOUBLE PRECISION,
    unit VARCHAR(20),
    threshold_warning DOUBLE PRECISION DEFAULT 80.0,
    threshold_critical DOUBLE PRECISION DEFAULT 95.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable(
    'resource_utilization', 
    'timestamp',
    chunk_time_interval => INTERVAL '2 hours',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_resource_utilization_tenant_time 
ON resource_utilization (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_resource_utilization_type_time 
ON resource_utilization (resource_type, timestamp DESC);

-- Scaling events table for correlation analysis
CREATE TABLE IF NOT EXISTS scaling_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    instance_id VARCHAR(100),
    event_type scaling_event_type NOT NULL,
    trigger_reason TEXT,
    scale_from INTEGER,
    scale_to INTEGER,
    duration_seconds INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    triggered_by VARCHAR(100),
    automation_rule_id UUID,
    cost_impact DOUBLE PRECISION,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scaling_events_tenant_time 
ON scaling_events (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_events_service_time 
ON scaling_events (service_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_events_type_time 
ON scaling_events (event_type, timestamp DESC);

-- Performance baselines for anomaly detection
CREATE TABLE IF NOT EXISTS performance_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    metric_type metric_type NOT NULL,
    time_window VARCHAR(20) NOT NULL, -- '1h', '24h', '7d', etc.
    baseline_value DOUBLE PRECISION NOT NULL,
    standard_deviation DOUBLE PRECISION,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    confidence_interval_lower DOUBLE PRECISION,
    confidence_interval_upper DOUBLE PRECISION,
    sample_count INTEGER,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_baselines_unique 
ON performance_baselines (tenant_id, service_name, metric_type, time_window);

-- Metric retention policies
CREATE TABLE IF NOT EXISTS metric_retention_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    retention_period INTERVAL NOT NULL DEFAULT '90 days',
    aggregation_policy JSONB DEFAULT '{}',
    compression_after INTERVAL DEFAULT '30 days',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retention_policies_unique 
ON metric_retention_policies (tenant_id, table_name);

-- Aggregated metrics materialized views
-- 1-minute aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1min AS
SELECT
    time_bucket('1 minute', timestamp) AS bucket,
    tenant_id,
    service_name,
    instance_id,
    metric_type,
    metric_name,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS sample_count,
    STDDEV(value) AS stddev_value
FROM scaling_metrics
GROUP BY bucket, tenant_id, service_name, instance_id, metric_type, metric_name
ORDER BY bucket DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_1min_unique 
ON metrics_1min (bucket, tenant_id, service_name, instance_id, metric_type, metric_name);

-- 5-minute aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_5min AS
SELECT
    time_bucket('5 minutes', timestamp) AS bucket,
    tenant_id,
    service_name,
    metric_type,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS sample_count,
    STDDEV(value) AS stddev_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) AS p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) AS p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) AS p99
FROM scaling_metrics
GROUP BY bucket, tenant_id, service_name, metric_type
ORDER BY bucket DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_5min_unique 
ON metrics_5min (bucket, tenant_id, service_name, metric_type);

-- Hourly aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hourly AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    tenant_id,
    service_name,
    metric_type,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS sample_count,
    STDDEV(value) AS stddev_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) AS p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) AS p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) AS p99
FROM scaling_metrics
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY bucket, tenant_id, service_name, metric_type
ORDER BY bucket DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_hourly_unique 
ON metrics_hourly (bucket, tenant_id, service_name, metric_type);

-- Alert thresholds configuration
CREATE TABLE IF NOT EXISTS alert_thresholds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    metric_type metric_type NOT NULL,
    threshold_type VARCHAR(20) NOT NULL CHECK (threshold_type IN ('upper', 'lower', 'range')),
    warning_value DOUBLE PRECISION,
    critical_value DOUBLE PRECISION,
    emergency_value DOUBLE PRECISION,
    duration_minutes INTEGER DEFAULT 5,
    enabled BOOLEAN DEFAULT TRUE,
    notification_channels JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_thresholds_unique 
ON alert_thresholds (tenant_id, service_name, metric_type, threshold_type);

-- Functions for metric aggregation and analysis
CREATE OR REPLACE FUNCTION calculate_metric_baseline(
    p_tenant_id UUID,
    p_service_name VARCHAR,
    p_metric_type metric_type,
    p_time_window VARCHAR DEFAULT '7d'
) RETURNS VOID AS $$
DECLARE
    baseline_data RECORD;
    retention_days INTEGER;
BEGIN
    -- Parse time window to days
    retention_days := CASE 
        WHEN p_time_window = '1h' THEN 1
        WHEN p_time_window = '24h' THEN 1
        WHEN p_time_window = '7d' THEN 7
        WHEN p_time_window = '30d' THEN 30
        ELSE 7
    END;

    -- Calculate baseline statistics
    SELECT
        AVG(value) AS baseline_value,
        STDDEV(value) AS standard_deviation,
        MIN(value) AS min_value,
        MAX(value) AS max_value,
        COUNT(*) AS sample_count
    INTO baseline_data
    FROM scaling_metrics
    WHERE tenant_id = p_tenant_id
        AND service_name = p_service_name
        AND metric_type = p_metric_type
        AND timestamp >= NOW() - (retention_days || ' days')::INTERVAL;

    -- Insert or update baseline
    INSERT INTO performance_baselines (
        tenant_id, service_name, metric_type, time_window,
        baseline_value, standard_deviation, min_value, max_value,
        confidence_interval_lower, confidence_interval_upper,
        sample_count, calculated_at, valid_until
    ) VALUES (
        p_tenant_id, p_service_name, p_metric_type, p_time_window,
        baseline_data.baseline_value, baseline_data.standard_deviation,
        baseline_data.min_value, baseline_data.max_value,
        baseline_data.baseline_value - (baseline_data.standard_deviation * 2),
        baseline_data.baseline_value + (baseline_data.standard_deviation * 2),
        baseline_data.sample_count,
        NOW(),
        NOW() + (retention_days || ' days')::INTERVAL
    )
    ON CONFLICT (tenant_id, service_name, metric_type, time_window)
    DO UPDATE SET
        baseline_value = EXCLUDED.baseline_value,
        standard_deviation = EXCLUDED.standard_deviation,
        min_value = EXCLUDED.min_value,
        max_value = EXCLUDED.max_value,
        confidence_interval_lower = EXCLUDED.confidence_interval_lower,
        confidence_interval_upper = EXCLUDED.confidence_interval_upper,
        sample_count = EXCLUDED.sample_count,
        calculated_at = EXCLUDED.calculated_at,
        valid_until = EXCLUDED.valid_until,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to detect anomalies
CREATE OR REPLACE FUNCTION detect_metric_anomalies(
    p_tenant_id UUID,
    p_service_name VARCHAR DEFAULT NULL,
    p_lookback_minutes INTEGER DEFAULT 60
) RETURNS TABLE (
    metric_type metric_type,
    service_name VARCHAR,
    current_value DOUBLE PRECISION,
    baseline_value DOUBLE PRECISION,
    deviation_score DOUBLE PRECISION,
    anomaly_severity alert_severity
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_metrics AS (
        SELECT
            m.metric_type,
            m.service_name,
            AVG(m.value) AS current_value
        FROM scaling_metrics m
        WHERE m.tenant_id = p_tenant_id
            AND (p_service_name IS NULL OR m.service_name = p_service_name)
            AND m.timestamp >= NOW() - (p_lookback_minutes || ' minutes')::INTERVAL
        GROUP BY m.metric_type, m.service_name
    ),
    anomaly_detection AS (
        SELECT
            rm.metric_type,
            rm.service_name,
            rm.current_value,
            pb.baseline_value,
            CASE 
                WHEN pb.standard_deviation > 0 THEN 
                    ABS(rm.current_value - pb.baseline_value) / pb.standard_deviation
                ELSE 0
            END AS deviation_score
        FROM recent_metrics rm
        JOIN performance_baselines pb ON (
            pb.tenant_id = p_tenant_id
            AND pb.service_name = rm.service_name
            AND pb.metric_type = rm.metric_type
            AND pb.time_window = '7d'
            AND pb.valid_until > NOW()
        )
    )
    SELECT
        ad.metric_type,
        ad.service_name,
        ad.current_value,
        ad.baseline_value,
        ad.deviation_score,
        CASE
            WHEN ad.deviation_score >= 4 THEN 'emergency'::alert_severity
            WHEN ad.deviation_score >= 3 THEN 'critical'::alert_severity
            WHEN ad.deviation_score >= 2 THEN 'warning'::alert_severity
            ELSE 'info'::alert_severity
        END AS anomaly_severity
    FROM anomaly_detection ad
    WHERE ad.deviation_score >= 2
    ORDER BY ad.deviation_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE scaling_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_utilization ENABLE ROW LEVEL SECURITY;
ALTER TABLE scaling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tenant_isolation_scaling_metrics ON scaling_metrics
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::UUID);

CREATE POLICY tenant_isolation_performance_snapshots ON performance_snapshots
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::UUID);

CREATE POLICY tenant_isolation_resource_utilization ON resource_utilization
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::UUID);

CREATE POLICY tenant_isolation_scaling_events ON scaling_events
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::UUID);

CREATE POLICY tenant_isolation_performance_baselines ON performance_baselines
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::UUID);

CREATE POLICY tenant_isolation_metric_retention_policies ON metric_retention_policies
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::UUID);

CREATE POLICY tenant_isolation_alert_thresholds ON alert_thresholds
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::UUID);

-- Compression policies for TimescaleDB
SELECT add_compression_policy('scaling_metrics', INTERVAL '24 hours', if_not_exists => true);
SELECT add_compression_policy('resource_utilization', INTERVAL '48 hours', if_not_exists => true);

-- Data retention policies
SELECT add_retention_policy('scaling_metrics', INTERVAL '90 days', if_not_exists => true);
SELECT add_retention_policy('resource_utilization', INTERVAL '180 days', if_not_exists => true);

-- Continuous aggregation policies (refresh materialized views)
SELECT add_continuous_aggregate_policy('metrics_1min',
    start_offset => INTERVAL '5 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => true);

SELECT add_continuous_aggregate_policy('metrics_5min',
    start_offset => INTERVAL '30 minutes', 
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => true);

SELECT add_continuous_aggregate_policy('metrics_hourly',
    start_offset => INTERVAL '6 hours',
    end_offset => INTERVAL '1 hour', 
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true);

-- Schedule baseline calculation job (runs every hour)
SELECT cron.schedule(
    'calculate-baselines',
    '0 * * * *', -- Every hour
    $$
    DO $$
    DECLARE
        tenant_rec RECORD;
        service_rec RECORD;
        metric_rec RECORD;
    BEGIN
        FOR tenant_rec IN SELECT DISTINCT tenant_id FROM scaling_metrics WHERE timestamp >= NOW() - INTERVAL '1 hour' LOOP
            FOR service_rec IN SELECT DISTINCT service_name FROM scaling_metrics WHERE tenant_id = tenant_rec.tenant_id LOOP
                FOR metric_rec IN SELECT DISTINCT metric_type FROM scaling_metrics WHERE tenant_id = tenant_rec.tenant_id AND service_name = service_rec.service_name LOOP
                    PERFORM calculate_metric_baseline(tenant_rec.tenant_id, service_rec.service_name, metric_rec.metric_type, '7d');
                END LOOP;
            END LOOP;
        END LOOP;
    END $$;
    $$
);

-- Create helpful views for common queries
CREATE OR REPLACE VIEW latest_performance_summary AS
SELECT DISTINCT ON (tenant_id, service_name)
    tenant_id,
    service_name,
    timestamp,
    cpu_usage,
    memory_usage,
    disk_usage,
    response_time_p95,
    throughput,
    error_rate,
    active_connections
FROM performance_snapshots
ORDER BY tenant_id, service_name, timestamp DESC;

CREATE OR REPLACE VIEW scaling_events_with_impact AS
SELECT
    se.*,
    COALESCE(
        (SELECT AVG(value) FROM scaling_metrics sm 
         WHERE sm.tenant_id = se.tenant_id 
           AND sm.service_name = se.service_name
           AND sm.metric_type = 'cpu_usage'
           AND sm.timestamp BETWEEN se.timestamp AND se.timestamp + INTERVAL '1 hour'),
        0
    ) AS post_event_cpu_avg
FROM scaling_events se;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE scaling_metrics IS 'High-frequency time-series metrics storage with TimescaleDB optimization';
COMMENT ON TABLE performance_snapshots IS 'Point-in-time performance snapshots for detailed analysis';
COMMENT ON TABLE resource_utilization IS 'Resource usage tracking across different resource types';
COMMENT ON TABLE scaling_events IS 'Scaling events for correlation with performance metrics';
COMMENT ON TABLE performance_baselines IS 'Baseline metrics for anomaly detection algorithms';
COMMENT ON TABLE metric_retention_policies IS 'Configurable data retention and lifecycle policies';
COMMENT ON TABLE alert_thresholds IS 'Alert threshold configuration for automated monitoring';

COMMENT ON FUNCTION calculate_metric_baseline IS 'Calculates and updates performance baselines for anomaly detection';
COMMENT ON FUNCTION detect_metric_anomalies IS 'Detects performance anomalies based on statistical baselines';
```