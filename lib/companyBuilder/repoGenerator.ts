// lib/companyBuilder/repoGenerator.ts
// Purpose: Generates GitHub repositories with full folder structure, base code,
//          CI/CD workflows, and configuration files for a new company/SaaS product.
// Date: 2026-03-08

import { runOrchestrator }       from "@/lib/orchestrator/orchestrator";
import type { ProductArchitecture } from "./productArchitect";
import type { CompanyPlan }      from "./companyPlanner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RepoGeneratorInput {
  plan          : CompanyPlan;
  architecture  : ProductArchitecture;
  githubOrg?    : string;
  githubToken?  : string;
  private?      : boolean;
}

export interface GeneratedFile {
  path    : string;
  content : string;
}

export interface RepoGenerationResult {
  repoName     : string;
  repoUrl?     : string;
  repoId?      : string;
  created      : boolean;
  filesGenerated: number;
  files        : GeneratedFile[];
  cicdFiles    : GeneratedFile[];
  configFiles  : GeneratedFile[];
  errors       : string[];
}

// ── GitHub API helper ──────────────────────────────────────────────────────

async function ghApi(
  method : string,
  path   : string,
  token  : string,
  body?  : unknown
): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization : `token ${token}`,
        Accept        : "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent"  : "javari-company-builder/1.0",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json() as Record<string, unknown>;
    return { ok: res.ok, data, status: res.status };
  } catch (err) {
    return { ok: false, data: { error: String(err) }, status: 0 };
  }
}

// ── Package.json generator ─────────────────────────────────────────────────

function generatePackageJson(plan: CompanyPlan): string {
  const slug = plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return JSON.stringify({
    name   : slug,
    version: "0.1.0",
    private: true,
    scripts: {
      dev  : "next dev",
      build: "next build",
      start: "next start",
      lint : "next lint",
      "type-check": "tsc --noEmit",
      test : "vitest",
      "test:e2e": "playwright test",
    },
    dependencies: {
      next              : "14.2.0",
      react             : "^18.3.0",
      "react-dom"       : "^18.3.0",
      typescript        : "^5.4.0",
      "@supabase/supabase-js": "^2.43.0",
      "@supabase/auth-helpers-nextjs": "^0.10.0",
      "next-auth"       : "^4.24.0",
      stripe            : "^15.0.0",
      "@stripe/stripe-js": "^3.0.0",
      zod               : "^3.23.0",
      zustand           : "^4.5.0",
      "@tanstack/react-query": "^5.0.0",
      "framer-motion"   : "^11.0.0",
      "lucide-react"    : "^0.378.0",
      "class-variance-authority": "^0.7.0",
      clsx              : "^2.1.0",
      "tailwind-merge"  : "^2.3.0",
    },
    devDependencies: {
      "@types/node"  : "^20.0.0",
      "@types/react" : "^18.3.0",
      "tailwindcss"  : "^3.4.0",
      "autoprefixer" : "^10.4.0",
      "postcss"      : "^8.4.0",
      "eslint"       : "^8.57.0",
      "eslint-config-next": "14.2.0",
      "vitest"       : "^1.6.0",
      "@playwright/test": "^1.44.0",
    },
  }, null, 2);
}

// ── tsconfig generator ────────────────────────────────────────────────────

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"],
      allowJs: false, skipLibCheck: true, strict: true,
      noEmit: true, esModuleInterop: true, module: "esnext",
      moduleResolution: "bundler", resolveJsonModule: true,
      isolatedModules: true, jsx: "preserve", incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2);
}

// ── GitHub Actions CI/CD ───────────────────────────────────────────────────

function generateCIWorkflow(plan: CompanyPlan): string {
  return `name: CI

on:
  push:
    branches: [main, development]
  pull_request:
    branches: [main]

jobs:
  check:
    name: Type Check + Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint

  test:
    name: Unit Tests
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --reporter=verbose

  security:
    name: Security Scan
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run npm audit
        run: npm audit --audit-level=high
`;
}

// ── Next.js config ─────────────────────────────────────────────────────────

function generateNextConfig(plan: CompanyPlan): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { typedRoutes: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security',  value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy',    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.stripe.com;" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
`;
}

// ── Health endpoint ────────────────────────────────────────────────────────

function generateHealthRoute(plan: CompanyPlan): string {
  return `// app/api/health/route.ts — ${plan.companyName} health check
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: '${plan.companyName}',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'unknown',
  });
}
`;
}

// ── README generator ───────────────────────────────────────────────────────

function generateReadme(plan: CompanyPlan, arch: ProductArchitecture): string {
  return `# ${plan.companyName}

