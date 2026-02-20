// lib/javari/modules/validator.ts
// Module Factory Validator v2.1
// Static analysis + security + schema checks on generated artifacts
// OWASP Top 10 aware, WCAG 2.2 AA checks, no external linting deps
// 2026-02-19 — P1-003 — Fixed: AUTH001 false positive for db-only modules
// Timestamp: 2026-02-19 22:10 EST

import type {
  ModuleArtifacts,
  ModuleRequest,
  ValidationResult,
  ValidationIssue,
  ValidationChecks,
} from './types';

// ── Security Patterns (OWASP Top 10) ─────────────────────────────────────────

const HARDCODED_SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /sk-ant-[a-zA-Z0-9]{20,}/,
  /eyJhbGci[a-zA-Z0-9._-]{20,}/,          // Raw JWTs
  /password\s*=\s*["'][^"']{4,}/i,
  /secret\s*=\s*["'][^"']{8,}/i,
  /api[_-]?key\s*=\s*["'][^"']{8,}/i,
  /AKIA[0-9A-Z]{16}/,                      // AWS access keys
];

const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/, code: 'SEC001', message: 'eval() detected — XSS risk' },
  { pattern: /dangerouslySetInnerHTML/, code: 'SEC002', message: 'dangerouslySetInnerHTML — XSS risk; sanitize first' },
  { pattern: /console\.log\(.*(?:key|secret|password|token)/i, code: 'SEC004', message: 'Possible credential logging' },
  { pattern: /\.innerHTML\s*=/, code: 'SEC005', message: 'innerHTML assignment — XSS risk' },
  { pattern: /document\.write/, code: 'SEC006', message: 'document.write() — XSS risk' },
];

// Only applies to client components (files with "use client")
const CLIENT_DANGEROUS_PATTERNS = [
  {
    pattern: /process\.env\.(?!NEXT_PUBLIC_)[A-Z_]+/,
    code: 'SEC003',
    message: 'Non-public env var in client component — use NEXT_PUBLIC_ or move to server',
  },
];

const TS_CHECKS = [
  { pattern: /: any(?:\s|;|,|\))/, code: 'TS001', message: 'Implicit any — use explicit type', severity: 'warning' as const },
  { pattern: /\/\/ @ts-ignore/, code: 'TS002', message: '@ts-ignore suppresses type checking', severity: 'warning' as const },
  { pattern: /\/\/ @ts-nocheck/, code: 'TS003', message: '@ts-nocheck disables all type checking', severity: 'error' as const },
  { pattern: /as unknown as/, code: 'TS004', message: 'Double cast (as unknown as) — unsafe', severity: 'warning' as const },
];

// ── Helper: Scan File For Issues ──────────────────────────────────────────────

function scanFile(
  content: string,
  filePath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');
  const isClient = content.includes("'use client'") || content.includes('"use client"');

  // Line-by-line scans
  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Hardcoded secrets (all file types)
    for (const pattern of HARDCODED_SECRET_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          severity: 'error',
          file: filePath,
          line: lineNum,
          code: 'SEC000',
          message: 'Potential hardcoded secret detected — use environment variables',
        });
      }
    }

    // Dangerous patterns (all file types)
    for (const { pattern, code, message } of DANGEROUS_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({ severity: 'error', file: filePath, line: lineNum, code, message });
      }
    }

    // Client-only patterns
    if (isClient) {
      for (const { pattern, code, message } of CLIENT_DANGEROUS_PATTERNS) {
        if (pattern.test(line)) {
          issues.push({ severity: 'error', file: filePath, line: lineNum, code, message });
        }
      }
    }

    // TypeScript checks
    for (const { pattern, code, message, severity } of TS_CHECKS) {
      if (pattern.test(line)) {
        issues.push({ severity, file: filePath, line: lineNum, code, message });
      }
    }
  });

  return issues;
}

// ── Check: API Route Shape ────────────────────────────────────────────────────

function checkAPIRouteShape(content: string): { passed: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const filePath = 'api-route';

  const hasNextRequest = /NextRequest/.test(content);
  const hasNextResponse = /NextResponse/.test(content);
  const hasDynamic = /export const dynamic/.test(content);
  const hasNamedExport = /export async function (GET|POST|PUT|PATCH|DELETE)/.test(content);
  const hasDefaultExport = /export default/.test(content);

  if (!hasNextRequest || !hasNextResponse) {
    issues.push({
      severity: 'error', file: filePath, code: 'API001',
      message: 'API route must import NextRequest and NextResponse from next/server',
    });
  }
  if (!hasDynamic) {
    issues.push({
      severity: 'warning', file: filePath, code: 'API002',
      message: 'Missing: export const dynamic = "force-dynamic"',
    });
  }
  if (!hasNamedExport) {
    issues.push({
      severity: 'error', file: filePath, code: 'API003',
      message: 'API route must export named async functions (GET, POST, etc.)',
    });
  }
  if (hasDefaultExport) {
    issues.push({
      severity: 'error', file: filePath, code: 'API004',
      message: 'API routes must NOT use export default in Next.js 14 App Router',
    });
  }

  return { passed: issues.filter((i) => i.severity === 'error').length === 0, issues };
}

