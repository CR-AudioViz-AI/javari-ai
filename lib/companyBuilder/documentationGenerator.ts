// lib/companyBuilder/documentationGenerator.ts
// Purpose: Generates complete documentation suite: technical architecture docs,
//          API reference, user guides, investor summaries, and onboarding guides.
// Date: 2026-03-08

import { runOrchestrator }          from "@/lib/orchestrator/orchestrator";
import type { CompanyPlan }          from "./companyPlanner";
import type { ProductArchitecture }  from "./productArchitect";
import type { BusinessModel }        from "./businessModelDesigner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DocumentationSuite {
  architecture   : string;     // ARCHITECTURE.md
  apiReference   : string;     // API.md
  userGuide      : string;     // USER_GUIDE.md
  investorSummary: string;     // INVESTOR_SUMMARY.md
  onboarding     : string;     // ONBOARDING.md
  contributing   : string;     // CONTRIBUTING.md
  security       : string;     // SECURITY.md
  changelog      : string;     // CHANGELOG.md
  generatedAt    : string;
}

// ── Architecture doc ───────────────────────────────────────────────────────

function generateArchitectureDoc(plan: CompanyPlan, arch: ProductArchitecture): string {
  const tables = arch.database.tables
    .map(t => `\n### \`${t.name}\`\n| Column | Type | Nullable |\n|---|---|---|\n${t.columns.map(c => `| ${c.name} | ${c.type} | ${c.nullable ? "yes" : "no"} |`).join("\n")}`)
    .join("\n");

  return `# ${plan.companyName} — Architecture

> Last updated: ${new Date().toISOString().split("T")[0]}

## System Overview

${plan.productVision}

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | ${arch.frontend.framework} | User interface |
| Backend | ${arch.backend.runtime} | API and business logic |
| Database | ${arch.database.engine} | Data persistence |
| Auth | ${arch.auth.provider} | Authentication |
| Payments | ${arch.payments.provider} | Billing |
| Hosting | ${arch.infrastructure.hosting} | Deployment |

## Frontend

**Framework:** ${arch.frontend.framework}
**Styling:** ${arch.frontend.styling}
**State:** ${arch.frontend.stateManager}
**Animations:** ${arch.frontend.animations}

### Pages
${arch.frontend.pages.map(p => `- ${p}`).join("\n")}

### Core Components
${arch.frontend.components.map(c => `- ${c}`).join("\n")}

## Backend

**Runtime:** ${arch.backend.runtime}
**API Style:** ${arch.backend.apiStyle}
**Rate Limiting:** ${arch.backend.rateLimiting}
**Caching:** ${arch.backend.caching}

**Middleware:**
${arch.backend.middleware.map(m => `- ${m}`).join("\n")}

## Database Schema
${tables}

## Authentication

- **Provider:** ${arch.auth.provider}
- **Methods:** ${arch.auth.methods.join(", ")}
- **Session:** ${arch.auth.sessionStore}
- **RBAC:** ${arch.auth.rbac}

## Infrastructure

- **Hosting:** ${arch.infrastructure.hosting}
- **Regions:** ${arch.infrastructure.regions.join(", ")}
- **CDN:** ${arch.infrastructure.cdn}
- **CI/CD:** ${arch.infrastructure.cicd}

## Security

**Headers:** ${arch.security.headers.join(", ")}
**OWASP Compliance:**
${arch.security.owasp.map(o => `- ${o}`).join("\n")}

## Folder Structure

\`\`\`
${arch.folderStructure.join("\n")}
\`\`\`

## Environment Variables

| Variable | Required | Secret |
|---|---|---|
${arch.envVars.map(e => `| \`${e.key}\` | ${e.required ? "✅" : "❌"} | ${e.secret ? "🔒" : "—"} |`).join("\n")}
`;
}

// ── API reference ──────────────────────────────────────────────────────────

function generateAPIDoc(plan: CompanyPlan, arch: ProductArchitecture): string {
  return `# ${plan.companyName} — API Reference

