```sql
-- Migration: Community Health Metrics Database
-- Created: 2024-12-01
-- Description: Comprehensive community health tracking with engagement rates, growth patterns, and satisfaction metrics

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create enum types for better data integrity
CREATE TYPE engagement_type AS ENUM (
    'post_created', 'comment_added', 'like_given', 'share_made',
    'profile_viewed', 'message_sent', 'event_attended', 'group_joined',
    'content_consumed', 'reaction_added'
);

CREATE TYPE satisfaction_scale AS ENUM (
    'very_dissatisfied', 'dissatisfied', 'neutral', 'satisfied', 'very_satisfied'
);

CREATE TYPE health_metric_type AS ENUM (
    'engagement_rate', 'growth_rate', 'retention_rate', 'satisfaction_score',
    'activity_index', 'churn_risk', 'virality_coefficient', 'time_to_value'
);

CREATE TYPE cohort_period AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');

-- Health Metric Definitions Table
CREATE TABLE IF NOT EXISTS health_metric_definitions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type health_metric_type NOT NULL,
    description TEXT,
    calculation_method TEXT NOT NULL,
    target_value DECIMAL(10,4),
    warning_threshold DECIMAL(10,4),
    critical_threshold DECIMAL(10,4),
    unit VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Community Health Metrics (Main hypertable)
CREATE TABLE IF NOT EXISTS community_health_metrics (
    id UUID DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL,
    metric_definition_id UUID NOT NULL REFERENCES health_metric_definitions(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    value DECIMAL(12,4) NOT NULL,
    trend_direction INTEGER CHECK (trend_direction IN (-1, 0, 1)), -- -1: down, 0: stable, 1: up
    period_type VARCHAR(20) DEFAULT 'hourly', -- hourly, daily, weekly, monthly
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, recorded_at)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('community_health_metrics', 'recorded_at', chunk_time_interval => INTERVAL '1 day');

-- Engagement Events Table
CREATE TABLE IF NOT EXISTS engagement_events (
    id UUID DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL,
    user_id UUID NOT NULL,
    event_type engagement_type NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id UUID,
    content_id UUID,
    content_type VARCHAR(50),
    engagement_value DECIMAL(8,4) DEFAULT 1.0,
    device_type VARCHAR(20),
    source_platform VARCHAR(30),
    geo_location JSONB,
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (id, occurred_at)
);

-- Convert to hypertable
SELECT create_hypertable('engagement_events', 'occurred_at', chunk_time_interval => INTERVAL '1 day');

-- Satisfaction Surveys Table
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    community_id UUID NOT NULL,
    user_id UUID NOT NULL,
    survey_type VARCHAR(50) NOT NULL,
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
    satisfaction_level satisfaction_scale,
    feedback_text TEXT,
    response_time_seconds INTEGER,
    survey_version VARCHAR(10),
    completion_rate DECIMAL(5,2),
    submitted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Growth Cohorts Table
CREATE TABLE IF NOT EXISTS growth_cohorts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    community_id UUID NOT NULL,
    cohort_start_date DATE NOT NULL,
    period_type cohort_period NOT NULL,
    initial_user_count INTEGER NOT NULL DEFAULT 0,
    current_active_users INTEGER DEFAULT 0,
    retention_rate DECIMAL(5,2),
    growth_rate DECIMAL(8,4),
    churn_count INTEGER DEFAULT 0,
    revenue_per_user DECIMAL(10,2),
    lifetime_value DECIMAL(12,2),
    calculated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(community_id, cohort_start_date, period_type)
);

-- User Activity Snapshots for trend analysis
CREATE TABLE IF NOT EXISTS user_activity_snapshots (
    id UUID DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL,
    user_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    total_engagements INTEGER DEFAULT 0,
    unique_engagement_types INTEGER DEFAULT 0,
    session_duration_minutes INTEGER DEFAULT 0,
    content_created INTEGER DEFAULT 0,
    social_interactions INTEGER DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    risk_score DECIMAL(5,4) DEFAULT 0,
    activity_trend INTEGER DEFAULT 0,
    PRIMARY KEY (id, snapshot_date)
);

SELECT create_hypertable('user_activity_snapshots', 'snapshot_date', chunk_time_interval => INTERVAL '7 days');

-- Materialized view for real-time engagement metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS engagement_metrics_hourly AS
SELECT 
    community_id,
    date_trunc('hour', occurred_at) as hour_bucket,
    COUNT(*) as total_events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT event_type) as event_variety,
    AVG(engagement_value) as avg_engagement_value,
    SUM(CASE WHEN event_type IN ('post_created', 'comment_added') THEN 1 ELSE 0 END) as content_creation_events,
    SUM(CASE WHEN event_type IN ('like_given', 'share_made', 'reaction_added') THEN 1 ELSE 0 END) as social_interaction_events
FROM engagement_events 
GROUP BY community_id, date_trunc('hour', occurred_at);

-- Materialized view for satisfaction trends
CREATE MATERIALIZED VIEW IF NOT EXISTS satisfaction_trends AS
SELECT 
    community_id,
    date_trunc('week', submitted_at) as week_bucket,
    COUNT(*) as response_count,
    AVG(nps_score::numeric) as avg_nps,
    COUNT(CASE WHEN nps_score >= 9 THEN 1 END)::decimal / COUNT(*) * 100 as promoter_percentage,
    COUNT(CASE WHEN nps_score <= 6 THEN 1 END)::decimal / COUNT(*) * 100 as detractor_percentage,
    AVG(completion_rate) as avg_completion_rate
FROM satisfaction_surveys 
WHERE nps_score IS NOT NULL
GROUP BY community_id, date_trunc('week', submitted_at);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_health_metrics_community_time ON community_health_metrics (community_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_type_time ON community_health_metrics (metric_definition_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_events_community_time ON engagement_events (community_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_events_user_time ON engagement_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_events_type ON engagement_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_satisfaction_community_time ON satisfaction_surveys (community_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cohorts_community_date ON growth_cohorts (community_id, cohort_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_snapshots_community_date ON user_activity_snapshots (community_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_snapshots_user_date ON user_activity_snapshots (user_id, snapshot_date DESC);

-- GIN indexes for JSONB metadata
CREATE INDEX IF NOT EXISTS idx_health_metrics_metadata_gin ON community_health_metrics USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_engagement_metadata_gin ON engagement_events USING gin(metadata);

-- Unique indexes for materialized views
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_hourly_unique ON engagement_metrics_hourly (community_id, hour_bucket);
CREATE UNIQUE INDEX IF NOT EXISTS idx_satisfaction_trends_unique ON satisfaction_trends (community_id, week_bucket);

-- Enable Row Level Security
ALTER TABLE health_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their community metrics" ON community_health_metrics
    FOR SELECT USING (
        community_id IN (
            SELECT community_id FROM user_communities 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Community admins can manage health metrics" ON community_health_metrics
    FOR ALL USING (
        community_id IN (
            SELECT community_id FROM user_communities 
            WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

CREATE POLICY "Users can view engagement events for their communities" ON engagement_events
    FOR SELECT USING (
        community_id IN (
            SELECT community_id FROM user_communities 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own engagement events" ON engagement_events
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view satisfaction data for their communities" ON satisfaction_surveys
    FOR SELECT USING (
        community_id IN (
            SELECT community_id FROM user_communities 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can submit satisfaction surveys" ON satisfaction_surveys
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Community members can view cohort data" ON growth_cohorts
    FOR SELECT USING (
        community_id IN (
            SELECT community_id FROM user_communities 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view activity snapshots for their communities" ON user_activity_snapshots
    FOR SELECT USING (
        community_id IN (
            SELECT community_id FROM user_communities 
            WHERE user_id = auth.uid()
        )
    );

-- Insert default health metric definitions
INSERT INTO health_metric_definitions (name, type, description, calculation_method, target_value, warning_threshold, critical_threshold, unit) VALUES
('Daily Active Users', 'engagement_rate', 'Number of unique users active per day', 'COUNT(DISTINCT user_id) per day', 1000, 800, 500, 'users'),
('Weekly Engagement Rate', 'engagement_rate', 'Percentage of users who engage weekly', '(weekly_active_users / total_users) * 100', 75.0, 60.0, 40.0, 'percentage'),
('Net Promoter Score', 'satisfaction_score', 'Overall customer satisfaction metric', '(% promoters - % detractors)', 50.0, 30.0, 10.0, 'score'),
('User Retention Rate', 'retention_rate', 'Percentage of users retained after 30 days', '(retained_users / new_users) * 100', 80.0, 60.0, 40.0, 'percentage'),
('Monthly Growth Rate', 'growth_rate', 'Month-over-month user growth', '((current_users - previous_users) / previous_users) * 100', 10.0, 5.0, 0.0, 'percentage'),
('Average Session Duration', 'activity_index', 'Average time spent per session', 'AVG(session_duration_minutes)', 15.0, 10.0, 5.0, 'minutes'),
('Content Creation Rate', 'engagement_rate', 'Average posts per active user per day', 'total_posts / active_users', 2.0, 1.0, 0.5, 'posts'),
('Community Virality Coefficient', 'virality_coefficient', 'Rate of organic user acquisition', 'invited_users / existing_users', 0.5, 0.3, 0.1, 'coefficient')
ON CONFLICT (name) DO NOTHING;

-- Functions for automated calculations

-- Function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(p_community_id UUID, p_period INTERVAL DEFAULT '1 day'::INTERVAL)
RETURNS DECIMAL AS $$
DECLARE
    total_users INTEGER;
    active_users INTEGER;
    engagement_rate DECIMAL;
BEGIN
    -- Get total users in community
    SELECT COUNT(*) INTO total_users
    FROM user_communities 
    WHERE community_id = p_community_id;
    
    -- Get active users in period
    SELECT COUNT(DISTINCT user_id) INTO active_users
    FROM engagement_events 
    WHERE community_id = p_community_id 
    AND occurred_at >= now() - p_period;
    
    IF total_users > 0 THEN
        engagement_rate := (active_users::DECIMAL / total_users::DECIMAL) * 100;
    ELSE
        engagement_rate := 0;
    END IF;
    
    RETURN engagement_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate NPS
CREATE OR REPLACE FUNCTION calculate_nps(p_community_id UUID, p_period INTERVAL DEFAULT '30 days'::INTERVAL)
RETURNS DECIMAL AS $$
DECLARE
    total_responses INTEGER;
    promoters INTEGER;
    detractors INTEGER;
    nps_score DECIMAL;
BEGIN
    SELECT COUNT(*) INTO total_responses
    FROM satisfaction_surveys 
    WHERE community_id = p_community_id 
    AND submitted_at >= now() - p_period
    AND nps_score IS NOT NULL;
    
    SELECT COUNT(*) INTO promoters
    FROM satisfaction_surveys 
    WHERE community_id = p_community_id 
    AND submitted_at >= now() - p_period
    AND nps_score >= 9;
    
    SELECT COUNT(*) INTO detractors
    FROM satisfaction_surveys 
    WHERE community_id = p_community_id 
    AND submitted_at >= now() - p_period
    AND nps_score <= 6;
    
    IF total_responses > 0 THEN
        nps_score := ((promoters::DECIMAL - detractors::DECIMAL) / total_responses::DECIMAL) * 100;
    ELSE
        nps_score := 0;
    END IF;
    
    RETURN nps_score;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_health_metrics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY engagement_metrics_hourly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY satisfaction_trends;
END;
$$ LANGUAGE plpgsql;

-- Schedule automated tasks with pg_cron
SELECT cron.schedule('refresh-health-metrics', '0 * * * *', 'SELECT refresh_health_metrics_views();');
SELECT cron.schedule('calculate-daily-metrics', '0 1 * * *', 'SELECT calculate_and_store_daily_metrics();');

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_health_metric_definitions_updated_at
    BEFORE UPDATE ON health_metric_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE health_metric_definitions IS 'Defines available health metrics and their calculation parameters';
COMMENT ON TABLE community_health_metrics IS 'Time-series storage for calculated community health metrics';
COMMENT ON TABLE engagement_events IS 'Raw engagement event data for detailed analysis';
COMMENT ON TABLE satisfaction_surveys IS 'User satisfaction surveys and NPS data';
COMMENT ON TABLE growth_cohorts IS 'Cohort analysis data for tracking user retention and growth patterns';
COMMENT ON TABLE user_activity_snapshots IS 'Daily snapshots of user activity for trend analysis';

-- Grant permissions for service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
```