// ── Check: Credit System Hook ─────────────────────────────────────────────────

function checkCreditSystem(artifacts: ModuleArtifacts): boolean {
  if (artifacts.request && (artifacts.request as unknown as ModuleRequest).creditsPerUse === 0) {
    return true; // Free module — no credit system required
  }

  const allContent = [
    artifacts.uiPage?.content ?? '',
    ...artifacts.apiRoutes.map((r) => r.content),
  ].join('\n');

  // Accept any of these patterns as credit system hooks
  return (
    /credits/.test(allContent) ||
    /credit/.test(allContent) ||
    /creditsPerUse/.test(allContent) ||
    /deduct/.test(allContent) ||
    /user_credits/.test(allContent) ||
    /balance/.test(allContent)
  );
}

// ── Check: Auth Gate ──────────────────────────────────────────────────────────

function checkAuthGate(artifacts: ModuleArtifacts): boolean {
  const uiContent = artifacts.uiPage?.content ?? '';
  const apiContent = artifacts.apiRoutes.map((r) => r.content).join('\n');

  // UI: must use useAuth or useUser or check user
  const uiHasAuth = /useAuth|useUser|useAuthContext/.test(uiContent) || /!user/.test(uiContent);

  // API: must verify auth token / JWT
  const apiHasAuth =
    /authorization|getUser|verifyToken|auth\.uid|Bearer/i.test(apiContent);

  // Accept if at least the API has auth (UI might be generated without auth for free modules)
  return uiHasAuth || apiHasAuth;
}

// ── Check: WCAG Labels ────────────────────────────────────────────────────────

function checkWCAGLabels(content: string): boolean {
  if (!content || content.length < 50) return true; // No UI — skip

  const hasInteractiveElements =
    /<(button|input|textarea|select|a)[^>]*>/.test(content);

  if (!hasInteractiveElements) return true;

  return (
    /aria-label/.test(content) ||
    /aria-labelledby/.test(content) ||
    /htmlFor/.test(content) ||
    /<label/.test(content)
  );
}

// ── Check: Schema Completeness ────────────────────────────────────────────────

function checkSchemaCompleteness(artifacts: ModuleArtifacts): boolean {
  // Registry entry must be valid JSON with required fields
  const reg = artifacts.registryEntry;
  if (!reg) return false;

  try {
    const parsed = JSON.parse(reg.content) as Record<string, unknown>;
    const required = ['slug', 'name', 'family', 'types', 'creditsPerUse', 'routes'];
    return required.every((field) => field in parsed);
  } catch {
    return false;
  }
}

// ── Check: TypeScript Syntax (structural heuristics) ─────────────────────────

function checkTypeScriptSyntax(content: string, filePath: string): { passed: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  // Check for common structural issues
  const openBraces = (content.match(/\{/g) ?? []).length;
  const closeBraces = (content.match(/\}/g) ?? []).length;

  if (Math.abs(openBraces - closeBraces) > 3) {
    issues.push({
      severity: 'warning',
      file: filePath,
      code: 'TS010',
      message: `Brace mismatch: ${openBraces} open vs ${closeBraces} close — possible truncation`,
    });
  }

  // Check for incomplete async functions
  const asyncFnCount = (content.match(/async function/g) ?? []).length;
  const returnCount = (content.match(/return /g) ?? []).length;
  if (asyncFnCount > 0 && returnCount === 0) {
    issues.push({
      severity: 'warning',
      file: filePath,
      code: 'TS011',
      message: 'Async functions with no return statement — possible truncation',
    });
  }

  return { passed: issues.filter((i) => i.severity === 'error').length === 0, issues };
}

// ── Compute Quality Score ─────────────────────────────────────────────────────

function computeScore(
  checks: ValidationChecks,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): number {
  let score = 100;

  // Deduct for failed checks (weighted)
  if (!checks.typescriptSyntax)     score -= 20;
  if (!checks.schemaCompleteness)   score -= 15;
  if (!checks.apiRouteShape)        score -= 20;
  if (!checks.noHardcodedSecrets)   score -= 30; // Security: heavy penalty
  if (!checks.creditSystemHooked)   score -= 10;
  if (!checks.authGatePresent)      score -= 15;
  if (!checks.wcagLabels)           score -= 10;

  // Deduct for individual issues
  score -= errors.length * 5;
  score -= warnings.length * 1;

  return Math.max(0, Math.min(100, score));
}