**Base URL:** \`https://api.${plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/v1\`
**Authentication:** Bearer token in \`Authorization\` header
**Format:** JSON

## Authentication

All API requests require a valid API key:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Rate Limits

| Plan | Requests/min | Daily cap |
|---|---|---|
| Free | 10 | 1,000 |
| Pro | 100 | 50,000 |
| Scale | 1,000 | 500,000 |
| Enterprise | Custom | Unlimited |

## Endpoints

### GET /v1/health
Check API health status.
\`\`\`json
{ "ok": true, "version": "1.0.0", "timestamp": "2026-03-08T..." }
\`\`\`

### POST /v1/auth/token
Exchange credentials for an API token.
**Body:** \`{ "email": "", "password": "" }\`
**Returns:** \`{ "token": "", "expires_at": "" }\`

### GET /v1/user/profile
Get the authenticated user's profile.
**Returns:** \`{ "id": "", "email": "", "plan": "", "usage": {} }\`

### GET /v1/user/usage
Get current period usage statistics.
**Returns:** \`{ "period": "", "consumed": {}, "limits": {}, "reset_at": "" }\`

### POST /v1/api-keys
Create a new API key.
**Body:** \`{ "name": "", "expires_at": "" }\`
**Returns:** \`{ "id": "", "key": "", "name": "", "created_at": "" }\`

### DELETE /v1/api-keys/:id
Revoke an API key.

## Error Codes

| Code | Meaning |
|---|---|
| 400 | Bad Request — invalid input |
| 401 | Unauthorized — invalid or missing API key |
| 403 | Forbidden — insufficient permissions |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error |

## Webhooks

Configure webhooks in your dashboard to receive real-time events.

**Events:**
- \`subscription.created\`
- \`subscription.updated\`
- \`subscription.cancelled\`
- \`payment.succeeded\`
- \`payment.failed\`
`;
}

// ── User guide ─────────────────────────────────────────────────────────────

function generateUserGuide(plan: CompanyPlan, biz: BusinessModel): string {
  return `# ${plan.companyName} — User Guide

## Welcome to ${plan.companyName}

${plan.productVision}

## Getting Started

### 1. Create Your Account
1. Visit [app.${plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/signup](/)
2. Sign up with Google, GitHub, or email
3. Verify your email address
4. Complete your profile

### 2. Choose a Plan

${biz.pricing.map(t => `**${t.name}** — $${t.monthlyPrice}/mo\n${t.features.map(f => `  - ${f}`).join("\n")}`).join("\n\n")}

### 3. Core Features

${plan.mvpFeatures.map((f, i) => `**${i + 1}. ${f}**\nConfigure and start using ${f.toLowerCase()} from your dashboard.`).join("\n\n")}

## API Access

1. Go to **Settings → API Keys**
2. Click **Create New Key**
3. Name your key and set an expiry
4. Copy your key immediately — it won't be shown again

## Billing

- All plans renew automatically
- Cancel anytime from **Settings → Billing**
- Annual billing saves 17%
- Enterprise contracts available — contact sales

## Support

- **Documentation:** /docs
- **Community:** Discord
- **Email:** support@${plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com
- **Enterprise SLA:** 4-hour response time
`;
}

// ── Investor summary ───────────────────────────────────────────────────────

function generateInvestorSummary(plan: CompanyPlan, biz: BusinessModel): string {
  return `# ${plan.companyName} — Investor Summary

## One-Line Pitch
${plan.tagline}

## Problem
${plan.marketOpportunity}

## Solution
${plan.productVision}

## Market Opportunity
- **Industry:** ${plan.industry}
- **Target Users:** ${plan.target_users}
- Growing demand for AI-native ${plan.industry} solutions

## Business Model
**Primary:** ${biz.revenueStreams[0]?.name ?? "Subscription"} — ${biz.revenueStreams[0]?.description ?? "monthly SaaS tiers"}
**Pricing:** ${biz.pricing.filter(t => t.monthlyPrice > 0).map(t => `$${t.monthlyPrice}/mo ${t.name}`).join(", ")}

## Key Metrics (Projections)
| Metric | Month 6 | Month 12 | Month 24 |
|---|---|---|---|
| MRR | $${biz.projections[5]?.mrr?.toLocaleString() ?? 0} | $${biz.projections[11]?.mrr?.toLocaleString() ?? 0} | $${biz.projections[23]?.mrr?.toLocaleString() ?? 0} |
| Customers | ${biz.projections[5]?.customers ?? 0} | ${biz.projections[11]?.customers ?? 0} | ${biz.projections[23]?.customers ?? 0} |
| ARR | $${biz.projections[11]?.arr?.toLocaleString() ?? 0} | $${(biz.projections[11]?.mrr ?? 0) * 12 |0} | — |

## Unit Economics
- **ARPU:** $${biz.unitEconomics.avgRevenuePerUser}/mo
- **LTV:** $${biz.unitEconomics.estimatedLTV}
- **CAC:** $${biz.unitEconomics.estimatedCAC}
- **LTV/CAC:** ${biz.unitEconomics.ltvCacRatio}x
- **Gross Margin:** ${biz.unitEconomics.grossMargin}%
- **Payback:** ${biz.unitEconomics.paybackPeriodMonths} months

## Differentiators
${plan.differentiators.map((d, i) => `${i + 1}. ${d}`).join("\n")}

## Stack
${plan.techStack.join(" • ")}

## Ask
Seeking seed investment to accelerate growth, hire, and expand features.

---
*Generated by Javari Autonomous Company Builder — CR AudioViz AI, LLC*
`;
}

