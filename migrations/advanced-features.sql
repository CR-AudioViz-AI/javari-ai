-- ============================================================================
-- JAVARI AI USAGE TRACKING & ADVANCED FEATURES MIGRATION
-- Adds usage logs, telemetry, code execution tracking, and more
-- Timestamp: Tuesday, October 28, 2025 - 2:50 PM EST
-- ============================================================================

-- 1. USAGE LOGS TABLE
-- Tracks all API calls, costs, and usage patterns
CREATE TABLE IF NOT EXISTS javari_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Model Info
  model TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'other')),
  
  -- Token Usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Cost
  estimated_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  
  -- Performance
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- Context
  feature_used TEXT, -- 'chat', 'code_execution', 'file_analysis', etc.
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CODE EXECUTION LOGS TABLE
-- Tracks code executions for safety and learning
CREATE TABLE IF NOT EXISTS javari_code_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Code Info
  language TEXT NOT NULL, -- 'python', 'javascript', 'bash', etc.
  code TEXT NOT NULL,
  
  -- Execution
  execution_environment TEXT NOT NULL, -- 'sandbox', 'docker', 'vm'
  execution_status TEXT NOT NULL CHECK (execution_status IN ('success', 'error', 'timeout', 'cancelled')),
  output TEXT,
  error_output TEXT,
  exit_code INTEGER,
  
  -- Performance
  execution_time_ms INTEGER,
  memory_used_mb DECIMAL(10,2),
  cpu_usage_percent DECIMAL(5,2),
  
  -- Security
  sandbox_violations TEXT[],
  risk_level TEXT CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'critical')),
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. FILE OPERATIONS TABLE
-- Tracks file uploads, downloads, and analysis
CREATE TABLE IF NOT EXISTS javari_file_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- File Info
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- MIME type
  file_size_bytes BIGINT NOT NULL,
  file_hash TEXT NOT NULL, -- SHA-256 for deduplication
  
  -- Operation
  operation_type TEXT NOT NULL CHECK (operation_type IN ('upload', 'download', 'analyze', 'generate')),
  storage_path TEXT,
  
  -- Analysis Results (if analyzed)
  analysis_result JSONB,
  
  -- Security
  virus_scan_result TEXT CHECK (virus_scan_result IN ('clean', 'infected', 'suspicious', 'not_scanned')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 4. TELEMETRY TABLE
-- Tracks user interactions and system behavior for learning
CREATE TABLE IF NOT EXISTS javari_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Event Info
  event_type TEXT NOT NULL, -- 'chat_sent', 'model_switched', 'error_occurred', etc.
  event_category TEXT NOT NULL, -- 'user_action', 'system_event', 'error', 'performance'
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Context
  user_agent TEXT,
  ip_address INET,
  session_id TEXT,
  
  -- Performance Metrics
  page_load_time_ms INTEGER,
  api_response_time_ms INTEGER,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. FEATURE FLAGS TABLE
-- Controls feature rollouts and A/B testing
CREATE TABLE IF NOT EXISTS javari_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Flag Info
  flag_name TEXT NOT NULL UNIQUE,
  flag_description TEXT,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('boolean', 'percentage', 'user_list')),
  
  -- Configuration
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowed_users UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Metadata
  created_by TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ
);

-- 6. LEARNING FEEDBACK TABLE
-- Stores user feedback for model improvement
CREATE TABLE IF NOT EXISTS javari_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Feedback Info
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'flag', 'rating', 'comment')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- Context
  response_text TEXT NOT NULL, -- The AI response being rated
  user_prompt TEXT NOT NULL, -- The user message that prompted the response
  model_used TEXT NOT NULL,
  
  -- Categories
  issue_category TEXT CHECK (issue_category IN ('accuracy', 'helpfulness', 'safety', 'performance', 'other')),
  
  -- Status
  reviewed BOOLEAN NOT NULL DEFAULT false,
  action_taken TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 7. AUTO-HEALING INCIDENTS TABLE
-- Tracks automated fixes and interventions
CREATE TABLE IF NOT EXISTS javari_auto_healing_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Incident Info
  incident_type TEXT NOT NULL CHECK (incident_type IN ('build_failure', 'runtime_error', 'performance_degradation', 'security_issue')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  
  -- Detection
  detected_by TEXT NOT NULL, -- 'monitor', 'user_report', 'automatic'
  detection_method TEXT,
  
  -- Context
  project_id UUID REFERENCES javari_projects(id) ON DELETE CASCADE,
  affected_component TEXT,
  error_stack TEXT,
  
  -- Resolution
  auto_fix_attempted BOOLEAN NOT NULL DEFAULT false,
  auto_fix_successful BOOLEAN,
  fix_description TEXT,
  fix_code_diff TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'analyzing', 'fixing', 'resolved', 'needs_human')),
  
  -- Performance
  detection_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution_time TIMESTAMPTZ,
  time_to_resolve_minutes INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Usage logs indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON javari_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_conversation ON javari_usage_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_model ON javari_usage_logs(model);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON javari_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_provider ON javari_usage_logs(provider);

