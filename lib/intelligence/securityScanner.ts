// lib/intelligence/securityScanner.ts
// Purpose: Security scanner — detects SQL injection, dangerous eval, exposed
//          secrets/tokens, missing auth checks, and dangerous dependency patterns
//          using pattern matching on source file contents.
// Date: 2026-03-07

import type { CodeIssue } from "./codeAnalyzer";

// ── Rule types ─────────────────────────────────────────────────────────────

interface SecurityRule {
  id          : string;
  name        : string;
  severity    : CodeIssue["severity"];
  pattern     : RegExp;
  description : (match: string, file: string) => string;
  fix         : string;
  // Optional: exclude pattern (false positives)
  exclude?    : RegExp;
}

// ── Security rules ─────────────────────────────────────────────────────────

const RULES: SecurityRule[] = [
  // ── SQL Injection ──────────────────────────────────────────────────────
  {
    id      : "SQL_INJECTION_TEMPLATE",
    name    : "SQL injection via template literal",
    severity: "critical",
    pattern : /`\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\s[^`]*\$\{/gi,
    description: (m, file) => `SQL injection risk: user input interpolated directly into SQL query`,
    fix     : "Use parameterized queries or a query builder (Supabase .from().select(), pg $1/$2 params). Never interpolate user data into SQL strings.",
    exclude : /\/\/.*(safe|sanitized|escaped)/i,
  },
  {
    id      : "SQL_INJECTION_CONCAT",
    name    : "SQL injection via string concatenation",
    severity: "critical",
    pattern : /(?:query|sql|SQL)\s*[+=]\s*["'][^"']*["']\s*\+\s*(?:req\.|params\.|body\.|query\.)/gi,
    description: (m, file) => `SQL injection: request parameter concatenated into SQL string`,
    fix     : "Replace string concatenation with parameterized queries.",
  },

  // ── Dangerous eval ────────────────────────────────────────────────────
  {
    id      : "DANGEROUS_EVAL",
    name    : "Use of eval()",
    severity: "critical",
    pattern : /(?:^|[^A-Za-z0-9_$])eval\s*\(/gm,
    description: (m, file) => `eval() usage detected — executes arbitrary code`,
    fix     : "Remove eval(). Use JSON.parse() for JSON, or refactor logic to avoid dynamic code execution.",
    exclude : /\/\/.*eval|eslint-disable.*eval/i,
  },
  {
    id      : "DANGEROUS_FUNCTION_CONSTRUCTOR",
    name    : "new Function() dynamic code execution",
    severity: "high",
    pattern : /new\s+Function\s*\(/gm,
    description: (m, file) => `new Function() executes dynamic code — equivalent to eval()`,
    fix     : "Replace with static function definitions.",
  },

  // ── Exposed secrets ───────────────────────────────────────────────────
  {
    id      : "HARDCODED_SECRET_KEY",
    name    : "Hardcoded secret/API key",
    severity: "critical",
    pattern : /(?:apiKey|api_key|secret|password|token|AUTH|SECRET)\s*[:=]\s*["'][A-Za-z0-9_\-/+]{20,}["']/gi,
    description: (m, file) => `Potential hardcoded credential detected in source`,
    fix     : "Move to environment variables via process.env or vault (getSecret()). Never commit credentials.",
    exclude : /(?:process\.env|getSecret|placeholder|example|your-|xxx|test|dummy|fake|NEXT_PUBLIC)/i,
  },
  {
    id      : "HARDCODED_JWT_SECRET",
    name    : "Hardcoded JWT secret",
    severity: "critical",
    pattern : /jwt\s*\.sign\s*\([^,]+,\s*["'][^"']{8,}["']/gi,
    description: (m, file) => `JWT signed with hardcoded secret string`,
    fix     : "Use process.env.JWT_SECRET or getSecret('JWT_SECRET').",
  },
  {
    id      : "AWS_ACCESS_KEY",
    name    : "Hardcoded AWS access key",
    severity: "critical",
    pattern : /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
    description: (m, file) => `AWS Access Key ID pattern detected in source`,
    fix     : "Remove immediately. Rotate the key. Use IAM roles or environment variables.",
  },

  // ── Missing auth checks ───────────────────────────────────────────────
  {
    id      : "API_ROUTE_NO_AUTH",
    name    : "API route missing authentication check",
    severity: "high",
    // POST/DELETE route handler with no session/auth check in first 20 lines
    pattern : /export\s+async\s+function\s+(?:POST|DELETE|PUT|PATCH)\s*\([^)]*\)/gm,
    description: (m, file) => `Mutating API route (${m.trim().split("(")[0].split(" ").pop()}) — verify auth check exists`,
    fix     : "Add authentication check: verify session token, API key, or Supabase auth before processing mutations.",
  },
  {
    id      : "CORS_WILDCARD",
    name    : "CORS wildcard origin",
    severity: "medium",
    pattern : /Access-Control-Allow-Origin['":\s]*\*['";\s]/g,
    description: (m, file) => `CORS wildcard (*) allows any origin to call this endpoint`,
    fix     : "Restrict CORS to specific allowed origins in production.",
  },

  // ── Dangerous dependencies / patterns ─────────────────────────────────
  {
    id      : "PROCESS_ENV_DIRECT",
    name    : "Direct process.env read for sensitive value",
    severity: "low",
    pattern : /process\.env\.(?:SECRET|TOKEN|KEY|PASSWORD|PASS|AUTH|API_KEY|PRIVATE)[A-Z_]*/g,
    description: (m, file) => `Direct process.env read for sensitive value: ${m}`,
    fix     : "Use getSecret() from platform-secrets for credentials. process.env is acceptable only for bootstrap vars.",
    exclude : /\/\/.*ok|getSecret/i,
  },
  {
    id      : "UNSAFE_REDIRECT",
    name    : "Open redirect vulnerability",
    severity: "high",
    pattern : /redirect\s*\(\s*(?:req\.|request\.|params\.|body\.|query\.)[^)]+\)/gi,
    description: (m, file) => `Potential open redirect: redirecting to user-controlled URL`,
    fix     : "Validate redirect URLs against an allowlist before redirecting.",
  },
  {
    id      : "PROTOTYPE_POLLUTION",
    name    : "Prototype pollution risk",
    severity: "medium",
    pattern : /\[\s*["']__proto__["']\s*\]|\bObject\.assign\s*\(\s*\w+\s*,\s*req\./gi,
    description: (m, file) => `Potential prototype pollution via user-controlled object merge`,
    fix     : "Use structured clone or sanitize user input before object merge. Avoid Object.assign with request data.",
  },
  {
    id      : "DANGEROUS_INNERHTML",
    name    : "dangerouslySetInnerHTML with non-sanitized input",
    severity: "high",
    pattern : /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!DOMPurify|sanitize)/gi,
    description: (m, file) => `dangerouslySetInnerHTML used without apparent sanitization (XSS risk)`,
    fix     : "Sanitize HTML with DOMPurify before setting innerHTML. Never use raw user content.",
  },
  {
    id      : "CONSOLE_LOG_SENSITIVE",
    name    : "console.log of potentially sensitive data",
    severity: "low",
    pattern : /console\.(?:log|info|debug)\s*\([^)]*(?:password|secret|token|key|auth|credential)[^)]*\)/gi,
    description: (m, file) => `console.log may be logging sensitive data`,
    fix     : "Remove console.log of sensitive values. Use structured logging with masking.",
  },
];

// ── Scanner ────────────────────────────────────────────────────────────────

export type SecurityIssue = CodeIssue & { rule: string };

export function scanForSecurity(files: Record<string, string>): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const [file, content] of Object.entries(files)) {
    const lines = content.split("\n");

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;

      while ((m = rule.pattern.exec(content)) !== null) {
        const matchText = m[0];

        // Check exclusion pattern
        if (rule.exclude && rule.exclude.test(matchText)) continue;

        // Exclude commented lines
        const lineNum  = content.slice(0, m.index).split("\n").length;
        const lineText = lines[lineNum - 1] ?? "";
        const stripped = lineText.trimStart();
        if (stripped.startsWith("//") || stripped.startsWith("*") || stripped.startsWith("#")) continue;
        // Skip lines with eslint-disable
        if (lineText.includes("eslint-disable")) continue;

        issues.push({
          severity     : rule.severity,
          type         : "security",
          file,
          line         : lineNum,
          description  : rule.description(matchText, file),
          suggested_fix: rule.fix,
          rule         : rule.id,
        });

        // One issue per rule per file to reduce noise
        break;
      }
    }
  }

  return issues;
}
