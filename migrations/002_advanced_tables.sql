/**
 * JAVARI AI - DATABASE SCHEMA PART 2
 * Work logs, build health, suggestions, reviews, dependencies
 */

-- ============================================================================
-- TABLE 5: WORK LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_work_log_id'),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  files_affected TEXT[] DEFAULT '{}',
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  impact_level TEXT CHECK (impact_level IN ('minor', 'moderate', 'major', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_logs_conversation_id ON work_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_project_id ON work_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_id ON work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_action_type ON work_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_work_logs_created_at ON work_logs(created_at);

-- ============================================================================
-- TABLE 6: BUILD HEALTH TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS build_health_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_build_health_id'),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  build_status TEXT NOT NULL CHECK (build_status IN ('success', 'failed', 'building', 'cancelled')),
  error_message TEXT,
  error_type TEXT,
  stack_trace TEXT,
  build_duration_ms INTEGER,
  deployment_url TEXT,
  vercel_deployment_id TEXT,
  git_commit_sha TEXT,
  git_commit_message TEXT,
  git_branch TEXT,
  auto_fix_attempted BOOLEAN DEFAULT FALSE,
  auto_fix_successful BOOLEAN,
  fix_applied TEXT,
  fix_confidence_score INTEGER CHECK (fix_confidence_score >= 0 AND fix_confidence_score <= 100),
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_build_health_project_id ON build_health_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_build_health_status ON build_health_tracking(build_status);
CREATE INDEX IF NOT EXISTS idx_build_health_created_at ON build_health_tracking(created_at);

-- ============================================================================
-- TABLE 7: SMART SUGGESTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS smart_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_suggestion_id'),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority priority_level DEFAULT 'medium',
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  estimated_effort_hours NUMERIC(5,2),
  expected_impact TEXT,
  implementation_details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented', 'obsolete')),
  accepted_at TIMESTAMPTZ,
  implemented_at TIMESTAMPTZ,
  rejected_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_project_id ON smart_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON smart_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON smart_suggestions(priority);

-- ============================================================================
-- TABLE 8: CODE REVIEW QUEUE
-- ============================================================================
CREATE TABLE IF NOT EXISTS code_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_review_id'),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  code_before TEXT,
  code_after TEXT NOT NULL,
  change_type TEXT CHECK (change_type IN ('create', 'update', 'delete', 'refactor')),
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  complexity_score INTEGER CHECK (complexity_score >= 0 AND complexity_score <= 100),
  potential_issues TEXT[] DEFAULT '{}',
  security_concerns TEXT[] DEFAULT '{}',
  performance_concerns TEXT[] DEFAULT '{}',
  suggestions TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  reviewed_by TEXT,
  review_comments JSONB DEFAULT '[]',
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_review_project_id ON code_review_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_code_review_status ON code_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_code_review_created_at ON code_review_queue(created_at);

-- ============================================================================
-- TABLE 9: DEPENDENCY TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS dependency_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numeric_id INTEGER UNIQUE NOT NULL DEFAULT nextval('seq_dependency_id'),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  subproject_id UUID REFERENCES subprojects(id) ON DELETE SET NULL,
  package_name TEXT NOT NULL,
  current_version TEXT NOT NULL,
  latest_version TEXT,
  package_manager TEXT CHECK (package_manager IN ('npm', 'yarn', 'pnpm', 'pip', 'composer')),
  is_dev_dependency BOOLEAN DEFAULT FALSE,
  has_security_vulnerability BOOLEAN DEFAULT FALSE,
  vulnerability_severity TEXT CHECK (vulnerability_severity IN ('low', 'medium', 'high', 'critical')),
  vulnerability_details JSONB DEFAULT '{}',
  update_available BOOLEAN DEFAULT FALSE,
  breaking_changes BOOLEAN DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependency_project_id ON dependency_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_dependency_package_name ON dependency_tracking(package_name);
CREATE INDEX IF NOT EXISTS idx_dependency_vulnerability ON dependency_tracking(has_security_vulnerability);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subprojects_updated_at ON subprojects;
CREATE TRIGGER update_subprojects_updated_at BEFORE UPDATE ON subprojects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_smart_suggestions_updated_at ON smart_suggestions;
CREATE TRIGGER update_smart_suggestions_updated_at BEFORE UPDATE ON smart_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_code_review_queue_updated_at ON code_review_queue;
CREATE TRIGGER update_code_review_queue_updated_at BEFORE UPDATE ON code_review_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dependency_tracking_updated_at ON dependency_tracking;
CREATE TRIGGER update_dependency_tracking_updated_at BEFORE UPDATE ON dependency_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE!
-- ============================================================================
