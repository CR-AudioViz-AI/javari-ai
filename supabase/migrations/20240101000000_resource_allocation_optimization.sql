```sql
-- Resource Allocation Optimization Service Migration
-- Version: 20240101000000
-- Description: ML-powered resource allocation optimization with traffic prediction and cost optimization

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- Create enum types
CREATE TYPE resource_type AS ENUM (
    'server',
    'database',
    'cdn',
    'storage',
    'cache',
    'load_balancer'
);

CREATE TYPE scaling_action AS ENUM (
    'scale_up',
    'scale_down',
    'maintain',
    'optimize'
);

CREATE TYPE prediction_model_type AS ENUM (
    'linear_regression',
    'neural_network',
    'time_series',
    'ensemble',
    'custom'
);

CREATE TYPE optimization_objective AS ENUM (
    'cost',
    'performance',
    'availability',
    'balanced'
);

-- Resource allocation configurations table
CREATE TABLE IF NOT EXISTS resource_allocation_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type resource_type NOT NULL,
    config_data JSONB NOT NULL DEFAULT '{}',
    min_capacity INTEGER NOT NULL DEFAULT 1,
    max_capacity INTEGER NOT NULL DEFAULT 100,
    target_utilization DECIMAL(5,2) DEFAULT 70.00,
    scaling_cooldown_minutes INTEGER DEFAULT 10,
    cost_budget_daily DECIMAL(10,2),
    optimization_objective optimization_objective DEFAULT 'balanced',
    is_active BOOLEAN DEFAULT true,
    auto_scaling_enabled BOOLEAN DEFAULT true,
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT valid_capacity_range CHECK (min_capacity <= max_capacity),
    CONSTRAINT valid_utilization CHECK (target_utilization > 0 AND target_utilization <= 100),
    CONSTRAINT valid_config_data CHECK (jsonb_typeof(config_data) = 'object')
);

-- Traffic prediction models table
CREATE TABLE IF NOT EXISTS traffic_prediction_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    model_type prediction_model_type NOT NULL,
    resource_type resource_type NOT NULL,
    model_data JSONB NOT NULL DEFAULT '{}',
    training_data_source JSONB DEFAULT '{}',
    accuracy_metrics JSONB DEFAULT '{}',
    prediction_horizon_hours INTEGER DEFAULT 24,
    retraining_frequency_hours INTEGER DEFAULT 168,
    last_trained_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_horizon CHECK (prediction_horizon_hours > 0 AND prediction_horizon_hours <= 168),
    CONSTRAINT valid_retraining CHECK (retraining_frequency_hours >= 1)
);

-- Resource metrics table (time-series data)
CREATE TABLE IF NOT EXISTS resource_metrics (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    resource_type resource_type NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    unit VARCHAR(20),
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, resource_id, metric_name, timestamp)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('resource_metrics', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Scaling events table
CREATE TABLE IF NOT EXISTS scaling_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    config_id UUID NOT NULL REFERENCES resource_allocation_configs(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL,
    scaling_action scaling_action NOT NULL,
    previous_capacity INTEGER,
    new_capacity INTEGER,
    trigger_reason TEXT,
    predicted_demand DECIMAL(10,2),
    cost_impact DECIMAL(10,2),
    execution_status VARCHAR(50) DEFAULT 'pending',
    execution_details JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID,
    
    CONSTRAINT valid_capacity_change CHECK (
        (scaling_action = 'scale_up' AND new_capacity > previous_capacity) OR
        (scaling_action = 'scale_down' AND new_capacity < previous_capacity) OR
        (scaling_action IN ('maintain', 'optimize'))
    )
);

-- Cost optimization rules table
CREATE TABLE IF NOT EXISTS cost_optimization_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type resource_type,
    conditions JSONB NOT NULL DEFAULT '{}',
    actions JSONB NOT NULL DEFAULT '{}',
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    max_executions_per_day INTEGER DEFAULT 10,
    execution_count INTEGER DEFAULT 0,
    last_execution_at TIMESTAMPTZ,
    effectiveness_score DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_priority CHECK (priority >= 1 AND priority <= 1000),
    CONSTRAINT valid_conditions CHECK (jsonb_typeof(conditions) = 'object'),
    CONSTRAINT valid_actions CHECK (jsonb_typeof(actions) = 'object')
);

-- Allocation recommendations table
CREATE TABLE IF NOT EXISTS allocation_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    config_id UUID NOT NULL REFERENCES resource_allocation_configs(id) ON DELETE CASCADE,
    model_id UUID REFERENCES traffic_prediction_models(id),
    resource_id UUID NOT NULL,
    recommendation_type scaling_action NOT NULL,
    current_allocation JSONB DEFAULT '{}',
    recommended_allocation JSONB DEFAULT '{}',
    predicted_metrics JSONB DEFAULT '{}',
    confidence_score DECIMAL(5,2),
    cost_savings_estimate DECIMAL(10,2),
    performance_impact JSONB DEFAULT '{}',
    implementation_priority INTEGER DEFAULT 100,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending',
    applied_at TIMESTAMPTZ,
    feedback_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 100),
    CONSTRAINT valid_validity_period CHECK (valid_until > valid_from),
    CONSTRAINT valid_feedback CHECK (feedback_score IS NULL OR (feedback_score >= 1 AND feedback_score <= 5))
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_resource_allocation_configs_tenant_type 
    ON resource_allocation_configs(tenant_id, resource_type) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_resource_allocation_configs_updated 
    ON resource_allocation_configs(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_traffic_prediction_models_tenant_active 
    ON traffic_prediction_models(tenant_id, resource_type) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_resource_metrics_tenant_resource_time 
    ON resource_metrics(tenant_id, resource_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_resource_metrics_metric_name_time 
    ON resource_metrics(metric_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_events_tenant_time 
    ON scaling_events(tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scaling_events_config_status 
    ON scaling_events(config_id, execution_status);

CREATE INDEX IF NOT EXISTS idx_cost_optimization_rules_tenant_active 
    ON cost_optimization_rules(tenant_id, priority DESC) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_allocation_recommendations_tenant_status 
    ON allocation_recommendations(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_allocation_recommendations_config_validity 
    ON allocation_recommendations(config_id, valid_from, valid_until) 
    WHERE status = 'pending';

-- Create materialized views for aggregated statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS resource_utilization_summary AS
SELECT 
    tenant_id,
    resource_type,
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(metric_value) as avg_utilization,
    MAX(metric_value) as max_utilization,
    MIN(metric_value) as min_utilization,
    STDDEV(metric_value) as utilization_variance,
    COUNT(*) as metric_count
FROM resource_metrics 
WHERE metric_name = 'utilization_percentage'
    AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY tenant_id, resource_type, DATE_TRUNC('hour', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_utilization_summary_unique
    ON resource_utilization_summary(tenant_id, resource_type, hour);

CREATE MATERIALIZED VIEW IF NOT EXISTS cost_optimization_effectiveness AS
SELECT 
    tenant_id,
    resource_type,
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as total_recommendations,
    COUNT(*) FILTER (WHERE status = 'applied') as applied_recommendations,
    AVG(confidence_score) as avg_confidence,
    SUM(cost_savings_estimate) FILTER (WHERE status = 'applied') as total_savings,
    AVG(feedback_score) FILTER (WHERE feedback_score IS NOT NULL) as avg_feedback
FROM allocation_recommendations
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, resource_type, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_optimization_effectiveness_unique
    ON cost_optimization_effectiveness(tenant_id, resource_type, day);

-- RLS Policies
ALTER TABLE resource_allocation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_prediction_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scaling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_optimization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_recommendations ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY resource_allocation_configs_tenant_policy ON resource_allocation_configs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY traffic_prediction_models_tenant_policy ON traffic_prediction_models
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY resource_metrics_tenant_policy ON resource_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY scaling_events_tenant_policy ON scaling_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cost_optimization_rules_tenant_policy ON cost_optimization_rules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY allocation_recommendations_tenant_policy ON allocation_recommendations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Functions for complex allocation logic
CREATE OR REPLACE FUNCTION calculate_optimal_allocation(
    p_tenant_id UUID,
    p_resource_type resource_type,
    p_prediction_horizon_hours INTEGER DEFAULT 24
) RETURNS TABLE (
    resource_id UUID,
    current_capacity INTEGER,
    recommended_capacity INTEGER,
    confidence_score DECIMAL,
    cost_impact DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Complex allocation calculation logic would go here
    -- This is a simplified version for demonstration
    RETURN QUERY
    WITH resource_stats AS (
        SELECT 
            rm.resource_id,
            AVG(rm.metric_value) as avg_utilization,
            MAX(rm.metric_value) as peak_utilization
        FROM resource_metrics rm
        WHERE rm.tenant_id = p_tenant_id
            AND rm.resource_type = p_resource_type
            AND rm.metric_name = 'utilization_percentage'
            AND rm.timestamp >= NOW() - (p_prediction_horizon_hours || ' hours')::INTERVAL
        GROUP BY rm.resource_id
    ),
    config_data AS (
        SELECT 
            rac.id,
            rac.min_capacity,
            rac.max_capacity,
            rac.target_utilization
        FROM resource_allocation_configs rac
        WHERE rac.tenant_id = p_tenant_id
            AND rac.resource_type = p_resource_type
            AND rac.is_active = true
    )
    SELECT 
        rs.resource_id,
        cd.min_capacity as current_capacity,
        GREATEST(
            cd.min_capacity,
            LEAST(
                cd.max_capacity,
                CEIL(rs.peak_utilization / cd.target_utilization * cd.min_capacity)
            )
        )::INTEGER as recommended_capacity,
        CASE 
            WHEN rs.avg_utilization > 0 THEN LEAST(95.0, rs.avg_utilization * 1.2)
            ELSE 50.0
        END as confidence_score,
        0.0 as cost_impact
    FROM resource_stats rs
    CROSS JOIN config_data cd;
END;
$$;

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_resource_allocation_configs_updated_at
    BEFORE UPDATE ON resource_allocation_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_traffic_prediction_models_updated_at
    BEFORE UPDATE ON traffic_prediction_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cost_optimization_rules_updated_at
    BEFORE UPDATE ON cost_optimization_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_resource_optimization_views()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY resource_utilization_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY cost_optimization_effectiveness;
END;
$$;

-- Stored procedure for automated scaling execution
CREATE OR REPLACE FUNCTION execute_scaling_recommendation(
    p_recommendation_id UUID,
    p_executed_by UUID DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_recommendation allocation_recommendations;
    v_scaling_event_id UUID;
BEGIN
    -- Get recommendation details
    SELECT * INTO v_recommendation 
    FROM allocation_recommendations 
    WHERE id = p_recommendation_id 
        AND status = 'pending'
        AND valid_from <= NOW() 
        AND (valid_until IS NULL OR valid_until > NOW());
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Create scaling event
    INSERT INTO scaling_events (
        tenant_id,
        config_id,
        resource_id,
        scaling_action,
        previous_capacity,
        new_capacity,
        trigger_reason,
        predicted_demand,
        cost_impact,
        created_by
    ) VALUES (
        v_recommendation.tenant_id,
        v_recommendation.config_id,
        v_recommendation.resource_id,
        v_recommendation.recommendation_type,
        (v_recommendation.current_allocation->>'capacity')::INTEGER,
        (v_recommendation.recommended_allocation->>'capacity')::INTEGER,
        'Automated recommendation execution',
        (v_recommendation.predicted_metrics->>'demand')::DECIMAL,
        v_recommendation.cost_savings_estimate,
        p_executed_by
    ) RETURNING id INTO v_scaling_event_id;
    
    -- Update recommendation status
    UPDATE allocation_recommendations 
    SET 
        status = 'applied',
        applied_at = NOW()
    WHERE id = p_recommendation_id;
    
    RETURN TRUE;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE resource_allocation_configs IS 'Configuration settings for automated resource allocation and scaling';
COMMENT ON TABLE traffic_prediction_models IS 'ML models used for traffic prediction and capacity planning';
COMMENT ON TABLE resource_metrics IS 'Time-series metrics data for resources (utilization, performance, etc.)';
COMMENT ON TABLE scaling_events IS 'Historical record of all scaling actions taken';
COMMENT ON TABLE cost_optimization_rules IS 'Business rules for cost optimization and resource efficiency';
COMMENT ON TABLE allocation_recommendations IS 'ML-generated recommendations for resource allocation changes';

-- Grant permissions for service usage
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
```