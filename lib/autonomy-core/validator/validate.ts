// lib/autonomy-core/validator/validate.ts
// CR AudioViz AI — Patch Validator
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// Validates proposed patches BEFORE apply. Score ≥ 75 → "apply", < 50 → "reject".
// Checks safety, reversibility, TypeScript integrity signals, and size delta.

import type { CorePatch, ValidationResult, ValidationCheck } from "../crawler/types";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("autonomy");

// ── Individual checks ─────────────────────────────────────────────────────────

function checkNoSecretAdded(patch: CorePatch): ValidationCheck {
  const SECRET_PATTERNS = [
    /(['"])sk-[A-Za-z0-9]{20,}['"]/,
    /(['"])AKIA[A-Z0-9]{16}['"]/,
    /(['"])ghp_[A-Za-z0-9]{36}['"]/,
  ];
  const oldHas = SECRET_PATTERNS.some((p) => p.test(patch.oldContent));
  const newHas = SECRET_PATTERNS.some((p) => p.test(patch.newContent));
  const passed = !(!oldHas && newHas); // only fail if NEW introduced a secret
  return {
    name:   "no_secret_added",
    passed,
    detail: passed ? "No new secrets introduced" : "CRITICAL: patch introduces a hardcoded secret",
    weight: 10,
  };
}

function checkNoImportRemoved(patch: CorePatch): ValidationCheck {
  const extractImports = (c: string) =>
    [...c.matchAll(/^import .+ from ['"][^'"]+['"]/gm)].map((m) => m[0]);
  const oldImports = extractImports(patch.oldContent);
  const newImports = extractImports(patch.newContent);
  const removed    = oldImports.filter((i) => !newImports.includes(i));
  const passed     = removed.length === 0;
  return {
    name:   "no_import_removed",
    passed,
    detail: passed ? "No imports removed" : `Removed imports: ${removed.slice(0, 3).join(", ")}`,
    weight: 8,
  };
}

function checkNoExportRemoved(patch: CorePatch): ValidationCheck {
  const extractExports = (c: string) =>
    [...c.matchAll(/^export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+(\w+)/gm)].map((m) => m[1]);
  const oldExports = extractExports(patch.oldContent);
  const newExports = extractExports(patch.newContent);
  const removed    = oldExports.filter((e) => !newExports.includes(e));
  const passed     = removed.length === 0;
  return {
    name:   "no_export_removed",
    passed,
    detail: passed ? "All public exports preserved" : `Missing exports: ${removed.join(", ")}`,
    weight: 9,
  };
}

function checkSizeDelta(patch: CorePatch): ValidationCheck {
  const oldLines  = patch.oldContent.split("\n").length;
  const newLines  = patch.newContent.split("\n").length;
  const delta     = newLines - oldLines;
  const pctChange = Math.abs(delta / Math.max(oldLines, 1)) * 100;
  // Ring 2 should only make small, safe changes — reject if >20% size change
  const passed    = pctChange <= 20;
  return {
    name:   "size_delta_safe",
    passed,
    detail: `${delta >= 0 ? "+" : ""}${delta} lines (${pctChange.toFixed(1)}% change)`,
    weight: 6,
  };
}

function checkNoAsyncAdded(patch: CorePatch): ValidationCheck {
  // Ring 2 fixes should not introduce new async patterns
  const countAsync = (c: string) => (c.match(/\basync\b/g) ?? []).length;
  const oldAsync   = countAsync(patch.oldContent);
  const newAsync   = countAsync(patch.newContent);
  const passed     = newAsync <= oldAsync;
  return {
    name:   "no_async_added",
    passed,
    detail: passed ? "No new async patterns" : `Added ${newAsync - oldAsync} async keyword(s)`,
    weight: 5,
  };
}

function checkNoDbCall(patch: CorePatch): ValidationCheck {
  // New DB calls must never be introduced by Ring 2
  const DB_PATTERNS = [/supabase\.(from|rpc|storage|auth)\(/, /prisma\./, /pg\.query/];
  const hadDB  = DB_PATTERNS.some((p) => p.test(patch.oldContent));
  const hasDB  = DB_PATTERNS.some((p) => p.test(patch.newContent));
  const passed = hadDB || !hasDB; // only fail if NEW db call introduced
  return {
    name:   "no_db_call_added",
    passed,
    detail: passed ? "No new database calls" : "BLOCKED: patch introduces a new database call",
    weight: 10,
  };
}

function checkNoBillingPath(patch: CorePatch): ValidationCheck {
  const BILLING_PATHS = ["revenue", "billing", "stripe", "paypal", "subscription", "seat"];
  const hadBilling = BILLING_PATHS.some((p) => patch.oldContent.toLowerCase().includes(p));
  const hasBilling = BILLING_PATHS.some((p) => patch.newContent.toLowerCase().includes(p));
  const passed     = hadBilling || !hasBilling;
  return {
    name:   "no_billing_change",
    passed,
    detail: passed ? "No billing code changes" : "BLOCKED: patch touches billing logic",
    weight: 10,
  };
}

function checkRevertsClean(patch: CorePatch): ValidationCheck {
  // Can the patch be reversed? Requires oldContent to be non-empty
  const passed = patch.oldContent.length > 0 && patch.newContent.length > 0;
  return {
    name:   "reversible",
    passed,
    detail: passed ? "Full old content preserved for rollback" : "Cannot roll back — missing content",
    weight: 7,
  };
}

function checkNoAuthChange(patch: CorePatch): ValidationCheck {
  const AUTH_PATTERNS = [/getServerSession/, /supabase\.auth/, /jwt\.verify/, /validateToken/];
  const hadAuth = AUTH_PATTERNS.some((p) => p.test(patch.oldContent));
  const hasAuth = AUTH_PATTERNS.some((p) => p.test(patch.newContent));
  const passed  = hadAuth || !hasAuth;
  return {
    name:   "no_auth_change",
    passed,
    detail: passed ? "No auth logic changes" : "BLOCKED: patch modifies auth code",
    weight: 10,
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScore(checks: ValidationCheck[]): number {
  const totalWeight  = checks.reduce((s, c) => s + c.weight, 0);
  const earnedWeight = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
  return Math.round((earnedWeight / totalWeight) * 100);
}

// ── Main validator ────────────────────────────────────────────────────────────

export async function validatePatch(patch: CorePatch): Promise<ValidationResult> {
  const start  = Date.now();

  const checks: ValidationCheck[] = [
    checkNoSecretAdded(patch),
    checkNoImportRemoved(patch),
    checkNoExportRemoved(patch),
    checkSizeDelta(patch),
    checkNoAsyncAdded(patch),
    checkNoDbCall(patch),
    checkNoBillingPath(patch),
    checkRevertsClean(patch),
    checkNoAuthChange(patch),
  ];

  const score  = computeScore(checks);
  const failed = checks.filter((c) => !c.passed);

  // Any weight-10 fail → immediate reject regardless of score
  const criticalFail = failed.some((c) => c.weight >= 10);

  const recommendation: ValidationResult["recommendation"] =
    criticalFail || score < 50  ? "reject"  :
    score < 75                  ? "review"  : "apply";

  const result: ValidationResult = {
    passed:         recommendation === "apply",
    score,
    checks,
    recommendation,
    durationMs: Date.now() - start,
  };

  log.info(`Patch validation: score=${score} rec=${recommendation}`, {
    meta: { patchId: patch.id, failed: failed.map((c) => c.name) }
  });

  return result;
}
