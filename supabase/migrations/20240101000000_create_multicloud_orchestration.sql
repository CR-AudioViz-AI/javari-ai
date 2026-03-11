```sql
-- Multi-Cloud Resource Orchestration Service Migration
-- Creates database schema for dynamic workload allocation across cloud providers

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cloud_provider_type') THEN
        CREATE TYPE cloud_provider_type AS ENUM ('aws', 'azure', 'gcp', 'kubernetes', 'on_premise');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workload_status') THEN
        CREATE TYPE workload_status AS ENUM ('pending', 'provisioning', 'running', 'scaling', 'migrating', 'failed', 'terminated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_type') THEN
        CREATE TYPE resource_type AS ENUM ('compute', 'storage', 'database', 'network', 'container', 'serverless');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'migration_status') THEN
        CREATE TYPE migration_status AS ENUM ('planned', 'in_progress', 'completed', 'failed', 'rolled_back');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level') THEN
        CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_status') THEN
        CREATE TYPE health_status AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');
    END IF;
END $$;

-- Cloud Providers table
CREATE TABLE IF NOT EXISTS cloud_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    provider_type cloud_provider_type NOT NULL,
    region VARCHAR(50) NOT NULL,
    endpoint_url TEXT,
    credentials_encrypted TEXT NOT NULL, -- Encrypted JSON with API keys/tokens
    capabilities JSONB NOT NULL DEFAULT '{}', -- Available services, instance types, etc.
    cost_multiplier DECIMAL(5,3) DEFAULT 1.0, -- Cost adjustment factor
    performance_baseline JSONB DEFAULT '{}', -- Baseline performance metrics
    is_active BOOLEAN DEFAULT true,
    health_status health_status DEFAULT 'unknown',
    last_health_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_provider_region UNIQUE (provider_type, region)
);

-- Availability Zones table
CREATE TABLE IF NOT EXISTS availability_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES cloud_providers(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    zone_id VARCHAR(50) NOT NULL,
    health_status health_status DEFAULT 'unknown',
    capacity_utilization DECIMAL(5,2) DEFAULT 0.0, -- Percentage 0-100
    current_workloads INTEGER DEFAULT 0,
    max_workloads INTEGER DEFAULT 100,
    cost_factor DECIMAL(5,3) DEFAULT 1.0,
    latency_ms INTEGER DEFAULT 0, -- Average latency
    last_health_check TIMESTAMPTZ,
    maintenance_window JSONB, -- Scheduled maintenance windows
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_provider_zone UNIQUE (provider_id, zone_id)
);

-- Workload Templates table
CREATE TABLE IF NOT EXISTS workload_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    resource_type resource_type NOT NULL,
    template_config JSONB NOT NULL, -- Container specs, VM requirements, etc.
    resource_requirements JSONB NOT NULL, -- CPU, RAM, storage, network
    environment_variables JSONB DEFAULT '{}',
    health_check_config JSONB DEFAULT '{}',
    scaling_config JSONB DEFAULT '{}', -- Auto-scaling parameters
    is_active BOOLEAN DEFAULT true,
    created_by UUID, -- User/system that created template
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orchestration Policies table
CREATE TABLE IF NOT EXISTS orchestration_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    priority priority_level DEFAULT 'medium',
    conditions JSONB NOT NULL, -- Rules for when policy applies
    allocation_strategy JSONB NOT NULL, -- How to allocate resources
    cost_constraints JSONB DEFAULT '{}', -- Max cost per hour/month
    performance_requirements JSONB DEFAULT '{}', -- Min latency, throughput
    availability_requirements JSONB DEFAULT '{}', -- Uptime, redundancy
    preferred_providers JSONB DEFAULT '[]', -- Ordered list of preferred providers
    excluded_providers JSONB DEFAULT '[]', -- Providers to avoid
    failover_config JSONB DEFAULT '{}', -- Failover behavior
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workload Definitions table
CREATE TABLE IF NOT EXISTS workload_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_id UUID REFERENCES workload_templates(id),
    policy_id UUID REFERENCES orchestration_policies(id),
    owner_id UUID NOT NULL, -- User/team responsible
    resource_requirements JSONB NOT NULL,
    environment_config JSONB DEFAULT '{}',
    dependencies JSONB DEFAULT '[]', -- Other workloads this depends on
    tags JSONB DEFAULT '{}',
    desired_state workload_status DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource Allocations table
CREATE TABLE IF NOT EXISTS resource_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workload_id UUID NOT NULL REFERENCES workload_definitions(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES cloud_providers(id),
    zone_id UUID REFERENCES availability_zones(id),
    allocation_id VARCHAR(200), -- Cloud provider's resource ID
    resource_type resource_type NOT NULL,
    status workload_status DEFAULT 'pending',
    configuration JSONB NOT NULL, -- Actual deployed configuration
    endpoint_url TEXT, -- Access URL for the resource
    internal_ip INET,
    external_ip INET,
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    last_health_check TIMESTAMPTZ,
    health_status health_status DEFAULT 'unknown',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_workload_provider UNIQUE (workload_id, provider_id, allocation_id)
);

-- Cost Metrics table
CREATE TABLE IF NOT EXISTS cost_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    allocation_id UUID REFERENCES resource_allocations(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES cloud_providers(id),
    workload_id UUID NOT NULL REFERENCES workload_definitions(id),
    cost_per_hour DECIMAL(10,4) NOT NULL,
    actual_cost DECIMAL(10,4) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_period DATERANGE,
    resource_usage JSONB DEFAULT '{}', -- CPU hours, GB-hours, requests, etc.
    cost_breakdown JSONB DEFAULT '{}', -- Detailed cost components
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT cost_metrics_period_check CHECK (billing_period IS NOT NULL)
);

-- Performance Metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    allocation_id UUID REFERENCES resource_allocations(id) ON DELETE CASCADE,
    workload_id UUID NOT NULL REFERENCES workload_definitions(id),
    metric_type VARCHAR(50) NOT NULL, -- 'latency', 'throughput', 'cpu', 'memory', etc.
    value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'ms', 'requests/sec', 'percent', 'MB', etc.
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration Jobs table
CREATE TABLE IF NOT EXISTS migration_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workload_id UUID NOT NULL REFERENCES workload_definitions(id),
    source_allocation_id UUID REFERENCES resource_allocations(id),
    target_provider_id UUID NOT NULL REFERENCES cloud_providers(id),
    target_zone_id UUID REFERENCES availability_zones(id),
    migration_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'auto_failover', 'cost_optimization', 'performance'
    trigger_reason TEXT,
    status migration_status DEFAULT 'planned',
    migration_config JSONB DEFAULT '{}',
    rollback_config JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_duration INTERVAL,
    actual_duration INTERVAL,
    downtime_duration INTERVAL,
    error_message TEXT,
    rollback_reason TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Failover Events table
CREATE TABLE IF NOT EXISTS failover_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workload_id UUID NOT NULL REFERENCES workload_definitions(id),
    failed_allocation_id UUID REFERENCES resource_allocations(id),
    failover_allocation_id UUID REFERENCES resource_allocations(id),
    trigger_type VARCHAR(50) NOT NULL, -- 'health_check', 'performance', 'cost', 'manual'
    trigger_details JSONB DEFAULT '{}',
    detection_time TIMESTAMPTZ NOT NULL,
    failover_started_at TIMESTAMPTZ,
    failover_completed_at TIMESTAMPTZ,
    recovery_time INTERVAL, -- Time to detect + failover
    impact_assessment JSONB DEFAULT '{}', -- Users affected, data loss, etc.
    root_cause TEXT,
    resolution_steps JSONB DEFAULT '[]',
    lessons_learned TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cloud_providers_type_region ON cloud_providers(provider_type, region);
CREATE INDEX IF NOT EXISTS idx_cloud_providers_health ON cloud_providers(health_status, is_active);

CREATE INDEX IF NOT EXISTS idx_availability_zones_provider ON availability_zones(provider_id);
CREATE INDEX IF NOT EXISTS idx_availability_zones_health ON availability_zones(health_status);
CREATE INDEX IF NOT EXISTS idx_availability_zones_capacity ON availability_zones(capacity_utilization) WHERE capacity_utilization < 80;

CREATE INDEX IF NOT EXISTS idx_workload_definitions_owner ON workload_definitions(owner_id);
CREATE INDEX IF NOT EXISTS idx_workload_definitions_policy ON workload_definitions(policy_id);
CREATE INDEX IF NOT EXISTS idx_workload_definitions_template ON workload_definitions(template_id);
CREATE INDEX IF NOT EXISTS idx_workload_definitions_tags ON workload_definitions USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_resource_allocations_workload ON resource_allocations(workload_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_provider ON resource_allocations(provider_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_status ON resource_allocations(status);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_health ON resource_allocations(health_status);

CREATE INDEX IF NOT EXISTS idx_cost_metrics_allocation ON cost_metrics(allocation_id);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_workload_period ON cost_metrics(workload_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_recorded_at ON cost_metrics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_allocation ON performance_metrics(allocation_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_workload_type ON performance_metrics(workload_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_workload ON migration_jobs(workload_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_created_at ON migration_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_failover_events_workload ON failover_events(workload_id);
CREATE INDEX IF NOT EXISTS idx_failover_events_detection_time ON failover_events(detection_time);
CREATE INDEX IF NOT EXISTS idx_failover_events_trigger_type ON failover_events(trigger_type);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_cloud_providers_updated_at ON cloud_providers;
CREATE TRIGGER update_cloud_providers_updated_at
    BEFORE UPDATE ON cloud_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_zones_updated_at ON availability_zones;
CREATE TRIGGER update_availability_zones_updated_at
    BEFORE UPDATE ON availability_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workload_templates_updated_at ON workload_templates;
CREATE TRIGGER update_workload_templates_updated_at
    BEFORE UPDATE ON workload_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orchestration_policies_updated_at ON orchestration_policies;
CREATE TRIGGER update_orchestration_policies_updated_at
    BEFORE UPDATE ON orchestration_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workload_definitions_updated_at ON workload_definitions;
CREATE TRIGGER update_workload_definitions_updated_at
    BEFORE UPDATE ON workload_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_resource_allocations_updated_at ON resource_allocations;
CREATE TRIGGER update_resource_allocations_updated_at
    BEFORE UPDATE ON resource_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_migration_jobs_updated_at ON migration_jobs;
CREATE TRIGGER update_migration_jobs_updated_at
    BEFORE UPDATE ON migration_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_failover_events_updated_at ON failover_events;
CREATE TRIGGER update_failover_events_updated_at
    BEFORE UPDATE ON failover_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE cloud_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestration_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE failover_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic policies - should be customized based on requirements)
CREATE POLICY "Users can view their workloads" ON workload_definitions
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their workloads" ON workload_definitions
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their workloads" ON workload_definitions
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their workloads" ON workload_definitions
    FOR DELETE USING (auth.uid() = owner_id);

-- Similar policies for related tables
CREATE POLICY "Users can view their allocations" ON resource_allocations
    FOR SELECT USING (
        workload_id IN (
            SELECT id FROM workload_definitions WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their cost metrics" ON cost_metrics
    FOR SELECT USING (
        workload_id IN (
            SELECT id FROM workload_definitions WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their performance metrics" ON performance_metrics
    FOR SELECT USING (
        workload_id IN (
            SELECT id FROM workload_definitions WHERE owner_id = auth.uid()
        )
    );

-- Admin policies for cloud providers and system tables
CREATE POLICY "Service role can manage providers" ON cloud_providers
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage zones" ON availability_zones
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create materialized view for workload analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS workload_analytics AS
SELECT 
    wd.id as workload_id,
    wd.name as workload_name,
    wd.owner_id,
    COUNT(ra.id) as allocation_count,
    AVG(cm.cost_per_hour) as avg_cost_per_hour,
    SUM(cm.actual_cost) as total_cost,
    AVG(CASE WHEN pm.metric_type = 'latency' THEN pm.value END) as avg_latency_ms,
    COUNT(fe.id) as failover_count,
    MAX(ra.updated_at) as last_allocation_update
FROM workload_definitions wd
LEFT JOIN resource_allocations ra ON wd.id = ra.workload_id
LEFT JOIN cost_metrics cm ON wd.id = cm.workload_id
LEFT JOIN performance_metrics pm ON wd.id = pm.workload_id 
LEFT JOIN failover_events fe ON wd.id = fe.workload_id
WHERE wd.is_active = true
GROUP BY wd.id, wd.name, wd.owner_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_workload_analytics_workload_id ON workload_analytics(workload_id);
CREATE INDEX IF NOT EXISTS idx_workload_analytics_owner ON workload_analytics(owner_id);

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_workload_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW workload_analytics;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE cloud_providers IS 'Stores configuration and credentials for different cloud providers';
COMMENT ON TABLE workload_definitions IS 'Defines workloads to be deployed across cloud providers';
COMMENT ON TABLE resource_allocations IS 'Tracks active resource deployments and their status';
COMMENT ON TABLE cost_metrics IS 'Records real-time cost data for allocated resources';
COMMENT ON TABLE performance_metrics IS 'Stores performance metrics from deployed workloads';
COMMENT ON TABLE migration_jobs IS 'Tracks workload migration operations between providers';
COMMENT ON TABLE failover_events IS 'Records failover incidents and recovery actions';
COMMENT ON MATERIALIZED VIEW workload_analytics IS 'Aggregated analytics for workload performance and costs';
```