> ${plan.tagline}

${plan.productVision}

## Stack

| Layer | Technology |
|---|---|
| Frontend | ${arch.frontend.framework} |
| Database | ${arch.database.engine} |
| Auth | ${arch.auth.provider} |
| Payments | ${arch.payments.provider} |
| Hosting | ${arch.infrastructure.hosting} |

## Quick Start

\`\`\`bash
git clone <repo-url>
cd ${plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}
npm install
cp .env.example .env.local
# Fill in .env.local with your credentials
npm run dev
\`\`\`

## Environment Variables

${arch.envVars.map(e => `- \`${e.key}\` — ${e.required ? "Required" : "Optional"}${e.secret ? " 🔒" : ""}`).join("\n")}

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system design.

---

Built with the Javari Autonomous Company Builder — CR AudioViz AI, LLC
`;
}

// ── Env example ────────────────────────────────────────────────────────────

function generateEnvExample(arch: ProductArchitecture): string {
  return arch.envVars
    .map(e => `${e.key}=${e.example}`)
    .join("\n");
}

// ── Main generator ─────────────────────────────────────────────────────────

export async function generateRepository(input: RepoGeneratorInput): Promise<RepoGenerationResult> {
  const { plan, architecture: arch } = input;
  const repoName  = plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const token     = input.githubToken ?? process.env.GITHUB_TOKEN ?? process.env.GH_PAT ?? "";
  const org       = input.githubOrg   ?? "CR-AudioViz-AI";
  const errors: string[] = [];

  // ── 1. Generate file contents ─────────────────────────────────────────
  const files: GeneratedFile[] = [
    { path: "package.json",         content: generatePackageJson(plan) },
    { path: "tsconfig.json",        content: generateTsConfig() },
    { path: "next.config.js",       content: generateNextConfig(plan) },
    { path: ".env.example",         content: generateEnvExample(arch) },
    { path: "README.md",            content: generateReadme(plan, arch) },
    { path: "app/api/health/route.ts", content: generateHealthRoute(plan) },
  ];

  const cicdFiles: GeneratedFile[] = [
    { path: ".github/workflows/ci.yml", content: generateCIWorkflow(plan) },
  ];

  const configFiles: GeneratedFile[] = [
    {
      path: ".gitignore",
      content: "# Dependencies\nnode_modules/\n.pnp\n.pnp.js\n\n# Next.js\n.next/\nout/\n\n# Env\n.env\n.env.local\n.env.*.local\n\n# Debug\nnpm-debug.log*\n\n# TypeScript\n*.tsbuildinfo\nnext-env.d.ts\n",
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from 'tailwindcss';\nconst config: Config = {\n  darkMode: ['class'],\n  content: ['./pages/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','./app/**/*.{ts,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n};\nexport default config;\n`,
    },
  ];

  // ── 2. Create GitHub repo if token provided ───────────────────────────
  let created = false;
  let repoUrl: string | undefined;
  let repoId: string | undefined;

  if (token) {
    // Create repo under org or user
    const createRes = await ghApi("POST", `/orgs/${org}/repos`, token, {
      name       : repoName,
      description: plan.tagline,
      private    : input.private ?? true,
      auto_init  : false,
      has_issues : true,
      has_wiki   : true,
    });

    if (createRes.ok) {
      created = true;
      repoUrl = createRes.data.html_url as string;
      repoId  = String(createRes.data.id ?? "");

      // Commit all generated files
      const allFiles = [...files, ...cicdFiles, ...configFiles];
      for (const f of allFiles) {
        const commitRes = await ghApi("PUT", `/repos/${org}/${repoName}/contents/${f.path}`, token, {
          message: `init: ${f.path} — generated by Javari Company Builder`,
          content : Buffer.from(f.content).toString("base64"),
          branch  : "main",
        });
        if (!commitRes.ok) {
          errors.push(`Failed to commit ${f.path}: ${JSON.stringify(commitRes.data).slice(0, 100)}`);
        }
      }
    } else {
      // Repo may already exist or org doesn't exist — try user namespace
      errors.push(`Org repo create failed (${createRes.status}): ${JSON.stringify(createRes.data).slice(0, 120)}`);
    }
  } else {
    errors.push("No GitHub token — repo creation skipped, files generated in-memory only");
  }

  return {
    repoName,
    repoUrl,
    repoId,
    created,
    filesGenerated: files.length + cicdFiles.length + configFiles.length,
    files,
    cicdFiles,
    configFiles,
    errors,
  };
}