-- Code execution logs indexes
CREATE INDEX IF NOT EXISTS idx_code_exec_conversation ON javari_code_execution_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_code_exec_user ON javari_code_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_code_exec_status ON javari_code_execution_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_code_exec_risk ON javari_code_execution_logs(risk_level);

-- File operations indexes
CREATE INDEX IF NOT EXISTS idx_file_ops_conversation ON javari_file_operations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_file_ops_user ON javari_file_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_file_ops_hash ON javari_file_operations(file_hash);
CREATE INDEX IF NOT EXISTS idx_file_ops_type ON javari_file_operations(operation_type);

-- Telemetry indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_user ON javari_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON javari_telemetry(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON javari_telemetry(created_at DESC);

-- Feature flags indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON javari_feature_flags(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON javari_feature_flags(flag_name);

-- Learning feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_conversation ON javari_learning_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON javari_learning_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewed ON javari_learning_feedback(reviewed) WHERE reviewed = false;

-- Auto-healing indexes
CREATE INDEX IF NOT EXISTS idx_healing_project ON javari_auto_healing_incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_healing_status ON javari_auto_healing_incidents(status);
CREATE INDEX IF NOT EXISTS idx_healing_severity ON javari_auto_healing_incidents(severity);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON javari_feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_healing_updated_at BEFORE UPDATE ON javari_auto_healing_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Daily usage statistics
CREATE OR REPLACE VIEW javari_daily_usage_stats AS
SELECT 
  DATE(created_at) as date,
  provider,
  model,
  COUNT(*) as total_requests,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost,
  AVG(response_time_ms) as avg_response_time_ms,
  COUNT(CASE WHEN success = true THEN 1 END) as successful_requests,
  COUNT(CASE WHEN success = false THEN 1 END) as failed_requests
FROM javari_usage_logs
GROUP BY DATE(created_at), provider, model
ORDER BY date DESC, total_requests DESC;

-- User activity summary
CREATE OR REPLACE VIEW javari_user_activity_summary AS
SELECT 
  user_id,
  COUNT(DISTINCT conversation_id) as total_conversations,
  COUNT(*) as total_api_calls,
  SUM(total_tokens) as total_tokens_used,
  SUM(estimated_cost) as total_cost,
  MAX(created_at) as last_active,
  MIN(created_at) as first_active
FROM javari_usage_logs
GROUP BY user_id;

-- Model performance comparison
CREATE OR REPLACE VIEW javari_model_performance AS
SELECT 
  model,
  provider,
  COUNT(*) as total_uses,
  AVG(response_time_ms) as avg_response_time,
  AVG(input_tokens) as avg_input_tokens,
  AVG(output_tokens) as avg_output_tokens,
  AVG(estimated_cost) as avg_cost_per_request,
  COUNT(CASE WHEN success = true THEN 1 END)::FLOAT / COUNT(*) * 100 as success_rate_percent
FROM javari_usage_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY model, provider
ORDER BY total_uses DESC;

-- ============================================================================
-- SEED FEATURE FLAGS
-- ============================================================================

INSERT INTO javari_feature_flags (flag_name, flag_description, flag_type, enabled, rollout_percentage, tags) VALUES
  ('multi_model_chat', 'Enable multiple AI model selection', 'boolean', true, 100, ARRAY['chat', 'core']),
  ('code_execution', 'Enable code execution in sandboxed environment', 'boolean', true, 100, ARRAY['advanced', 'dev']),
  ('file_upload', 'Enable file uploads and analysis', 'boolean', true, 100, ARRAY['advanced', 'files']),
  ('auto_healing', 'Enable automatic build error detection and fixing', 'boolean', true, 100, ARRAY['advanced', 'monitoring']),
  ('telemetry', 'Enable usage telemetry collection', 'boolean', true, 100, ARRAY['analytics']),
  ('advanced_analytics', 'Enable advanced analytics dashboard', 'percentage', false, 0, ARRAY['analytics', 'beta']),
  ('claude_opus', 'Enable Claude Opus 4 model', 'boolean', true, 100, ARRAY['models', 'premium']),
  ('real_time_collaboration', 'Enable real-time collaboration features', 'boolean', false, 0, ARRAY['social', 'beta'])
ON CONFLICT (flag_name) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
