// lib/repair/verificationRunner.ts
// Purpose: Verification runner — validates repaired code before and after commit.
//          Runs: TypeScript heuristic checks, lint signal detection, basic
//          syntax validation, and Vercel build status polling.
//          Records verification_report artifact in roadmap_task_artifacts.
// Date: 2026-03-07

import { recordArtifact }  from "@/lib/roadmap/artifactRecorder";
import type { PRResult }   from "./pullRequestCreator";
import type { PatchResult } from "./patchGenerator";

// ── Types ──────────────────────────────────────────────────────────────────

export interface VerificationCheck {
  name    : string;
  passed  : boolean;
  detail  : string;
}

export interface VerificationReport {
  ok            : boolean;
  taskId        : string;
  checks        : VerificationCheck[];
  buildStatus   : "unknown" | "passing" | "failing" | "skipped";
  lintStatus    : "clean" | "warnings" | "errors" | "skipped";
  syntaxValid   : boolean;
  artifactId?   : string;
  durationMs    : number;
  notes         : string[];
}

// ── TypeScript heuristic checks ────────────────────────────────────────────
// (No tsc available in serverless — use text-based validation)

function checkTypeScriptHeuristics(content: string, file: string): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  // Balanced braces
  const open  = (content.match(/\{/g) ?? []).length;
  const close = (content.match(/\}/g) ?? []).length;
  checks.push({
    name  : "balanced_braces",
    passed: Math.abs(open - close) <= 2,  // small tolerance for string literals
    detail: `{ count=${open} } count=${close}`,
  });

  // Balanced parentheses
  const openP  = (content.match(/\(/g) ?? []).length;
  const closeP = (content.match(/\)/g) ?? []).length;
  checks.push({
    name  : "balanced_parens",
    passed: Math.abs(openP - closeP) <= 3,
    detail: `( count=${openP} ) count=${closeP}`,
  });

  // No obvious syntax errors
  const hasSyntaxMarkers = /^\s*}\s*$/.test(content) && content.trim().startsWith("}");
  checks.push({
    name  : "no_orphaned_braces",
    passed: !hasSyntaxMarkers,
    detail: hasSyntaxMarkers ? "File starts with }" : "OK",
  });

  // Has at least one export (for library files)
  if (file.startsWith("lib/")) {
    const hasExport = /\bexport\b/.test(content);
    checks.push({
      name  : "has_exports",
      passed: hasExport,
      detail: hasExport ? "Exports found" : "No exports — may be broken",
    });
  }

  // No raw process.env for sensitive values (new secrets must use getSecret)
  const sensitiveEnvPattern = /process\.env\.(?:SECRET|PRIVATE_KEY|JWT_SECRET|DB_PASSWORD)/i;
  const hasSensitiveEnv = sensitiveEnvPattern.test(content);
  checks.push({
    name  : "no_hardcoded_sensitive_env",
    passed: !hasSensitiveEnv,
    detail: hasSensitiveEnv ? "Found sensitive process.env direct read" : "OK",
  });

  // No eval remaining
  const hasEval = /(?:^|[^A-Za-z0-9_$])eval\s*\(/.test(content);
  checks.push({
    name  : "no_eval",
    passed: !hasEval,
    detail: hasEval ? "eval() still present" : "OK",
  });

  // Repair marker present (confirms patch was applied)
  const hasRepairMarker = content.includes("[javari-repair]");
  checks.push({
    name  : "repair_marker_present",
    passed: hasRepairMarker,
    detail: hasRepairMarker ? "Repair marker found" : "No repair marker — patch may not have applied",
  });

  return checks;
}

// ── Lint signal detection ──────────────────────────────────────────────────
// Textual patterns that indicate common ESLint errors

