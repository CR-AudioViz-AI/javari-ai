```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create enum types
CREATE TYPE memory_type AS ENUM ('episodic', 'semantic', 'procedural', 'contextual');
CREATE TYPE memory_status AS ENUM ('active', 'archived', 'tombstone');
CREATE TYPE conflict_resolution_strategy AS ENUM ('last_write_wins', 'merge', 'manual', 'vector_clock');

-- Create team_memories table with vector embeddings and CRDT support
CREATE TABLE IF NOT EXISTS team_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    memory_type memory_type NOT NULL DEFAULT 'semantic',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimensions
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- CRDT fields for conflict resolution
    vector_clock JSONB NOT NULL DEFAULT '{}',
    replica_id UUID NOT NULL,
    logical_timestamp BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000000,
    parent_memory_id UUID,
    
    -- Memory lifecycle
    status memory_status NOT NULL DEFAULT 'active',
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    FOREIGN KEY (parent_memory_id) REFERENCES team_memories(id) ON DELETE CASCADE
);

-- Create memory_conflicts table for CRDT operations tracking
CREATE TABLE IF NOT EXISTS memory_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    memory_id UUID NOT NULL,
    conflicting_memory_id UUID,
    
    -- Conflict metadata
    conflict_type TEXT NOT NULL,
    resolution_strategy conflict_resolution_strategy NOT NULL DEFAULT 'vector_clock',
    conflict_data JSONB NOT NULL DEFAULT '{}',
    
    -- Resolution tracking
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_result JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (memory_id) REFERENCES team_memories(id) ON DELETE CASCADE,
    FOREIGN KEY (conflicting_memory_id) REFERENCES team_memories(id) ON DELETE SET NULL
);

-- Create memory_access_logs for audit trail
CREATE TABLE IF NOT EXISTS memory_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    memory_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    
    -- Access details
    access_type TEXT NOT NULL, -- 'read', 'write', 'search', 'delete'
    query_vector vector(1536),
    similarity_score FLOAT,
    context_data JSONB DEFAULT '{}',
    
    -- Performance metrics
    response_time_ms INTEGER,
    results_count INTEGER,
    
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (memory_id) REFERENCES team_memories(id) ON DELETE CASCADE
);

-- Create team_memory_subscriptions for real-time sync
CREATE TABLE IF NOT EXISTS team_memory_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    
    -- Subscription filters
    memory_types memory_type[] DEFAULT array['semantic', 'episodic', 'procedural', 'contextual'],
    tag_filters TEXT[] DEFAULT '{}',
    importance_threshold FLOAT DEFAULT 0.0,
    
    -- Sync state
    last_sync_timestamp BIGINT DEFAULT 0,
    sync_vector_clock JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(team_id, agent_id)
);

-- Create memory_embeddings_cache for performance optimization
CREATE TABLE IF NOT EXISTS memory_embeddings_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    model_version TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(team_id, content_hash, model_version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_memories_team_id ON team_memories(team_id);
CREATE INDEX IF NOT EXISTS idx_team_memories_agent_id ON team_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_team_memories_type ON team_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_team_memories_status ON team_memories(status);
CREATE INDEX IF NOT EXISTS idx_team_memories_importance ON team_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_team_memories_created_at ON team_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_memories_tags ON team_memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_team_memories_metadata ON team_memories USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_team_memories_vector_clock ON team_memories USING GIN(vector_clock);

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_team_memories_embedding ON team_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Other table indexes
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_team_id ON memory_conflicts(team_id);
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_memory_id ON memory_conflicts(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_conflicts_resolved ON memory_conflicts(resolved);

CREATE INDEX IF NOT EXISTS idx_memory_access_logs_team_id ON memory_access_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_memory_id ON memory_access_logs(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_agent_id ON memory_access_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_accessed_at ON memory_access_logs(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_memory_subscriptions_team_id ON team_memory_subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_team_memory_subscriptions_active ON team_memory_subscriptions(is_active);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_cache_team_id ON memory_embeddings_cache(team_id);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_cache_hash ON memory_embeddings_cache(content_hash);

-- Enable Row Level Security
ALTER TABLE team_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memory_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_embeddings_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team-scoped access

-- Team memories policies
CREATE POLICY "team_memories_select" ON team_memories
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "team_memories_insert" ON team_memories
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "team_memories_update" ON team_memories
    FOR UPDATE USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "team_memories_delete" ON team_memories
    FOR DELETE USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'owner')
        )
    );

-- Memory conflicts policies
CREATE POLICY "memory_conflicts_select" ON memory_conflicts
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "memory_conflicts_insert" ON memory_conflicts
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Memory access logs policies
CREATE POLICY "memory_access_logs_select" ON memory_access_logs
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "memory_access_logs_insert" ON memory_access_logs
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Team memory subscriptions policies
CREATE POLICY "team_memory_subscriptions_select" ON team_memory_subscriptions
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "team_memory_subscriptions_all" ON team_memory_subscriptions
    FOR ALL USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Memory embeddings cache policies
CREATE POLICY "memory_embeddings_cache_select" ON memory_embeddings_cache
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "memory_embeddings_cache_insert" ON memory_embeddings_cache
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Function for semantic memory search
CREATE OR REPLACE FUNCTION search_team_memories(
    p_team_id UUID,
    p_query_embedding vector(1536),
    p_similarity_threshold FLOAT DEFAULT 0.7,
    p_limit INTEGER DEFAULT 10,
    p_memory_types memory_type[] DEFAULT array['semantic', 'episodic', 'procedural', 'contextual'],
    p_tags TEXT[] DEFAULT array[]::TEXT[]
)
RETURNS TABLE (
    memory_id UUID,
    title TEXT,
    content TEXT,
    memory_type memory_type,
    similarity_score FLOAT,
    importance_score FLOAT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.id,
        tm.title,
        tm.content,
        tm.memory_type,
        1 - (tm.embedding <=> p_query_embedding) AS similarity,
        tm.importance_score,
        tm.tags,
        tm.created_at
    FROM team_memories tm
    WHERE 
        tm.team_id = p_team_id
        AND tm.status = 'active'
        AND tm.memory_type = ANY(p_memory_types)
        AND (array_length(p_tags, 1) IS NULL OR tm.tags && p_tags)
        AND (1 - (tm.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY tm.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for CRDT vector clock comparison
CREATE OR REPLACE FUNCTION compare_vector_clocks(
    clock1 JSONB,
    clock2 JSONB
)
RETURNS TEXT AS $$
DECLARE
    key TEXT;
    val1 INTEGER;
    val2 INTEGER;
    clock1_greater BOOLEAN := FALSE;
    clock2_greater BOOLEAN := FALSE;
BEGIN
    -- Compare all keys in both clocks
    FOR key IN SELECT DISTINCT jsonb_object_keys(clock1 || clock2) LOOP
        val1 := COALESCE((clock1->>key)::INTEGER, 0);
        val2 := COALESCE((clock2->>key)::INTEGER, 0);
        
        IF val1 > val2 THEN
            clock1_greater := TRUE;
        ELSIF val2 > val1 THEN
            clock2_greater := TRUE;
        END IF;
    END LOOP;
    
    -- Return relationship
    IF clock1_greater AND NOT clock2_greater THEN
        RETURN 'greater';
    ELSIF clock2_greater AND NOT clock1_greater THEN
        RETURN 'less';
    ELSIF NOT clock1_greater AND NOT clock2_greater THEN
        RETURN 'equal';
    ELSE
        RETURN 'concurrent';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to merge vector clocks
CREATE OR REPLACE FUNCTION merge_vector_clocks(
    clock1 JSONB,
    clock2 JSONB
)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    key TEXT;
    val1 INTEGER;
    val2 INTEGER;
BEGIN
    FOR key IN SELECT DISTINCT jsonb_object_keys(clock1 || clock2) LOOP
        val1 := COALESCE((clock1->>key)::INTEGER, 0);
        val2 := COALESCE((clock2->>key)::INTEGER, 0);
        result := result || jsonb_build_object(key, GREATEST(val1, val2));
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function for automatic conflict detection and resolution
CREATE OR REPLACE FUNCTION handle_memory_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    existing_memory RECORD;
    clock_comparison TEXT;
    conflict_id UUID;
BEGIN
    -- Only process active memories
    IF NEW.status != 'active' THEN
        RETURN NEW;
    END IF;
    
    -- Look for existing memories with same content hash or similar content
    FOR existing_memory IN 
        SELECT * FROM team_memories 
        WHERE team_id = NEW.team_id 
        AND id != NEW.id 
        AND status = 'active'
        AND (
            -- Same content
            content = NEW.content
            OR 
            -- Similar embedding (potential semantic conflict)
            (embedding IS NOT NULL AND NEW.embedding IS NOT NULL 
             AND 1 - (embedding <=> NEW.embedding) > 0.95)
        )
    LOOP
        -- Compare vector clocks
        clock_comparison := compare_vector_clocks(NEW.vector_clock, existing_memory.vector_clock);
        
        -- Handle concurrent updates (conflict detected)
        IF clock_comparison = 'concurrent' THEN
            -- Create conflict record
            INSERT INTO memory_conflicts (
                team_id,
                memory_id,
                conflicting_memory_id,
                conflict_type,
                resolution_strategy,
                conflict_data
            ) VALUES (
                NEW.team_id,
                NEW.id,
                existing_memory.id,
                'concurrent_update',
                'vector_clock',
                jsonb_build_object(
                    'new_clock', NEW.vector_clock,
                    'existing_clock', existing_memory.vector_clock,
                    'timestamp_diff', NEW.logical_timestamp - existing_memory.logical_timestamp
                )
            ) RETURNING id INTO conflict_id;
            
            -- Auto-resolve using last-write-wins for now
            IF NEW.logical_timestamp > existing_memory.logical_timestamp THEN
                -- Mark existing as tombstone
                UPDATE team_memories 
                SET status = 'tombstone', updated_at = NOW()
                WHERE id = existing_memory.id;
                
                -- Merge vector clocks
                NEW.vector_clock := merge_vector_clocks(NEW.vector_clock, existing_memory.vector_clock);
            ELSE
                -- Mark new as tombstone
                NEW.status := 'tombstone';
            END IF;
            
            -- Mark conflict as resolved
            UPDATE memory_conflicts 
            SET resolved = TRUE, resolved_at = NOW(), resolved_by = NEW.agent_id
            WHERE id = conflict_id;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conflict resolution
CREATE TRIGGER trigger_memory_conflicts
    BEFORE INSERT OR UPDATE ON team_memories
    FOR EACH ROW
    EXECUTE FUNCTION handle_memory_conflicts();

-- Trigger function for updating timestamps and access tracking
CREATE OR REPLACE FUNCTION update_memory_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    
    -- Increment vector clock for this replica
    NEW.vector_clock := NEW.vector_clock || jsonb_build_object(
        NEW.replica_id::TEXT, 
        COALESCE((NEW.vector_clock->>NEW.replica_id::TEXT)::INTEGER, 0) + 1
    );
    
    -- Update logical timestamp
    NEW.logical_timestamp := extract(epoch from now()) * 1000000;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create timestamp trigger
CREATE TRIGGER trigger_update_memory_timestamps
    BEFORE UPDATE ON team_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_timestamps();

-- Function to log memory access
CREATE OR REPLACE FUNCTION log_memory_access(
    p_team_id UUID,
    p_memory_id UUID,
    p_agent_id UUID,
    p_access_type TEXT,
    p_query_vector vector(1536) DEFAULT NULL,
    p_similarity_score FLOAT DEFAULT NULL,
    p_context_data JSONB DEFAULT '{}',
    p_response_time_ms INTEGER DEFAULT NULL,
    p_results_count INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO memory_access_logs (
        team_id,
        memory_id,
        agent_id,
        access_type,
        query_vector,
        similarity_score,
        context_data,
        response_time_ms,
        results_count
    ) VALUES (
        p_team_id,
        p_memory_id,
        p_agent_id,
        p_access_type,
        p_query_vector,
        p_similarity_score,
        p_context_data,
        p_response_time_ms,
        p_results_count
    ) RETURNING id INTO log_id;
    
    -- Update access count and timestamp on memory
    UPDATE team_memories 
    SET 
        access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE id = p_memory_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired memories
    WITH deleted AS (
        DELETE FROM team_memories 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    -- Cleanup old tombstone memories (older than 30 days)
    WITH tombstone_deleted AS (
        DELETE FROM team_memories 
        WHERE status = 'tombstone' AND updated_at < NOW() - INTERVAL '30 days'
        RETURNING id
    )
    SELECT deleted_count + COUNT(*) INTO deleted_count FROM tombstone_deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create initial subscription triggers for realtime
CREATE OR REPLACE FUNCTION notify_memory_changes()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'event_type', TG_OP,
        'team_id', COALESCE(NEW.team_id, OLD.team_id),
        'memory_id', COALESCE(NEW.id, OLD.id),
        'agent_id', COALESCE(NEW.agent_id, OLD.agent_id),
        'memory_type', COALESCE(NEW.memory_type, OLD.memory_type),
        'timestamp', extract(epoch from now())
    );
    
    PERFORM pg_notify('team_memory_changes', payload::TEXT);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_memory_changes
    AFTER INSERT OR UPDATE OR DELETE ON team_memories
    FOR EACH ROW
    EXECUTE FUNCTION notify_memory_changes();
```