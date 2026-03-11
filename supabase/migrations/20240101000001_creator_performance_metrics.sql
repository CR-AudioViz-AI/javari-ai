```sql
-- Creator Performance Metrics Database Migration
-- File: supabase/migrations/20240101000001_creator_performance_metrics.sql
-- Description: Comprehensive database schema for creator performance tracking with real-time analytics optimization

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Create enum types for standardized values
CREATE TYPE metric_type AS ENUM ('view', 'like', 'share', 'comment', 'click', 'conversion', 'subscription');
CREATE TYPE platform_type AS ENUM ('youtube', 'tiktok', 'instagram', 'twitter', 'twitch', 'linkedin');
CREATE TYPE content_type AS ENUM ('video', 'image', 'story', 'reel', 'short', 'live', 'podcast', 'article');
CREATE TYPE conversion_stage AS ENUM ('impression', 'click', 'view', 'engagement', 'lead', 'conversion');
CREATE TYPE demographic_category AS ENUM ('age', 'gender', 'location', 'interest', 'device', 'language');

-- Creators table for basic creator information
CREATE TABLE IF NOT EXISTS creators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    handle VARCHAR(255) NOT NULL,
    display_name VARCHAR(500),
    email VARCHAR(255),
    platforms platform_type[] DEFAULT '{}',
    verified BOOLEAN DEFAULT FALSE,
    tier VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main creator metrics table with time-series partitioning
CREATE TABLE IF NOT EXISTS creator_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    content_id VARCHAR(255),
    content_type content_type,
    metric_type metric_type NOT NULL,
    metric_value BIGINT NOT NULL DEFAULT 0,
    metric_value_decimal DECIMAL(15,4),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('creator_metrics', 'timestamp', if_not_exists => TRUE);

-- Engagement metrics table with hourly aggregations
CREATE TABLE IF NOT EXISTS engagement_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    content_type content_type,
    hour_bucket TIMESTAMPTZ NOT NULL,
    views BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    engagement_rate DECIMAL(8,4) DEFAULT 0,
    reach BIGINT DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    avg_watch_time DECIMAL(10,2) DEFAULT 0,
    completion_rate DECIMAL(8,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('engagement_metrics', 'hour_bucket', if_not_exists => TRUE);

-- Conversion metrics table with funnel tracking
CREATE TABLE IF NOT EXISTS conversion_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    content_id VARCHAR(255),
    funnel_stage conversion_stage NOT NULL,
    campaign_id VARCHAR(255),
    conversion_count BIGINT DEFAULT 0,
    conversion_value DECIMAL(15,2) DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_url TEXT,
    target_url TEXT,
    conversion_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('conversion_metrics', 'timestamp', if_not_exists => TRUE);

-- Audience demographics table
CREATE TABLE IF NOT EXISTS audience_demographics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    demographic_type demographic_category NOT NULL,
    demographic_value VARCHAR(255) NOT NULL,
    audience_count BIGINT DEFAULT 0,
    percentage DECIMAL(8,4) DEFAULT 0,
    date_captured DATE NOT NULL DEFAULT CURRENT_DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance benchmarks table
CREATE TABLE IF NOT EXISTS performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform platform_type NOT NULL,
    content_type content_type NOT NULL,
    follower_range VARCHAR(50) NOT NULL, -- e.g., '1k-10k', '10k-100k'
    metric_type metric_type NOT NULL,
    percentile_25 DECIMAL(15,4),
    percentile_50 DECIMAL(15,4),
    percentile_75 DECIMAL(15,4),
    percentile_90 DECIMAL(15,4),
    benchmark_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sample_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time analytics cache for dashboard queries
CREATE TABLE IF NOT EXISTS real_time_analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content performance table
CREATE TABLE IF NOT EXISTS content_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    content_id VARCHAR(255) NOT NULL,
    content_type content_type NOT NULL,
    title TEXT,
    published_at TIMESTAMPTZ,
    total_views BIGINT DEFAULT 0,
    total_likes BIGINT DEFAULT 0,
    total_shares BIGINT DEFAULT 0,
    total_comments BIGINT DEFAULT 0,
    engagement_rate DECIMAL(8,4) DEFAULT 0,
    performance_score DECIMAL(8,4) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create materialized view for creator performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_performance_summary AS
SELECT 
    c.id as creator_id,
    c.handle,
    c.display_name,
    COUNT(DISTINCT cm.platform) as active_platforms,
    DATE_TRUNC('day', NOW()) as summary_date,
    
    -- Last 30 days metrics
    COALESCE(SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '30 days' AND cm.metric_type = 'view' THEN cm.metric_value END), 0) as views_30d,
    COALESCE(SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '30 days' AND cm.metric_type = 'like' THEN cm.metric_value END), 0) as likes_30d,
    COALESCE(SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '30 days' AND cm.metric_type = 'share' THEN cm.metric_value END), 0) as shares_30d,
    COALESCE(SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '30 days' AND cm.metric_type = 'comment' THEN cm.metric_value END), 0) as comments_30d,
    
    -- Last 7 days metrics
    COALESCE(SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '7 days' AND cm.metric_type = 'view' THEN cm.metric_value END), 0) as views_7d,
    COALESCE(SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '7 days' AND cm.metric_type = 'like' THEN cm.metric_value END), 0) as likes_7d,
    
    -- Growth rates (comparing last 7 days to previous 7 days)
    CASE 
        WHEN SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '14 days' AND cm.timestamp < NOW() - INTERVAL '7 days' AND cm.metric_type = 'view' THEN cm.metric_value END) > 0 
        THEN ((SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '7 days' AND cm.metric_type = 'view' THEN cm.metric_value END)::DECIMAL / 
               SUM(CASE WHEN cm.timestamp >= NOW() - INTERVAL '14 days' AND cm.timestamp < NOW() - INTERVAL '7 days' AND cm.metric_type = 'view' THEN cm.metric_value END)) - 1) * 100
        ELSE 0
    END as view_growth_rate,
    
    -- Average engagement rate
    COALESCE(AVG(CASE WHEN em.hour_bucket >= NOW() - INTERVAL '30 days' THEN em.engagement_rate END), 0) as avg_engagement_rate_30d,
    
    -- Total conversions
    COALESCE(SUM(CASE WHEN conv.timestamp >= NOW() - INTERVAL '30 days' THEN conv.conversion_count END), 0) as conversions_30d,
    COALESCE(SUM(CASE WHEN conv.timestamp >= NOW() - INTERVAL '30 days' THEN conv.conversion_value END), 0) as conversion_value_30d
    
FROM creators c
LEFT JOIN creator_metrics cm ON c.id = cm.creator_id AND cm.timestamp >= NOW() - INTERVAL '30 days'
LEFT JOIN engagement_metrics em ON c.id = em.creator_id AND em.hour_bucket >= NOW() - INTERVAL '30 days'
LEFT JOIN conversion_metrics conv ON c.id = conv.creator_id AND conv.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY c.id, c.handle, c.display_name;

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_creator_metrics_creator_timestamp ON creator_metrics (creator_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_creator_metrics_platform_type ON creator_metrics (platform, metric_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_creator_metrics_content ON creator_metrics (content_id, timestamp DESC) WHERE content_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_creator_bucket ON engagement_metrics (creator_id, hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_platform ON engagement_metrics (platform, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_metrics_creator_timestamp ON conversion_metrics (creator_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_metrics_campaign ON conversion_metrics (campaign_id, timestamp DESC) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversion_metrics_funnel ON conversion_metrics (funnel_stage, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audience_demographics_creator_date ON audience_demographics (creator_id, date_captured DESC);
CREATE INDEX IF NOT EXISTS idx_audience_demographics_type_value ON audience_demographics (demographic_type, demographic_value);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_creator_key ON real_time_analytics_cache (creator_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON real_time_analytics_cache (expires_at) WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_content_performance_creator_platform ON content_performance (creator_id, platform, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_performance_score ON content_performance (performance_score DESC);

CREATE INDEX IF NOT EXISTS idx_benchmarks_platform_content_range ON performance_benchmarks (platform, content_type, follower_range);

-- Enable Row Level Security
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for creator data isolation
CREATE POLICY "Users can view their own creator profile" ON creators
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own creator profile" ON creators
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own creator profile" ON creators
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Creators can view their own metrics" ON creator_metrics
    FOR SELECT USING (creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid()));

CREATE POLICY "System can insert metrics for any creator" ON creator_metrics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Creators can view their own engagement metrics" ON engagement_metrics
    FOR SELECT USING (creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid()));

CREATE POLICY "System can manage engagement metrics" ON engagement_metrics
    FOR ALL WITH CHECK (true);

CREATE POLICY "Creators can view their own conversion metrics" ON conversion_metrics
    FOR SELECT USING (creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid()));

CREATE POLICY "System can insert conversion metrics" ON conversion_metrics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Creators can view their own demographics" ON audience_demographics
    FOR SELECT USING (creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid()));

CREATE POLICY "System can manage demographics" ON audience_demographics
    FOR ALL WITH CHECK (true);

CREATE POLICY "Creators can view their own cache" ON real_time_analytics_cache
    FOR SELECT USING (creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid()));

CREATE POLICY "System can manage analytics cache" ON real_time_analytics_cache
    FOR ALL WITH CHECK (true);

CREATE POLICY "Creators can view their own content performance" ON content_performance
    FOR SELECT USING (creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid()));

CREATE POLICY "System can manage content performance" ON content_performance
    FOR ALL WITH CHECK (true);

-- Performance benchmarks are public (no RLS needed)

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_creators_updated_at BEFORE UPDATE ON creators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_engagement_metrics_updated_at BEFORE UPDATE ON engagement_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audience_demographics_updated_at BEFORE UPDATE ON audience_demographics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_cache_updated_at BEFORE UPDATE ON real_time_analytics_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmarks_updated_at BEFORE UPDATE ON performance_benchmarks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for real-time metric aggregation
CREATE OR REPLACE FUNCTION aggregate_engagement_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO engagement_metrics (
        creator_id, platform, content_type, hour_bucket,
        views, likes, shares, comments, clicks
    )
    VALUES (
        NEW.creator_id,
        NEW.platform,
        NEW.content_type,
        DATE_TRUNC('hour', NEW.timestamp),
        CASE WHEN NEW.metric_type = 'view' THEN NEW.metric_value ELSE 0 END,
        CASE WHEN NEW.metric_type = 'like' THEN NEW.metric_value ELSE 0 END,
        CASE WHEN NEW.metric_type = 'share' THEN NEW.metric_value ELSE 0 END,
        CASE WHEN NEW.metric_type = 'comment' THEN NEW.metric_value ELSE 0 END,
        CASE WHEN NEW.metric_type = 'click' THEN NEW.metric_value ELSE 0 END
    )
    ON CONFLICT (creator_id, platform, COALESCE(content_type, 'video'), hour_bucket)
    DO UPDATE SET
        views = engagement_metrics.views + CASE WHEN NEW.metric_type = 'view' THEN NEW.metric_value ELSE 0 END,
        likes = engagement_metrics.likes + CASE WHEN NEW.metric_type = 'like' THEN NEW.metric_value ELSE 0 END,
        shares = engagement_metrics.shares + CASE WHEN NEW.metric_type = 'share' THEN NEW.metric_value ELSE 0 END,
        comments = engagement_metrics.comments + CASE WHEN NEW.metric_type = 'comment' THEN NEW.metric_value ELSE 0 END,
        clicks = engagement_metrics.clicks + CASE WHEN NEW.metric_type = 'click' THEN NEW.metric_value ELSE 0 END,
        engagement_rate = CASE 
            WHEN (engagement_metrics.views + CASE WHEN NEW.metric_type = 'view' THEN NEW.metric_value ELSE 0 END) > 0 
            THEN ((engagement_metrics.likes + engagement_metrics.shares + engagement_metrics.comments + 
                   CASE WHEN NEW.metric_type = 'like' THEN NEW.metric_value ELSE 0 END +
                   CASE WHEN NEW.metric_type = 'share' THEN NEW.metric_value ELSE 0 END +
                   CASE WHEN NEW.metric_type = 'comment' THEN NEW.metric_value ELSE 0 END)::DECIMAL / 
                  (engagement_metrics.views + CASE WHEN NEW.metric_type = 'view' THEN NEW.metric_value ELSE 0 END)) * 100
            ELSE 0 
        END,
        updated_at = NOW();

    -- Add unique constraint for the ON CONFLICT
    ALTER TABLE engagement_metrics ADD CONSTRAINT IF NOT EXISTS 
        unique_engagement_hourly UNIQUE (creator_id, platform, content_type, hour_bucket);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for real-time aggregation
CREATE TRIGGER trigger_aggregate_engagement_metrics
    AFTER INSERT ON creator_metrics
    FOR EACH ROW
    WHEN (NEW.metric_type IN ('view', 'like', 'share', 'comment', 'click'))
    EXECUTE FUNCTION aggregate_engagement_metrics();

-- Function to calculate performance scores
CREATE OR REPLACE FUNCTION calculate_performance_score(
    p_creator_id UUID,
    p_platform platform_type,
    p_content_id VARCHAR DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
    score DECIMAL := 0;
    engagement_score DECIMAL := 0;
    reach_score DECIMAL := 0;
    conversion_score DECIMAL := 0;
BEGIN
    -- Calculate engagement score (0-40 points)
    SELECT COALESCE(AVG(engagement_rate), 0) * 0.4 INTO engagement_score
    FROM engagement_metrics 
    WHERE creator_id = p_creator_id 
      AND platform = p_platform
      AND hour_bucket >= NOW() - INTERVAL '30 days';
    
    -- Calculate reach score (0-30 points)
    SELECT COALESCE(LOG(GREATEST(SUM(views), 1)) * 3, 0) INTO reach_score
    FROM engagement_metrics 
    WHERE creator_id = p_creator_id 
      AND platform = p_platform
      AND hour_bucket >= NOW() - INTERVAL '30 days';
    
    -- Calculate conversion score (0-30 points)
    SELECT COALESCE(SUM(conversion_count) * 0.1, 0) INTO conversion_score
    FROM conversion_metrics 
    WHERE creator_id = p_creator_id 
      AND platform = p_platform
      AND timestamp >= NOW() - INTERVAL '30 days';
    
    score := LEAST(engagement_score + reach_score + conversion_score, 100);
    
    RETURN ROUND(score, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_creator_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY creator_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic refresh of materialized view (every hour)
SELECT cron.schedule('refresh-creator-summary', '0 * * * *', 'SELECT refresh_creator_performance_summary();');

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM real_time_analytics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cache cleanup (every 15 minutes)
SELECT cron.schedule('cleanup-cache', '*/15 * * * *', 'SELECT cleanup_expired_cache();');

-- Add data retention policy for old metrics (keep 2 years)
SELECT add_retention_policy('creator_metrics', INTERVAL '2 years', if_not_exists => true);
SELECT add_retention_policy('engagement_metrics', INTERVAL '2 years', if_not_exists => true);
SELECT add_retention_policy('conversion_metrics', INTERVAL '2 years', if_not_exists => true);

-- Grant necessary permissions for real-time functionality
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Enable real-time for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE creators;
ALTER PUBLICATION supabase_realtime ADD TABLE creator_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE engagement_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE real_time_analytics_cache;

COMMENT ON TABLE creators IS 'Creator profiles and basic information';
COMMENT ON TABLE creator_metrics IS 'Time-series data for all creator metrics with hypertable optimization';
COMMENT ON TABLE engagement_metrics IS 'Hourly aggregated engagement data for performance tracking';
COMMENT ON TABLE conversion_metrics IS 'Conversion funnel tracking with campaign attribution';
COMMENT ON TABLE audience_demographics IS 'Audience demographic breakdowns by platform';
COMMENT ON TABLE performance_benchmarks IS 'Industry benchmarks for performance comparison';
COMMENT ON TABLE real_time_analytics_cache IS 'Cached analytics data for dashboard performance';
COMMENT ON TABLE content_performance IS 'Individual content piece performance metrics';
COMMENT ON MATERIALIZED VIEW creator_performance_summary IS 'Aggregated performance summary for quick dashboard loading';
```