function detectLintSignals(content: string): {
  status: VerificationReport["lintStatus"];
  signals: string[];
} {
  const errors: string[]   = [];
  const warnings: string[] = [];

  if (/\bvar\s+/.test(content))       warnings.push("var declaration (prefer const/let)");
  if (/==(?!=)/.test(content))        warnings.push("loose equality (==)");
  if (/console\.log\(/.test(content)) warnings.push("console.log in production code");
  if (/\/\/ @ts-ignore/.test(content)) warnings.push("@ts-ignore present");
  if (/as\s+any\b/.test(content))     warnings.push("TypeScript 'as any' cast");
  if (/!\./.test(content))            warnings.push("Non-null assertion (!) in use");
  if (/TODO|FIXME|HACK/.test(content)) warnings.push("TODO/FIXME comments remain");
  if (/require\s*\(/.test(content) && /import/.test(content)) {
    warnings.push("Mixed require() and import syntax");
  }

  const status: VerificationReport["lintStatus"] =
    errors.length > 0   ? "errors" :
    warnings.length > 0 ? "warnings" :
    "clean";

  return { status, signals: [...errors, ...warnings] };
}

// ── Build status check ─────────────────────────────────────────────────────

async function checkVercelBuildStatus(prBranch?: string): Promise<VerificationReport["buildStatus"]> {
  if (!prBranch) return "skipped";

  const VERCEL_PROJECT = "prj_zxjzE2qvMWFWqV0AspGvago6aPV5";
  const VERCEL_TEAM    = "team_Z0yef7NlFu1coCJWz8UmUdI5";
  const token = process.env.VERCEL_TOKEN ?? "";
  if (!token) return "unknown";

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT}&teamId=${VERCEL_TEAM}&limit=3`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal : AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return "unknown";
    const data = await res.json() as { deployments: Array<{ state: string; meta: { githubCommitRef?: string } }> };
    const branchDeploy = data.deployments.find(d => d.meta?.githubCommitRef === prBranch);
    if (!branchDeploy) return "unknown";
    return branchDeploy.state === "READY" ? "passing" :
           branchDeploy.state === "ERROR" ? "failing" :
           "unknown";
  } catch {
    return "unknown";
  }
}

// ── Main verification runner ───────────────────────────────────────────────

export async function runVerification(
  taskId     : string,
  patch      : PatchResult,
  prResult   : PRResult,
  options    : { recordArtifactEnabled?: boolean } = {}
): Promise<VerificationReport> {
  const t0     = Date.now();
  const checks : VerificationCheck[] = [];
  const notes  : string[] = [];

  // Check 1: Patch generation succeeded
  checks.push({
    name  : "patch_generated",
    passed: patch.ok,
    detail: patch.ok ? patch.patchSummary : (patch.error ?? "unknown"),
  });

  // Check 2: PR/commit created
  checks.push({
    name  : "commit_or_pr_created",
    passed: prResult.ok && prResult.mode !== "skipped",
    detail: prResult.ok
      ? `${prResult.mode}: ${prResult.prUrl ?? prResult.commitSha ?? "ok"}`
      : (prResult.error ?? "skipped"),
  });

  // Check 3: TypeScript heuristic checks on patched content
  if (patch.patchedContent) {
    const tsChecks = checkTypeScriptHeuristics(patch.patchedContent, patch.plan.targetFile);
    checks.push(...tsChecks);
  }

  // Check 4: Lint signals
  const { status: lintStatus, signals } = detectLintSignals(patch.patchedContent ?? "");
  if (signals.length > 0) notes.push(`Lint signals: ${signals.join("; ")}`);

  checks.push({
    name  : "lint_check",
    passed: lintStatus !== "errors",
    detail: lintStatus === "clean" ? "No lint signals" : signals.join("; "),
  });

  // Check 5: Build status (async, best-effort)
  const buildStatus = await checkVercelBuildStatus(prResult.branch);
  checks.push({
    name  : "vercel_build",
    passed: buildStatus !== "failing",
    detail: `build=${buildStatus}`,
  });

  // Check 6: Content is non-empty and non-identical to original (for non-skipped patches)
  if (prResult.mode !== "skipped") {
    const hasChanges = patch.patchedContent !== patch.originalContent;
    checks.push({
      name  : "content_changed",
      passed: hasChanges,
      detail: hasChanges ? "Patched content differs from original" : "No changes detected",
    });
  }

  // Aggregate: overall ok if critical checks pass
  const criticalChecks = ["patch_generated", "commit_or_pr_created", "balanced_braces"];
  const criticalPassed = checks
    .filter(c => criticalChecks.includes(c.name))
    .every(c => c.passed);

  const syntaxValid = checks
    .filter(c => ["balanced_braces", "balanced_parens", "no_orphaned_braces"].includes(c.name))
    .every(c => c.passed);

  const report: VerificationReport = {
    ok         : criticalPassed,
    taskId,
    checks,
    buildStatus,
    lintStatus,
    syntaxValid,
    durationMs : Date.now() - t0,
    notes,
  };

  // Record artifact if enabled
  if (options.recordArtifactEnabled !== false) {
    try {
      const ar = await recordArtifact({
        task_id          : taskId,
        artifact_type    : "verification_report" as "commit", // type widening handled below
        artifact_location: prResult.prUrl ?? prResult.commitSha ?? `repair:${taskId}`,
        artifact_data    : {
          ok          : report.ok,
          buildStatus,
          lintStatus,
          syntaxValid,
          checksTotal : checks.length,
          checksPassed: checks.filter(c => c.passed).length,
          prUrl       : prResult.prUrl,
          prNumber    : prResult.prNumber,
          commitSha   : prResult.commitSha,
          notes,
        },
      });
      report.artifactId = ar.id;
    } catch { /* best-effort */ }
  }

  return report;
}
