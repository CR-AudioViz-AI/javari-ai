```sql
-- Community Reputation System Migration
-- Created: 2024-03-15
-- Description: Comprehensive reputation system with scoring, trust levels, privileges, and decay mechanisms

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Trust Levels Configuration
CREATE TABLE IF NOT EXISTS trust_levels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    min_reputation INTEGER NOT NULL DEFAULT 0,
    max_reputation INTEGER,
    description TEXT,
    color_code VARCHAR(7) DEFAULT '#6B7280',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_reputation_range CHECK (
        min_reputation >= 0 AND 
        (max_reputation IS NULL OR max_reputation > min_reputation)
    )
);

-- Create unique index on reputation ranges to prevent overlaps
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_levels_reputation_range 
ON trust_levels (min_reputation, COALESCE(max_reputation, 2147483647));

-- User Reputation Scores
CREATE TABLE IF NOT EXISTS reputation_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    current_score INTEGER NOT NULL DEFAULT 0,
    lifetime_score INTEGER NOT NULL DEFAULT 0,
    trust_level_id INTEGER REFERENCES trust_levels(id),
    last_decay_at TIMESTAMPTZ DEFAULT NOW(),
    score_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT positive_lifetime_score CHECK (lifetime_score >= 0),
    CONSTRAINT valid_current_score CHECK (current_score >= -1000)
);

-- Ensure one reputation record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_reputation_scores_user_id 
ON reputation_scores (user_id);

-- Reputation Events for Score Tracking
CREATE TABLE IF NOT EXISTS reputation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    score_change INTEGER NOT NULL,
    source_type VARCHAR(50),
    source_id UUID,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_score_change CHECK (score_change BETWEEN -100 AND 100)
);

-- Index for efficient event querying
CREATE INDEX IF NOT EXISTS idx_reputation_events_user_processed 
ON reputation_events (user_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reputation_events_source 
ON reputation_events (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_reputation_events_type_date 
ON reputation_events (event_type, created_at DESC);

-- User Privileges Based on Trust Level
CREATE TABLE IF NOT EXISTS user_privileges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    privilege_name VARCHAR(100) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by_trust_level INTEGER REFERENCES trust_levels(id),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_expiration CHECK (expires_at IS NULL OR expires_at > granted_at)
);

-- Efficient privilege lookups
CREATE INDEX IF NOT EXISTS idx_user_privileges_user_active 
ON user_privileges (user_id, is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_privileges_name_active 
ON user_privileges (privilege_name, is_active);

-- Reputation Decay Configuration
CREATE TABLE IF NOT EXISTS reputation_decay_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    decay_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0100,
    min_score_threshold INTEGER DEFAULT 10,
    max_score_threshold INTEGER,
    decay_interval INTERVAL DEFAULT '7 days',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_decay_rate CHECK (decay_rate BETWEEN 0 AND 1),
    CONSTRAINT valid_thresholds CHECK (
        min_score_threshold >= 0 AND 
        (max_score_threshold IS NULL OR max_score_threshold > min_score_threshold)
    )
);

-- Privilege Definitions
CREATE TABLE IF NOT EXISTS privilege_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    required_trust_level INTEGER REFERENCES trust_levels(id),
    is_system_privilege BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reputation Score Calculation Function
CREATE OR REPLACE FUNCTION calculate_reputation_score(p_user_id UUID)
RETURNS TABLE(new_score INTEGER, trust_level_id INTEGER) AS $$
DECLARE
    v_current_score INTEGER := 0;
    v_trust_level_id INTEGER;
BEGIN
    -- Calculate total score from events
    SELECT COALESCE(SUM(score_change), 0)
    INTO v_current_score
    FROM reputation_events
    WHERE user_id = p_user_id;
    
    -- Determine trust level
    SELECT tl.id
    INTO v_trust_level_id
    FROM trust_levels tl
    WHERE v_current_score >= tl.min_reputation
      AND (tl.max_reputation IS NULL OR v_current_score <= tl.max_reputation)
    ORDER BY tl.min_reputation DESC
    LIMIT 1;
    
    RETURN QUERY SELECT v_current_score, v_trust_level_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Reputation Score Function
CREATE OR REPLACE FUNCTION update_reputation_score(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_calc_result RECORD;
    v_old_trust_level INTEGER;
BEGIN
    -- Get calculation results
    SELECT * INTO v_calc_result
    FROM calculate_reputation_score(p_user_id);
    
    -- Get current trust level
    SELECT trust_level_id INTO v_old_trust_level
    FROM reputation_scores
    WHERE user_id = p_user_id;
    
    -- Update or insert reputation score
    INSERT INTO reputation_scores (
        user_id, 
        current_score, 
        lifetime_score, 
        trust_level_id,
        updated_at
    )
    VALUES (
        p_user_id,
        v_calc_result.new_score,
        GREATEST(v_calc_result.new_score, 0),
        v_calc_result.trust_level_id,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        current_score = v_calc_result.new_score,
        lifetime_score = GREATEST(reputation_scores.lifetime_score, v_calc_result.new_score),
        trust_level_id = v_calc_result.trust_level_id,
        updated_at = NOW();
    
    -- Update privileges if trust level changed
    IF v_old_trust_level IS DISTINCT FROM v_calc_result.trust_level_id THEN
        PERFORM update_user_privileges(p_user_id, v_calc_result.trust_level_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update User Privileges Function
CREATE OR REPLACE FUNCTION update_user_privileges(
    p_user_id UUID,
    p_new_trust_level_id INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Deactivate all current privileges
    UPDATE user_privileges
    SET is_active = FALSE
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    -- Grant new privileges based on trust level
    INSERT INTO user_privileges (user_id, privilege_name, granted_by_trust_level)
    SELECT 
        p_user_id,
        pd.name,
        p_new_trust_level_id
    FROM privilege_definitions pd
    WHERE pd.required_trust_level <= p_new_trust_level_id
    ON CONFLICT (user_id, privilege_name) DO UPDATE SET
        is_active = TRUE,
        granted_by_trust_level = p_new_trust_level_id,
        granted_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Reputation Decay Function
CREATE OR REPLACE FUNCTION apply_reputation_decay()
RETURNS INTEGER AS $$
DECLARE
    v_config RECORD;
    v_affected_count INTEGER := 0;
    v_user RECORD;
BEGIN
    -- Get active decay configuration
    SELECT * INTO v_config
    FROM reputation_decay_config
    WHERE is_active = TRUE
    ORDER BY id
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Apply decay to eligible users
    FOR v_user IN
        SELECT user_id, current_score
        FROM reputation_scores
        WHERE current_score >= v_config.min_score_threshold
          AND (v_config.max_score_threshold IS NULL OR current_score <= v_config.max_score_threshold)
          AND last_decay_at <= NOW() - v_config.decay_interval
    LOOP
        -- Insert decay event
        INSERT INTO reputation_events (
            user_id,
            event_type,
            score_change,
            source_type,
            metadata
        )
        VALUES (
            v_user.user_id,
            'reputation_decay',
            -CEIL(v_user.current_score * v_config.decay_rate),
            'system',
            jsonb_build_object('decay_rate', v_config.decay_rate, 'config_id', v_config.id)
        );
        
        -- Update last decay timestamp
        UPDATE reputation_scores
        SET last_decay_at = NOW()
        WHERE user_id = v_user.user_id;
        
        -- Recalculate reputation
        PERFORM update_reputation_score(v_user.user_id);
        
        v_affected_count := v_affected_count + 1;
    END LOOP;
    
    RETURN v_affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic reputation updates
CREATE OR REPLACE FUNCTION trigger_update_reputation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_reputation_score(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on reputation events
DROP TRIGGER IF EXISTS tr_reputation_events_update ON reputation_events;
CREATE TRIGGER tr_reputation_events_update
    AFTER INSERT ON reputation_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_reputation();

-- Insert Default Trust Levels
INSERT INTO trust_levels (name, min_reputation, max_reputation, description, color_code, sort_order)
VALUES 
    ('New User', 0, 99, 'New community members', '#9CA3AF', 1),
    ('Basic Member', 100, 499, 'Established community participation', '#3B82F6', 2),
    ('Trusted Member', 500, 1499, 'Trusted community contributor', '#10B981', 3),
    ('Expert Member', 1500, 4999, 'Expert level contributions', '#F59E0B', 4),
    ('Community Leader', 5000, NULL, 'Exceptional community leadership', '#8B5CF6', 5)
ON CONFLICT (name) DO NOTHING;

-- Insert Default Privilege Definitions
INSERT INTO privilege_definitions (name, description, required_trust_level)
VALUES 
    ('create_comments', 'Can create comments on content', 1),
    ('edit_own_content', 'Can edit own uploaded content', 1),
    ('report_content', 'Can report inappropriate content', 2),
    ('moderate_comments', 'Can moderate community comments', 4),
    ('feature_content', 'Can feature exceptional content', 5),
    ('manage_users', 'Can manage user accounts', 5)
ON CONFLICT (name) DO NOTHING;

-- Insert Default Decay Configuration
INSERT INTO reputation_decay_config (name, decay_rate, min_score_threshold, decay_interval)
VALUES ('default_decay', 0.02, 100, '14 days'::interval)
ON CONFLICT (name) DO NOTHING;

-- Schedule reputation decay job (runs weekly)
SELECT cron.schedule(
    'reputation-decay',
    '0 2 * * 0',
    'SELECT apply_reputation_decay();'
);

-- Row Level Security Policies

-- Reputation Scores - Users can read their own, admins can read all
ALTER TABLE reputation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reputation" ON reputation_scores
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM user_privileges up
            WHERE up.user_id = auth.uid()
            AND up.privilege_name = 'manage_users'
            AND up.is_active = TRUE
        )
    );

CREATE POLICY "System can update reputation" ON reputation_scores
    FOR ALL USING (auth.role() = 'service_role');

-- Reputation Events - Users can read their own events
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reputation events" ON reputation_events
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM user_privileges up
            WHERE up.user_id = auth.uid()
            AND up.privilege_name = 'manage_users'
            AND up.is_active = TRUE
        )
    );

-- User Privileges - Users can read their own privileges
ALTER TABLE user_privileges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own privileges" ON user_privileges
    FOR SELECT USING (auth.uid() = user_id);

-- Trust Levels - Public read access
ALTER TABLE trust_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trust levels are publicly readable" ON trust_levels
    FOR SELECT USING (true);

-- Privilege Definitions - Public read access
ALTER TABLE privilege_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privilege definitions are publicly readable" ON privilege_definitions
    FOR SELECT USING (true);

-- Reputation Decay Config - Admin only
ALTER TABLE reputation_decay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access decay config" ON reputation_decay_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_privileges up
            WHERE up.user_id = auth.uid()
            AND up.privilege_name = 'manage_users'
            AND up.is_active = TRUE
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reputation_scores_trust_level 
ON reputation_scores (trust_level_id);

CREATE INDEX IF NOT EXISTS idx_reputation_scores_score_desc 
ON reputation_scores (current_score DESC);

CREATE INDEX IF NOT EXISTS idx_reputation_scores_last_decay 
ON reputation_scores (last_decay_at);

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers
CREATE TRIGGER tr_reputation_scores_updated_at
    BEFORE UPDATE ON reputation_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_trust_levels_updated_at
    BEFORE UPDATE ON trust_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_reputation_decay_config_updated_at
    BEFORE UPDATE ON reputation_decay_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```