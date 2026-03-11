```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better data integrity
CREATE TYPE world_zone_type AS ENUM ('central', 'north', 'south', 'east', 'west', 'underground', 'sky');
CREATE TYPE interaction_type AS ENUM ('pickup', 'activate', 'dialogue', 'quest', 'portal', 'combat');
CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed', 'failed');

-- World Zones table (master table for partitioning)
CREATE TABLE IF NOT EXISTS world_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    zone_type world_zone_type NOT NULL,
    boundary GEOMETRY(POLYGON, 4326) NOT NULL,
    metadata JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- World States table (partitioned by zone)
CREATE TABLE IF NOT EXISTS world_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES world_zones(id) ON DELETE CASCADE,
    zone_type world_zone_type NOT NULL,
    position GEOMETRY(POINT, 4326) NOT NULL,
    state_data JSONB NOT NULL DEFAULT '{}',
    version INTEGER DEFAULT 1,
    checksum TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY LIST (zone_type);

-- Create partitions for each zone type
CREATE TABLE IF NOT EXISTS world_states_central PARTITION OF world_states
    FOR VALUES IN ('central');
CREATE TABLE IF NOT EXISTS world_states_north PARTITION OF world_states
    FOR VALUES IN ('north');
CREATE TABLE IF NOT EXISTS world_states_south PARTITION OF world_states
    FOR VALUES IN ('south');
CREATE TABLE IF NOT EXISTS world_states_east PARTITION OF world_states
    FOR VALUES IN ('east');
CREATE TABLE IF NOT EXISTS world_states_west PARTITION OF world_states
    FOR VALUES IN ('west');
CREATE TABLE IF NOT EXISTS world_states_underground PARTITION OF world_states
    FOR VALUES IN ('underground');
CREATE TABLE IF NOT EXISTS world_states_sky PARTITION OF world_states
    FOR VALUES IN ('sky');

-- User Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    world_id UUID REFERENCES world_zones(id),
    current_position GEOMETRY(POINT, 4326),
    session_data JSONB DEFAULT '{}',
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- User Progress table (partitioned by user_id hash for scalability)
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    world_id UUID NOT NULL REFERENCES world_zones(id) ON DELETE CASCADE,
    quest_id TEXT,
    achievement_id TEXT,
    progress_type TEXT NOT NULL,
    status progress_status DEFAULT 'not_started',
    progress_data JSONB DEFAULT '{}',
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, world_id, quest_id, achievement_id)
) PARTITION BY HASH (user_id);

-- Create hash partitions for user_progress
CREATE TABLE IF NOT EXISTS user_progress_0 PARTITION OF user_progress
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS user_progress_1 PARTITION OF user_progress
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS user_progress_2 PARTITION OF user_progress
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS user_progress_3 PARTITION OF user_progress
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Interactive Elements table
CREATE TABLE IF NOT EXISTS interactive_elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES world_zones(id) ON DELETE CASCADE,
    element_type interaction_type NOT NULL,
    position GEOMETRY(POINT, 4326) NOT NULL,
    interaction_radius DECIMAL(10,2) DEFAULT 5.0,
    element_data JSONB NOT NULL DEFAULT '{}',
    state JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '{}',
    cooldown_seconds INTEGER DEFAULT 0,
    max_interactions INTEGER,
    interaction_count INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Interactions table (for tracking interaction history)
CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    element_id UUID NOT NULL REFERENCES interactive_elements(id) ON DELETE CASCADE,
    interaction_type interaction_type NOT NULL,
    interaction_data JSONB DEFAULT '{}',
    success BOOLEAN DEFAULT true,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    INDEX (user_id, timestamp DESC)
);

-- Real-time State Sync table (for tracking changes)
CREATE TABLE IF NOT EXISTS state_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    changes JSONB,
    user_id UUID,
    timestamp TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions for state_sync_log
CREATE TABLE IF NOT EXISTS state_sync_log_current PARTITION OF state_sync_log
    FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE)) 
    TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'));

-- Indexes for performance optimization

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_world_zones_boundary_gist ON world_zones USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_world_states_position_gist ON world_states USING GIST (position);
CREATE INDEX IF NOT EXISTS idx_interactive_elements_position_gist ON interactive_elements USING GIST (position);
CREATE INDEX IF NOT EXISTS idx_user_sessions_position_gist ON user_sessions USING GIST (current_position) WHERE current_position IS NOT NULL;

-- B-tree indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_world_states_world_id ON world_states (world_id);
CREATE INDEX IF NOT EXISTS idx_world_states_updated_at ON world_states (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions (last_active DESC) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_user_progress_user_world ON user_progress (user_id, world_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON user_progress (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactive_elements_world ON interactive_elements (world_id, active);
CREATE INDEX IF NOT EXISTS idx_interactive_elements_type ON interactive_elements (element_type, active);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_time ON user_interactions (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_state_sync_log_table_record ON state_sync_log (table_name, record_id);

-- JSONB indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_world_states_state_gin ON world_states USING GIN (state_data);
CREATE INDEX IF NOT EXISTS idx_user_progress_data_gin ON user_progress USING GIN (progress_data);
CREATE INDEX IF NOT EXISTS idx_interactive_elements_data_gin ON interactive_elements USING GIN (element_data);
CREATE INDEX IF NOT EXISTS idx_interactive_elements_state_gin ON interactive_elements USING GIN (state);

-- Database functions for spatial operations

-- Function to find nearby interactive elements
CREATE OR REPLACE FUNCTION find_nearby_elements(
    user_pos GEOMETRY(POINT, 4326),
    search_radius DECIMAL DEFAULT 100.0,
    element_types interaction_type[] DEFAULT NULL
)
RETURNS TABLE (
    element_id UUID,
    element_type interaction_type,
    distance DECIMAL,
    element_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ie.id,
        ie.element_type,
        ROUND(ST_Distance(ie.position, user_pos)::DECIMAL, 2) as distance,
        ie.element_data
    FROM interactive_elements ie
    WHERE 
        ie.active = true
        AND ST_DWithin(ie.position, user_pos, search_radius)
        AND (element_types IS NULL OR ie.element_type = ANY(element_types))
    ORDER BY ST_Distance(ie.position, user_pos);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update world state with version control
CREATE OR REPLACE FUNCTION update_world_state(
    p_world_id UUID,
    p_position GEOMETRY(POINT, 4326),
    p_state_data JSONB,
    p_expected_version INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    current_version INTEGER;
    new_state_id UUID;
    zone_type_val world_zone_type;
BEGIN
    -- Get zone type for partitioning
    SELECT wz.zone_type INTO zone_type_val
    FROM world_zones wz
    WHERE wz.id = p_world_id;
    
    IF zone_type_val IS NULL THEN
        RAISE EXCEPTION 'World zone not found: %', p_world_id;
    END IF;
    
    -- Check version if provided
    IF p_expected_version IS NOT NULL THEN
        SELECT version INTO current_version
        FROM world_states 
        WHERE world_id = p_world_id 
            AND ST_Equals(position, p_position)
        ORDER BY version DESC 
        LIMIT 1;
        
        IF current_version IS NOT NULL AND current_version != p_expected_version THEN
            RAISE EXCEPTION 'Version conflict: expected %, got %', p_expected_version, current_version;
        END IF;
    END IF;
    
    -- Insert new state
    INSERT INTO world_states (world_id, zone_type, position, state_data, version, checksum)
    VALUES (
        p_world_id,
        zone_type_val,
        p_position,
        p_state_data,
        COALESCE(current_version, 0) + 1,
        MD5(p_state_data::TEXT)
    )
    RETURNING id INTO new_state_id;
    
    RETURN new_state_id;
END;
$$ LANGUAGE plpgsql;

-- Triggers for real-time synchronization

-- Function to log state changes
CREATE OR REPLACE FUNCTION log_state_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO state_sync_log (table_name, record_id, operation, changes, user_id)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE 
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
        END,
        COALESCE(NEW.user_id, OLD.user_id, auth.uid())
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for state synchronization
CREATE TRIGGER world_states_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON world_states
    FOR EACH ROW EXECUTE FUNCTION log_state_change();

CREATE TRIGGER user_progress_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION log_state_change();

CREATE TRIGGER interactive_elements_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON interactive_elements
    FOR EACH ROW EXECUTE FUNCTION log_state_change();

CREATE TRIGGER user_interactions_sync_trigger
    AFTER INSERT ON user_interactions
    FOR EACH ROW EXECUTE FUNCTION log_state_change();

-- Row Level Security policies

-- Enable RLS on all user-specific tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Policies for user_sessions
CREATE POLICY "Users can view their own sessions"
    ON user_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON user_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON user_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies for user_progress
CREATE POLICY "Users can view their own progress"
    ON user_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
    ON user_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
    ON user_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies for user_interactions
CREATE POLICY "Users can view their own interactions"
    ON user_interactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions"
    ON user_interactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Public read access for world data
CREATE POLICY "World zones are publicly readable"
    ON world_zones FOR SELECT
    TO authenticated, anon
    USING (active = true);

CREATE POLICY "World states are publicly readable"
    ON world_states FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Interactive elements are publicly readable"
    ON interactive_elements FOR SELECT
    TO authenticated, anon
    USING (active = true);

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_world_zones_updated_at
    BEFORE UPDATE ON world_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_world_states_updated_at
    BEFORE UPDATE ON world_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactive_elements_updated_at
    BEFORE UPDATE ON interactive_elements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE world_states;
ALTER PUBLICATION supabase_realtime ADD TABLE user_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE interactive_elements;
ALTER PUBLICATION supabase_realtime ADD TABLE user_interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE state_sync_log;

-- Create sample data function for testing
CREATE OR REPLACE FUNCTION create_sample_world_data()
RETURNS VOID AS $$
DECLARE
    central_zone_id UUID;
BEGIN
    -- Insert a sample central zone
    INSERT INTO world_zones (name, zone_type, boundary, metadata)
    VALUES (
        'Central Hub',
        'central',
        ST_GeomFromText('POLYGON((-1 -1, -1 1, 1 1, 1 -1, -1 -1))', 4326),
        '{"description": "The central hub of CRAIverse", "max_players": 100}'
    )
    RETURNING id INTO central_zone_id;
    
    -- Insert some interactive elements
    INSERT INTO interactive_elements (world_id, element_type, position, element_data, interaction_radius)
    VALUES 
        (central_zone_id, 'portal', ST_Point(0, 0, 4326), '{"destination": "north_zone", "activation_key": "portal_crystal"}', 10.0),
        (central_zone_id, 'quest', ST_Point(0.5, 0.5, 4326), '{"quest_giver": "Elder Sage", "quest_type": "fetch", "reward": 100}', 5.0),
        (central_zone_id, 'pickup', ST_Point(-0.3, 0.2, 4326), '{"item_type": "health_potion", "quantity": 1, "respawn_time": 300}', 2.0);
    
    RAISE NOTICE 'Sample world data created successfully';
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring view
CREATE OR REPLACE VIEW performance_metrics AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    most_common_vals,
    most_common_freqs,
    histogram_bounds
FROM pg_stats 
WHERE schemaname = 'public' 
    AND tablename IN ('world_states', 'user_progress', 'interactive_elements', 'user_interactions');

-- Comments for documentation
COMMENT ON TABLE world_zones IS 'Master table defining world zones with spatial boundaries';
COMMENT ON TABLE world_states IS 'Partitioned table storing world state data by zone type';
COMMENT ON TABLE user_sessions IS 'Active user sessions with current positions and session data';
COMMENT ON TABLE user_progress IS 'Hash-partitioned user progress tracking across all worlds';
COMMENT ON TABLE interactive_elements IS 'Spatial elements that users can interact with in the world';
COMMENT ON TABLE user_interactions IS 'Log of all user interactions with world elements';
COMMENT ON TABLE state_sync_log IS 'Real-time synchronization log for state changes';
COMMENT ON FUNCTION find_nearby_elements IS 'Spatial query function to find interactive elements near a position';
COMMENT ON FUNCTION update_world_state IS 'Version-controlled world state update with conflict detection';
```