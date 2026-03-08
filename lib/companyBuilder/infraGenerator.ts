// lib/companyBuilder/infraGenerator.ts
// Purpose: Generates deployment infrastructure configuration: Vercel project setup,
//          Dockerfile for containerized deployments, Terraform configs for cloud
//          resources, GitHub Actions workflows for CI/CD pipelines.
// Date: 2026-03-08

import type { CompanyPlan }        from "./companyPlanner";
import type { ProductArchitecture } from "./productArchitect";

// ── Types ──────────────────────────────────────────────────────────────────

export interface InfraConfig {
  vercel     : VercelConfig;
  docker     : DockerConfig;
  terraform  : TerraformConfig;
  cicd       : CICDConfig;
  generatedAt: string;
}

export interface VercelConfig {
  projectName  : string;
  framework    : string;
  buildCommand : string;
  outputDir    : string;
  envVars      : Array<{ key: string; value: string; target: string[] }>;
  headers      : Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  rewrites     : Array<{ source: string; destination: string }>;
  crons        : Array<{ path: string; schedule: string }>;
  vercelJson   : string;
}

export interface DockerConfig {
  dockerfile   : string;
  dockerCompose: string;
  dockerIgnore : string;
}

export interface TerraformConfig {
  mainTf      : string;
  variablesTf : string;
  outputsTf   : string;
}

export interface CICDConfig {
  deployWorkflow  : string;
  releaseWorkflow : string;
  previewWorkflow : string;
}

// ── Vercel configuration generator ────────────────────────────────────────

function generateVercelConfig(plan: CompanyPlan, arch: ProductArchitecture): VercelConfig {
  const slug = plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  const vercelJson = JSON.stringify({
    framework    : "nextjs",
    buildCommand : "npm run build",
    devCommand   : "npm run dev",
    installCommand: "npm install",
    outputDirectory: ".next",
    headers: [
      {
        source : "/(.*)",
        headers: arch.security.headers.map(h => {
          const vals: Record<string, string> = {
            "Content-Security-Policy"  : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.stripe.com",
            "X-Frame-Options"          : "DENY",
            "X-Content-Type-Options"   : "nosniff",
            "Referrer-Policy"          : "strict-origin-when-cross-origin",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Permissions-Policy"       : "camera=(), microphone=(), geolocation=()",
          };
          return { key: h, value: vals[h] ?? "" };
        }).filter(h => h.value),
      },
    ],
    crons: [
      { path: "/api/cron/health-check", schedule: "*/5 * * * *" },
      { path: "/api/cron/usage-reset",  schedule: "0 0 1 * *"  },
    ],
    rewrites: [
      { source: "/docs/:path*", destination: "/docs/[...slug]" },
    ],
  }, null, 2);

  return {
    projectName  : slug,
    framework    : "nextjs",
    buildCommand : "npm run build",
    outputDir    : ".next",
    envVars      : arch.envVars.map(e => ({
      key   : e.key,
      value : e.secret ? "" : e.example,
      target: ["production", "preview", "development"],
    })),
    headers: [],
    rewrites: [],
    crons: [
      { path: "/api/cron/health-check", schedule: "*/5 * * * *" },
    ],
    vercelJson,
  };
}

// ── Dockerfile generator ───────────────────────────────────────────────────

function generateDockerfile(plan: CompanyPlan): DockerConfig {
  const slug = plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  const dockerfile = `# ${plan.companyName} — Production Dockerfile
# Multi-stage build for minimal image size

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`;

  const dockerCompose = `# ${plan.companyName} — docker-compose for local development
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    env_file:
      - .env.local
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${slug}_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;

  const dockerIgnore = `node_modules
.next
.git
.env*
*.log
README.md
.dockerignore
`;

  return { dockerfile, dockerCompose, dockerIgnore };
}

// ── Terraform generator ────────────────────────────────────────────────────

function generateTerraform(plan: CompanyPlan): TerraformConfig {
  const slug = plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  const mainTf = `# ${plan.companyName} — Terraform Infrastructure
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

# Vercel project
resource "vercel_project" "${slug}" {
  name      = var.project_name
  framework = "nextjs"
  git_repository = {
    type = "github"
    repo = var.github_repo
  }
}

# Vercel production domain
resource "vercel_project_domain" "production" {
  project_id = vercel_project.${slug}.id
  domain     = var.production_domain
}

# Vercel environment variables
resource "vercel_project_environment_variable" "env_vars" {
  for_each   = var.env_vars
  project_id = vercel_project.${slug}.id
  key        = each.key
  value      = each.value
  target     = ["production", "preview"]
  sensitive  = true
}
`;

  const variablesTf = `variable "project_name"      { type = string }
variable "github_repo"        { type = string }
variable "production_domain"  { type = string }
variable "env_vars" {
  type      = map(string)
  sensitive = true
}
`;

  const outputsTf = `output "project_id"    { value = vercel_project.${slug}.id }
output "project_url"   { value = vercel_project_domain.production.domain }
`;

  return { mainTf, variablesTf, outputsTf };
}

// ── CI/CD workflow generators ──────────────────────────────────────────────

function generateCICDWorkflows(_plan: CompanyPlan): CICDConfig {
  // Note: GitHub Actions expressions (${{ }}) are stored as plain strings
  // to avoid Turbopack template literal parsing conflicts.
  const gha = (s: string) => s; // identity — kept for clarity

  const deployWorkflow = [
    "name: Deploy to Production",
    "on:",
    "  push:",
    "    branches: [main]",
    "jobs:",
    "  deploy:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: amondnet/vercel-action@v25",
    "        with:",
    "          vercel-token: ${{ secrets.VERCEL_TOKEN }}",
    "          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}",
    "          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}",
    "          vercel-args: '--prod'",
  ].join("\n");

  const previewWorkflow = [
    "name: Preview Deployment",
    "on:",
    "  pull_request:",
    "    branches: [main]",
    "jobs:",
    "  preview:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: amondnet/vercel-action@v25",
    "        id: vercel-deploy",
    "        with:",
    "          vercel-token: ${{ secrets.VERCEL_TOKEN }}",
    "          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}",
    "          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}",
    "      - uses: actions/github-script@v7",
    "        with:",
    "          script: |",
    "            github.rest.issues.createComment({",
    "              issue_number: context.issue.number,",
    "              owner: context.repo.owner,",
    "              repo: context.repo.repo,",
    "              body: '\\uD83D\\uDE80 Preview: ${{ steps.vercel-deploy.outputs.preview-url }}'",
    "            })",
  ].join("\n");

  const releaseWorkflow = [
    "name: Release",
    "on:",
    "  push:",
    "    tags: ['v*']",
    "jobs:",
    "  release:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: softprops/action-gh-release@v2",
    "        with:",
    "          generate_release_notes: true",
  ].join("\n");

  return { deployWorkflow: gha(deployWorkflow), previewWorkflow: gha(previewWorkflow), releaseWorkflow: gha(releaseWorkflow) };
}

// ── Main generator ─────────────────────────────────────────────────────────

export function generateInfrastructure(
  plan: CompanyPlan,
  arch: ProductArchitecture
): InfraConfig {
  return {
    vercel    : generateVercelConfig(plan, arch),
    docker    : generateDockerfile(plan),
    terraform : generateTerraform(plan),
    cicd      : generateCICDWorkflows(plan),
    generatedAt: new Date().toISOString(),
  };
}