// ── Onboarding guide ───────────────────────────────────────────────────────

function generateOnboarding(plan: CompanyPlan): string {
  return `# ${plan.companyName} — Developer Onboarding

## Prerequisites
- Node.js 20+
- npm 10+
- Git
- Supabase account
- Stripe account (for billing)

## Setup

\`\`\`bash
# 1. Clone the repo
git clone <repo-url>
cd ${plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Start development server
npm run dev
\`\`\`

## Supabase Setup
1. Create project at supabase.com
2. Copy URL and anon key to .env.local
3. Run migrations: \`npx supabase db push\`

## Stripe Setup
1. Create account at stripe.com
2. Create products matching pricing tiers
3. Copy secret key and webhook secret to .env.local
4. Configure webhook endpoint: \`/api/webhooks/stripe\`

## Deployment
- Push to \`main\` → triggers Vercel preview deploy
- Merge PR → triggers production deploy
- See \`.github/workflows/\` for CI/CD details

## Code Standards
- TypeScript strict mode — no \`any\` types
- Every function has error handling
- WCAG 2.2 AA accessibility on all UI
- OWASP Top 10 security compliance
- Tests required for all new features
`;
}

// ── Security policy ────────────────────────────────────────────────────────

function generateSecurityPolicy(plan: CompanyPlan): string {
  return `# Security Policy — ${plan.companyName}

## Supported Versions
We release patches for security vulnerabilities for the latest major version.

## Reporting Vulnerabilities
**Please do NOT file public GitHub issues for security vulnerabilities.**

Email: security@${plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com
PGP: Available on request

We will respond within 48 hours and patch within 7 days.

## Security Practices
- All data encrypted in transit (TLS 1.3) and at rest (AES-256)
- Row Level Security on all user data
- OWASP Top 10 compliance
- Regular automated security scanning via Javari
- Dependency audits on every CI run
- CSP headers on all responses
`;
}

// ── Main generator ─────────────────────────────────────────────────────────

export async function generateDocumentation(
  plan: CompanyPlan,
  arch: ProductArchitecture,
  biz : BusinessModel
): Promise<DocumentationSuite> {
  return {
    architecture   : generateArchitectureDoc(plan, arch),
    apiReference   : generateAPIDoc(plan, arch),
    userGuide      : generateUserGuide(plan, biz),
    investorSummary: generateInvestorSummary(plan, biz),
    onboarding     : generateOnboarding(plan),
    contributing   : `# Contributing to ${plan.companyName}\n\n## Code of Conduct\nBe respectful and professional.\n\n## Pull Requests\n1. Fork the repo\n2. Create a feature branch\n3. Write tests\n4. Submit PR against \`main\`\n\n## Standards\n- TypeScript strict mode\n- ESLint + Prettier\n- Conventional Commits\n`,
    security       : generateSecurityPolicy(plan),
    changelog      : `# Changelog\n\n## [0.1.0] — ${new Date().toISOString().split("T")[0]}\n\n### Added\n- Initial release generated by Javari Autonomous Company Builder\n- Core authentication system\n- Subscription billing with Stripe\n- REST API v1\n- Admin dashboard\n`,
    generatedAt    : new Date().toISOString(),
  };
}
