/**
 * JAVARI AI - PROJECTS MANAGEMENT TYPES
 * Complete TypeScript definitions for projects system
 * Date: October 28, 2025
 */

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface JavariProject {
  id: string;
  user_id: string;
  name: string;
  display_name: string;
  description: string | null;
  
  // Repository Info
  github_repo: string | null;
  github_branch: string | null;
  vercel_project: string | null;
  
  // Credentials
  credentials: ProjectCredentials;
  
  // Health Monitoring
  health_score: number; // 0-100
  last_health_check: string | null;
  build_status: BuildStatus;
  last_build_at: string | null;
  
  // Tracking
  total_chats: number;
  active_chats_count: number;
  total_work_logs: number;
  total_deployments: number;
  
  // Costs
  total_tokens_used: number;
  total_cost_incurred: number;
  total_cost_saved: number;
  
  // Status
  status: ProjectStatus;
  starred: boolean;
  archived: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
}

export interface ProjectCredentials {
  github_token?: string;
  vercel_token?: string;
  openai_key?: string;
  supabase_url?: string;
  supabase_key?: string;
  custom?: Record<string, string>;
}

export type ProjectStatus = 
  | 'active'
  | 'paused'
  | 'archived'
  | 'error';

export type BuildStatus =
  | 'success'
  | 'failed'
  | 'pending'
  | 'unknown';

// ============================================================================
// CREATE/UPDATE TYPES
// ============================================================================

export interface CreateProjectInput {
  name: string;
  display_name: string;
  description?: string;
  github_repo?: string;
  github_branch?: string;
  vercel_project?: string;
  credentials?: Partial<ProjectCredentials>;
  starred?: boolean;
}

export interface UpdateProjectInput {
  display_name?: string;
  description?: string;
  github_repo?: string;
  github_branch?: string;
  vercel_project?: string;
  credentials?: Partial<ProjectCredentials>;
  status?: ProjectStatus;
  starred?: boolean;
  archived?: boolean;
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export interface ProjectHealthCheck {
  project_id: string;
  health_score: number;
  build_status: BuildStatus;
  issues: HealthIssue[];
  recommendations: string[];
  last_check: string;
}

export interface HealthIssue {
  type: HealthIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affected_files?: string[];
  suggestion?: string;
}

export type HealthIssueType =
  | 'build_failure'
  | 'dependency_outdated'
  | 'security_vulnerability'
  | 'performance_issue'
  | 'code_quality'
  | 'missing_tests';

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface ProjectAnalytics {
  project_id: string;
  period: AnalyticsPeriod;
  metrics: {
    total_chats: number;
    total_messages: number;
    total_tokens: number;
    total_cost: number;
    avg_response_time: number;
    
    code_metrics: {
      lines_added: number;
      lines_deleted: number;
      files_created: number;
      files_modified: number;
      apis_created: number;
      tests_written: number;
    };
    
    quality_metrics: {
      build_success_rate: number;
      avg_health_score: number;
      issues_identified: number;
      issues_resolved: number;
      resolution_rate: number;
    };
    
    efficiency_metrics: {
      cost_saved: number;
      time_saved_hours: number;
      automation_rate: number;
    };
  };
  charts: {
    health_over_time: TimeSeriesData[];
    cost_over_time: TimeSeriesData[];
    activity_over_time: TimeSeriesData[];
  };
}

export type AnalyticsPeriod = '24h' | '7d' | '30d' | '90d' | 'all';

export interface TimeSeriesData {
  timestamp: string;
  value: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ProjectsListResponse {
  projects: JavariProject[];
  total: number;
  page: number;
  per_page: number;
  filters: ProjectFilters;
}

export interface ProjectFilters {
  status?: ProjectStatus[];
  starred?: boolean;
  archived?: boolean;
  search?: string;
  health_min?: number;
  health_max?: number;
  sort_by?: ProjectSortField;
  sort_order?: 'asc' | 'desc';
}

export type ProjectSortField =
  | 'name'
  | 'created_at'
  | 'updated_at'
  | 'health_score'
  | 'total_cost'
  | 'last_activity_at';

// ============================================================================
// SUB-PROJECT TYPES
// ============================================================================

export interface JavariSubProject {
  id: string;
  parent_project_id: string;
  name: string;
  display_name: string;
  description: string | null;
  
  // Repository Info
  github_repo: string | null;
  vercel_project: string | null;
  
  // Credentials (override parent)
  credential_overrides: Partial<ProjectCredentials>;
  
  // Health
  health_score: number;
  
  // Tracking
  active_chats_count: number;
  starred: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateSubProjectInput {
  parent_project_id: string;
  name: string;
  display_name: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
  credential_overrides?: Partial<ProjectCredentials>;
  starred?: boolean;
}

export interface UpdateSubProjectInput {
  display_name?: string;
  description?: string;
  github_repo?: string;
  vercel_project?: string;
  credential_overrides?: Partial<ProjectCredentials>;
  starred?: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

// ============================================================================
// SUCCESS TYPES
// ============================================================================

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