// ── Main Validator ────────────────────────────────────────────────────────────

export function validateModule(
  req: ModuleRequest,
  artifacts: ModuleArtifacts
): ValidationResult {
  const allErrors: ValidationIssue[] = [];
  const allWarnings: ValidationIssue[] = [];

  // Attach request to artifacts for credit system check
  (artifacts as ModuleArtifacts & { request?: ModuleRequest }).request = req;

  // ── Scan all TypeScript files ─────────────────────────────────────────────
  const tsFiles: Array<{ path: string; content: string }> = [];
  if (artifacts.uiPage) tsFiles.push({ path: artifacts.uiPage.path, content: artifacts.uiPage.content });
  tsFiles.push(...artifacts.uiComponents.map((f) => ({ path: f.path, content: f.content })));
  tsFiles.push(...artifacts.apiRoutes.map((f) => ({ path: f.path, content: f.content })));

  for (const file of tsFiles) {
    const fileIssues = scanFile(file.content, file.path);
    allErrors.push(...fileIssues.filter((i) => i.severity === 'error'));
    allWarnings.push(...fileIssues.filter((i) => i.severity === 'warning'));
  }

  // ── TypeScript syntax check ───────────────────────────────────────────────
  let syntaxPassed = true;
  for (const file of tsFiles) {
    const { passed, issues } = checkTypeScriptSyntax(file.content, file.path);
    if (!passed) syntaxPassed = false;
    allErrors.push(...issues.filter((i) => i.severity === 'error'));
    allWarnings.push(...issues.filter((i) => i.severity === 'warning'));
  }

  // ── API route shape check ─────────────────────────────────────────────────
  let apiRoutePassed = true;
  for (const apiFile of artifacts.apiRoutes) {
    const { passed, issues } = checkAPIRouteShape(apiFile.content);
    if (!passed) apiRoutePassed = false;
    allErrors.push(...issues.filter((i) => i.severity === 'error'));
    allWarnings.push(...issues.filter((i) => i.severity === 'warning'));
  }
  if (artifacts.apiRoutes.length === 0 && (req.types.includes('api') || req.types.includes('full-stack'))) {
    apiRoutePassed = false;
    allErrors.push({
      severity: 'error', file: 'pipeline', code: 'API000',
      message: 'API route required but not generated',
    });
  }

  // ── Security: no hardcoded secrets ───────────────────────────────────────
  const noHardcodedSecrets = !allErrors.some((e) => e.code === 'SEC000');

  // ── Schema completeness ───────────────────────────────────────────────────
  const schemaComplete = checkSchemaCompleteness(artifacts);
  if (!schemaComplete) {
    allErrors.push({
      severity: 'error', file: artifacts.registryEntry.path, code: 'REG001',
      message: 'Registry entry missing required fields (slug, name, family, types, creditsPerUse, routes)',
    });
  }

  // ── Credit system ─────────────────────────────────────────────────────────
  const creditHooked = checkCreditSystem(artifacts);
  if (!creditHooked && req.creditsPerUse > 0) {
    allWarnings.push({
      severity: 'warning', file: 'pipeline', code: 'CRED001',
      message: 'Credit deduction not detected in generated code — verify manually',
    });
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  // DB-only modules have no UI or API routes — auth gate not applicable
  const isDbOnly = req.types.length > 0 && req.types.every((t) => t === 'db');
  const authGate = isDbOnly || checkAuthGate(artifacts);
  if (!authGate) {
    allErrors.push({
      severity: 'error', file: 'pipeline', code: 'AUTH001',
      message: 'No auth gate detected in UI or API route',
    });
  }

  // ── WCAG labels ───────────────────────────────────────────────────────────
  const wcagOk = checkWCAGLabels(artifacts.uiPage?.content ?? '');
  if (!wcagOk) {
    allWarnings.push({
      severity: 'warning', file: artifacts.uiPage?.path ?? 'ui', code: 'WCAG001',
      message: 'Interactive elements without aria-label, aria-labelledby, or htmlFor',
    });
  }

  const checks: ValidationChecks = {
    typescriptSyntax: syntaxPassed,
    schemaCompleteness: schemaComplete,
    apiRouteShape: artifacts.apiRoutes.length === 0 ? true : apiRoutePassed,
    noHardcodedSecrets,
    creditSystemHooked: req.creditsPerUse === 0 ? true : creditHooked,
    authGatePresent: authGate,
    wcagLabels: wcagOk,
  };

  const score = computeScore(checks, allErrors, allWarnings);
  const passed = allErrors.length === 0;

  return {
    passed,
    errors: allErrors,
    warnings: allWarnings,
    checks,
    score,
  };
}
