// lib/repair/repairPlanner.ts
// Purpose: Repair planner — converts CodeIssue findings from the intelligence
//          engine into structured RepairPlan objects with strategies, risk levels,
//          and sequenced steps. Each plan drives one patch generation cycle.
// Date: 2026-03-07

import type { CodeIssue, Severity } from "@/lib/intelligence/codeAnalyzer";

// ── Types ──────────────────────────────────────────────────────────────────

export type RepairStrategy =
  | "replace_pattern"    // regex-based substitution in file
  | "insert_guard"       // add a guard clause / auth check
  | "refactor_query"     // restructure N+1 or SQL pattern
  | "remove_dead_code"   // delete unused export / import
  | "add_timeout"        // wrap fetch with AbortSignal.timeout
  | "add_test_file"      // generate test file for untested module
  | "parameterize_sql"   // convert SQL string concat to parameterized
  | "ai_rewrite"         // full AI-driven file rewrite (complex cases)
  | "add_comment_only";  // low-risk — add TODO resolution comment

export interface RepairStep {
  order       : number;
  action      : string;
  description : string;
}

export interface RepairPlan {
  issueId     : string;   // deterministic — derived from issue signature
  taskId?     : string;   // roadmap task ID if injected
  issue       : CodeIssue;
  strategy    : RepairStrategy;
  riskLevel   : "safe" | "low" | "medium" | "high";
  steps       : RepairStep[];
  targetFile  : string;
  estimatedMs : number;   // rough estimate
  requiresPR  : boolean;  // true → create PR instead of direct commit
  prBranch    : string;
  aiPrompt    : string;   // sent to patchGenerator for AI rewrites
  canAutoMerge: boolean;  // only true for very safe, reversible changes
}

// ── Strategy selector ──────────────────────────────────────────────────────

function selectStrategy(issue: CodeIssue): RepairStrategy {
  const { type, rule } = issue as CodeIssue & { rule?: string };

  switch (rule) {
    case "SQL_INJECTION_TEMPLATE":
    case "SQL_INJECTION_CONCAT":
      return "parameterize_sql";
    case "DANGEROUS_EVAL":
    case "DANGEROUS_FUNCTION_CONSTRUCTOR":
      return "replace_pattern";
    case "HARDCODED_SECRET_KEY":
    case "HARDCODED_JWT_SECRET":
    case "AWS_ACCESS_KEY":
      return "replace_pattern";       // replace literal with getSecret() call
    case "API_ROUTE_NO_AUTH":
      return "insert_guard";
    case "N_PLUS_1_AWAIT_IN_LOOP":
    case "N_PLUS_1_FOREACH_AWAIT":
      return "refactor_query";
    case "MISSING_REQUEST_TIMEOUT":
      return "add_timeout";
    case "SYNC_FS_READ":
    case "SYNC_FS_WRITE":
    case "SYNC_EXEC":
      return "replace_pattern";
    case "BARREL_IMPORT_LODASH":
    case "BARREL_IMPORT_MOMENT":
    case "STAR_IMPORT":
      return "replace_pattern";
    case "UNUSED_IMPORT":
      return "remove_dead_code";
    case "UNUSED_EXPORT":
      return "add_comment_only";
    case "DEAD_ROUTE":
      return "add_comment_only";
    case "MISSING_TEST_FILE":
    case "UNTESTED_API_ROUTE":
      return "add_test_file";
    case "TODO_COMMENT_FIXME":
    case "TODO_COMMENT_BUG":
      return "ai_rewrite";
    default:
      // Fall back by issue type
      if (type === "security")    return "ai_rewrite";
      if (type === "performance") return "replace_pattern";
      if (type === "testing")     return "add_test_file";
      return "ai_rewrite";
  }
}

function riskLevel(issue: CodeIssue, strategy: RepairStrategy): RepairPlan["riskLevel"] {
  if (issue.severity === "critical") return "high";
  if (strategy === "remove_dead_code" || strategy === "add_comment_only") return "safe";
  if (strategy === "add_timeout" || strategy === "add_test_file") return "low";
  if (strategy === "replace_pattern" || strategy === "insert_guard") return "low";
  if (strategy === "refactor_query" || strategy === "parameterize_sql") return "medium";
  if (strategy === "ai_rewrite") return "medium";
  return "medium";
}

