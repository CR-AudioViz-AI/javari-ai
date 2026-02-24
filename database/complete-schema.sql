-- ================================================================
-- JAVARI AI - COMPLETE DATABASE SCHEMA
-- Ultimate Autonomous, Self-Healing AI Assistant
-- Created: Tuesday, October 28, 2025 - 1:20 PM EST
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ================================================================
-- CORE USER TABLES
-- ================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer DEFAULT 1000 NOT NULL,
  subscription_tier text DEFAULT 'free',
  total_spent numeric DEFAULT 0,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ================================================================
-- CONVERSATION TABLES
-- ================================================================

-- Main conversations table
CREATE TABLE IF NOT EXISTS javari_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT 'New Conversation',
  project_id uuid,
  provider text NOT NULL,
  model text NOT NULL,
  system_prompt text,
  temperature numeric DEFAULT 0.7,
  max_tokens integer DEFAULT 4000,
  total_tokens integer DEFAULT 0,
  total_cost numeric DEFAULT 0,
  quality_score integer CHECK (quality_score >= 1 AND quality_score <= 5),
  is_starred boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS javari_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES javari_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  tokens integer DEFAULT 0,
  cost numeric DEFAULT 0,
  latency_ms integer,
  quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
  feedback_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Message embeddings for semantic search
CREATE TABLE IF NOT EXISTS javari_message_embeddings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid REFERENCES javari_messages(id) ON DELETE CASCADE,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- FILE & MULTI-MODAL TABLES
-- ================================================================

-- Uploaded files
CREATE TABLE IF NOT EXISTS javari_files (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES javari_conversations(id) ON DELETE SET NULL,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  mime_type text,
  storage_path text NOT NULL,
  storage_bucket text DEFAULT 'javari-uploads',
  extracted_text text,
  ocr_text text,
  transcription text,
  analysis jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- File embeddings for semantic search
CREATE TABLE IF NOT EXISTS javari_file_embeddings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id uuid REFERENCES javari_files(id) ON DELETE CASCADE,
  chunk_index integer,
  chunk_text text,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- AI PROVIDER TABLES
-- ================================================================

-- Available AI providers
CREATE TABLE IF NOT EXISTS javari_providers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  priority integer DEFAULT 100,
  fallback_provider text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Provider models
CREATE TABLE IF NOT EXISTS javari_provider_models (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider text NOT NULL,
  model_name text NOT NULL,
  display_name text NOT NULL,
  context_window integer,
  input_cost_per_1k numeric,
  output_cost_per_1k numeric,
  capabilities jsonb DEFAULT '{}'::jsonb,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(provider, model_name)
);

-- Provider performance tracking
CREATE TABLE IF NOT EXISTS javari_provider_performance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider text NOT NULL,
  model text NOT NULL,
  date date NOT NULL,
  request_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  total_cost numeric DEFAULT 0,
  avg_latency_ms numeric,
  avg_quality_score numeric,
  last_failure_at timestamptz,
  last_failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, model, date)
);

-- Provider health checks
CREATE TABLE IF NOT EXISTS javari_provider_health (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms integer,
  error_message text,
  checked_at timestamptz DEFAULT now()
);

-- ================================================================
-- LEARNING & PATTERN TABLES
-- ================================================================

-- User behavior patterns
CREATE TABLE IF NOT EXISTS javari_learning_patterns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  pattern_data jsonb NOT NULL,
  frequency integer DEFAULT 1,
  confidence_score numeric DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Task type classifications
CREATE TABLE IF NOT EXISTS javari_task_classifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES javari_conversations(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  best_provider text,
  best_model text,
  avg_cost numeric,
  avg_quality numeric,
  created_at timestamptz DEFAULT now()
);

