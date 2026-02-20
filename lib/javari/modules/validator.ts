// lib/javari/modules/validator.ts
// Module Factory Validator — v2.1 (bug fixes: SEC003, REG001, API000)
// Runs static analysis, security scanning, schema checks on generated artifacts
// No external linting dependencies — pure pattern matching + structural validation
// OWASP Top 10 aware, WCAG 2.2 AA checks
// 2026-02-19 — TASK-P1-003 — Fixed: SEC003 regex, REG001 falsy, API000 scope

import type {
  ModuleArtifacts,
  ModuleRequest,
  ValidationResult,
  ValidationIssue,
  ValidationChecks,
} from './types';

// ── Security Patterns (OWASP Top 10) ─────────────────────────────────────────

const HARDCODED_SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,           // OpenAI keys
  /sk-ant-[a-zA-Z0-9]{20,}/,       // Anthropic keys
  /eyJhbGci/,                        // Raw JWTs
  /password\s*=\s*["'][^"']{4,}/i,  // Hardcoded passwords
  /secret\s*=\s*["'][^"']{8,}/i,    // Hardcoded secrets
  /api[_-]?key\s*=\s*["'][^"']{8,}/i, // Inline API keys
  /AKIA[0-9A-Z]{16}/,               // AWS access keys
];

// Patterns that are dangerous in ALL file types (client and server)
const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/, code: 'SEC001', message: 'eval() detected — XSS risk' },
  { pattern: /dangerouslySetInnerHTML/, code: 'SEC002', message: 'dangerouslySetInnerHTML — XSS risk; sanitize first' },
  { pattern: /console\.log\(.*(?:key|secret|password|token)/i, code: 'SEC004', message: 'Possible credential logging' },
  { pattern: /\.innerHTML\s*=/, code: 'SEC005', message: 'innerHTML assignment — XSS risk' },
  { pattern: /document\.write/, code: 'SEC006', message: 'document.write() — XSS risk' },
];

// Client-only dangerous patterns (only apply to files with "use client")
// FIX: SEC003 regex now uses lookahead at START of var name (not after full [A-Z_]+ match)
// FIX: SEC003 moved to client-only checks — API routes legitimately use server env vars
const CLIENT_DANGEROUS_PATTERNS = [
  {
    // Correct lookahead: checks immediately after "process.env." prefix
    pattern: /process\.env\.(?!NEXT_PUBLIC_)[A-Z_]+/,
    code: 'SEC003',
    message: 'Non-public env var exposed in client component — use NEXT_PUBLIC_ prefix or move to server',
  },
];

// ── TypeScript / React patterns ───────────────────────────────────────────────

const TS_CHECKS = [
  { pattern: /: any(?:\s|;|,|\))/, code: 'TS001', message: 'Implicit any detected — use explicit type', severity: 'warning' as const },
  { pattern: /\/\/ @ts-ignore/, code: 'TS002', message: '@ts-ignore suppresses type checking — fix the underlying issue', severity: 'warning' as const },
  { pattern: /\/\/ @ts-nocheck/, code: 'TS003', message: '@ts-nocheck disables all type checking in this file', severity: 'error' as const },
  { pattern: /as unknown as/, code: 'TS004', message: 'Double cast (as unknown as) — unsafe type assertion', severity: 'warning' as const },
];

const REQUIRED_API_EXPORTS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const REQUIRED_API_PATTERNS = [
  { pattern: /export const dynamic/, code: 'API001', message: 'Missing export const dynamic — add "force-dynamic" for auth routes' },
  { pattern: /NextResponse\.json/, code: 'API002', message: 'Missing NextResponse.json — ensure structured response' },
];

const REQUIRED_UI_PATTERNS = [
  { pattern: /"use client"/, code: 'UI001', message: 'Missing "use client" directive at top of file' },
  { pattern: /aria-label|aria-labelledby|aria-describedby|role=/, code: 'UI002', message: 'No ARIA attributes found — check WCAG 2.2 AA compliance' },
];

// ── Credit System Checks ──────────────────────────────────────────────────────

const CREDIT_PATTERNS = [
  /credits\/deduct/,
  /deductCredits/,
  /creditBalance/,
  /creditsPerUse/,
  /\/api\/credits/,
];

// ── Auth Patterns ─────────────────────────────────────────────────────────────

