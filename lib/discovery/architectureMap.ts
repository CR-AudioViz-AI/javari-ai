// lib/discovery/architectureMap.ts
// Purpose: Architecture map builder — assembles the complete system architecture
//          report from scan results, stack detection, and dependency graphs.
//          Produces the canonical DiscoveryReport output.
// Date: 2026-03-07

import type { ScanResult } from "./repoScanner";
import type { DetectedStack } from "./stackDetector";
import type { DependencyGraphMap } from "./dependencyGraph";

// ── Output types ───────────────────────────────────────────────────────────

export interface ServiceEndpoint {
  path     : string;
  method   : string;
  file     : string;
  inferred : boolean;
}

export interface InfraResource {
  type    : string;  // "vercel" | "supabase" | "aws" | "docker" | "k8s" | etc.
  name    : string;
  details : Record<string, unknown>;
}

export interface SecurityFinding {
  severity    : "critical" | "high" | "medium" | "low" | "info";
  category    : string;
  description : string;
  file?       : string;
  remediation : string;
}

export interface DiscoveryReport {
  // Core canonical fields (as specified)
  frameworks  : string[];
  languages   : string[];
  databases   : string[];
  services    : ServiceEndpoint[];
  deployments : InfraResource[];
  dependencies: Array<{ name: string; version: string; ecosystem: string; type: string; risk: string[] }>;

  // Extended analysis
  infra           : string[];
  runtimes        : string[];
  fileCount       : number;
  apiRoutes       : ServiceEndpoint[];
  securityFindings: SecurityFinding[];
  riskSummary     : {
    totalRisks        : number;
    criticalCount     : number;
    unpinnedDeps      : string[];
    missingEnvExample : boolean;
    noTests           : boolean;
    noDockerfile      : boolean;
  };
  suggestedTasks  : SuggestedTask[];
  scannedAt       : string;
  scanMs          : number;
  target          : string;
}

export interface SuggestedTask {
  id          : string;
  title       : string;
  description : string;
  phase_id    : string;
  priority    : "critical" | "high" | "medium" | "low";
  category    : "security" | "quality" | "maintenance" | "infra" | "testing";
  depends_on  : string[];
}

// ── API route detection ────────────────────────────────────────────────────

