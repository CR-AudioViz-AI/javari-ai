```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better type safety
DO $$ BEGIN
    CREATE TYPE context_entry_type AS ENUM ('observation', 'decision', 'insight', 'goal', 'constraint', 'resource');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE decision_status AS ENUM ('proposed', 'approved', 'rejected', 'implemented', 'superseded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE access_pattern_type AS ENUM ('semantic_search', 'temporal_query', 'decision_lookup', 'agent_memory');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Team contexts table - main container for team-level shared context
CREATE TABLE IF NOT EXISTS team_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
    context_window_size INTEGER DEFAULT 4000,
    max_entries INTEGER DEFAULT 10000,
    retention_days INTEGER DEFAULT 90,
    
    CONSTRAINT unique_team_context_name UNIQUE(team_id, name)
);

-- Context entries table with vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS context_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_context_id UUID NOT NULL REFERENCES team_contexts(id) ON DELETE CASCADE,
    agent_id UUID,
    entry_type context_entry_type NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI ada-002 embedding dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    relevance_score FLOAT DEFAULT 1.0,
    is_archived BOOLEAN DEFAULT false,
    parent_entry_id UUID REFERENCES context_entries(id),
    related_decision_id UUID,
    source_reference VARCHAR(500),
    confidence_level FLOAT DEFAULT 1.0 CHECK (confidence_level >= 0 AND confidence_level <= 1),
    
    -- Full text search vector
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
    ) STORED
);

-- Team decisions table for tracking decisions and their context
CREATE TABLE IF NOT EXISTS team_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_context_id UUID NOT NULL REFERENCES team_contexts(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    decision_maker_id UUID,
    status decision_status DEFAULT 'proposed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    decided_at TIMESTAMP WITH TIME ZONE,
    implemented_at TIMESTAMP WITH TIME ZONE,
    rationale TEXT,
    alternatives_considered JSONB DEFAULT '[]',
    impact_assessment JSONB DEFAULT '{}',
    related_entries UUID[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    expiry_date TIMESTAMP WITH TIME ZONE,
    superseded_by UUID REFERENCES team_decisions(id),
    
    -- Embedding for semantic search of decisions
    embedding vector(1536),
    
    -- Full text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(rationale, '')), 'C')
    ) STORED
);

-- Agent memories table for individual agent context within teams
CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_context_id UUID NOT NULL REFERENCES team_contexts(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    memory_type VARCHAR(50) NOT NULL, -- 'short_term', 'long_term', 'procedural', 'episodic'
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    decay_factor FLOAT DEFAULT 0.95 CHECK (decay_factor >= 0 AND decay_factor <= 1),
    metadata JSONB DEFAULT '{}',
    related_entries UUID[] DEFAULT '{}',
    is_shared BOOLEAN DEFAULT false,
    consolidation_candidate BOOLEAN DEFAULT false,
    
    CONSTRAINT unique_agent_memory UNIQUE(team_context_id, agent_id, memory_type, content)
);

-- Context access patterns table for retrieval optimization
CREATE TABLE IF NOT EXISTS context_access_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_context_id UUID NOT NULL REFERENCES team_contexts(id) ON DELETE CASCADE,
    agent_id UUID,
    pattern_type access_pattern_type NOT NULL,
    query_text TEXT,
    query_embedding vector(1536),
    retrieved_entries UUID[] DEFAULT '{}',
    access_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    result_count INTEGER DEFAULT 0,
    relevance_threshold FLOAT DEFAULT 0.7,
    metadata JSONB DEFAULT '{}',
    session_id UUID,
    
    -- Track query patterns for optimization
    query_hash VARCHAR(64) GENERATED ALWAYS AS (
        encode(sha256(coalesce(query_text, '')::bytea), 'hex')
    ) STORED
);

-- Create indexes for optimal performance

-- Vector similarity search indexes
CREATE INDEX IF NOT EXISTS idx_context_entries_embedding 
ON context_entries USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_team_decisions_embedding 
ON team_decisions USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding 
ON agent_memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_access_patterns_embedding 
ON context_access_patterns USING ivfflat (query_embedding vector_cosine_ops)
WITH (lists = 100);

-- Traditional indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_team_contexts_team_id ON team_contexts(team_id);
CREATE INDEX IF NOT EXISTS idx_team_contexts_active ON team_contexts(team_id, is_active);

CREATE INDEX IF NOT EXISTS idx_context_entries_team_context ON context_entries(team_context_id);
CREATE INDEX IF NOT EXISTS idx_context_entries_agent ON context_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_context_entries_type ON context_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_context_entries_created ON context_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_entries_relevance ON context_entries(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_context_entries_search ON context_entries USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_context_entries_tags ON context_entries USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_context_entries_archived ON context_entries(team_context_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_team_decisions_team_context ON team_decisions(team_context_id);
CREATE INDEX IF NOT EXISTS idx_team_decisions_status ON team_decisions(status);
CREATE INDEX IF NOT EXISTS idx_team_decisions_created ON team_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_decisions_priority ON team_decisions(priority DESC);
CREATE INDEX IF NOT EXISTS idx_team_decisions_search ON team_decisions USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_agent_memories_team_agent ON agent_memories(team_context_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_accessed ON agent_memories(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_shared ON agent_memories(is_shared);

CREATE INDEX IF NOT EXISTS idx_access_patterns_team_context ON context_access_patterns(team_context_id);
CREATE INDEX IF NOT EXISTS idx_access_patterns_agent ON context_access_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_access_patterns_type ON context_access_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_access_patterns_timestamp ON context_access_patterns(access_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_patterns_hash ON context_access_patterns(query_hash);

-- Enable Row Level Security
ALTER TABLE team_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_access_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team-based access control
CREATE POLICY team_contexts_access ON team_contexts
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM team_members 
            WHERE team_members.team_id = team_contexts.team_id
        )
    );

CREATE POLICY context_entries_access ON context_entries
    FOR ALL USING (
        team_context_id IN (
            SELECT id FROM team_contexts
            WHERE auth.uid() IN (
                SELECT user_id FROM team_members 
                WHERE team_members.team_id = team_contexts.team_id
            )
        )
    );

CREATE POLICY team_decisions_access ON team_decisions
    FOR ALL USING (
        team_context_id IN (
            SELECT id FROM team_contexts
            WHERE auth.uid() IN (
                SELECT user_id FROM team_members 
                WHERE team_members.team_id = team_contexts.team_id
            )
        )
    );

CREATE POLICY agent_memories_access ON agent_memories
    FOR ALL USING (
        team_context_id IN (
            SELECT id FROM team_contexts
            WHERE auth.uid() IN (
                SELECT user_id FROM team_members 
                WHERE team_members.team_id = team_contexts.team_id
            )
        )
    );

CREATE POLICY context_access_patterns_access ON context_access_patterns
    FOR ALL USING (
        team_context_id IN (
            SELECT id FROM team_contexts
            WHERE auth.uid() IN (
                SELECT user_id FROM team_members 
                WHERE team_members.team_id = team_contexts.team_id
            )
        )
    );

-- Create functions for context management

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_team_contexts_updated_at
    BEFORE UPDATE ON team_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_entries_updated_at
    BEFORE UPDATE ON context_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_decisions_updated_at
    BEFORE UPDATE ON team_decisions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update agent memory access patterns
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE agent_memories 
    SET 
        accessed_at = NOW(),
        access_count = access_count + 1,
        importance_score = LEAST(1.0, importance_score * (1 + 0.1))
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for semantic search with hybrid scoring
CREATE OR REPLACE FUNCTION search_context_entries(
    p_team_context_id UUID,
    p_query_embedding vector(1536),
    p_query_text TEXT DEFAULT NULL,
    p_entry_types context_entry_type[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    content TEXT,
    entry_type context_entry_type,
    similarity_score FLOAT,
    text_score FLOAT,
    hybrid_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.title,
        ce.content,
        ce.entry_type,
        (1 - (ce.embedding <=> p_query_embedding)) as similarity_score,
        CASE 
            WHEN p_query_text IS NOT NULL THEN 
                ts_rank_cd(ce.search_vector, plainto_tsquery('english', p_query_text))
            ELSE 0.0
        END as text_score,
        -- Hybrid scoring: 70% semantic + 30% text search + relevance boost
        (
            0.7 * (1 - (ce.embedding <=> p_query_embedding)) +
            0.3 * CASE 
                WHEN p_query_text IS NOT NULL THEN 
                    ts_rank_cd(ce.search_vector, plainto_tsquery('english', p_query_text))
                ELSE 0.0
            END +
            0.1 * ce.relevance_score
        ) as hybrid_score,
        ce.created_at,
        ce.metadata
    FROM context_entries ce
    WHERE 
        ce.team_context_id = p_team_context_id
        AND ce.is_archived = false
        AND (p_entry_types IS NULL OR ce.entry_type = ANY(p_entry_types))
        AND (1 - (ce.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY hybrid_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function for context consolidation
CREATE OR REPLACE FUNCTION consolidate_agent_memories(
    p_team_context_id UUID,
    p_agent_id UUID,
    p_consolidation_threshold INTEGER DEFAULT 100
)
RETURNS INTEGER AS $$
DECLARE
    consolidated_count INTEGER := 0;
    memory_record RECORD;
    similar_memories UUID[];
BEGIN
    -- Mark memories as consolidation candidates based on similarity and access patterns
    FOR memory_record IN 
        SELECT id, embedding, content, importance_score
        FROM agent_memories 
        WHERE team_context_id = p_team_context_id 
        AND agent_id = p_agent_id
        AND memory_type = 'short_term'
        AND access_count < 5
        AND created_at < NOW() - INTERVAL '7 days'
    LOOP
        -- Find similar memories
        SELECT ARRAY_AGG(id) INTO similar_memories
        FROM agent_memories am
        WHERE am.team_context_id = p_team_context_id
        AND am.agent_id = p_agent_id
        AND am.id != memory_record.id
        AND (1 - (am.embedding <=> memory_record.embedding)) > 0.9
        LIMIT 5;
        
        -- Mark for consolidation if similar memories found
        IF array_length(similar_memories, 1) > 0 THEN
            UPDATE agent_memories 
            SET consolidation_candidate = true 
            WHERE id = memory_record.id OR id = ANY(similar_memories);
            
            consolidated_count := consolidated_count + 1;
        END IF;
    END LOOP;
    
    RETURN consolidated_count;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for context analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS team_context_analytics AS
SELECT 
    tc.id as team_context_id,
    tc.team_id,
    tc.name as context_name,
    COUNT(DISTINCT ce.id) as total_entries,
    COUNT(DISTINCT ce.agent_id) as active_agents,
    COUNT(DISTINCT td.id) as total_decisions,
    COUNT(DISTINCT CASE WHEN td.status = 'implemented' THEN td.id END) as implemented_decisions,
    AVG(ce.relevance_score) as avg_relevance_score,
    COUNT(DISTINCT cap.agent_id) as accessing_agents,
    AVG(cap.response_time_ms) as avg_response_time_ms,
    tc.updated_at as last_updated
FROM team_contexts tc
LEFT JOIN context_entries ce ON tc.id = ce.team_context_id AND ce.is_archived = false
LEFT JOIN team_decisions td ON tc.id = td.team_context_id
LEFT JOIN context_access_patterns cap ON tc.id = cap.team_context_id 
    AND cap.access_timestamp > NOW() - INTERVAL '30 days'
WHERE tc.is_active = true
GROUP BY tc.id, tc.team_id, tc.name, tc.updated_at;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_context_analytics_id 
ON team_context_analytics(team_context_id);

-- Set up automatic refresh of materialized view
CREATE OR REPLACE FUNCTION refresh_team_context_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY team_context_analytics;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Add helpful comments
COMMENT ON TABLE team_contexts IS 'Main container for team-level shared context and configuration';
COMMENT ON TABLE context_entries IS 'Individual context entries with vector embeddings for semantic search';
COMMENT ON TABLE team_decisions IS 'Decision history and tracking for teams';
COMMENT ON TABLE agent_memories IS 'Individual agent memory storage within team contexts';
COMMENT ON TABLE context_access_patterns IS 'Access pattern tracking for retrieval optimization';
COMMENT ON FUNCTION search_context_entries IS 'Hybrid semantic and text search for context entries';
COMMENT ON FUNCTION consolidate_agent_memories IS 'Consolidates similar agent memories to optimize storage';
```