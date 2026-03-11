```sql
-- Shared Team Memory Service Migration
-- File: src/lib/database/migrations/20241201_shared_team_memory.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Team memory contexts table with vector embeddings
CREATE TABLE IF NOT EXISTS team_memory_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    context_type VARCHAR(50) NOT NULL CHECK (context_type IN ('conversation', 'task', 'learning', 'pattern', 'decision')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimension
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    relevance_score FLOAT DEFAULT 1.0,
    access_level VARCHAR(20) DEFAULT 'team' CHECK (access_level IN ('private', 'team', 'public')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT FALSE,
    archive_reason TEXT
);

-- AI agent memories table for individual agent context
CREATE TABLE IF NOT EXISTS ai_agent_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(100) NOT NULL,
    team_id UUID NOT NULL,
    memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('working', 'episodic', 'semantic', 'procedural')),
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    context_window INTEGER DEFAULT 4000,
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    parent_memory_id UUID REFERENCES ai_agent_memories(id),
    related_contexts UUID[] DEFAULT '{}'
);

-- Memory sharing permissions table for access control
CREATE TABLE IF NOT EXISTS memory_sharing_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID NOT NULL,
    memory_table VARCHAR(50) NOT NULL CHECK (memory_table IN ('team_memory_contexts', 'ai_agent_memories', 'learned_patterns')),
    granted_to_agent VARCHAR(100),
    granted_to_team UUID,
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('read', 'write', 'share', 'delete')),
    granted_by UUID,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    conditions JSONB DEFAULT '{}'
);

-- Learned patterns table for reusable insights
CREATE TABLE IF NOT EXISTS learned_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_name VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL CHECK (pattern_type IN ('solution', 'approach', 'anti_pattern', 'best_practice', 'workflow')),
    description TEXT NOT NULL,
    pattern_data JSONB NOT NULL,
    embedding VECTOR(1536),
    confidence_score FLOAT DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    usage_count INTEGER DEFAULT 0,
    success_rate FLOAT DEFAULT 0.0,
    team_id UUID NOT NULL,
    domain_tags TEXT[] DEFAULT '{}',
    applicable_contexts TEXT[] DEFAULT '{}',
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    is_validated BOOLEAN DEFAULT FALSE,
    validation_data JSONB DEFAULT '{}'
);

-- Task history memories table for historical context
CREATE TABLE IF NOT EXISTS task_history_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL,
    team_id UUID NOT NULL,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    execution_summary TEXT,
    outcome_type VARCHAR(50) CHECK (outcome_type IN ('success', 'failure', 'partial', 'cancelled')),
    lessons_learned TEXT,
    embedding VECTOR(1536),
    involved_agents TEXT[] DEFAULT '{}',
    tools_used TEXT[] DEFAULT '{}',
    duration_minutes INTEGER,
    complexity_score FLOAT,
    performance_metrics JSONB DEFAULT '{}',
    related_memories UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    is_reference BOOLEAN DEFAULT FALSE
);

-- Memory retrieval logs table for usage tracking
CREATE TABLE IF NOT EXISTS memory_retrieval_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(100) NOT NULL,
    team_id UUID NOT NULL,
    query_text TEXT,
    query_embedding VECTOR(1536),
    search_type VARCHAR(50) NOT NULL CHECK (search_type IN ('semantic', 'keyword', 'hybrid', 'contextual')),
    retrieved_memories JSONB NOT NULL,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    actual_results INTEGER,
    retrieval_time_ms INTEGER,
    was_helpful BOOLEAN,
    feedback_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id UUID
);

-- Memory consolidation jobs table
CREATE TABLE IF NOT EXISTS memory_consolidation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('merge_similar', 'archive_old', 'extract_patterns', 'cleanup_duplicates')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    parameters JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}',
    processed_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_team_memory_contexts_team_id ON team_memory_contexts(team_id);
CREATE INDEX IF NOT EXISTS idx_team_memory_contexts_type ON team_memory_contexts(context_type);
CREATE INDEX IF NOT EXISTS idx_team_memory_contexts_created_at ON team_memory_contexts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_memory_contexts_embedding ON team_memory_contexts USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_team_memory_contexts_tags ON team_memory_contexts USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_agent_id ON ai_agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_team_id ON ai_agent_memories(team_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_type ON ai_agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_importance ON ai_agent_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_embedding ON ai_agent_memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_last_accessed ON ai_agent_memories(last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_memory_sharing_permissions_memory ON memory_sharing_permissions(memory_id, memory_table);
CREATE INDEX IF NOT EXISTS idx_memory_sharing_permissions_agent ON memory_sharing_permissions(granted_to_agent);
CREATE INDEX IF NOT EXISTS idx_memory_sharing_permissions_team ON memory_sharing_permissions(granted_to_team);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_team_id ON learned_patterns(team_id);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_type ON learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_embedding ON learned_patterns USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_domain_tags ON learned_patterns USING gin(domain_tags);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_usage ON learned_patterns(usage_count DESC, success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_task_history_memories_task_id ON task_history_memories(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_memories_team_id ON task_history_memories(team_id);
CREATE INDEX IF NOT EXISTS idx_task_history_memories_embedding ON task_history_memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_task_history_memories_agents ON task_history_memories USING gin(involved_agents);
CREATE INDEX IF NOT EXISTS idx_task_history_memories_completed_at ON task_history_memories(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_retrieval_logs_agent_id ON memory_retrieval_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_retrieval_logs_team_id ON memory_retrieval_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_memory_retrieval_logs_created_at ON memory_retrieval_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_retrieval_logs_session ON memory_retrieval_logs(session_id);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION find_similar_memories(
    query_embedding VECTOR(1536),
    team_id_param UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    memory_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    memory_id UUID,
    memory_type TEXT,
    content TEXT,
    similarity_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tmc.id as memory_id,
        'team_context'::TEXT as memory_type,
        tmc.content,
        1 - (tmc.embedding <=> query_embedding) as similarity_score,
        tmc.created_at
    FROM team_memory_contexts tmc
    WHERE tmc.team_id = team_id_param
        AND tmc.is_archived = FALSE
        AND (memory_types IS NULL OR tmc.context_type = ANY(memory_types))
        AND 1 - (tmc.embedding <=> query_embedding) >= similarity_threshold
    
    UNION ALL
    
    SELECT 
        lp.id as memory_id,
        'learned_pattern'::TEXT as memory_type,
        lp.description as content,
        1 - (lp.embedding <=> query_embedding) as similarity_score,
        lp.created_at
    FROM learned_patterns lp
    WHERE lp.team_id = team_id_param
        AND (memory_types IS NULL OR lp.pattern_type = ANY(memory_types))
        AND 1 - (lp.embedding <=> query_embedding) >= similarity_threshold
    
    UNION ALL
    
    SELECT 
        thm.id as memory_id,
        'task_history'::TEXT as memory_type,
        thm.execution_summary as content,
        1 - (thm.embedding <=> query_embedding) as similarity_score,
        thm.created_at
    FROM task_history_memories thm
    WHERE thm.team_id = team_id_param
        AND (memory_types IS NULL OR thm.outcome_type = ANY(memory_types))
        AND 1 - (thm.embedding <=> query_embedding) >= similarity_threshold
    
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$;

-- Memory cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_memories()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Archive expired contexts
    UPDATE team_memory_contexts 
    SET is_archived = TRUE, archive_reason = 'Expired'
    WHERE expires_at < NOW() AND is_archived = FALSE;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Archive low-importance agent memories older than 30 days
    UPDATE ai_agent_memories 
    SET parent_memory_id = NULL -- Break references before potential deletion
    WHERE importance_score < 0.3 
        AND last_accessed < NOW() - INTERVAL '30 days'
        AND created_at < NOW() - INTERVAL '30 days';
    
    -- Clean up old retrieval logs (keep only last 90 days)
    DELETE FROM memory_retrieval_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RETURN cleaned_count;
END;
$$;

-- Memory consolidation function
CREATE OR REPLACE FUNCTION consolidate_similar_memories(
    team_id_param UUID,
    similarity_threshold FLOAT DEFAULT 0.95
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    consolidated_count INTEGER := 0;
    memory_record RECORD;
    similar_record RECORD;
BEGIN
    -- Find and merge very similar team memories
    FOR memory_record IN 
        SELECT id, embedding, content, created_at
        FROM team_memory_contexts 
        WHERE team_id = team_id_param AND is_archived = FALSE
        ORDER BY created_at DESC
    LOOP
        -- Find similar memories
        FOR similar_record IN
            SELECT id, content, created_at
            FROM team_memory_contexts
            WHERE team_id = team_id_param 
                AND id != memory_record.id
                AND is_archived = FALSE
                AND 1 - (embedding <=> memory_record.embedding) >= similarity_threshold
                AND created_at < memory_record.created_at
        LOOP
            -- Merge content and archive the older memory
            UPDATE team_memory_contexts 
            SET 
                content = content || E'\n\n--- Merged from similar memory ---\n' || similar_record.content,
                updated_at = NOW()
            WHERE id = memory_record.id;
            
            UPDATE team_memory_contexts 
            SET 
                is_archived = TRUE,
                archive_reason = 'Merged into memory: ' || memory_record.id::TEXT
            WHERE id = similar_record.id;
            
            consolidated_count := consolidated_count + 1;
        END LOOP;
    END LOOP;
    
    RETURN consolidated_count;
END;
$$;

-- RLS Policies
ALTER TABLE team_memory_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_sharing_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_retrieval_logs ENABLE ROW LEVEL SECURITY;

-- Team memory contexts policies
CREATE POLICY "Users can view team memories they have access to" ON team_memory_contexts
    FOR SELECT USING (
        access_level = 'public' OR 
        (access_level = 'team' AND team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )) OR
        created_by = auth.uid()
    );

CREATE POLICY "Users can insert team memories for their teams" ON team_memory_contexts
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own team memories" ON team_memory_contexts
    FOR UPDATE USING (
        created_by = auth.uid() OR
        team_id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- AI agent memories policies
CREATE POLICY "Service role can manage agent memories" ON ai_agent_memories
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view agent memories for their teams" ON ai_agent_memories
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Memory sharing permissions policies
CREATE POLICY "Users can view sharing permissions for accessible memories" ON memory_sharing_permissions
    FOR SELECT USING (
        granted_to_team IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        ) OR
        granted_by = auth.uid()
    );

-- Learned patterns policies
CREATE POLICY "Users can view patterns for their teams" ON learned_patterns
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage patterns" ON learned_patterns
    FOR ALL USING (auth.role() = 'service_role');

-- Task history memories policies
CREATE POLICY "Users can view task history for their teams" ON task_history_memories
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage task history" ON task_history_memories
    FOR ALL USING (auth.role() = 'service_role');

-- Memory retrieval logs policies
CREATE POLICY "Service role can manage retrieval logs" ON memory_retrieval_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view retrieval logs for their teams" ON memory_retrieval_logs
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_team_memory_contexts_updated_at BEFORE UPDATE ON team_memory_contexts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_agent_memories_updated_at BEFORE UPDATE ON ai_agent_memories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_learned_patterns_updated_at BEFORE UPDATE ON learned_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE team_memory_contexts IS 'Shared team memory contexts with vector embeddings for semantic search';
COMMENT ON TABLE ai_agent_memories IS 'Individual AI agent memories with different memory types and importance scoring';
COMMENT ON TABLE memory_sharing_permissions IS 'Access control for memory sharing between agents and teams';
COMMENT ON TABLE learned_patterns IS 'Reusable patterns and insights learned by the AI team';
COMMENT ON TABLE task_history_memories IS 'Historical task execution memories for learning and reference';
COMMENT ON TABLE memory_retrieval_logs IS 'Usage tracking and analytics for memory retrieval operations';
COMMENT ON FUNCTION find_similar_memories IS 'Vector similarity search across all memory types';
COMMENT ON FUNCTION cleanup_old_memories IS 'Maintenance function to archive expired and low-value memories';
COMMENT ON FUNCTION consolidate_similar_memories IS 'Consolidation function to merge similar memories and reduce storage overhead';
```