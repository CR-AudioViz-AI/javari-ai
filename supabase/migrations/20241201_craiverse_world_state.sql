```sql
-- CRAIverse World State Persistence Database Migration
-- Created: 2024-12-01
-- Description: Comprehensive schema for world state persistence with spatial indexing and version control

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create custom types
CREATE TYPE world_status AS ENUM ('active', 'archived', 'maintenance', 'deleted');
CREATE TYPE object_type AS ENUM ('building', 'terrain', 'character', 'item', 'decoration', 'system');
CREATE TYPE modification_type AS ENUM ('create', 'update', 'delete', 'move', 'batch');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'conflict', 'failed');

-- Worlds table - Main world metadata and spatial bounds
CREATE TABLE IF NOT EXISTS worlds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status world_status DEFAULT 'active',
    bounds GEOMETRY(POLYGON, 4326) NOT NULL,
    chunk_size INTEGER DEFAULT 64,
    max_objects_per_chunk INTEGER DEFAULT 1000,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- World chunks table - Spatial partitioning for efficient queries
CREATE TABLE IF NOT EXISTS world_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    chunk_x INTEGER NOT NULL,
    chunk_y INTEGER NOT NULL,
    bounds GEOMETRY(POLYGON, 4326) NOT NULL,
    object_count INTEGER DEFAULT 0,
    data_size BIGINT DEFAULT 0,
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    checksum TEXT,
    metadata JSONB DEFAULT '{}',
    is_dirty BOOLEAN DEFAULT FALSE,
    UNIQUE(world_id, chunk_x, chunk_y)
);

-- World objects table - Individual entities and items in the world
CREATE TABLE IF NOT EXISTS world_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES world_chunks(id) ON DELETE SET NULL,
    object_type object_type NOT NULL,
    position GEOMETRY(POINT, 4326) NOT NULL,
    rotation JSONB DEFAULT '{"x": 0, "y": 0, "z": 0}',
    scale JSONB DEFAULT '{"x": 1, "y": 1, "z": 1}',
    properties JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES world_objects(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- World versions table - Track major world state changes
CREATE TABLE IF NOT EXISTS world_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changeset JSONB DEFAULT '{}',
    object_count INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(world_id, version_number)
);

-- World modifications table - Track individual user changes
CREATE TABLE IF NOT EXISTS world_modifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    object_id UUID REFERENCES world_objects(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    modification_type modification_type NOT NULL,
    before_state JSONB,
    after_state JSONB,
    position GEOMETRY(POINT, 4326),
    sync_status sync_status DEFAULT 'pending',
    conflict_data JSONB,
    batch_id UUID,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- World snapshots table - Point-in-time world state snapshots
CREATE TABLE IF NOT EXISTS world_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    version_id UUID REFERENCES world_versions(id) ON DELETE SET NULL,
    name TEXT,
    description TEXT,
    snapshot_data JSONB NOT NULL,
    compressed_size BIGINT,
    checksum TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial partitions table - For managing large world partitioning
CREATE TABLE IF NOT EXISTS spatial_partitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    partition_key TEXT NOT NULL,
    bounds GEOMETRY(POLYGON, 4326) NOT NULL,
    level INTEGER DEFAULT 0,
    parent_id UUID REFERENCES spatial_partitions(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(world_id, partition_key)
);

-- Real-time sync events table - Track real-time synchronization
CREATE TABLE IF NOT EXISTS sync_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sequence_number BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization

-- Spatial indexes using PostGIS
CREATE INDEX IF NOT EXISTS idx_worlds_bounds_gist ON worlds USING GIST (bounds);
CREATE INDEX IF NOT EXISTS idx_world_chunks_bounds_gist ON world_chunks USING GIST (bounds);
CREATE INDEX IF NOT EXISTS idx_world_objects_position_gist ON world_objects USING GIST (position);
CREATE INDEX IF NOT EXISTS idx_world_modifications_position_gist ON world_modifications USING GIST (position);
CREATE INDEX IF NOT EXISTS idx_spatial_partitions_bounds_gist ON spatial_partitions USING GIST (bounds);

-- Regular indexes for common queries
CREATE INDEX IF NOT EXISTS idx_worlds_creator_status ON worlds (creator_id, status);
CREATE INDEX IF NOT EXISTS idx_worlds_updated_at ON worlds (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_chunks_world_id ON world_chunks (world_id);
CREATE INDEX IF NOT EXISTS idx_world_chunks_coordinates ON world_chunks (world_id, chunk_x, chunk_y);
CREATE INDEX IF NOT EXISTS idx_world_chunks_dirty ON world_chunks (world_id, is_dirty) WHERE is_dirty = TRUE;
CREATE INDEX IF NOT EXISTS idx_world_objects_world_id ON world_objects (world_id);
CREATE INDEX IF NOT EXISTS idx_world_objects_chunk_id ON world_objects (chunk_id);
CREATE INDEX IF NOT EXISTS idx_world_objects_type_active ON world_objects (world_id, object_type, is_active);
CREATE INDEX IF NOT EXISTS idx_world_objects_owner ON world_objects (owner_id);
CREATE INDEX IF NOT EXISTS idx_world_objects_parent ON world_objects (parent_id);
CREATE INDEX IF NOT EXISTS idx_world_versions_world_id ON world_versions (world_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_world_modifications_world_user ON world_modifications (world_id, user_id);
CREATE INDEX IF NOT EXISTS idx_world_modifications_sync_status ON world_modifications (sync_status) WHERE sync_status != 'synced';
CREATE INDEX IF NOT EXISTS idx_world_modifications_batch ON world_modifications (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_world_modifications_created_at ON world_modifications (world_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_snapshots_world_id ON world_snapshots (world_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_events_world_sequence ON sync_events (world_id, sequence_number DESC);

-- JSONB indexes for flexible metadata queries
CREATE INDEX IF NOT EXISTS idx_worlds_settings_gin ON worlds USING GIN (settings);
CREATE INDEX IF NOT EXISTS idx_worlds_metadata_gin ON worlds USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_world_objects_properties_gin ON world_objects USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_world_objects_metadata_gin ON world_objects USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_world_modifications_after_state_gin ON world_modifications USING GIN (after_state);

-- Create utility functions

-- Function to get objects within spatial bounds
CREATE OR REPLACE FUNCTION get_objects_in_bounds(
    p_world_id UUID,
    p_bounds GEOMETRY
)
RETURNS TABLE (
    object_id UUID,
    object_type object_type,
    position GEOMETRY,
    properties JSONB,
    distance FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wo.id,
        wo.object_type,
        wo.position,
        wo.properties,
        ST_Distance(wo.position, ST_Centroid(p_bounds)) as distance
    FROM world_objects wo
    WHERE wo.world_id = p_world_id
      AND wo.is_active = TRUE
      AND ST_Intersects(wo.position, p_bounds)
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to update chunk metadata after object changes
CREATE OR REPLACE FUNCTION update_chunk_metadata()
RETURNS TRIGGER AS $$
DECLARE
    chunk_rec RECORD;
BEGIN
    -- Find affected chunk(s)
    FOR chunk_rec IN 
        SELECT DISTINCT wc.id
        FROM world_chunks wc
        WHERE wc.world_id = COALESCE(NEW.world_id, OLD.world_id)
          AND ST_Intersects(wc.bounds, COALESCE(NEW.position, OLD.position))
    LOOP
        -- Update object count and set dirty flag
        UPDATE world_chunks
        SET object_count = (
                SELECT COUNT(*)
                FROM world_objects wo
                WHERE wo.chunk_id = chunk_rec.id
                  AND wo.is_active = TRUE
            ),
            last_modified = NOW(),
            is_dirty = TRUE
        WHERE id = chunk_rec.id;
    END LOOP;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to create automatic world snapshots
CREATE OR REPLACE FUNCTION create_world_snapshot(
    p_world_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    snapshot_id UUID;
    snapshot_data JSONB;
BEGIN
    -- Generate snapshot data
    SELECT jsonb_build_object(
        'world', row_to_json(w.*),
        'chunks', (
            SELECT jsonb_agg(row_to_json(wc.*))
            FROM world_chunks wc
            WHERE wc.world_id = p_world_id
        ),
        'objects', (
            SELECT jsonb_agg(row_to_json(wo.*))
            FROM world_objects wo
            WHERE wo.world_id = p_world_id
              AND wo.is_active = TRUE
        )
    ) INTO snapshot_data
    FROM worlds w
    WHERE w.id = p_world_id;
    
    -- Insert snapshot
    INSERT INTO world_snapshots (
        world_id,
        name,
        description,
        snapshot_data,
        checksum,
        created_by
    ) VALUES (
        p_world_id,
        COALESCE(p_name, 'Auto-snapshot ' || NOW()::TEXT),
        p_description,
        snapshot_data,
        md5(snapshot_data::TEXT),
        auth.uid()
    ) RETURNING id INTO snapshot_id;
    
    RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers

-- Trigger to update world updated_at timestamp
CREATE OR REPLACE FUNCTION update_world_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE worlds 
    SET updated_at = NOW()
    WHERE id = NEW.world_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic updates
CREATE TRIGGER trg_world_objects_update_chunk
    AFTER INSERT OR UPDATE OR DELETE ON world_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_chunk_metadata();

CREATE TRIGGER trg_world_objects_update_world
    AFTER INSERT OR UPDATE OR DELETE ON world_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_world_timestamp();

CREATE TRIGGER trg_world_modifications_update_world
    AFTER INSERT ON world_modifications
    FOR EACH ROW
    EXECUTE FUNCTION update_world_timestamp();

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_partitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

-- Worlds policies
CREATE POLICY "Users can view public worlds" ON worlds
    FOR SELECT USING (
        status = 'active' OR creator_id = auth.uid()
    );

CREATE POLICY "Users can create worlds" ON worlds
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update their worlds" ON worlds
    FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY "Creators can delete their worlds" ON worlds
    FOR DELETE USING (creator_id = auth.uid());

-- World chunks policies
CREATE POLICY "Users can view chunks of accessible worlds" ON world_chunks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM worlds w
            WHERE w.id = world_id
              AND (w.status = 'active' OR w.creator_id = auth.uid())
        )
    );

CREATE POLICY "Authenticated users can modify chunks" ON world_chunks
    FOR ALL USING (auth.uid() IS NOT NULL);

-- World objects policies
CREATE POLICY "Users can view objects in accessible worlds" ON world_objects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM worlds w
            WHERE w.id = world_id
              AND (w.status = 'active' OR w.creator_id = auth.uid())
        )
    );

CREATE POLICY "Users can create objects in accessible worlds" ON world_objects
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM worlds w
            WHERE w.id = world_id
              AND (w.status = 'active' OR w.creator_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their objects or in their worlds" ON world_objects
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM worlds w
            WHERE w.id = world_id AND w.creator_id = auth.uid()
        )
    );

-- World modifications policies
CREATE POLICY "Users can view their modifications" ON world_modifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create modifications" ON world_modifications
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        user_id = auth.uid()
    );

-- Sync events policies (admin only for full access)
CREATE POLICY "Users can view sync events for their worlds" ON sync_events
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM worlds w
            WHERE w.id = world_id AND w.creator_id = auth.uid()
        )
    );

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable real-time subscriptions for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE worlds;
ALTER PUBLICATION supabase_realtime ADD TABLE world_objects;
ALTER PUBLICATION supabase_realtime ADD TABLE world_modifications;
ALTER PUBLICATION supabase_realtime ADD TABLE sync_events;

-- Create initial sequence for sync events
CREATE SEQUENCE IF NOT EXISTS sync_event_sequence;

-- Migration complete
```