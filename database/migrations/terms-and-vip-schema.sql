-- =============================================================================
-- JAVARI AI - TERMS ACCEPTANCE & DELIVERY TRACKING
-- =============================================================================
-- Database schema for user responsibility and delivery system
-- Production Ready - Tuesday, December 16, 2025 - 11:35 PM EST
-- =============================================================================

-- Terms Acceptance Table
CREATE TABLE IF NOT EXISTS terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, version)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user_version 
ON terms_acceptance(user_id, version);

-- Enable RLS
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Users can only see their own acceptance records
CREATE POLICY "Users can view own terms acceptance" ON terms_acceptance
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own acceptance
CREATE POLICY "Users can accept terms" ON terms_acceptance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- VIP USERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS vip_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  access_level VARCHAR(20) NOT NULL DEFAULT 'standard',
  permissions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Roy and Cindy as VIPs
INSERT INTO vip_users (email, name, role, access_level, permissions) VALUES
  ('royhenderson@craudiovizai.com', 'Roy Henderson', 'CEO & Co-Founder', 'unlimited', 
   '["unlimited_requests", "all_ai_providers", "priority_processing", "no_restrictions", "full_delivery_mode", "admin_access", "bypass_content_filters", "unlimited_tokens", "all_tools_access", "autonomous_build"]'::jsonb),
  ('cindyhenderson@craudiovizai.com', 'Cindy Henderson', 'CMO & Co-Founder', 'unlimited',
   '["unlimited_requests", "all_ai_providers", "priority_processing", "no_restrictions", "full_delivery_mode", "admin_access", "bypass_content_filters", "unlimited_tokens", "all_tools_access", "autonomous_build"]'::jsonb)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  access_level = EXCLUDED.access_level,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- RLS for VIP users table
ALTER TABLE vip_users ENABLE ROW LEVEL SECURITY;

-- Only service role can manage VIP users
CREATE POLICY "Service role full access to vip_users" ON vip_users
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- DELIVERY ATTEMPTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  task TEXT NOT NULL,
  config JSONB,
  vip_level VARCHAR(20),
  attempts JSONB DEFAULT '[]'::jsonb,
  success BOOLEAN,
  delivered BOOLEAN,
  final_result JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  tokens_used INTEGER,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_user 
ON delivery_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_success 
ON delivery_attempts(success, created_at DESC);

-- =============================================================================
-- AI PROVIDER USAGE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  request_type VARCHAR(50),
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_cents INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for usage analytics
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_provider 
ON ai_provider_usage(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_user 
ON ai_provider_usage(user_id, created_at DESC);

-- =============================================================================
-- USER PREFERENCES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_provider VARCHAR(50) DEFAULT 'anthropic',
  preferred_model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
  auto_select_provider BOOLEAN DEFAULT true,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  theme VARCHAR(20) DEFAULT 'system',
  language VARCHAR(10) DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to check if user is VIP
CREATE OR REPLACE FUNCTION is_vip_user(check_email TEXT)
RETURNS TABLE(is_vip BOOLEAN, access_level VARCHAR, permissions JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS is_vip,
    v.access_level,
    v.permissions
  FROM vip_users v
  WHERE v.email = check_email AND v.is_active = true;
  
  -- If no rows returned, check domain
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      true AS is_vip,
      v.access_level,
      v.permissions
    FROM vip_users v
    WHERE v.email = '@' || split_part(check_email, '@', 2) AND v.is_active = true;
  END IF;
  
  -- If still not found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'standard'::VARCHAR, '[]'::JSONB;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's latest terms acceptance
CREATE OR REPLACE FUNCTION get_terms_status(check_user_id UUID)
RETURNS TABLE(has_accepted BOOLEAN, version VARCHAR, accepted_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS has_accepted,
    ta.version,
    ta.accepted_at
  FROM terms_acceptance ta
  WHERE ta.user_id = check_user_id
  ORDER BY ta.accepted_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::VARCHAR, NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vip_users_updated_at
  BEFORE UPDATE ON vip_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
