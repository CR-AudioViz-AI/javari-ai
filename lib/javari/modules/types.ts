// lib/javari/modules/types.ts
// Module Factory Engine — Canonical Type Definitions
// Strict TypeScript: no implicit any, no loose unions
// 2026-02-19 — TASK-P1-001 Module Factory Core Engine

export type ModuleFamily =
  | 'creative-suite'
  | 'business-intelligence'
  | 'developer-tools'
  | 'ai-integration'
  | 'social-impact'
  | 'gaming';

export type ModuleType = 'ui' | 'api' | 'db' | 'full-stack';

export type ModuleStatus =
  | 'draft'
  | 'generating'
  | 'validating'
  | 'ready'
  | 'committed'
  | 'deployed'
  | 'failed';

export type PricingTier = 'free' | 'starter' | 'pro' | 'enterprise';

// ── Request ───────────────────────────────────────────────────────────────────

export interface ModuleRequest {
  /** Human-readable name: "Audio Visualizer" */
  name: string;
  /** URL slug: "audio-visualizer" */
  slug: string;
  /** What this module does — fed directly to LLM for generation */
  description: string;
  family: ModuleFamily;
  /** Which artifact types to generate */
  types: ModuleType[];
  creditsPerUse: number;
  minPlan: PricingTier;
  features?: string[];
  /** LLM to use for code generation — defaults to gpt-4o */
  generationModel?: string;
  autoCommit?: boolean;
  autoDeploy?: boolean;
}

// ── File Artifacts ────────────────────────────────────────────────────────────

export interface ModuleFile {
  /** Repo-root-relative path: "app/tools/audio-visualizer/page.tsx" */
  path: string;
  content: string;
  language: 'typescript' | 'sql' | 'json' | 'markdown';
  /** Byte size of content */
  size: number;
}

export interface ModuleArtifacts {
  uiPage?: ModuleFile;
  uiComponents: ModuleFile[];
  apiRoutes: ModuleFile[];
  dbMigration?: ModuleFile;
  registryEntry: ModuleFile;
  readme: ModuleFile;
}

// ── Validation ────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  file: string;
  line?: number;
  code: string;
  message: string;
}

export interface ValidationChecks {
  typescriptSyntax: boolean;
  schemaCompleteness: boolean;
  apiRouteShape: boolean;
  noHardcodedSecrets: boolean;
  creditSystemHooked: boolean;
  authGatePresent: boolean;
  wcagLabels: boolean;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  checks: ValidationChecks;
  /** 0–100 quality score */
  score: number;
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export interface ModuleDependency {
  name: string;
  version: string;
  type: 'npm' | 'internal' | 'supabase-table';
  required: boolean;
}

// ── Versioning ────────────────────────────────────────────────────────────────

export interface ModuleVersion {
  semver: string;
  changelog: string;
  generatedAt: string;
  generatedBy: string;
  /** SHA-256 of all file contents concatenated */
  checksum: string;
}

// ── Commit & Deploy ───────────────────────────────────────────────────────────

export interface CommitRecord {
  sha: string;
  url: string;
  branch: string;
  filesCommitted: string[];
  message: string;
  timestamp: string;
}

export interface DeployRecord {
  deploymentId: string;
  url: string;
  previewUrl: string;
  triggeredAt: string;
  status: 'triggered' | 'building' | 'ready' | 'error';
}

// ── Full Output ───────────────────────────────────────────────────────────────

export interface GeneratedModule {
  id: string;
  request: ModuleRequest;
  artifacts: ModuleArtifacts;
  dependencies: ModuleDependency[];
  validation: ValidationResult;
  version: ModuleVersion;
  commit?: CommitRecord;
  deploy?: DeployRecord;
  status: ModuleStatus;
  generationMs: number;
  generatedAt: string;
}

// ── Supabase Registry ─────────────────────────────────────────────────────────

export interface ModuleRegistryEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  family: ModuleFamily;
  types: string[];
  credits_per_use: number;
  min_plan: PricingTier;
  status: ModuleStatus;
  version: string;
  ui_path: string | null;
  api_path: string | null;
  db_table: string | null;
  commit_sha: string | null;
  deploy_url: string | null;
  generated_at: string;
  updated_at: string;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export type PipelineStepStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped';

export interface PipelineStep {
  name: string;
  status: PipelineStepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface PipelineState {
  moduleId: string;
  steps: PipelineStep[];
  currentStep: string;
  overallStatus: ModuleStatus;
  startedAt: string;
}