function inferAPIRoutes(filePaths: string[]): ServiceEndpoint[] {
  const routes: ServiceEndpoint[] = [];
  const seen = new Set<string>();

  for (const file of filePaths) {
    // Next.js App Router: app/api/*/route.ts
    const appRouteMatch = file.match(/^app\/api\/(.+?)\/route\.(ts|js)$/i);
    if (appRouteMatch) {
      const routePath = `/api/${appRouteMatch[1]}`;
      if (!seen.has(routePath)) {
        seen.add(routePath);
        routes.push({ path: routePath, method: "ANY", file, inferred: true });
      }
      continue;
    }

    // Next.js Pages Router: pages/api/*.ts
    const pagesApiMatch = file.match(/^pages\/api\/(.+?)\.(ts|js)$/i);
    if (pagesApiMatch) {
      const routePath = `/api/${pagesApiMatch[1]}`;
      if (!seen.has(routePath)) {
        seen.add(routePath);
        routes.push({ path: routePath, method: "ANY", file, inferred: true });
      }
      continue;
    }

    // Express/Fastify: routes/ directory patterns
    const expressMatch = file.match(/^(?:src\/)?routes?\/(.+?)\.(ts|js)$/i);
    if (expressMatch) {
      routes.push({ path: `/${expressMatch[1]}`, method: "ANY", file, inferred: true });
    }
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

// ── Infrastructure resource detection ─────────────────────────────────────

function inferInfraResources(
  filePaths: string[],
  keyFiles: Record<string, string>
): InfraResource[] {
  const resources: InfraResource[] = [];

  // Vercel
  if (filePaths.some(f => f === "vercel.json" || f.startsWith(".vercel/"))) {
    const config = keyFiles["vercel.json"] ? JSON.parse(keyFiles["vercel.json"]) : {};
    resources.push({ type: "vercel", name: "Vercel Deployment", details: config });
  }

  // Supabase (detect from package.json deps or usage patterns)
  const pkgContent = keyFiles["package.json"] ?? "";
  if (pkgContent.includes("supabase") || filePaths.some(f => f.includes("supabase"))) {
    resources.push({ type: "supabase", name: "Supabase (PostgreSQL)", details: {} });
  }

  // AWS SDK
  if (pkgContent.includes("@aws-sdk") || pkgContent.includes("aws-sdk")) {
    resources.push({ type: "aws", name: "AWS SDK", details: {} });
  }

  // Docker
  if (filePaths.some(f => f === "Dockerfile" || f.match(/^Dockerfile\./))) {
    const content = keyFiles["Dockerfile"] ?? "";
    const baseImage = content.match(/^FROM\s+(.+)/m)?.[1] ?? "unknown";
    resources.push({ type: "docker", name: "Docker Container", details: { baseImage } });
  }

  // Docker Compose
  if (filePaths.some(f => f === "docker-compose.yml" || f === "docker-compose.yaml")) {
    resources.push({ type: "docker-compose", name: "Docker Compose", details: {} });
  }

  // Kubernetes
  if (filePaths.some(f => f.includes("k8s/") || f.includes("kubernetes/"))) {
    resources.push({ type: "kubernetes", name: "Kubernetes", details: {} });
  }

  // Cloudflare
  if (filePaths.some(f => f === "wrangler.toml")) {
    resources.push({ type: "cloudflare", name: "Cloudflare Workers", details: {} });
  }

  // Fly.io
  if (filePaths.some(f => f === "fly.toml")) {
    resources.push({ type: "fly", name: "Fly.io", details: {} });
  }

  // GitHub Actions
  if (filePaths.some(f => f.startsWith(".github/workflows/"))) {
    const workflows = filePaths.filter(f => f.startsWith(".github/workflows/"));
    resources.push({ type: "github-actions", name: "GitHub Actions CI/CD", details: { workflows } });
  }

  // Stripe
  if (pkgContent.includes('"stripe"')) {
    resources.push({ type: "stripe", name: "Stripe Payments", details: {} });
  }

  // OpenAI
  if (pkgContent.includes("openai")) {
    resources.push({ type: "openai", name: "OpenAI API", details: {} });
  }

  // Anthropic
  if (pkgContent.includes("@anthropic-ai")) {
    resources.push({ type: "anthropic", name: "Anthropic Claude API", details: {} });
  }

  return resources;
}

// ── Security analysis ──────────────────────────────────────────────────────

function analyzeSecurityFindings(
  filePaths: string[],
  keyFiles: Record<string, string>,
  depGraph: DependencyGraphMap
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Check for .env files committed (should never be)
  const envFiles = filePaths.filter(f => f.match(/^\.env$|^\.env\.[^e]/));
  for (const f of envFiles) {
    findings.push({
      severity: "critical", category: "secrets",
      description: `Potentially committed env file: ${f}`,
      file: f,
      remediation: "Add to .gitignore immediately. Rotate all secrets.",
    });
  }

  // Missing .env.example
  if (!filePaths.some(f => f === ".env.example" || f === ".env.template")) {
    findings.push({
      severity: "medium", category: "documentation",
      description: "No .env.example file found",
      remediation: "Create .env.example documenting all required env vars.",
    });
  }

  // Missing tests
  const hasTests = filePaths.some(f =>
    f.includes("__tests__") || f.includes(".test.") || f.includes(".spec.") ||
    f.startsWith("tests/") || f.startsWith("test/")
  );
  if (!hasTests) {
    findings.push({
      severity: "high", category: "quality",
      description: "No test files detected",
      remediation: "Add unit and integration tests. Consider Jest, Vitest, or pytest.",
    });
  }

  // Wildcard deps
  for (const [, graph] of Object.entries(depGraph)) {
    if (graph.riskSummary.wildcardVersions.length > 0) {
      findings.push({
        severity: "high", category: "dependencies",
        description: `Wildcard versions: ${graph.riskSummary.wildcardVersions.slice(0, 5).join(", ")}`,
        remediation: "Pin all dependency versions for reproducible builds.",
      });
    }
    for (const pkg of graph.riskSummary.criticalPackages.slice(0, 10)) {
      findings.push({
        severity: "info", category: "dependencies",
        description: `Security-sensitive package in use: ${pkg}`,
        remediation: `Ensure ${pkg} is pinned to a patched version and audited regularly.`,
      });
    }
  }

  // Missing security headers (Next.js / Vercel)
  const hasSecurityHeaders = !!keyFiles["next.config.js"] || !!keyFiles["next.config.ts"] ||
    (keyFiles["vercel.json"] && JSON.stringify(keyFiles["vercel.json"]).includes("headers"));
  if (!hasSecurityHeaders && filePaths.some(f => f === "package.json")) {
    findings.push({
      severity: "medium", category: "security",
      description: "No security headers configuration detected",
      remediation: "Add Content-Security-Policy, X-Frame-Options, and HSTS headers.",
    });
  }

  return findings.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  });
}

// ── Suggested tasks generator ──────────────────────────────────────────────

