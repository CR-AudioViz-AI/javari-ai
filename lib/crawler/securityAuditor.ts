// lib/crawler/securityAuditor.ts
// Purpose: Security auditor — checks HTTP headers, HTML patterns, JS content,
//          and URL structure for security issues. No active exploitation —
//          passive analysis only.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export interface SecurityFinding {
  severity   : SecuritySeverity;
  category   : string;
  title      : string;
  detail     : string;
  remediation: string;
  url?       : string;
  rule       : string;
}

export interface SecurityAuditResult {
  findings     : SecurityFinding[];
  score        : number;     // 0–100 (100 = perfect)
  grade        : "A" | "B" | "C" | "D" | "F";
  headerAudit  : Record<string, { present: boolean; value?: string; recommendation?: string }>;
  exposedPaths : string[];
  summary      : { total: number; critical: number; high: number; medium: number; low: number };
}

// ── Security headers ───────────────────────────────────────────────────────

interface HeaderCheck {
  header     : string;
  severity   : SecuritySeverity;
  rule       : string;
  description: string;
  good       : RegExp | null;   // null = just presence check
  remediation: string;
}

const SECURITY_HEADERS: HeaderCheck[] = [
  {
    header: "content-security-policy", severity: "high", rule: "MISSING_CSP",
    description: "Content Security Policy (CSP) header is missing",
    good: null,
    remediation: "Add Content-Security-Policy header to restrict resource loading origins.",
  },
  {
    header: "strict-transport-security", severity: "high", rule: "MISSING_HSTS",
    description: "HTTP Strict Transport Security (HSTS) is not set",
    good: /max-age=\d+/,
    remediation: "Add Strict-Transport-Security: max-age=31536000; includeSubDomains",
  },
  {
    header: "x-frame-options", severity: "medium", rule: "MISSING_XFRAME",
    description: "X-Frame-Options header missing — clickjacking risk",
    good: /DENY|SAMEORIGIN/,
    remediation: "Add X-Frame-Options: DENY or SAMEORIGIN",
  },
  {
    header: "x-content-type-options", severity: "medium", rule: "MISSING_XCTO",
    description: "X-Content-Type-Options not set — MIME sniffing risk",
    good: /nosniff/,
    remediation: "Add X-Content-Type-Options: nosniff",
  },
  {
    header: "referrer-policy", severity: "low", rule: "MISSING_REFERRER",
    description: "Referrer-Policy header not set",
    good: /no-referrer|strict-origin|same-origin/,
    remediation: "Add Referrer-Policy: strict-origin-when-cross-origin",
  },
  {
    header: "permissions-policy", severity: "low", rule: "MISSING_PERMS",
    description: "Permissions-Policy header not set",
    good: null,
    remediation: "Add Permissions-Policy header to restrict browser feature access.",
  },
  {
    header: "x-xss-protection", severity: "low", rule: "XSS_PROTECTION_DISABLED",
    description: "X-XSS-Protection is disabled or not set",
    good: /1;\s*mode=block/,
    remediation: "Add X-XSS-Protection: 1; mode=block (deprecated but still helpful for old browsers)",
  },
];

const SENSITIVE_HEADERS = [
  "x-powered-by", "server", "x-aspnet-version", "x-aspnetmvc-version",
];

const EXPOSED_PATHS = [
  "/.env", "/.git/config", "/.git/HEAD", "/config.json", "/config.yaml",
  "/wp-config.php", "/phpinfo.php", "/.htaccess", "/web.config",
  "/package.json", "/composer.json", "/Dockerfile", "/docker-compose.yml",
  "/README.md", "/CHANGELOG.md", "/.DS_Store", "/backup.sql",
  "/admin", "/admin/login", "/wp-admin", "/phpmyadmin",
  "/api/v1/users", "/api/users", "/api/keys", "/api/admin",
];

// ── JS pattern checks ──────────────────────────────────────────────────────

interface JsSecurityPattern {
  rule      : string;
  severity  : SecuritySeverity;
  pattern   : RegExp;
  title     : string;
  remediation: string;
}