-- Error learning
CREATE TABLE IF NOT EXISTS javari_error_learning (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_type text NOT NULL,
  error_message text NOT NULL,
  context jsonb,
  resolution text,
  success_rate numeric,
  occurrences integer DEFAULT 1,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- A/B test results
CREATE TABLE IF NOT EXISTS javari_ab_tests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_name text NOT NULL,
  variant text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric,
  sample_size integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(test_name, variant, metric_name)
);

-- ================================================================
-- COST & ANALYTICS TABLES
-- ================================================================

-- Detailed cost tracking
CREATE TABLE IF NOT EXISTS javari_cost_tracking (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES javari_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES javari_messages(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  cost numeric NOT NULL,
  credits_used integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Usage analytics
CREATE TABLE IF NOT EXISTS javari_usage_analytics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  conversations_count integer DEFAULT 0,
  messages_count integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  credits_used integer DEFAULT 0,
  files_uploaded integer DEFAULT 0,
  code_executions integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- ================================================================
-- PROJECT MANAGEMENT TABLES
-- ================================================================

-- User projects
CREATE TABLE IF NOT EXISTS javari_projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL,
  tech_stack jsonb DEFAULT '[]'::jsonb,
  repository_url text,
  deployment_url text,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'testing', 'deployed', 'archived')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Project components
CREATE TABLE IF NOT EXISTS javari_project_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid REFERENCES javari_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  code text,
  file_path text,
  language text,
  version integer DEFAULT 1,
  is_deployed boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Project deployments
CREATE TABLE IF NOT EXISTS javari_project_deployments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid REFERENCES javari_projects(id) ON DELETE CASCADE,
  deployment_url text NOT NULL,
  commit_sha text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'ready', 'error')),
  build_log text,
  error_message text,
  deployed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- CODE EXECUTION TABLES
-- ================================================================

-- Code executions
CREATE TABLE IF NOT EXISTS javari_code_executions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES javari_conversations(id) ON DELETE SET NULL,
  code text NOT NULL,
  language text NOT NULL,
  output text,
  error text,
  execution_time_ms integer,
  memory_used_mb numeric,
  exit_code integer,
  created_at timestamptz DEFAULT now()
);

-- Generated tests
CREATE TABLE IF NOT EXISTS javari_generated_tests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id uuid REFERENCES javari_project_components(id) ON DELETE CASCADE,
  test_type text NOT NULL CHECK (test_type IN ('unit', 'integration', 'e2e')),
  test_code text NOT NULL,
  test_framework text,
  passed boolean,
  results jsonb,
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- HEALTH & MONITORING TABLES
-- ================================================================

-- System health checks
CREATE TABLE IF NOT EXISTS javari_health_checks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_type text NOT NULL,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms integer,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz DEFAULT now()
);

-- Auto-healing actions
CREATE TABLE IF NOT EXISTS javari_auto_heal_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_type text NOT NULL,
  trigger_reason text NOT NULL,
  action_taken text NOT NULL,
  was_successful boolean NOT NULL,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Telemetry events
CREATE TABLE IF NOT EXISTS javari_telemetry (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  session_id text,
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- FEEDBACK & SUGGESTIONS TABLES
-- ================================================================

-- User feedback
CREATE TABLE IF NOT EXISTS javari_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES javari_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES javari_messages(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  feedback_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- AI-generated suggestions
CREATE TABLE IF NOT EXISTS javari_suggestions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL,
  suggestion_text text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  is_applied boolean DEFAULT false,
  applied_at timestamptz,
  was_helpful boolean,
  created_at timestamptz DEFAULT now()
);

-- Optimization recommendations
CREATE TABLE IF NOT EXISTS javari_optimization_recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  recommendation_text text NOT NULL,
  estimated_savings_usd numeric,
  estimated_savings_credits integer,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- MEMORY & CONTEXT TABLES
-- ================================================================

-- Long-term memory
CREATE TABLE IF NOT EXISTS javari_long_term_memory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  importance numeric DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  access_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, memory_type, key)
);