const AUTH_PATTERNS = [
  /Authorization.*Bearer/,
  /supabase.*auth/i,
  /getSession/,
  /useUser/,
  /verifyJWT/,
  /getUser/,
  /auth\.api\.getUser/,
];

// ── Issue Builder ─────────────────────────────────────────────────────────────

function issue(
  severity: ValidationIssue['severity'],
  file: string,
  code: string,
  message: string,
  line?: number
): ValidationIssue {
  return { severity, file, code, message, ...(line !== undefined ? { line } : {}) };
}

function findLineNumber(content: string, pattern: RegExp): number | undefined {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return undefined;
}

// ── UI File Validation ────────────────────────────────────────────────────────

function validateUIFile(file: { path: string; content: string }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { path, content } = file;

  // Required patterns
  for (const { pattern, code, message } of REQUIRED_UI_PATTERNS) {
    if (!pattern.test(content)) {
      issues.push(issue('error', path, code, message));
    }
  }

  // TypeScript issues
  for (const { pattern, code, message, severity } of TS_CHECKS) {
    if (pattern.test(content)) {
      const line = findLineNumber(content, pattern);
      issues.push(issue(severity, path, code, message, line));
    }
  }

  // Security scan — patterns dangerous in all files
  for (const { pattern, code, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      const line = findLineNumber(content, pattern);
      issues.push(issue('error', path, code, message, line));
    }
  }

  // Client-only checks: SEC003 — server env vars in client components
  if (/"use client"/.test(content)) {
    for (const { pattern, code, message } of CLIENT_DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        const line = findLineNumber(content, pattern);
        issues.push(issue('error', path, code, message, line));
      }
    }
  }

  return issues;
}

// ── API File Validation ───────────────────────────────────────────────────────