const JS_PATTERNS: JsSecurityPattern[] = [
  {
    rule: "HARDCODED_API_KEY", severity: "critical",
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/gi,
    title: "Hardcoded API key in client-side JS",
    remediation: "Move API keys to server-side environment variables. Never expose secrets in client JS.",
  },
  {
    rule: "HARDCODED_JWT_SECRET", severity: "critical",
    pattern: /(?:jwt[_-]?secret|jwt[_-]?key)\s*[:=]\s*["']([^"']{8,})["']/gi,
    title: "Hardcoded JWT secret in client-side JS",
    remediation: "JWT secrets must only exist server-side. Remove from any client bundle.",
  },
  {
    rule: "AWS_ACCESS_KEY", severity: "critical",
    pattern: /AKIA[0-9A-Z]{16}/g,
    title: "AWS Access Key ID exposed in client JS",
    remediation: "Rotate key immediately. Use IAM roles or server-side signing for AWS operations.",
  },
  {
    rule: "PRIVATE_KEY_EXPOSED", severity: "critical",
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
    title: "Private key found in client-side content",
    remediation: "Remove private key immediately. Private keys must never appear in client-side code.",
  },
  {
    rule: "DANGEROUS_EVAL", severity: "high",
    pattern: /\beval\s*\(/g,
    title: "eval() usage detected in client JS",
    remediation: "Replace eval() with safer alternatives. eval() can enable code injection attacks.",
  },
  {
    rule: "DOCUMENT_WRITE", severity: "medium",
    pattern: /document\.write\s*\(/g,
    title: "document.write() usage — XSS risk",
    remediation: "Replace with DOM APIs: createElement, appendChild, or innerHTML with sanitization.",
  },
  {
    rule: "POSTMESSAGE_NO_ORIGIN_CHECK", severity: "medium",
    pattern: /addEventListener\s*\(\s*["']message["']/g,
    title: "postMessage listener detected — verify origin validation",
    remediation: "Always validate event.origin in postMessage listeners to prevent cross-origin attacks.",
  },
  {
    rule: "LOCALSTORAGE_SENSITIVE", severity: "medium",
    pattern: /localStorage\.setItem\s*\([^)]*(?:token|secret|password|key)/gi,
    title: "Sensitive data stored in localStorage",
    remediation: "Use httpOnly cookies for auth tokens. localStorage is accessible to XSS attacks.",
  },
  {
    rule: "PUBLIC_S3_BUCKET", severity: "high",
    pattern: /https?:\/\/[a-z0-9\-]+\.s3(?:\.[\w-]+)?\.amazonaws\.com/g,
    title: "Direct S3 bucket URL exposed in client",
    remediation: "Use signed URLs or CloudFront. Verify bucket is not publicly readable.",
  },
  {
    rule: "OPEN_CORS_WILDCARD", severity: "medium",
    pattern: /access-control-allow-origin\s*:\s*\*/gi,
    title: "Wildcard CORS policy detected",
    remediation: "Restrict Access-Control-Allow-Origin to specific trusted domains.",
  },
];

// ── Exposed path checker ───────────────────────────────────────────────────

export async function checkExposedPaths(
  rootUrl   : string,
  userAgent : string = "JavariBot/1.0"
): Promise<string[]> {
  const exposed: string[] = [];
  const base = rootUrl.replace(/\/$/, "");

  // Check 5 highest-risk paths
  const highRisk = EXPOSED_PATHS.filter(p =>
    [".env", ".git/config", "config.json", "phpinfo", "wp-config"].some(s => p.includes(s))
  ).slice(0, 5);

  for (const path of highRisk) {
    try {
      const res = await fetch(`${base}${path}`, {
        method  : "HEAD",
        headers : { "User-Agent": userAgent },
        redirect: "manual",
        signal  : AbortSignal.timeout(5_000),
      });
      if (res.status === 200 || res.status === 301 || res.status === 302) {
        exposed.push(`${base}${path} (HTTP ${res.status})`);
      }
    } catch { /* path not accessible — good */ }
  }

  return exposed;
}

// ── Main auditor ───────────────────────────────────────────────────────────

export function auditSecurity(
  headers    : Record<string, string>,
  htmlSamples: string[],
  jsSamples  : string[],
  pageUrls   : string[],
  exposedPaths: string[]
): SecurityAuditResult {
  const findings: SecurityFinding[] = [];
  const headerAudit: SecurityAuditResult["headerAudit"] = {};
  const lowerHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );

  // ── Security header checks ───────────────────────────────────────────────
  for (const check of SECURITY_HEADERS) {
    const value = lowerHeaders[check.header];
    const present = value !== undefined;
    const valid   = !present ? false : (check.good === null ? true : check.good.test(value));

    headerAudit[check.header] = { present, value, recommendation: valid ? undefined : check.remediation };

    if (!present || !valid) {
      findings.push({
        severity   : check.severity,
        category   : "headers",
        title      : check.description,
        detail     : present ? `Header present but value "${value}" may be insufficient` : `Header "${check.header}" not found in response`,
        remediation: check.remediation,
        rule       : check.rule,
      });
    }
  }

  // ── Server banner disclosure ─────────────────────────────────────────────
  for (const hdr of SENSITIVE_HEADERS) {
    if (lowerHeaders[hdr]) {
      findings.push({
        severity   : "low",
        category   : "headers",
        title      : `Server information disclosed via ${hdr}`,
        detail     : `${hdr}: ${lowerHeaders[hdr]}`,
        remediation: `Remove or mask the ${hdr} header to avoid version fingerprinting.`,
        rule       : "SERVER_BANNER_DISCLOSURE",
      });
    }
  }

  // ── HTTPS enforcement ────────────────────────────────────────────────────
  if (pageUrls.some(u => u.startsWith("http://"))) {
    findings.push({
      severity   : "high",
      category   : "transport",
      title      : "Site served over HTTP (not HTTPS)",
      detail     : "Pages are accessible over unencrypted HTTP",
      remediation: "Enforce HTTPS. Redirect all HTTP traffic to HTTPS and set HSTS.",
      rule       : "HTTP_NOT_HTTPS",
    });
  }

  // ── JS pattern analysis ──────────────────────────────────────────────────
  const jsContent = jsSamples.join("\n").slice(0, 500_000);
  for (const check of JS_PATTERNS) {
    const pat = new RegExp(check.pattern.source, check.pattern.flags);
    if (pat.test(jsContent)) {
      findings.push({
        severity   : check.severity,
        category   : "javascript",
        title      : check.title,
        detail     : `Pattern ${check.rule} detected in client-side JavaScript`,
        remediation: check.remediation,
        rule       : check.rule,
      });
    }
  }

  // ── Exposed paths ────────────────────────────────────────────────────────
  for (const path of exposedPaths) {
    findings.push({
      severity   : "critical",
      category   : "exposure",
      title      : "Sensitive path publicly accessible",
      detail     : path,
      remediation: "Block access to sensitive files via web server config or WAF rules.",
      url        : path.split(" ")[0],
      rule       : "EXPOSED_SENSITIVE_PATH",
    });
  }

  // ── HTML-level checks ────────────────────────────────────────────────────
  const allHtml = htmlSamples.join("\n").slice(0, 200_000);
  if (/<input[^>]+type\s*=\s*["']password["'][^>]*>/i.test(allHtml) &&
      !/<input[^>]+autocomplete\s*=\s*["'](?:off|new-password|current-password)["']/i.test(allHtml)) {
    findings.push({
      severity   : "low",
      category   : "forms",
      title      : "Password field without autocomplete attribute",
      detail     : "Password inputs should specify autocomplete to control browser behavior",
      remediation: "Add autocomplete='current-password' or 'new-password' to password inputs.",
      rule       : "PASSWORD_AUTOCOMPLETE",
    });
  }

  // ── Score calculation ────────────────────────────────────────────────────
  const SEVERITY_WEIGHTS = { critical: 25, high: 15, medium: 7, low: 2 };
  const deductions = findings.reduce((sum, f) => sum + SEVERITY_WEIGHTS[f.severity], 0);
  const score = Math.max(0, 100 - deductions);
  const grade: SecurityAuditResult["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  const summary = {
    total   : findings.length,
    critical: findings.filter(f => f.severity === "critical").length,
    high    : findings.filter(f => f.severity === "high").length,
    medium  : findings.filter(f => f.severity === "medium").length,
    low     : findings.filter(f => f.severity === "low").length,
  };

  return { findings, score, grade, headerAudit, exposedPaths, summary };
}
