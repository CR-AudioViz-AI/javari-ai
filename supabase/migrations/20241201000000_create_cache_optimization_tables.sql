```sql
-- Multi-Layer Cache Optimization Service Migration
-- Creates comprehensive schema for intelligent cache optimization across CDN, application, and database layers

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Cache layers table - defines different cache layers (CDN, application, database)
CREATE TABLE IF NOT EXISTS cache_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    layer_name VARCHAR(100) NOT NULL,
    layer_type VARCHAR(50) NOT NULL CHECK (layer_type IN ('cdn', 'application', 'database', 'edge', 'memory')),
    layer_config JSONB NOT NULL DEFAULT '{}',
    capacity_bytes BIGINT,
    current_usage_bytes BIGINT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    endpoint_url TEXT,
    provider VARCHAR(100),
    region VARCHAR(50),
    priority_level INTEGER DEFAULT 1,
    health_check_url TEXT,
    last_health_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, layer_name, layer_type)
);

-- Cache strategies table - optimization algorithms and rules
CREATE TABLE IF NOT EXISTS cache_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL CHECK (strategy_type IN ('lru', 'lfu', 'fifo', 'ttl', 'adaptive', 'ml_optimized')),
    algorithm_config JSONB NOT NULL DEFAULT '{}',
    target_layers TEXT[] NOT NULL,
    conditions JSONB DEFAULT '{}',
    priority_score DECIMAL(5,2) DEFAULT 50.0,
    effectiveness_score DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, strategy_name)
);

-- Cache metrics table (hypertable for time-series data)
CREATE TABLE IF NOT EXISTS cache_metrics (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    layer_id UUID NOT NULL REFERENCES cache_layers(id) ON DELETE CASCADE,
    metric_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cache_hits BIGINT DEFAULT 0,
    cache_misses BIGINT DEFAULT 0,
    cache_hit_ratio DECIMAL(5,4),
    response_time_ms DECIMAL(10,3),
    throughput_rps DECIMAL(10,2),
    error_count INTEGER DEFAULT 0,
    cache_size_bytes BIGINT,
    evictions_count INTEGER DEFAULT 0,
    memory_usage_percent DECIMAL(5,2),
    cpu_usage_percent DECIMAL(5,2),
    network_io_bytes BIGINT DEFAULT 0,
    custom_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert cache_metrics to hypertable for time-series optimization
SELECT create_hypertable('cache_metrics', 'metric_timestamp', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);

-- Cache policies table - TTL and invalidation rules
CREATE TABLE IF NOT EXISTS cache_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    policy_name VARCHAR(100) NOT NULL,
    layer_id UUID NOT NULL REFERENCES cache_layers(id) ON DELETE CASCADE,
    resource_pattern TEXT NOT NULL,
    ttl_seconds INTEGER,
    max_age_seconds INTEGER,
    stale_while_revalidate_seconds INTEGER,
    invalidation_rules JSONB DEFAULT '{}',
    vary_headers TEXT[],
    cache_control_headers JSONB DEFAULT '{}',
    compression_enabled BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, policy_name, layer_id)
);

-- Cache usage patterns table - ML-driven pattern analysis
CREATE TABLE IF NOT EXISTS cache_usage_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    pattern_type VARCHAR(50) NOT NULL CHECK (pattern_type IN ('temporal', 'geographic', 'user_behavior', 'content_type', 'seasonal')),
    layer_id UUID REFERENCES cache_layers(id) ON DELETE CASCADE,
    pattern_data JSONB NOT NULL,
    confidence_score DECIMAL(5,4),
    frequency_count INTEGER DEFAULT 1,
    first_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prediction_accuracy DECIMAL(5,4),
    optimization_impact DECIMAL(8,4),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'experimental')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache optimization logs table - audit and debugging
CREATE TABLE IF NOT EXISTS cache_optimization_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    optimization_type VARCHAR(50) NOT NULL,
    layer_id UUID REFERENCES cache_layers(id) ON DELETE SET NULL,
    strategy_id UUID REFERENCES cache_strategies(id) ON DELETE SET NULL,
    action_taken VARCHAR(100) NOT NULL,
    before_metrics JSONB,
    after_metrics JSONB,
    improvement_percentage DECIMAL(5,2),
    execution_time_ms DECIMAL(10,3),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache invalidation queue table
CREATE TABLE IF NOT EXISTS cache_invalidation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    layer_id UUID NOT NULL REFERENCES cache_layers(id) ON DELETE CASCADE,
    invalidation_type VARCHAR(50) NOT NULL CHECK (invalidation_type IN ('tag', 'url', 'pattern', 'full', 'selective')),
    target_identifier TEXT NOT NULL,
    priority INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance analytics aggregation view
CREATE MATERIALIZED VIEW IF NOT EXISTS cache_performance_summary AS
SELECT 
    cm.tenant_id,
    cm.layer_id,
    cl.layer_name,
    cl.layer_type,
    DATE_TRUNC('hour', cm.metric_timestamp) as hour_bucket,
    AVG(cm.cache_hit_ratio) as avg_hit_ratio,
    AVG(cm.response_time_ms) as avg_response_time,
    SUM(cm.cache_hits) as total_hits,
    SUM(cm.cache_misses) as total_misses,
    AVG(cm.throughput_rps) as avg_throughput,
    SUM(cm.error_count) as total_errors,
    AVG(cm.memory_usage_percent) as avg_memory_usage,
    COUNT(*) as metric_count
FROM cache_metrics cm
JOIN cache_layers cl ON cm.layer_id = cl.id
WHERE cm.metric_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY cm.tenant_id, cm.layer_id, cl.layer_name, cl.layer_type, DATE_TRUNC('hour', cm.metric_timestamp);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_cache_layers_tenant_type ON cache_layers(tenant_id, layer_type);
CREATE INDEX IF NOT EXISTS idx_cache_layers_status ON cache_layers(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_cache_strategies_tenant_active ON cache_strategies(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cache_strategies_effectiveness ON cache_strategies(effectiveness_score DESC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_cache_metrics_tenant_layer ON cache_metrics(tenant_id, layer_id, metric_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_timestamp ON cache_metrics(metric_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_hit_ratio ON cache_metrics(cache_hit_ratio) WHERE cache_hit_ratio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cache_policies_tenant_layer ON cache_policies(tenant_id, layer_id);
CREATE INDEX IF NOT EXISTS idx_cache_policies_pattern ON cache_policies USING GIN(to_tsvector('english', resource_pattern));
CREATE INDEX IF NOT EXISTS idx_cache_policies_active ON cache_policies(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_cache_usage_patterns_tenant_type ON cache_usage_patterns(tenant_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_cache_usage_patterns_confidence ON cache_usage_patterns(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_cache_usage_patterns_last_observed ON cache_usage_patterns(last_observed DESC);

CREATE INDEX IF NOT EXISTS idx_cache_optimization_logs_tenant ON cache_optimization_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_optimization_logs_success ON cache_optimization_logs(success, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_queue_status ON cache_invalidation_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_queue_tenant_layer ON cache_invalidation_queue(tenant_id, layer_id);

-- Enable Row Level Security
ALTER TABLE cache_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_usage_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_optimization_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_invalidation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY IF NOT EXISTS "Users can access own cache layers" ON cache_layers
    FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY IF NOT EXISTS "Users can access own cache strategies" ON cache_strategies
    FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY IF NOT EXISTS "Users can access own cache metrics" ON cache_metrics
    FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY IF NOT EXISTS "Users can access own cache policies" ON cache_policies
    FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY IF NOT EXISTS "Users can access own cache usage patterns" ON cache_usage_patterns
    FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY IF NOT EXISTS "Users can access own cache optimization logs" ON cache_optimization_logs
    FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY IF NOT EXISTS "Users can access own cache invalidation queue" ON cache_invalidation_queue
    FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

-- Functions for cache optimization calculations
CREATE OR REPLACE FUNCTION calculate_cache_hit_ratio(hits BIGINT, misses BIGINT)
RETURNS DECIMAL(5,4) AS $$
BEGIN
    IF (hits + misses) = 0 THEN
        RETURN NULL;
    END IF;
    RETURN ROUND((hits::DECIMAL / (hits + misses)::DECIMAL), 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get cache performance insights
CREATE OR REPLACE FUNCTION get_cache_performance_insights(p_tenant_id UUID, p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
    layer_name VARCHAR,
    layer_type VARCHAR,
    avg_hit_ratio DECIMAL,
    avg_response_time DECIMAL,
    total_requests BIGINT,
    performance_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cl.layer_name,
        cl.layer_type,
        AVG(cm.cache_hit_ratio) as avg_hit_ratio,
        AVG(cm.response_time_ms) as avg_response_time,
        SUM(cm.cache_hits + cm.cache_misses) as total_requests,
        -- Performance score calculation (hit ratio * 0.6 + response time factor * 0.4)
        ROUND(
            (AVG(cm.cache_hit_ratio) * 0.6 + 
             (1 - LEAST(AVG(cm.response_time_ms) / 1000, 1)) * 0.4) * 100, 2
        ) as performance_score
    FROM cache_layers cl
    JOIN cache_metrics cm ON cl.id = cm.layer_id
    WHERE cl.tenant_id = p_tenant_id 
    AND cm.metric_timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY cl.layer_name, cl.layer_type
    ORDER BY performance_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to update cache hit ratio
CREATE OR REPLACE FUNCTION update_cache_hit_ratio()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cache_hit_ratio := calculate_cache_hit_ratio(NEW.cache_hits, NEW.cache_misses);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate hit ratio
CREATE TRIGGER trigger_update_cache_hit_ratio
    BEFORE INSERT OR UPDATE ON cache_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_cache_hit_ratio();

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
CREATE TRIGGER trigger_cache_layers_updated_at
    BEFORE UPDATE ON cache_layers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_cache_strategies_updated_at
    BEFORE UPDATE ON cache_strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_cache_policies_updated_at
    BEFORE UPDATE ON cache_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_cache_usage_patterns_updated_at
    BEFORE UPDATE ON cache_usage_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Create refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_cache_performance_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW cache_performance_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule automatic refresh of materialized view (requires pg_cron extension)
-- SELECT cron.schedule('refresh-cache-performance', '*/15 * * * *', 'SELECT refresh_cache_performance_summary();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Insert default cache strategies
INSERT INTO cache_strategies (tenant_id, strategy_name, strategy_type, algorithm_config, target_layers, conditions, priority_score, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000000'::UUID, 'Default LRU', 'lru', '{"max_size": 1000, "eviction_policy": "least_recently_used"}', ARRAY['application', 'memory'], '{"content_type": ["text/html", "application/json"]}', 75.0, true),
    ('00000000-0000-0000-0000-000000000000'::UUID, 'CDN Adaptive', 'adaptive', '{"learning_rate": 0.1, "adaptation_interval": 300}', ARRAY['cdn', 'edge'], '{"cache_hit_ratio": {"min": 0.8}}', 85.0, true),
    ('00000000-0000-0000-0000-000000000000'::UUID, 'Database Query Cache', 'ttl', '{"default_ttl": 3600, "max_ttl": 86400}', ARRAY['database'], '{"query_complexity": {"min": 0.5}}', 70.0, true)
ON CONFLICT (tenant_id, strategy_name) DO NOTHING;

COMMENT ON TABLE cache_layers IS 'Defines different cache layers (CDN, application, database) with their configurations and status';
COMMENT ON TABLE cache_strategies IS 'Cache optimization algorithms and rules for intelligent caching decisions';
COMMENT ON TABLE cache_metrics IS 'Time-series performance metrics for all cache layers';
COMMENT ON TABLE cache_policies IS 'TTL and invalidation rules for cache resources';
COMMENT ON TABLE cache_usage_patterns IS 'ML-driven analysis of cache usage patterns for optimization';
COMMENT ON TABLE cache_optimization_logs IS 'Audit trail of cache optimization actions and their results';
COMMENT ON MATERIALIZED VIEW cache_performance_summary IS 'Aggregated cache performance analytics for reporting and monitoring';
```