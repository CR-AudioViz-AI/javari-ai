// lib/autonomy-core/crawler/types.ts
// CR AudioViz AI — Autonomy Core Crawler Types
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// All types used by the crawler, diff engine, fixer, validator, scheduler,
// and reporter. Single source of truth — never duplicated.

// ── Feature flag shape ────────────────────────────────────────────────────────

export interface AutonomyCoreConfig {
  enabled:              boolean;  // AUTONOMOUS_CORE_ENABLED
  mode:                 "continuous" | "manual" | "dry_run";
  ring:                 1 | 2 | 3;            // 1=log-only, 2=auto-apply safe, 3=all
  scope:                "core_only";          // always core_only for STEP 11
  intervalMinutes:      number;              // AUTONOMOUS_CORE_INTERVAL_MINUTES
  maxPatchesPerCycle:   number;              // AUTONOMOUS_CORE_MAX_PATCHES_PER_CYCLE
  killSwitch:           boolean;             // AUTONOMOUS_CORE_KILL_SWITCH
  requireValidator:     boolean;             // AUTONOMOUS_CORE_REQUIRE_VALIDATOR
  degradedOnAnomaly:    boolean;             // AUTONOMOUS_CORE_DEGRADED_ON_ANOMALY
}

export function getAutonomyCoreConfig(): AutonomyCoreConfig {
  return {
    enabled:            process.env.AUTONOMOUS_CORE_ENABLED           === "true",
    mode:               (process.env.AUTONOMOUS_CORE_MODE             ?? "continuous") as AutonomyCoreConfig["mode"],
    ring:               (parseInt(process.env.AUTONOMOUS_CORE_RING    ?? "2")          || 2) as 1 | 2 | 3,
    scope:              "core_only",
    intervalMinutes:    parseInt(process.env.AUTONOMOUS_CORE_INTERVAL_MINUTES        ?? "15") || 15,
    maxPatchesPerCycle: parseInt(process.env.AUTONOMOUS_CORE_MAX_PATCHES_PER_CYCLE   ?? "3")  || 3,
    killSwitch:         process.env.AUTONOMOUS_CORE_KILL_SWITCH       === "true",
    requireValidator:   process.env.AUTONOMOUS_CORE_REQUIRE_VALIDATOR !== "false",  // default true
    degradedOnAnomaly:  process.env.AUTONOMOUS_CORE_DEGRADED_ON_ANOMALY !== "false", // default true
  };
}

// ── Inventory types ───────────────────────────────────────────────────────────

export interface RouteInventory {
  path:       string;         // file path in repo
  route:      string;         // Next.js route e.g. /api/health/live
  methods:    string[];       // GET, POST, etc.
  runtime:    "nodejs" | "edge" | "unknown";
  sizeBytes:  number;
  lastSeen:   string;         // ISO timestamp
}

export interface ApiInventory {
  path:       string;
  route:      string;
  methods:    string[];
  exports:    string[];       // exported function/var names
  hasAuth:    boolean;
  hasRateLimit: boolean;
  sizeBytes:  number;
  lastSeen:   string;
}

export interface ComponentInventory {
  path:       string;
  name:       string;
  isClient:   boolean;        // "use client" directive
  imports:    string[];       // imported modules
  hasA11y:    boolean;        // any aria-* found
  sizeBytes:  number;
  lastSeen:   string;
}

export interface LibInventory {
  path:       string;
  module:     string;         // e.g. lib/observability/logger
  exports:    string[];
  sizeBytes:  number;
  lastSeen:   string;
}

export interface DbInventory {
  migrationFile: string;
  tables:        string[];
  policies:      string[];
  hasTrigger:    boolean;
  sizeBytes:     number;
  lastSeen:      string;
}

export interface RepoInventory {
  rootFiles:  string[];       // top-level files
  dirs:       string[];       // top-level dirs
  totalFiles: number;
  commitSha?: string;
  lastSeen:   string;
}

// ── Crawl snapshot ────────────────────────────────────────────────────────────

export interface CrawlSnapshot {
  id:          string;        // snap_<timestamp>_<rand>
  takenAt:     string;        // ISO
  routes:      RouteInventory[];
  apiRoutes:   ApiInventory[];
  components:  ComponentInventory[];
  libs:        LibInventory[];
  migrations:  DbInventory[];
  repo:        RepoInventory;
  durationMs:  number;
  ring:        number;
  scope:       string;
}

// ── Anomaly types ─────────────────────────────────────────────────────────────

export type AnomalySeverity = "info" | "warn" | "error" | "critical";

export interface Anomaly {
  id:          string;
  snapshotId:  string;
  type:        AnomalyType;
  severity:    AnomalySeverity;
  filePath:    string;
  message:     string;
  detail?:     string;
  fixable:     boolean;       // can Ring 2 auto-fix?
  fixType?:    FixType;
  detectedAt:  string;
}

export type AnomalyType =
  | "missing_error_handler"
  | "missing_auth_guard"
  | "missing_rate_limit"
  | "large_file"              // >500 lines
  | "no_runtime_declaration"
  | "missing_dynamic_export"
  | "client_component_no_ssr" // large client bundle risk
  | "missing_a11y"
  | "deprecated_import"
  | "console_log_in_prod"
  | "hardcoded_secret_pattern"
  | "missing_migration_rls"
  | "unhandled_promise"
  | "no_type_annotation"
  | "api_route_no_method_guard"
  | "missing_cache_header";

export type FixType =
  | "add_runtime_declaration"
  | "add_dynamic_export"
  | "remove_console_log"
  | "add_cache_header_comment"
  | "add_no_store_header_comment"
  | "wrap_promise_catch"
  | "add_error_boundary_comment";

// ── Patch types ───────────────────────────────────────────────────────────────

export type PatchStatus = "pending" | "applied" | "rejected" | "rolled_back" | "failed";
export type PatchRing   = 1 | 2 | 3;

export interface CorePatch {
  id:          string;        // patch_<timestamp>_<rand>
  snapshotId:  string;
  anomalyId:   string;
  filePath:    string;
  fixType:     FixType;
  ring:        PatchRing;
  description: string;
  oldContent:  string;        // full file before (for rollback)
  newContent:  string;        // full file after
  status:      PatchStatus;
  validatorScore?: number;    // 0-100
  appliedAt?:  string;
  rolledBackAt?: string;
  rolledBackReason?: string;
}

// ── Cycle report ──────────────────────────────────────────────────────────────

export interface CycleReport {
  id:           string;
  startedAt:    string;
  completedAt:  string;
  durationMs:   number;
  snapshotId:   string;
  anomaliesFound:  number;
  anomaliesByType: Record<string, number>;
  patchesAttempted: number;
  patchesApplied:   number;
  patchesRejected:  number;
  patchesFailed:    number;
  ring:         number;
  mode:         string;
  status:       "completed" | "halted" | "degraded" | "error";
  haltReason?:  string;
  patches:      CorePatch[];
}

// ── Validator types ───────────────────────────────────────────────────────────

export interface ValidationResult {
  passed:        boolean;
  score:         number;        // 0-100
  checks:        ValidationCheck[];
  recommendation: "apply" | "reject" | "review";
  durationMs:    number;
}

export interface ValidationCheck {
  name:    string;
  passed:  boolean;
  detail:  string;
  weight:  number;              // importance weight 1-10
}