function validateAPIFile(file: { path: string; content: string }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { path, content } = file;

  // Must export at least one HTTP verb
  // FIX: Check for both "export async function POST" and "export const POST = "
  // Also handle edge cases: "export function POST", "export const POST:"
  const hasHTTPExport = REQUIRED_API_EXPORTS.some((v) =>
    new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${v}\\b|export\\s+const\\s+${v}\\s*[=:]`
    ).test(content)
  );
  if (!hasHTTPExport) {
    issues.push(issue('error', path, 'API000', 'No HTTP method exported (GET, POST, etc.) — ensure export async function POST or export const POST ='));
  }

  // Required API patterns (warnings, not errors — AI sometimes omits these)
  for (const { pattern, code, message } of REQUIRED_API_PATTERNS) {
    if (!pattern.test(content)) {
      issues.push(issue('warning', path, code, message));
    }
  }

  // TypeScript issues
  for (const { pattern, code, message, severity } of TS_CHECKS) {
    if (pattern.test(content)) {
      const line = findLineNumber(content, pattern);
      issues.push(issue(severity, path, code, message, line));
    }
  }

  // Security scan — ALL file types (no SEC003 here — API routes ARE server-side)
  for (const { pattern, code, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      const line = findLineNumber(content, pattern);
      issues.push(issue('error', path, code, message, line));
    }
  }

  // NOTE: SEC003 (server env var check) intentionally NOT applied to API routes
  // API routes run server-side and legitimately use process.env.* without NEXT_PUBLIC_ prefix

  return issues;
}

// ── SQL Validation ────────────────────────────────────────────────────────────

function validateSQL(file: { path: string; content: string }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { path, content } = file;

  if (!content.includes('ENABLE ROW LEVEL SECURITY') && !content.includes('enable row level security')) {
    issues.push(issue('error', path, 'DB001', 'RLS not enabled — all tables must have Row Level Security'));
  }

  if (!content.includes('gen_random_uuid()') && !content.includes('uuid_generate_v4()') && !content.match(/id\s+uuid/i)) {
    issues.push(issue('warning', path, 'DB002', 'No UUID primary key detected — use id UUID DEFAULT gen_random_uuid()'));
  }

  if (!content.includes('user_id') && !content.includes('auth.users')) {
    issues.push(issue('warning', path, 'DB003', 'No user_id reference — ensure user data ownership is enforced'));
  }

  if (!content.includes('CREATE INDEX') && !content.includes('create index')) {
    issues.push(issue('info', path, 'DB004', 'No indexes defined — add indexes for user_id and created_at columns'));
  }

  return issues;
}

// ── Hardcoded Secret Scan ─────────────────────────────────────────────────────

function scanForSecrets(file: { path: string; content: string }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = file.content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of HARDCODED_SECRET_PATTERNS) {
      if (pattern.test(lines[i])) {
        issues.push(issue('error', file.path, 'SEC010',
          `Potential hardcoded secret on line ${i + 1} — use environment variables`, i + 1));
        break; // One report per line
      }
    }
  }

  return issues;
}

// ── Check Credit System Integration ──────────────────────────────────────────

function checkCreditIntegration(artifacts: ModuleArtifacts): boolean {
  const allContent = [
    artifacts.uiPage?.content ?? '',
    ...artifacts.apiRoutes.map((f) => f.content),
  ].join('\n');

  return CREDIT_PATTERNS.some((p) => p.test(allContent));
}

// ── Check Auth Gate ───────────────────────────────────────────────────────────

function checkAuthGate(artifacts: ModuleArtifacts): boolean {
  const allContent = [
    artifacts.uiPage?.content ?? '',
    ...artifacts.apiRoutes.map((f) => f.content),
  ].join('\n');

  return AUTH_PATTERNS.some((p) => p.test(allContent));
}

// ── Score Calculation ─────────────────────────────────────────────────────────

function calculateScore(
  issues: ValidationIssue[],
  checks: ValidationChecks
): number {
  const errorWeight = 15;
  const warningWeight = 5;

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  const checkBonus = Object.values(checks).filter(Boolean).length * 5;
  const deduction = errors * errorWeight + warnings * warningWeight;

  return Math.max(0, Math.min(100, 60 + checkBonus - deduction));
}

// ── Main Validator ────────────────────────────────────────────────────────────

export function validateModule(
  req: ModuleRequest,
  artifacts: ModuleArtifacts
): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Validate UI page
  if (artifacts.uiPage) {
    allIssues.push(...validateUIFile(artifacts.uiPage));
    allIssues.push(...scanForSecrets(artifacts.uiPage));
  }

  // Validate UI components
  for (const comp of artifacts.uiComponents) {
    allIssues.push(...validateUIFile(comp));
    allIssues.push(...scanForSecrets(comp));
  }

  // Validate API routes
  for (const route of artifacts.apiRoutes) {
    allIssues.push(...validateAPIFile(route));
    allIssues.push(...scanForSecrets(route));
  }

  // Validate DB migration
  if (artifacts.dbMigration) {
    allIssues.push(...validateSQL(artifacts.dbMigration));
  }

  // Registry completeness check
  // FIX: Use "field in registry" (presence check) not !registry[field] (falsy check)
  // This correctly handles creditsPerUse: 0, features: [], enabled: false, etc.
  try {
    const registry = JSON.parse(artifacts.registryEntry.content) as Record<string, unknown>;
    const required = ['slug', 'name', 'description', 'family', 'types', 'creditsPerUse'];
    for (const field of required) {
      if (!(field in registry)) {
        allIssues.push(issue('error', artifacts.registryEntry.path, 'REG001',
          `Registry entry missing required field: ${field}`));
      }
    }
  } catch {
    allIssues.push(issue('error', artifacts.registryEntry.path, 'REG000',
      'Registry entry is not valid JSON'));
  }

  // Compute checks
  const checks: ValidationChecks = {
    typescriptSyntax: !allIssues.some((i) => i.code.startsWith('TS') && i.severity === 'error'),
    schemaCompleteness: !allIssues.some((i) => i.code.startsWith('REG') && i.severity === 'error'),
    apiRouteShape: artifacts.apiRoutes.length === 0 ||  // no API routes = still ok (UI-only module)
      !allIssues.some((i) => i.code === 'API000' && i.severity === 'error'),
    noHardcodedSecrets: !allIssues.some((i) => i.code === 'SEC010'),
    creditSystemHooked: checkCreditIntegration(artifacts),
    authGatePresent: checkAuthGate(artifacts),
    wcagLabels: !allIssues.some((i) => i.code === 'UI002' && i.severity === 'error'),
  };

  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');
  const score = calculateScore(allIssues, checks);

  // Pass criteria: no errors AND secrets clean AND schema complete AND API shape valid (if routes exist)
  const passed =
    errors.length === 0 &&
    checks.noHardcodedSecrets &&
    checks.schemaCompleteness &&
    checks.apiRouteShape;

  return { passed, errors, warnings, checks, score };
}
