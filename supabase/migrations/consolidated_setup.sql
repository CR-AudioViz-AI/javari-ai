-- Javari Database Setup - Consolidated Migration
-- Run this in Supabase SQL Editor

-- 1. Execution Logs Table
CREATE TABLE IF NOT EXISTS javari_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  output TEXT,
  error TEXT,
  estimated_cost NUMERIC(10, 6) DEFAULT 0,
  roles_executed JSONB,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_logs_task_id ON javari_execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON javari_execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON javari_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_retry_count ON javari_execution_logs(retry_count);

-- 2. Telemetry Logs Table
CREATE TABLE IF NOT EXISTS javari_telemetry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER,
  cost NUMERIC(10, 6) DEFAULT 0,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_model ON javari_telemetry_logs(model);
CREATE INDEX IF NOT EXISTS idx_telemetry_provider ON javari_telemetry_logs(provider);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON javari_telemetry_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_success ON javari_telemetry_logs(success);
CREATE INDEX IF NOT EXISTS idx_telemetry_task_id ON javari_telemetry_logs(task_id);

-- 3. User Subscriptions Table (if not exists)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id TEXT PRIMARY KEY,
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Seed test subscription
INSERT INTO user_subscriptions (user_id, plan_tier, status)
VALUES ('roy_test_user', 'pro', 'active')
ON CONFLICT (user_id) 
DO UPDATE SET 
  plan_tier = 'pro', 
  status = 'active',
  updated_at = NOW();

-- Verify setup
SELECT 'Execution Logs Table' as table_name, COUNT(*) as row_count FROM javari_execution_logs
UNION ALL
SELECT 'Telemetry Logs Table', COUNT(*) FROM javari_telemetry_logs
UNION ALL
SELECT 'User Subscriptions Table', COUNT(*) FROM user_subscriptions;