function buildSteps(strategy: RepairStrategy, issue: CodeIssue): RepairStep[] {
  const file = issue.file;
  switch (strategy) {
    case "parameterize_sql":
      return [
        { order: 1, action: "fetch_file",         description: `Fetch current content of ${file}` },
        { order: 2, action: "locate_pattern",      description: "Locate SQL template literal or concatenation" },
        { order: 3, action: "generate_patch",      description: "Convert to parameterized query ($1, $2 or Supabase RPC)" },
        { order: 4, action: "validate_syntax",     description: "Verify TypeScript compiles" },
        { order: 5, action: "commit_or_pr",        description: "Commit fix to repair branch" },
      ];
    case "insert_guard":
      return [
        { order: 1, action: "fetch_file",          description: `Fetch current content of ${file}` },
        { order: 2, action: "locate_handler",      description: "Locate POST/DELETE handler function" },
        { order: 3, action: "generate_patch",      description: "Insert session/auth check at function entry" },
        { order: 4, action: "commit_or_pr",        description: "Commit fix to repair branch" },
      ];
    case "replace_pattern":
      return [
        { order: 1, action: "fetch_file",          description: `Fetch ${file}` },
        { order: 2, action: "apply_substitution",  description: `Apply pattern replacement per rule: ${(issue as CodeIssue & {rule?: string}).rule ?? "unknown"}` },
        { order: 3, action: "commit_or_pr",        description: "Commit fix" },
      ];
    case "add_timeout":
      return [
        { order: 1, action: "fetch_file",          description: `Fetch ${file}` },
        { order: 2, action: "wrap_fetch_calls",    description: "Add AbortSignal.timeout(10_000) to all fetch() calls" },
        { order: 3, action: "commit_or_pr",        description: "Commit fix" },
      ];
    case "remove_dead_code":
      return [
        { order: 1, action: "fetch_file",          description: `Fetch ${file}` },
        { order: 2, action: "remove_unused_import", description: `Remove unused import at line ${issue.line ?? "?"}` },
        { order: 3, action: "commit_or_pr",        description: "Commit cleanup" },
      ];
    case "refactor_query":
      return [
        { order: 1, action: "fetch_file",          description: `Fetch ${file}` },
        { order: 2, action: "extract_ids",         description: "Extract IDs before loop" },
        { order: 3, action: "batch_query",         description: "Replace loop with single batched query using .in() or Promise.all()" },
        { order: 4, action: "commit_or_pr",        description: "Commit refactor" },
      ];
    case "add_test_file":
      return [
        { order: 1, action: "fetch_source",        description: `Fetch ${file} to understand exports` },
        { order: 2, action: "generate_tests",      description: "Generate test file with describe/it blocks for each export" },
        { order: 3, action: "commit_test_file",    description: "Commit test file to repo" },
      ];
    case "ai_rewrite":
      return [
        { order: 1, action: "fetch_file",          description: `Fetch ${file}` },
        { order: 2, action: "ai_analyze",          description: `Send to AI with context: ${issue.description}` },
        { order: 3, action: "ai_generate_patch",   description: "AI generates complete fixed file" },
        { order: 4, action: "validate",            description: "Validate output is valid TypeScript" },
        { order: 5, action: "create_pr",           description: "Create GitHub PR for review" },
      ];
    default:
      return [
        { order: 1, action: "fetch_file",          description: `Fetch ${file}` },
        { order: 2, action: "generate_patch",      description: "Generate fix" },
        { order: 3, action: "commit_or_pr",        description: "Commit or PR" },
      ];
  }
}

function buildAIPrompt(issue: CodeIssue, strategy: RepairStrategy): string {
  return `You are an expert TypeScript/Next.js engineer performing an automated code repair.

ISSUE DETECTED:
  File: ${issue.file}
  Line: ${issue.line ?? "unknown"}
  Severity: ${issue.severity}
  Type: ${issue.type}
  Description: ${issue.description}
  Rule: ${(issue as CodeIssue & {rule?: string}).rule ?? "general"}

SUGGESTED FIX:
  ${issue.suggested_fix}

REPAIR STRATEGY: ${strategy}

INSTRUCTIONS:
1. You will be given the CURRENT FILE CONTENT.
2. Generate the COMPLETE FIXED FILE — never partial diffs.
3. Fix ONLY the reported issue. Do not refactor unrelated code.
4. Preserve all existing imports, exports, comments, and logic not related to the fix.
5. Ensure TypeScript strict mode compliance. No \`any\` without justification.
6. Add a single-line comment near the fix: // [javari-repair] fixed: ${issue.description.slice(0, 60)}
7. Return ONLY the complete file content. No markdown fences. No explanation.

CURRENT FILE CONTENT:
{{FILE_CONTENT}}`;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
}

// ── Main planner ───────────────────────────────────────────────────────────

export function planRepairs(issues: CodeIssue[], taskId?: string): RepairPlan[] {
  const plans: RepairPlan[] = [];

  for (let i = 0; i < issues.length; i++) {
    const issue    = issues[i];
    const strategy = selectStrategy(issue);
    const risk     = riskLevel(issue, strategy);
    const steps    = buildSteps(strategy, issue);

    const issueSlug = slugify(`${issue.type}-${issue.file.split("/").pop() ?? issue.file}`);
    const issueId   = `repair-${issueSlug}-${i}`;
    const prBranch  = `javari-repair/${issueSlug}-${Date.now()}`;

    // Only high-risk or critical issues require PRs; safe/low go direct
    const requiresPR  = risk === "high" || risk === "medium" || issue.severity === "critical";
    const canAutoMerge = risk === "safe" && issue.severity !== "critical";

    plans.push({
      issueId,
      taskId,
      issue,
      strategy,
      riskLevel   : risk,
      steps,
      targetFile  : issue.file,
      estimatedMs : steps.length * 1500,
      requiresPR,
      prBranch,
      aiPrompt    : buildAIPrompt(issue, strategy),
      canAutoMerge,
    });
  }

  return plans;
}

// Priority sort: critical first, then by strategy risk
export function prioritizePlans(plans: RepairPlan[]): RepairPlan[] {
  const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const RISK_ORDER: Record<RepairPlan["riskLevel"], number> = { safe: 0, low: 1, medium: 2, high: 3 };

  return [...plans].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity];
    if (sevDiff !== 0) return sevDiff;
    return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
  });
}
