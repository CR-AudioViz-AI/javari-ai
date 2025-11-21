-- Javari App Monitoring Database Schema
-- Migration: Add monitoring tables for SDK integration

-- App Health Status Table
CREATE TABLE IF NOT EXISTS app_health_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  uptime BIGINT NOT NULL,
  response_time INTEGER,
  error_rate DECIMAL(5,4),
  active_users INTEGER,
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(5,2),
  last_check TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_app_health_app_id (app_id),
  INDEX idx_app_health_status (status),
  INDEX idx_app_health_created_at (created_at)
);

-- Error Reports Table
CREATE TABLE IF NOT EXISTS error_reports (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('error', 'warning', 'critical')),
  message TEXT NOT NULL,
  stack TEXT,
  user_id TEXT,
  route TEXT,
  user_agent TEXT,
  metadata JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  auto_fix_attempted BOOLEAN DEFAULT FALSE,
  auto_fix_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  INDEX idx_error_reports_app_id (app_id),
  INDEX idx_error_reports_level (level),
  INDEX idx_error_reports_resolved (resolved),
  INDEX idx_error_reports_created_at (created_at)
);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  route TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  page_load_time INTEGER,
  time_to_interactive INTEGER,
  first_contentful_paint INTEGER,
  largest_contentful_paint INTEGER,
  cumulative_layout_shift DECIMAL(5,4),
  first_input_delay INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_performance_app_id (app_id),
  INDEX idx_performance_route (route),
  INDEX idx_performance_device_type (device_type),
  INDEX idx_performance_created_at (created_at)
);

-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  properties JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_analytics_app_id (app_id),
  INDEX idx_analytics_event_name (event_name),
  INDEX idx_analytics_user_id (user_id),
  INDEX idx_analytics_session_id (session_id),
  INDEX idx_analytics_created_at (created_at)
);

-- Feature Requests Table
CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'planned', 'in_progress', 'completed', 'rejected')),
  votes INTEGER DEFAULT 0,
  ai_feasibility DECIMAL(3,2),
  ai_estimated_effort TEXT,
  ai_suggested_implementation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_feature_requests_app_id (app_id),
  INDEX idx_feature_requests_user_id (user_id),
  INDEX idx_feature_requests_status (status),
  INDEX idx_feature_requests_priority (priority),
  INDEX idx_feature_requests_votes (votes DESC),
  INDEX idx_feature_requests_created_at (created_at DESC)
);

-- Feature Request Votes Table
CREATE TABLE IF NOT EXISTS feature_request_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(feature_request_id, user_id),
  INDEX idx_feature_votes_request_id (feature_request_id),
  INDEX idx_feature_votes_user_id (user_id)
);

-- Auto-fix Attempts Table
CREATE TABLE IF NOT EXISTS auto_fix_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_report_id TEXT NOT NULL REFERENCES error_reports(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  fix_type TEXT NOT NULL,
  ai_analysis JSONB,
  suggested_fix TEXT,
  applied BOOLEAN DEFAULT FALSE,
  success BOOLEAN,
  result_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  INDEX idx_auto_fix_error_id (error_report_id),
  INDEX idx_auto_fix_app_id (app_id),
  INDEX idx_auto_fix_success (success),
  INDEX idx_auto_fix_created_at (created_at)
);

-- Enable Row Level Security
ALTER TABLE app_health_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_request_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_fix_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow service role full access)
CREATE POLICY "Service role can do everything on app_health_status" 
  ON app_health_status FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on error_reports" 
  ON error_reports FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on performance_metrics" 
  ON performance_metrics FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on analytics_events" 
  ON analytics_events FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on feature_requests" 
  ON feature_requests FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on feature_request_votes" 
  ON feature_request_votes FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on auto_fix_attempts" 
  ON auto_fix_attempts FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for feature_requests updated_at
CREATE TRIGGER update_feature_requests_updated_at
  BEFORE UPDATE ON feature_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON app_health_status TO service_role;
GRANT ALL ON error_reports TO service_role;
GRANT ALL ON performance_metrics TO service_role;
GRANT ALL ON analytics_events TO service_role;
GRANT ALL ON feature_requests TO service_role;
GRANT ALL ON feature_request_votes TO service_role;
GRANT ALL ON auto_fix_attempts TO service_role;
