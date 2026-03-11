```sql
-- Distributed Cache Optimization Service Migration
-- Created: 2024-12-01
-- Description: Database schema for intelligent distributed cache management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create enums for cache types and statuses
CREATE TYPE cache_layer_type AS ENUM ('cdn', 'application', 'database', 'memory', 'redis');
CREATE TYPE cache_warming_strategy AS ENUM ('proactive', 'reactive', 'scheduled', 'ml_predicted', 'user_behavior');
CREATE TYPE cache_invalidation_type AS ENUM ('ttl', 'manual', 'event_based', 'dependency', 'lru', 'lfu');
CREATE TYPE cache_job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE cache_optimization_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Cache layers configuration table
CREATE TABLE IF NOT EXISTS cache_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    layer_type cache_layer_type NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    config JSONB NOT NULL DEFAULT '{}',
    endpoints JSONB DEFAULT '{}',
    capacity_limits JSONB DEFAULT '{}',
    ttl_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT cache_layers_priority_check CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT cache_layers_tenant_name_unique UNIQUE (tenant_id, name)
);

-- Cache warming strategies table
CREATE TABLE IF NOT EXISTS cache_warming_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    strategy_type cache_warming_strategy NOT NULL,
    target_layers UUID[] NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}',
    warming_rules JSONB NOT NULL DEFAULT '{}',
    schedule_config JSONB DEFAULT '{}',
    priority cache_optimization_priority DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    performance_threshold JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT cache_warming_strategies_tenant_name_unique UNIQUE (tenant_id, name)
);

-- Cache invalidation rules table
CREATE TABLE IF NOT EXISTS cache_invalidation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    invalidation_type cache_invalidation_type NOT NULL,
    target_layers UUID[] NOT NULL,
    trigger_conditions JSONB NOT NULL DEFAULT '{}',
    invalidation_patterns JSONB NOT NULL DEFAULT '{}',
    cascade_rules JSONB DEFAULT '{}',
    priority cache_optimization_priority DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT cache_invalidation_rules_tenant_name_unique UNIQUE (tenant_id, name)
);

-- Cache key mappings for cross-layer coordination
CREATE TABLE IF NOT EXISTS cache_key_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    primary_key VARCHAR(512) NOT NULL,
    layer_mappings JSONB NOT NULL DEFAULT '{}',
    dependency_graph JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT cache_key_mappings_tenant_key_unique UNIQUE (tenant_id, primary_key)
);

-- Cache warming jobs for scheduled tasks
CREATE TABLE IF NOT EXISTS cache_warming_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    strategy_id UUID NOT NULL REFERENCES cache_warming_strategies(id) ON DELETE CASCADE,
    job_name VARCHAR(255) NOT NULL,
    status cache_job_status DEFAULT 'pending',
    target_layers UUID[] NOT NULL,
    job_config JSONB NOT NULL DEFAULT '{}',
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache performance metrics table
CREATE TABLE IF NOT EXISTS cache_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    layer_id UUID REFERENCES cache_layers(id) ON DELETE CASCADE,
    metric_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cache_key VARCHAR(512),
    hit_rate DECIMAL(5,4),
    miss_rate DECIMAL(5,4),
    response_time_ms INTEGER,
    memory_usage_bytes BIGINT,
    request_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    eviction_count INTEGER DEFAULT 0,
    warming_time_ms INTEGER,
    custom_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache optimization recommendations table
CREATE TABLE IF NOT EXISTS cache_optimization_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    recommendation_type VARCHAR(100) NOT NULL,
    target_layers UUID[] NOT NULL,
    priority cache_optimization_priority DEFAULT 'medium',
    description TEXT NOT NULL,
    impact_analysis JSONB DEFAULT '{}',
    implementation_steps JSONB DEFAULT '{}',
    estimated_improvement JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_cache_layers_tenant_type ON cache_layers(tenant_id, layer_type);
CREATE INDEX IF NOT EXISTS idx_cache_layers_active ON cache_layers(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cache_layers_priority ON cache_layers(tenant_id, priority DESC);

CREATE INDEX IF NOT EXISTS idx_cache_warming_strategies_tenant ON cache_warming_strategies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_warming_strategies_active ON cache_warming_strategies(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cache_warming_strategies_priority ON cache_warming_strategies(tenant_id, priority);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_rules_tenant ON cache_invalidation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_rules_active ON cache_invalidation_rules(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_rules_type ON cache_invalidation_rules(tenant_id, invalidation_type);

CREATE INDEX IF NOT EXISTS idx_cache_key_mappings_tenant_key ON cache_key_mappings(tenant_id, primary_key);
CREATE INDEX IF NOT EXISTS idx_cache_key_mappings_updated ON cache_key_mappings(tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_tenant ON cache_warming_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_status ON cache_warming_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_scheduled ON cache_warming_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_strategy ON cache_warming_jobs(strategy_id);

CREATE INDEX IF NOT EXISTS idx_cache_performance_metrics_tenant ON cache_performance_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_performance_metrics_layer ON cache_performance_metrics(layer_id);
CREATE INDEX IF NOT EXISTS idx_cache_performance_metrics_timestamp ON cache_performance_metrics(tenant_id, metric_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cache_performance_metrics_key ON cache_performance_metrics(tenant_id, cache_key);

CREATE INDEX IF NOT EXISTS idx_cache_optimization_recommendations_tenant ON cache_optimization_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_optimization_recommendations_status ON cache_optimization_recommendations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cache_optimization_recommendations_priority ON cache_optimization_recommendations(tenant_id, priority);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_cache_layers_updated_at 
    BEFORE UPDATE ON cache_layers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_warming_strategies_updated_at 
    BEFORE UPDATE ON cache_warming_strategies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_invalidation_rules_updated_at 
    BEFORE UPDATE ON cache_invalidation_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_key_mappings_updated_at 
    BEFORE UPDATE ON cache_key_mappings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_warming_jobs_updated_at 
    BEFORE UPDATE ON cache_warming_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_optimization_recommendations_updated_at 
    BEFORE UPDATE ON cache_optimization_recommendations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for cache performance aggregation
CREATE OR REPLACE VIEW cache_performance_summary AS
SELECT 
    cpm.tenant_id,
    cl.name as layer_name,
    cl.layer_type,
    DATE_TRUNC('hour', cpm.metric_timestamp) as hour_bucket,
    AVG(cpm.hit_rate) as avg_hit_rate,
    AVG(cpm.response_time_ms) as avg_response_time,
    SUM(cpm.request_count) as total_requests,
    SUM(cpm.error_count) as total_errors,
    AVG(cpm.memory_usage_bytes) as avg_memory_usage
FROM cache_performance_metrics cpm
JOIN cache_layers cl ON cpm.layer_id = cl.id
GROUP BY cpm.tenant_id, cl.name, cl.layer_type, DATE_TRUNC('hour', cpm.metric_timestamp);

-- Create view for cache warming job status
CREATE OR REPLACE VIEW cache_warming_job_status AS
SELECT 
    cwj.tenant_id,
    cws.name as strategy_name,
    cws.strategy_type,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE cwj.status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE cwj.status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE cwj.status = 'pending') as pending_jobs,
    AVG(EXTRACT(EPOCH FROM (cwj.completed_at - cwj.started_at))) as avg_execution_time_seconds
FROM cache_warming_jobs cwj
JOIN cache_warming_strategies cws ON cwj.strategy_id = cws.id
GROUP BY cwj.tenant_id, cws.name, cws.strategy_type;

-- Enable Row Level Security (RLS)
ALTER TABLE cache_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_warming_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_invalidation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_key_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_warming_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_optimization_recommendations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY cache_layers_tenant_isolation ON cache_layers
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cache_warming_strategies_tenant_isolation ON cache_warming_strategies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cache_invalidation_rules_tenant_isolation ON cache_invalidation_rules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cache_key_mappings_tenant_isolation ON cache_key_mappings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cache_warming_jobs_tenant_isolation ON cache_warming_jobs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cache_performance_metrics_tenant_isolation ON cache_performance_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cache_optimization_recommendations_tenant_isolation ON cache_optimization_recommendations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Create function for cache invalidation cascade
CREATE OR REPLACE FUNCTION cascade_cache_invalidation(
    p_tenant_id UUID,
    p_cache_key VARCHAR(512),
    p_invalidation_reason TEXT DEFAULT 'manual'
)
RETURNS TABLE(layer_id UUID, keys_invalidated INTEGER) AS $$
DECLARE
    mapping_record RECORD;
    layer_record RECORD;
    keys_count INTEGER;
BEGIN
    -- Get key mappings for the primary key
    SELECT INTO mapping_record *
    FROM cache_key_mappings 
    WHERE tenant_id = p_tenant_id AND primary_key = p_cache_key;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Iterate through each layer mapping
    FOR layer_record IN 
        SELECT key, value 
        FROM jsonb_each(mapping_record.layer_mappings)
    LOOP
        -- Simulate invalidation (in real implementation, this would call external APIs)
        keys_count := (value->>'key_count')::INTEGER;
        
        -- Log the invalidation
        INSERT INTO cache_performance_metrics (
            tenant_id, layer_id, cache_key, custom_metrics
        ) VALUES (
            p_tenant_id, 
            key::UUID, 
            p_cache_key,
            jsonb_build_object(
                'event_type', 'invalidation',
                'reason', p_invalidation_reason,
                'keys_invalidated', keys_count
            )
        );
        
        RETURN QUERY SELECT key::UUID, keys_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for cache warming recommendations
CREATE OR REPLACE FUNCTION generate_cache_warming_recommendations(p_tenant_id UUID)
RETURNS TABLE(recommendation_id UUID, description TEXT, priority cache_optimization_priority) AS $$
DECLARE
    low_hit_rate_threshold DECIMAL := 0.7;
    high_response_time_threshold INTEGER := 1000;
BEGIN
    -- Identify layers with low hit rates
    INSERT INTO cache_optimization_recommendations (
        tenant_id, recommendation_type, target_layers, priority, description, impact_analysis
    )
    SELECT 
        p_tenant_id,
        'increase_warming_frequency',
        ARRAY[layer_id],
        'high'::cache_optimization_priority,
        'Layer ' || cl.name || ' has low hit rate (' || ROUND(avg_hit_rate * 100, 2) || '%). Consider increasing warming frequency.',
        jsonb_build_object(
            'current_hit_rate', avg_hit_rate,
            'target_hit_rate', 0.9,
            'potential_improvement', (0.9 - avg_hit_rate) * 100
        )
    FROM (
        SELECT layer_id, AVG(hit_rate) as avg_hit_rate
        FROM cache_performance_metrics
        WHERE tenant_id = p_tenant_id 
        AND metric_timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY layer_id
        HAVING AVG(hit_rate) < low_hit_rate_threshold
    ) low_performers
    JOIN cache_layers cl ON low_performers.layer_id = cl.id;
    
    -- Return generated recommendations
    RETURN QUERY
    SELECT cor.id, cor.description, cor.priority
    FROM cache_optimization_recommendations cor
    WHERE cor.tenant_id = p_tenant_id 
    AND cor.status = 'pending'
    ORDER BY cor.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE cache_layers IS 'Configuration for different cache layers (CDN, application, database, etc.)';
COMMENT ON TABLE cache_warming_strategies IS 'Strategies for proactively populating cache layers';
COMMENT ON TABLE cache_invalidation_rules IS 'Rules for cache eviction and invalidation across layers';
COMMENT ON TABLE cache_key_mappings IS 'Cross-layer key relationships for coordinated cache management';
COMMENT ON TABLE cache_warming_jobs IS 'Scheduled and executed cache warming tasks';
COMMENT ON TABLE cache_performance_metrics IS 'Performance metrics and analytics for cache optimization';
COMMENT ON TABLE cache_optimization_recommendations IS 'AI-generated recommendations for cache optimization';

COMMENT ON VIEW cache_performance_summary IS 'Aggregated cache performance metrics by layer and time period';
COMMENT ON VIEW cache_warming_job_status IS 'Summary of cache warming job execution status and performance';

COMMENT ON FUNCTION cascade_cache_invalidation IS 'Cascades cache invalidation across multiple layers for a given key';
COMMENT ON FUNCTION generate_cache_warming_recommendations IS 'Generates AI-powered recommendations for cache optimization';
```