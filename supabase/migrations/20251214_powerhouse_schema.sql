-- =============================================================================
-- JAVARI AI - POWERHOUSE DATABASE SCHEMA
-- =============================================================================
-- Tables for autonomous learning, intelligence caching, and analytics
-- Production Ready - Sunday, December 14, 2025
-- =============================================================================

-- ============ INTELLIGENCE CACHE ============
-- Caches external API responses to reduce costs and improve speed

CREATE TABLE IF NOT EXISTS intelligence_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    cached_data JSONB NOT NULL,
    action_type TEXT NOT NULL,
    hit_count INTEGER DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_cache_key ON intelligence_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_intelligence_cache_expires ON intelligence_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_intelligence_cache_action ON intelligence_cache(action_type);

-- ============ INTELLIGENCE QUERIES ============
-- Logs all external data queries for analytics

CREATE TABLE IF NOT EXISTS intelligence_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    query TEXT,
    params JSONB,
    user_id UUID,
    session_id TEXT,
    source TEXT,
    success BOOLEAN DEFAULT true,
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_queries_action ON intelligence_queries(action);
CREATE INDEX IF NOT EXISTS idx_intelligence_queries_user ON intelligence_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_queries_created ON intelligence_queries(created_at DESC);

-- ============ CHAT LOGS ============
-- Comprehensive chat logging for learning

CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id TEXT,
    source_app TEXT DEFAULT 'javariai.com',
    user_message TEXT NOT NULL,
    assistant_response TEXT NOT NULL,
    intent_detected TEXT,
    intent_confidence DECIMAL(3,2),
    model_used TEXT NOT NULL,
    provider_used TEXT NOT NULL,
    tokens_used INTEGER,
    response_time_ms INTEGER,
    enriched_data BOOLEAN DEFAULT false,
    user_feedback TEXT CHECK (user_feedback IN ('positive', 'negative', 'neutral')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_logs_user ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_intent ON chat_logs(intent_detected);
CREATE INDEX IF NOT EXISTS idx_chat_logs_model ON chat_logs(model_used);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at DESC);

-- ============ AUTONOMOUS DECISIONS ============
-- Records all autonomous decisions made by Javari

CREATE TABLE IF NOT EXISTS autonomous_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_type TEXT NOT NULL,
    action_taken TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    reasoning TEXT,
    context JSONB,
    outcome TEXT CHECK (outcome IN ('success', 'partial', 'failure', 'pending')),
    impact TEXT CHECK (impact IN ('high', 'medium', 'low')),
    user_id UUID,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_type ON autonomous_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_outcome ON autonomous_decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_created ON autonomous_decisions(created_at DESC);

-- ============ API PROVIDER STATS ============
-- Tracks performance of external API providers

