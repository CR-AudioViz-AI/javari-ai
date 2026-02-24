// ============================================================================
// JAVARI AI - TYPE DEFINITIONS
// All TypeScript interfaces for the Javari AI system
// ============================================================================

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface JavariProject {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
  health_score: number;
  active_chats_count: number;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface JavariSubProject {
  id: string;
  parent_project_id: string;
  name: string;
  display_name: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
  credential_overrides: Record<string, any>;
  health_score: number;
  active_chats_count: number;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface JavariChatSession {
  id: string;
  project_id: string;
  subproject_id?: string;
  user_id: string;
  title: string;
  status: 'active' | 'continued' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  parent_chat_id?: string;
  continuation_depth: number;
  context_summary?: string;
  credentials_snapshot: Record<string, any>;
  token_count: number;
  message_count: number;
  lines_of_code_added: number;
  lines_of_code_deleted: number;
  files_created: number;
  files_modified: number;
  apis_created: number;
  tests_written: number;
  estimated_cost_saved: number;
  actual_cost_incurred: number;
  issues_identified: number;
  issues_resolved: number;
  started_at: string;
  ended_at?: string;
  total_duration_minutes?: number;
  active_duration_minutes?: number;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface JavariChatWorkLog {
  id: string;
  chat_session_id: string;
  action_type: 'file_created' | 'file_modified' | 'file_deleted' | 'api_created' | 'test_written' | 'bug_fixed' | 'feature_added' | 'refactored' | 'deployed';
  action_category: 'code' | 'config' | 'docs' | 'tests' | 'deployment';
  description: string;
  impact_level: 'minor' | 'moderate' | 'major' | 'critical';
  files_affected: string[];
  lines_added: number;
  lines_deleted: number;
  complexity_added: number;
  tests_added: boolean;
  breaking_change: boolean;
  cost_saved: number;
  cost_incurred: number;
  needs_review: boolean;
  review_completed: boolean;
  commit_sha?: string;
  deploy_url?: string;
  created_at: string;
}

export interface JavariBuildHealth {
  id: string;
  project_id: string;
  chat_session_id?: string;
  build_id?: string;
  build_status: 'success' | 'failed' | 'pending';
  error_type?: string;
  error_message?: string;
  error_stack?: string;
  auto_fixable: boolean;
  fix_suggestion?: string;
  fix_confidence?: number;
  fix_applied: boolean;
  fix_result?: 'success' | 'failed';
  build_duration_seconds?: number;
  files_affected: string[];
  build_started_at: string;
  build_completed_at?: string;
  created_at: string;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateProjectRequest {
  name: string;
  display_name?: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  display_name?: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
  health_score?: number;
  starred?: boolean;
}

export interface CreateSubProjectRequest {
  parent_project_id: string;
  name: string;
  display_name?: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
  credential_overrides?: Record<string, any>;
}

export interface UpdateSubProjectRequest {
  name?: string;
  display_name?: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
  credential_overrides?: Record<string, any>;
  health_score?: number;
  starred?: boolean;
}

export interface CreateWorkLogRequest {
  chat_session_id: string;
  action_type: JavariChatWorkLog['action_type'];
  action_category: JavariChatWorkLog['action_category'];
  description: string;
  impact_level?: JavariChatWorkLog['impact_level'];
  files_affected?: string[];
  lines_added?: number;
  lines_deleted?: number;
  complexity_added?: number;
  tests_added?: boolean;
  breaking_change?: boolean;
  cost_saved?: number;
  cost_incurred?: number;
  needs_review?: boolean;
  commit_sha?: string;
  deploy_url?: string;
}

export interface HealthCheckResponse {
  healthy: boolean;
  project_id: string;
  latest_builds: JavariBuildHealth[];
  failed_builds_count: number;
  auto_fixable_count: number;
  recommendations: string[];
}
