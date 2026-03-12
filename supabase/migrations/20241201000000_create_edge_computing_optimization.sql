```sql
-- Edge Computing Optimization Service Migration
-- File: supabase/migrations/20241201000000_create_edge_computing_optimization.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE edge_node_status AS ENUM ('active', 'maintenance', 'overloaded', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workload_status AS ENUM ('pending', 'deploying', 'running', 'migrating', 'stopped', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE migration_status AS ENUM ('initiated', 'in_progress', 'completed', 'failed', 'rolled_back');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE capability_type AS ENUM ('gpu', 'tpu', 'cpu_intensive', 'memory_intensive', 'storage_intensive', 'network_intensive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Edge nodes table with geographical and capability data
CREATE TABLE IF NOT EXISTS edge_nodes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name varchar(255) NOT NULL,
    region varchar(100) NOT NULL,
    zone varchar(100) NOT NULL,
    location geometry(POINT, 4326) NOT NULL,
    ip_address inet NOT NULL,
    port integer DEFAULT 8080,
    status edge_node_status DEFAULT 'active',
    max_workloads integer DEFAULT 10,
    current_workloads integer DEFAULT 0,
    cpu_cores integer NOT NULL,
    memory_gb integer NOT NULL,
    storage_gb integer NOT NULL,
    network_bandwidth_mbps integer NOT NULL,
    gpu_count integer DEFAULT 0,
    gpu_model varchar(100),
    tpu_count integer DEFAULT 0,
    tpu_model varchar(100),
    cost_per_hour decimal(10,4) NOT NULL,
    availability_zone varchar(50),
    provider varchar(50) NOT NULL,
    metadata jsonb DEFAULT '{}',
    health_check_url varchar(500),
    last_health_check timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    
    CONSTRAINT edge_nodes_max_workloads_positive CHECK (max_workloads > 0),
    CONSTRAINT edge_nodes_current_workloads_valid CHECK (current_workloads >= 0 AND current_workloads <= max_workloads),
    CONSTRAINT edge_nodes_cpu_cores_positive CHECK (cpu_cores > 0),
    CONSTRAINT edge_nodes_memory_positive CHECK (memory_gb > 0),
    CONSTRAINT edge_nodes_cost_positive CHECK (cost_per_hour > 0)
);

-- Node capabilities table for regional AI service availability
CREATE TABLE IF NOT EXISTS node_capabilities (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    node_id uuid NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
    capability_type capability_type NOT NULL,
    specification jsonb NOT NULL DEFAULT '{}',
    performance_score decimal(5,2) DEFAULT 1.0,
    is_available boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(node_id, capability_type),
    CONSTRAINT node_capabilities_performance_score_valid CHECK (performance_score >= 0 AND performance_score <= 10)
);

-- Placement policies table for optimization rules
CREATE TABLE IF NOT EXISTS placement_policies (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    name varchar(255) NOT NULL,
    description text,
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    policy_rules jsonb NOT NULL DEFAULT '{}',
    latency_threshold_ms integer DEFAULT 100,
    cost_weight decimal(3,2) DEFAULT 0.3,
    performance_weight decimal(3,2) DEFAULT 0.4,
    availability_weight decimal(3,2) DEFAULT 0.3,
    preferred_regions text[] DEFAULT '{}',
    excluded_regions text[] DEFAULT '{}',
    required_capabilities capability_type[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    
    CONSTRAINT placement_policies_weights_sum CHECK (
        cost_weight + performance_weight + availability_weight = 1.0
    ),
    CONSTRAINT placement_policies_weights_positive CHECK (
        cost_weight >= 0 AND performance_weight >= 0 AND availability_weight >= 0
    )
);

-- Workload placements table for AI workload assignments
CREATE TABLE IF NOT EXISTS workload_placements (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    workload_id varchar(255) NOT NULL,
    workload_name varchar(255),
    workload_type varchar(100) NOT NULL,
    node_id uuid NOT NULL REFERENCES edge_nodes(id),
    policy_id uuid REFERENCES placement_policies(id),
    status workload_status DEFAULT 'pending',
    user_location geometry(POINT, 4326),
    latency_requirement_ms integer DEFAULT 100,
    cpu_requirement decimal(5,2) DEFAULT 1.0,
    memory_requirement_gb integer DEFAULT 1,
    storage_requirement_gb integer DEFAULT 10,
    network_requirement_mbps integer DEFAULT 10,
    required_capabilities capability_type[] DEFAULT '{}',
    placement_score decimal(5,2),
    placement_reason text,
    estimated_cost_per_hour decimal(10,4),
    actual_cost_per_hour decimal(10,4),
    deployed_at timestamptz,
    terminated_at timestamptz,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    
    CONSTRAINT workload_placements_unique_active UNIQUE (tenant_id, workload_id),
    CONSTRAINT workload_placements_requirements_positive CHECK (
        cpu_requirement > 0 AND memory_requirement_gb > 0 AND 
        storage_requirement_gb >= 0 AND network_requirement_mbps >= 0
    )
);

-- Migration events table for dynamic workload transfers
CREATE TABLE IF NOT EXISTS migration_events (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    workload_placement_id uuid NOT NULL REFERENCES workload_placements(id),
    source_node_id uuid NOT NULL REFERENCES edge_nodes(id),
    target_node_id uuid NOT NULL REFERENCES edge_nodes(id),
    migration_reason varchar(255) NOT NULL,
    status migration_status DEFAULT 'initiated',
    initiated_at timestamptz DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    error_message text,
    data_transfer_gb decimal(10,2),
    downtime_seconds integer,
    cost decimal(10,4) DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    
    CONSTRAINT migration_events_nodes_different CHECK (source_node_id != target_node_id)
);

-- Latency metrics table for performance monitoring
CREATE TABLE IF NOT EXISTS latency_metrics (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    workload_placement_id uuid NOT NULL REFERENCES workload_placements(id),
    node_id uuid NOT NULL REFERENCES edge_nodes(id),
    user_location geometry(POINT, 4326),
    measured_latency_ms integer NOT NULL,
    network_latency_ms integer,
    processing_latency_ms integer,
    response_size_bytes integer,
    timestamp timestamptz DEFAULT now(),
    measurement_type varchar(50) DEFAULT 'ping',
    metadata jsonb DEFAULT '{}',
    
    CONSTRAINT latency_metrics_latency_positive CHECK (measured_latency_ms >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_edge_nodes_location ON edge_nodes USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_edge_nodes_region_zone ON edge_nodes (region, zone);
CREATE INDEX IF NOT EXISTS idx_edge_nodes_status ON edge_nodes (status);
CREATE INDEX IF NOT EXISTS idx_edge_nodes_capabilities ON edge_nodes (gpu_count, tpu_count) WHERE gpu_count > 0 OR tpu_count > 0;

CREATE INDEX IF NOT EXISTS idx_node_capabilities_node_type ON node_capabilities (node_id, capability_type);
CREATE INDEX IF NOT EXISTS idx_node_capabilities_available ON node_capabilities (capability_type, is_available);

CREATE INDEX IF NOT EXISTS idx_placement_policies_tenant ON placement_policies (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_placement_policies_priority ON placement_policies (priority DESC);

CREATE INDEX IF NOT EXISTS idx_workload_placements_tenant ON workload_placements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workload_placements_node ON workload_placements (node_id);
CREATE INDEX IF NOT EXISTS idx_workload_placements_status ON workload_placements (status);
CREATE INDEX IF NOT EXISTS idx_workload_placements_location ON workload_placements USING GIST (user_location);
CREATE INDEX IF NOT EXISTS idx_workload_placements_created_at ON workload_placements (created_at);

CREATE INDEX IF NOT EXISTS idx_migration_events_tenant ON migration_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_events_workload ON migration_events (workload_placement_id);
CREATE INDEX IF NOT EXISTS idx_migration_events_status ON migration_events (status);
CREATE INDEX IF NOT EXISTS idx_migration_events_created_at ON migration_events (created_at);

CREATE INDEX IF NOT EXISTS idx_latency_metrics_tenant ON latency_metrics (tenant_id);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_workload ON latency_metrics (workload_placement_id);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_timestamp ON latency_metrics (timestamp);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_location ON latency_metrics USING GIST (user_location);

-- Create database functions for automated placement scoring
CREATE OR REPLACE FUNCTION calculate_placement_score(
    p_node_id uuid,
    p_user_location geometry DEFAULT NULL,
    p_latency_requirement_ms integer DEFAULT 100,
    p_required_capabilities capability_type[] DEFAULT '{}',
    p_cpu_requirement decimal DEFAULT 1.0,
    p_memory_requirement_gb integer DEFAULT 1,
    p_cost_weight decimal DEFAULT 0.3,
    p_performance_weight decimal DEFAULT 0.4,
    p_availability_weight decimal DEFAULT 0.3
) RETURNS decimal AS $$
DECLARE
    node_rec edge_nodes%ROWTYPE;
    distance_km decimal;
    estimated_latency_ms decimal;
    cost_score decimal := 0;
    performance_score decimal := 0;
    availability_score decimal := 0;
    capability_score decimal := 1;
    final_score decimal;
    cap capability_type;
BEGIN
    -- Get node details
    SELECT * INTO node_rec FROM edge_nodes WHERE id = p_node_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Check if node is available
    IF node_rec.status != 'active' OR node_rec.current_workloads >= node_rec.max_workloads THEN
        RETURN 0;
    END IF;
    
    -- Check resource requirements
    IF node_rec.cpu_cores < p_cpu_requirement OR node_rec.memory_gb < p_memory_requirement_gb THEN
        RETURN 0;
    END IF;
    
    -- Calculate distance and estimated latency if user location provided
    IF p_user_location IS NOT NULL THEN
        distance_km := ST_Distance(ST_Transform(node_rec.location, 3857), ST_Transform(p_user_location, 3857)) / 1000;
        estimated_latency_ms := distance_km * 0.05; -- Rough estimate: 0.05ms per km
        
        IF estimated_latency_ms > p_latency_requirement_ms THEN
            RETURN 0;
        END IF;
        
        performance_score := GREATEST(0, 1 - (estimated_latency_ms / p_latency_requirement_ms));
    ELSE
        performance_score := 0.5; -- Default score when location not available
    END IF;
    
    -- Calculate cost score (lower cost = higher score)
    cost_score := 1.0 / (1.0 + node_rec.cost_per_hour);
    
    -- Calculate availability score
    availability_score := 1.0 - (node_rec.current_workloads::decimal / node_rec.max_workloads::decimal);
    
    -- Check required capabilities
    IF array_length(p_required_capabilities, 1) > 0 THEN
        FOREACH cap IN ARRAY p_required_capabilities LOOP
            IF NOT EXISTS (
                SELECT 1 FROM node_capabilities 
                WHERE node_id = p_node_id 
                AND capability_type = cap 
                AND is_available = true
            ) THEN
                RETURN 0; -- Missing required capability
            END IF;
        END LOOP;
    END IF;
    
    -- Calculate final weighted score
    final_score := (cost_score * p_cost_weight) + 
                   (performance_score * p_performance_weight) + 
                   (availability_score * p_availability_weight);
    
    RETURN GREATEST(0, LEAST(10, final_score * 10));
END;
$$ LANGUAGE plpgsql;

-- Function to find optimal node placement
CREATE OR REPLACE FUNCTION find_optimal_placement(
    p_tenant_id uuid,
    p_user_location geometry DEFAULT NULL,
    p_latency_requirement_ms integer DEFAULT 100,
    p_required_capabilities capability_type[] DEFAULT '{}',
    p_cpu_requirement decimal DEFAULT 1.0,
    p_memory_requirement_gb integer DEFAULT 1,
    p_preferred_regions text[] DEFAULT '{}',
    p_excluded_regions text[] DEFAULT '{}'
) RETURNS TABLE (
    node_id uuid,
    placement_score decimal,
    estimated_latency_ms decimal,
    cost_per_hour decimal
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        en.id,
        calculate_placement_score(
            en.id,
            p_user_location,
            p_latency_requirement_ms,
            p_required_capabilities,
            p_cpu_requirement,
            p_memory_requirement_gb
        ) as score,
        CASE 
            WHEN p_user_location IS NOT NULL THEN
                (ST_Distance(ST_Transform(en.location, 3857), ST_Transform(p_user_location, 3857)) / 1000) * 0.05
            ELSE NULL 
        END as latency,
        en.cost_per_hour
    FROM edge_nodes en
    WHERE en.status = 'active'
        AND en.current_workloads < en.max_workloads
        AND en.cpu_cores >= p_cpu_requirement
        AND en.memory_gb >= p_memory_requirement_gb
        AND (array_length(p_preferred_regions, 1) IS NULL OR en.region = ANY(p_preferred_regions))
        AND (array_length(p_excluded_regions, 1) IS NULL OR NOT (en.region = ANY(p_excluded_regions)))
    ORDER BY score DESC, cost_per_hour ASC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_edge_nodes_updated_at BEFORE UPDATE ON edge_nodes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_capabilities_updated_at BEFORE UPDATE ON node_capabilities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_placement_policies_updated_at BEFORE UPDATE ON placement_policies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workload_placements_updated_at BEFORE UPDATE ON workload_placements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_migration_events_updated_at BEFORE UPDATE ON migration_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update node workload count
CREATE OR REPLACE FUNCTION update_node_workload_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE edge_nodes 
        SET current_workloads = current_workloads + 1 
        WHERE id = NEW.node_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE edge_nodes 
        SET current_workloads = GREATEST(0, current_workloads - 1) 
        WHERE id = OLD.node_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.node_id != NEW.node_id THEN
            UPDATE edge_nodes 
            SET current_workloads = GREATEST(0, current_workloads - 1) 
            WHERE id = OLD.node_id;
            
            UPDATE edge_nodes 
            SET current_workloads = current_workloads + 1 
            WHERE id = NEW.node_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workload_placement_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON workload_placements
    FOR EACH ROW EXECUTE FUNCTION update_node_workload_count();

-- Enable Row Level Security
ALTER TABLE edge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE latency_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for edge_nodes (public read, admin write)
CREATE POLICY "Public users can view edge nodes" ON edge_nodes
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage edge nodes" ON edge_nodes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_app_meta_data->>'role' = 'admin'
        )
    );

-- RLS Policies for node_capabilities
CREATE POLICY "Public users can view node capabilities" ON node_capabilities
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage node capabilities" ON node_capabilities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_app_meta_data->>'role' = 'admin'
        )
    );

-- RLS Policies for placement_policies (tenant isolation)
CREATE POLICY "Users can manage their placement policies" ON placement_policies
    FOR ALL USING (tenant_id = auth.uid());

-- RLS Policies for workload_placements (tenant isolation)
CREATE POLICY "Users can manage their workload placements" ON workload_placements
    FOR ALL USING (tenant_id = auth.uid());

-- RLS Policies for migration_events (tenant isolation)
CREATE POLICY "Users can view their migration events" ON migration_events
    FOR ALL USING (tenant_id = auth.uid());

-- RLS Policies for latency_metrics (tenant isolation)
CREATE POLICY "Users can manage their latency metrics" ON latency_metrics
    FOR ALL USING (tenant_id = auth.uid());

-- Create views for easier querying
CREATE OR REPLACE VIEW node_utilization_summary AS
SELECT 
    en.id,
    en.name,
    en.region,
    en.zone,
    en.status,
    en.current_workloads,
    en.max_workloads,
    ROUND((en.current_workloads::decimal / en.max_workloads::decimal) * 100, 2) as utilization_percentage,
    en.cost_per_hour,
    array_agg(DISTINCT nc.capability_type) FILTER (WHERE nc.is_available) as available_capabilities,
    COUNT(wp.id) as active_workloads
FROM edge_nodes en
LEFT JOIN node_capabilities nc ON en.id = nc.node_id
LEFT JOIN workload_placements wp ON en.id = wp.node_id AND wp.status = 'running'
GROUP BY en.id, en.name, en.region, en.zone, en.status, en.current_workloads, en.max_workloads, en.cost_per_hour;

-- Performance monitoring view
CREATE OR REPLACE VIEW workload_performance_summary AS
SELECT 
    wp.id,
    wp.tenant_id,
    wp.workload_id,
    wp.workload_name,
    en.name as node_name,
    en.region,
    wp.status,
    wp.latency_requirement_ms,
    AVG(lm.measured_latency_ms) as avg_actual_latency_ms,
    MIN(lm.measured_latency_ms) as min_latency_ms,
    MAX(lm.measured_latency_ms) as max_latency_ms,
    COUNT(lm.id) as measurement_count,
    wp.estimated_cost_per_hour,
    wp.actual_cost_per_hour,
    wp.created_at,
    wp.deployed_at
FROM workload_placements wp
JOIN edge_nodes en ON wp.node_id = en.id
LEFT JOIN latency_metrics lm ON wp.id = lm.workload_placement_id
    AND lm.timestamp >= wp.deployed_at
GROUP BY wp.id, wp.tenant_id, wp.workload_id, wp.workload_name, en.name, en.region, 
         wp.status, wp.latency_requirement_ms, wp.estimated_cost_per_hour, 
         wp.actual_cost_per_hour, wp.created_at, wp.deployed_at;

-- Grant permissions for service role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Insert sample data for testing
INSERT INTO edge_nodes (name, region, zone, location, ip_address, cpu_cores, memory_gb, storage_gb, network_bandwidth_mbps, cost_per_hour, provider)
VALUES 
    ('US-West-1A', 'us-west', 'us-west-1a', ST_GeomFromText('POINT(-122.4194 37.7749)',