CREATE TABLE IF NOT EXISTS api_provider_stats (
    provider_name TEXT PRIMARY KEY,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(10,2) DEFAULT 0,
    total_cost_usd DECIMAL(10,4) DEFAULT 0,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ INTENT PATTERNS ============
-- Learned patterns for intent detection

CREATE TABLE IF NOT EXISTS intent_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent TEXT NOT NULL,
    pattern TEXT NOT NULL,
    pattern_type TEXT CHECK (pattern_type IN ('regex', 'keyword', 'phrase', 'context')),
    confidence_boost DECIMAL(3,2) DEFAULT 0.1,
    hit_count INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    learned_from TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_patterns_intent ON intent_patterns(intent);
CREATE INDEX IF NOT EXISTS idx_intent_patterns_active ON intent_patterns(is_active);

-- ============ USER PREFERENCES ============
-- Learned user preferences for personalization

CREATE TABLE IF NOT EXISTS user_preferences_learned (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 0.5,
    source TEXT,
    interaction_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences_learned(user_id);

-- ============ DAILY ANALYTICS ============
-- Aggregated daily statistics

CREATE TABLE IF NOT EXISTS daily_analytics (
    date DATE PRIMARY KEY,
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    total_cost_usd DECIMAL(10,2) DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    avg_satisfaction DECIMAL(3,2),
    top_intents JSONB,
    top_models JSONB,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ FUNCTIONS ============

-- Function to update cache hit count
CREATE OR REPLACE FUNCTION increment_cache_hits(p_cache_key TEXT)
RETURNS void AS $$
BEGIN
    UPDATE intelligence_cache 
    SET hit_count = hit_count + 1,
        updated_at = NOW()
    WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;

-- Function to update API provider stats
CREATE OR REPLACE FUNCTION update_api_provider_stats(
    p_provider TEXT,
    p_success BOOLEAN,
    p_latency_ms INTEGER,
    p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO api_provider_stats (provider_name, total_requests, successful_requests, failed_requests, avg_latency_ms, last_error, last_error_at, last_success_at)
    VALUES (p_provider, 1, 
            CASE WHEN p_success THEN 1 ELSE 0 END,
            CASE WHEN p_success THEN 0 ELSE 1 END,
            p_latency_ms,
            CASE WHEN NOT p_success THEN p_error ELSE NULL END,
            CASE WHEN NOT p_success THEN NOW() ELSE NULL END,
            CASE WHEN p_success THEN NOW() ELSE NULL END)
    ON CONFLICT (provider_name) DO UPDATE SET
        total_requests = api_provider_stats.total_requests + 1,
        successful_requests = api_provider_stats.successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_requests = api_provider_stats.failed_requests + CASE WHEN p_success THEN 0 ELSE 1 END,
        avg_latency_ms = (api_provider_stats.avg_latency_ms * api_provider_stats.total_requests + p_latency_ms) / (api_provider_stats.total_requests + 1),
        last_error = CASE WHEN NOT p_success THEN p_error ELSE api_provider_stats.last_error END,
        last_error_at = CASE WHEN NOT p_success THEN NOW() ELSE api_provider_stats.last_error_at END,
        last_success_at = CASE WHEN p_success THEN NOW() ELSE api_provider_stats.last_success_at END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM intelligence_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============ ROW LEVEL SECURITY ============

ALTER TABLE intelligence_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_provider_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences_learned ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access - cache" ON intelligence_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - queries" ON intelligence_queries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - chat_logs" ON chat_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - decisions" ON autonomous_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - api_stats" ON api_provider_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - patterns" ON intent_patterns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - prefs" ON user_preferences_learned FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - analytics" ON daily_analytics FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON intelligence_cache TO anon, authenticated, service_role;
GRANT ALL ON intelligence_queries TO anon, authenticated, service_role;
GRANT ALL ON chat_logs TO anon, authenticated, service_role;
GRANT ALL ON autonomous_decisions TO anon, authenticated, service_role;
GRANT ALL ON api_provider_stats TO anon, authenticated, service_role;
GRANT ALL ON intent_patterns TO anon, authenticated, service_role;
GRANT ALL ON user_preferences_learned TO anon, authenticated, service_role;
GRANT ALL ON daily_analytics TO anon, authenticated, service_role;

-- ============ VIEWS ============

-- View for model performance overview
CREATE OR REPLACE VIEW model_performance_overview AS
SELECT 
    model_used,
    provider_used,
    COUNT(*) as total_uses,
    AVG(response_time_ms)::INTEGER as avg_response_time,
    AVG(tokens_used)::INTEGER as avg_tokens,
    COUNT(CASE WHEN user_feedback = 'positive' THEN 1 END)::DECIMAL / NULLIF(COUNT(user_feedback), 0) * 100 as satisfaction_rate,
    MAX(created_at) as last_used
FROM chat_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY model_used, provider_used
ORDER BY total_uses DESC;

-- View for intent distribution
CREATE OR REPLACE VIEW intent_distribution AS
SELECT 
    intent_detected,
    COUNT(*) as count,
    AVG(intent_confidence) as avg_confidence,
    AVG(response_time_ms)::INTEGER as avg_response_time,
    COUNT(CASE WHEN user_feedback = 'positive' THEN 1 END) as positive_feedback,
    COUNT(CASE WHEN user_feedback = 'negative' THEN 1 END) as negative_feedback
FROM chat_logs
WHERE created_at > NOW() - INTERVAL '7 days'
  AND intent_detected IS NOT NULL
GROUP BY intent_detected
ORDER BY count DESC;

-- View for API provider health
CREATE OR REPLACE VIEW api_provider_health AS
SELECT 
    provider_name,
    total_requests,
    successful_requests,
    ROUND(successful_requests::DECIMAL / NULLIF(total_requests, 0) * 100, 2) as success_rate,
    ROUND(avg_latency_ms::NUMERIC, 0) as avg_latency_ms,
    last_success_at,
    last_error_at,
    last_error,
    CASE 
        WHEN last_error_at > last_success_at THEN 'unhealthy'
        WHEN avg_latency_ms > 5000 THEN 'degraded'
        WHEN successful_requests::DECIMAL / NULLIF(total_requests, 0) < 0.95 THEN 'degraded'
        ELSE 'healthy'
    END as status
FROM api_provider_stats
ORDER BY total_requests DESC;

-- ============ DONE ============
-- Powerhouse schema ready for deployment