-- Conversation context
CREATE TABLE IF NOT EXISTS javari_conversation_context (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES javari_conversations(id) ON DELETE CASCADE,
  context_type text NOT NULL,
  context_data jsonb NOT NULL,
  relevance_score numeric CHECK (relevance_score >= 0 AND relevance_score <= 1),
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON javari_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON javari_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON javari_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON javari_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_starred ON javari_conversations(is_starred) WHERE is_starred = true;

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON javari_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON javari_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_provider_model ON javari_messages(provider, model);

-- File indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON javari_files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_conversation_id ON javari_files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_files_file_type ON javari_files(file_type);

-- Provider performance indexes
CREATE INDEX IF NOT EXISTS idx_provider_perf_date ON javari_provider_performance(date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_perf_provider ON javari_provider_performance(provider, model);

-- Cost tracking indexes
CREATE INDEX IF NOT EXISTS idx_cost_user_id ON javari_cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_created_at ON javari_cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_provider ON javari_cost_tracking(provider, model);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON javari_usage_analytics(user_id, date DESC);

-- Project indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON javari_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON javari_projects(status);

-- Component indexes
CREATE INDEX IF NOT EXISTS idx_components_project_id ON javari_project_components(project_id);

-- Telemetry indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id ON javari_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON javari_telemetry(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON javari_telemetry(created_at DESC);

-- Memory indexes
CREATE INDEX IF NOT EXISTS idx_long_term_memory_user ON javari_long_term_memory(user_id, memory_type);

-- ================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================

-- Enable RLS on all user-specific tables
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_project_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_code_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_optimization_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_long_term_memory ENABLE ROW LEVEL SECURITY;

-- User profile policies
CREATE POLICY "Users can view own profile" ON users_profile FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users_profile FOR UPDATE USING (auth.uid() = id);

-- Conversation policies
CREATE POLICY "Users can view own conversations" ON javari_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations" ON javari_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON javari_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON javari_conversations FOR DELETE USING (auth.uid() = user_id);

-- Message policies
CREATE POLICY "Users can view messages in own conversations" ON javari_messages FOR SELECT 
  USING (conversation_id IN (SELECT id FROM javari_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can create messages in own conversations" ON javari_messages FOR INSERT 
  WITH CHECK (conversation_id IN (SELECT id FROM javari_conversations WHERE user_id = auth.uid()));

-- File policies
CREATE POLICY "Users can view own files" ON javari_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upload files" ON javari_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON javari_files FOR DELETE USING (auth.uid() = user_id);

-- Project policies
CREATE POLICY "Users can view own projects" ON javari_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create projects" ON javari_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON javari_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON javari_projects FOR DELETE USING (auth.uid() = user_id);

-- Component policies
CREATE POLICY "Users can view components in own projects" ON javari_project_components FOR SELECT 
  USING (project_id IN (SELECT id FROM javari_projects WHERE user_id = auth.uid()));
CREATE POLICY "Users can create components in own projects" ON javari_project_components FOR INSERT 
  WITH CHECK (project_id IN (SELECT id FROM javari_projects WHERE user_id = auth.uid()));
CREATE POLICY "Users can update components in own projects" ON javari_project_components FOR UPDATE 
  USING (project_id IN (SELECT id FROM javari_projects WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete components in own projects" ON javari_project_components FOR DELETE 
  USING (project_id IN (SELECT id FROM javari_projects WHERE user_id = auth.uid()));

-- Cost tracking policies
CREATE POLICY "Users can view own cost data" ON javari_cost_tracking FOR SELECT USING (auth.uid() = user_id);

-- Analytics policies
CREATE POLICY "Users can view own analytics" ON javari_usage_analytics FOR SELECT USING (auth.uid() = user_id);

-- Learning patterns policies
CREATE POLICY "Users can view own patterns" ON javari_learning_patterns FOR SELECT USING (auth.uid() = user_id);

-- Feedback policies
CREATE POLICY "Users can view own feedback" ON javari_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can submit feedback" ON javari_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Suggestions policies
CREATE POLICY "Users can view own suggestions" ON javari_suggestions FOR SELECT USING (auth.uid() = user_id);

-- Recommendations policies
CREATE POLICY "Users can view own recommendations" ON javari_optimization_recommendations FOR SELECT USING (auth.uid() = user_id);

-- Memory policies
CREATE POLICY "Users can view own memory" ON javari_long_term_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can write memory" ON javari_long_term_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update memory" ON javari_long_term_memory FOR UPDATE USING (auth.uid() = user_id);

-- Code execution policies
CREATE POLICY "Users can view own executions" ON javari_code_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can execute code" ON javari_code_executions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- SEED DATA: PROVIDERS
-- ================================================================

-- Insert available AI providers
INSERT INTO javari_providers (name, display_name, priority, config) VALUES
  ('openai', 'OpenAI', 100, '{"default_model": "gpt-4-turbo-preview"}'::jsonb),
  ('claude', 'Anthropic Claude', 90, '{"default_model": "claude-3-5-sonnet-20241022"}'::jsonb),
  ('gemini', 'Google Gemini', 80, '{"default_model": "gemini-pro"}'::jsonb),
  ('mistral', 'Mistral AI', 70, '{"default_model": "mistral-large-latest"}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  priority = EXCLUDED.priority,
  config = EXCLUDED.config;

-- Insert provider models with pricing
INSERT INTO javari_provider_models (provider, model_name, display_name, context_window, input_cost_per_1k, output_cost_per_1k, capabilities) VALUES
  -- OpenAI Models
  ('openai', 'gpt-4-turbo-preview', 'GPT-4 Turbo', 128000, 0.01, 0.03, '{"vision": true, "function_calling": true}'::jsonb),
  ('openai', 'gpt-4', 'GPT-4', 8192, 0.03, 0.06, '{"function_calling": true}'::jsonb),
  ('openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 16385, 0.0005, 0.0015, '{"function_calling": true}'::jsonb),
  
  -- Claude Models
  ('claude', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 200000, 0.003, 0.015, '{"vision": true, "artifacts": true}'::jsonb),
  ('claude', 'claude-3-opus-20240229', 'Claude 3 Opus', 200000, 0.015, 0.075, '{"vision": true}'::jsonb),
  ('claude', 'claude-3-haiku-20240307', 'Claude 3 Haiku', 200000, 0.00025, 0.00125, '{"vision": true}'::jsonb),
  
  -- Gemini Models
  ('gemini', 'gemini-pro', 'Gemini Pro', 32768, 0.0005, 0.0015, '{"vision": false}'::jsonb),
  ('gemini', 'gemini-pro-vision', 'Gemini Pro Vision', 16384, 0.00025, 0.0005, '{"vision": true}'::jsonb),
  
  -- Mistral Models
  ('mistral', 'mistral-large-latest', 'Mistral Large', 32768, 0.004, 0.012, '{"function_calling": true}'::jsonb),
  ('mistral', 'mistral-medium-latest', 'Mistral Medium', 32768, 0.0027, 0.0081, '{}'::jsonb),
  ('mistral', 'mistral-small-latest', 'Mistral Small', 32768, 0.0002, 0.0006, '{}'::jsonb)
ON CONFLICT (provider, model_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  context_window = EXCLUDED.context_window,
  input_cost_per_1k = EXCLUDED.input_cost_per_1k,
  output_cost_per_1k = EXCLUDED.output_cost_per_1k,
  capabilities = EXCLUDED.capabilities;

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_users_profile_updated_at BEFORE UPDATE ON users_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON javari_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON javari_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON javari_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON javari_project_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update provider performance stats
CREATE OR REPLACE FUNCTION update_provider_performance(
  p_provider text,
  p_model text,
  p_success boolean,
  p_tokens integer,
  p_cost numeric,
  p_latency_ms integer,
  p_quality_score integer DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO javari_provider_performance (
    provider, model, date, 
    request_count, success_count, failure_count,
    total_tokens, total_cost, avg_latency_ms, avg_quality_score
  )
  VALUES (
    p_provider, p_model, CURRENT_DATE,
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_tokens, p_cost, p_latency_ms, p_quality_score
  )
  ON CONFLICT (provider, model, date)
  DO UPDATE SET
    request_count = javari_provider_performance.request_count + 1,
    success_count = javari_provider_performance.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    failure_count = javari_provider_performance.failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    total_tokens = javari_provider_performance.total_tokens + p_tokens,
    total_cost = javari_provider_performance.total_cost + p_cost,
    avg_latency_ms = (javari_provider_performance.avg_latency_ms * javari_provider_performance.request_count + p_latency_ms) / (javari_provider_performance.request_count + 1),
    avg_quality_score = CASE 
      WHEN p_quality_score IS NOT NULL THEN 
        COALESCE((javari_provider_performance.avg_quality_score * javari_provider_performance.request_count + p_quality_score) / (javari_provider_performance.request_count + 1), p_quality_score)
      ELSE javari_provider_performance.avg_quality_score
    END,
    last_failure_at = CASE WHEN NOT p_success THEN now() ELSE javari_provider_performance.last_failure_at END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- VIEWS FOR COMMON QUERIES
-- ================================================================

-- View for conversation summaries
CREATE OR REPLACE VIEW javari_conversation_summaries AS
SELECT 
  c.id,
  c.user_id,
  c.title,
  c.provider,
  c.model,
  c.total_tokens,
  c.total_cost,
  c.quality_score,
  c.is_starred,
  c.created_at,
  c.updated_at,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM javari_conversations c
LEFT JOIN javari_messages m ON m.conversation_id = c.id
GROUP BY c.id;

-- View for user statistics
CREATE OR REPLACE VIEW javari_user_statistics AS
SELECT 
  u.id as user_id,
  u.credits,
  u.subscription_tier,
  u.total_spent,
  COUNT(DISTINCT c.id) as total_conversations,
  COUNT(DISTINCT m.id) as total_messages,
  COALESCE(SUM(ct.total_tokens), 0) as total_tokens_used,
  COALESCE(SUM(ct.cost), 0) as total_cost_usd,
  COUNT(DISTINCT f.id) as files_uploaded,
  COUNT(DISTINCT p.id) as projects_count
FROM users_profile u
LEFT JOIN javari_conversations c ON c.user_id = u.id
LEFT JOIN javari_messages m ON m.conversation_id = c.id
LEFT JOIN javari_cost_tracking ct ON ct.user_id = u.id
LEFT JOIN javari_files f ON f.user_id = u.id
LEFT JOIN javari_projects p ON p.user_id = u.id
GROUP BY u.id, u.credits, u.subscription_tier, u.total_spent;

-- View for provider comparison
CREATE OR REPLACE VIEW javari_provider_comparison AS
SELECT 
  provider,
  model,
  SUM(request_count) as total_requests,
  SUM(success_count) as total_successes,
  SUM(failure_count) as total_failures,
  ROUND((SUM(success_count)::numeric / NULLIF(SUM(request_count), 0) * 100), 2) as success_rate,
  ROUND(AVG(avg_latency_ms), 0) as avg_latency_ms,
  ROUND(AVG(avg_cost), 6) as avg_cost_per_request,
  ROUND(AVG(avg_quality_score), 2) as avg_quality_score
FROM javari_provider_performance
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY provider, model
ORDER BY success_rate DESC, avg_cost_per_request ASC;

-- ================================================================
-- GRANT PERMISSIONS
-- ================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant permissions on all tables to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Service role gets all permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ================================================================
-- DATABASE COMPLETE
-- ================================================================

-- Summary comment
COMMENT ON SCHEMA public IS 'JavariAI Complete Database Schema - Autonomous, Self-Healing AI Assistant';