function generateSuggestedTasks(
  stack: DetectedStack,
  filePaths: string[],
  depGraph: DependencyGraphMap,
  findings: SecurityFinding[]
): SuggestedTask[] {
  const tasks: SuggestedTask[] = [];
  const ts = Date.now();

  // No tests
  const hasTests = filePaths.some(f =>
    f.includes("__tests__") || f.includes(".test.") || f.includes(".spec.")
  );
  if (!hasTests) {
    tasks.push({
      id: `discovery-testing-${ts}-001`,
      title: "Add test suite",
      description: "[type:build_module] No test files detected in this project. Add unit and integration tests to prevent regressions. Recommend Jest + Testing Library for React/Next.js projects.",
      phase_id: "quality",
      priority: "high",
      category: "testing",
      depends_on: [],
    });
  }

  // Missing env example
  if (!filePaths.some(f => f === ".env.example")) {
    tasks.push({
      id: `discovery-envdoc-${ts}-002`,
      title: "Create .env.example",
      description: "[type:build_module] No .env.example found. Create a template documenting all required environment variables without real values.",
      phase_id: "quality",
      priority: "medium",
      category: "quality",
      depends_on: [],
    });
  }

  // Unpinned deps
  for (const [, graph] of Object.entries(depGraph)) {
    if (graph.riskSummary.unpinnedDeps.length > 5) {
      tasks.push({
        id: `discovery-deppin-${ts}-003`,
        title: "Pin dependency versions",
        description: `[type:update_schema] ${graph.riskSummary.unpinnedDeps.length} unpinned dependencies detected in ${graph.ecosystem}. Pin all versions for reproducible builds and security.`,
        phase_id: "maintenance",
        priority: "medium",
        category: "maintenance",
        depends_on: [],
      });
      break;
    }
  }

  // Critical security findings
  const criticalFindings = findings.filter(f => f.severity === "critical");
  for (const finding of criticalFindings.slice(0, 3)) {
    tasks.push({
      id: `discovery-sec-${ts}-${tasks.length + 1}`.padEnd(30, "0"),
      title: `Security: ${finding.description.slice(0, 60)}`,
      description: `[type:update_schema] CRITICAL security finding detected. ${finding.description}. Remediation: ${finding.remediation}`,
      phase_id: "security",
      priority: "critical",
      category: "security",
      depends_on: [],
    });
  }

  // Missing Dockerfile for backend services
  if (!filePaths.some(f => f === "Dockerfile") && stack.frameworks.some(f => !f.includes("Next.js") && !f.includes("Vite"))) {
    tasks.push({
      id: `discovery-docker-${ts}-004`,
      title: "Add Dockerfile for containerization",
      description: "[type:build_module] No Dockerfile detected. Add containerization support for consistent deployment across environments.",
      phase_id: "infra",
      priority: "low",
      category: "infra",
      depends_on: [],
    });
  }

  return tasks;
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildArchitectureMap(
  scan    : ScanResult,
  stack   : DetectedStack,
  depGraph: DependencyGraphMap
): DiscoveryReport {
  const apiRoutes      = inferAPIRoutes(scan.filePaths);
  const deployments    = inferInfraResources(scan.filePaths, scan.keyFiles);
  const securityFindings = analyzeSecurityFindings(scan.filePaths, scan.keyFiles, depGraph);
  const suggestedTasks = generateSuggestedTasks(stack, scan.filePaths, depGraph, securityFindings);

  // Flatten all deps to canonical format
  const allDeps = Object.values(depGraph).flatMap(g =>
    [...g.production, ...g.development].map(d => ({
      name: d.name, version: d.version, ecosystem: d.ecosystem,
      type: d.type, risk: d.riskFlags,
    }))
  );

  const hasTests = scan.filePaths.some(f =>
    f.includes("__tests__") || f.includes(".test.") || f.includes(".spec.")
  );

  const criticalCount = securityFindings.filter(f => f.severity === "critical").length;
  const depGraphValues = Object.values(depGraph);

  return {
    frameworks  : stack.frameworks,
    languages   : stack.languages,
    databases   : stack.databases,
    services    : apiRoutes,
    deployments,
    dependencies: allDeps,
    infra       : stack.infra,
    runtimes    : stack.runtimes,
    fileCount   : scan.fileCount,
    apiRoutes,
    securityFindings,
    riskSummary : {
      totalRisks       : securityFindings.length,
      criticalCount,
      unpinnedDeps     : depGraphValues.flatMap(g => g.riskSummary.unpinnedDeps).slice(0, 20),
      missingEnvExample: !scan.filePaths.some(f => f === ".env.example"),
      noTests          : !hasTests,
      noDockerfile     : !scan.filePaths.some(f => f === "Dockerfile"),
    },
    suggestedTasks,
    scannedAt: new Date().toISOString(),
    scanMs   : scan.scanMs,
    target   : scan.target.localRoot ?? scan.target.repo ?? "unknown",
  };
}
