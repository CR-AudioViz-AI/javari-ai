/**
 * JAVARI AI - COMPLETE DATABASE SCHEMA
 * Deploy to Supabase - Split into migrations to avoid timeout
 * 
 * @version 2.0.0
 * @date October 27, 2025
 */

-- ============================================================================
-- ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- NUMERIC ID SEQUENCES
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_conversation_id START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_project_id START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_subproject_id START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_work_log_id START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_build_health_id START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_suggestion_id START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_review_id START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_dependency_id START 1000;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('active', 'inactive', 'archived', 'completed', 'on-hold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE health_status AS ENUM ('excellent', 'good', 'fair', 'poor', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE 1: PROJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_project_id'),
  name TEXT NOT NULL,
  description TEXT,
  repository_url TEXT,
  vercel_project_id TEXT,
  status project_status DEFAULT 'active',
  priority priority_level DEFAULT 'medium',
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  starred BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_starred ON projects(starred);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- ============================================================================
-- TABLE 2: SUBPROJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subprojects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_subproject_id'),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  repository_url TEXT,
  vercel_project_id TEXT,
  status project_status DEFAULT 'active',
  priority priority_level DEFAULT 'medium',
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  starred BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subprojects_project_id ON subprojects(project_id);
CREATE INDEX IF NOT EXISTS idx_subprojects_parent_id ON subprojects(parent_subproject_id);
CREATE INDEX IF NOT EXISTS idx_subprojects_status ON subprojects(status);

-- ============================================================================
-- TABLE 3: CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_conversation_id'),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status conversation_status DEFAULT 'active',
  starred BOOLEAN DEFAULT FALSE,
  continuation_depth INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  model_used TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON conversations(parent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_starred ON conversations(starred);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);

-- ============================================================================
-- TABLE 4: CONVERSATION MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  model_used TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);

