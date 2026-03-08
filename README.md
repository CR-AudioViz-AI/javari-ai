# Javari AI

**Your Story. Our Design.**

Javari AI is the autonomous intelligence layer powering the CR AudioViz AI platform.
Built to Fortune 50 standards by CR AudioViz AI, LLC — Fort Myers, Florida.

---

## Deployment Policy

### Development → Preview

```
push to main  →  Vercel Preview deployment  →  test via preview URL
```

- Direct pushes to `main` are allowed and trigger **preview-only** deployments.
- Every commit to `main` gets a Vercel preview URL for testing.
- `main` does **not** trigger production. It is a development staging branch.

### Release → Production

```
PR: main → production  →  status checks pass  →  production deployment (javariai.com)
```

- **Production deploys only via pull request** from `main` → `production`.
- The `production` branch is protected: PR required, Vercel status check required, no direct pushes, no force pushes.
- One approving review required before merge.

### Branch Roles

| Branch       | Purpose                      | Vercel Target | Direct Push |
|--------------|------------------------------|---------------|-------------|
| `main`       | Active development           | Preview       | ✅ Allowed  |
| `production` | Stable, released code        | Production    | ❌ Blocked  |

### Protection Rules — `production` branch

| Rule                          | Setting                    |
|-------------------------------|----------------------------|
| Required status checks        | `Vercel – javari-ai`       |
| Require status to be up-to-date | Yes                      |
| Required approving reviews    | 1                          |
| Dismiss stale reviews         | Yes                        |
| Allow force pushes            | ❌ Blocked                 |
| Allow deletions               | ❌ Blocked                 |

---

## Stack

- **Framework:** Next.js 14 App Router + TypeScript (strict)
- **Database:** Supabase PostgreSQL with Row Level Security
- **Hosting:** Vercel (iad1) — production branch: `production`
- **Payments:** Stripe + PayPal (live)
- **AI Routing:** Anthropic Claude, OpenAI GPT-4o, OpenRouter
- **Domains:** javariai.com / craudiovizai.com

---

## Autonomous Systems

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `GET /api/javari/queue` | Every 1 min (cron) | Execute pending roadmap tasks |
| `GET /api/javari/autonomy/cycle` | Every 3 min (cron) | Trigger planner when queue is empty |

The autonomy loop executes real platform work from the canonical roadmap (`MASTER_ROADMAP_v3.1`).
Tasks are seeded by phase priority: `core_platform → autonomy_engine → multi_ai_chat → payments → creator_tools → ecosystem_modules`.

---

*CR AudioViz AI, LLC — EIN 39-3646201*

<!-- intelligence-engine-build-trigger: 2026-03-07 -->

<!-- repair-engine-build-trigger: 2026-03-07 -->

<!-- autonomy-loop-build-trigger: 2026-03-07 -->

<!-- autonomy-seeder-fix: 2026-03-07 -->

<!-- crawler-build-trigger: 2026-03-07 -->

<!-- crawler-fix-buffer: 2026-03-07 -->

<!-- crawler-v2-single-pass: 2026-03-07 -->

<!-- crawler-v1.2-reachability: 2026-03-07 -->

<!-- ecosystem-governance-layer: 2026-03-07 -->

<!-- operations-center: 2026-03-07 -->

<!-- learning-intelligence-system: 2026-03-07 -->

<!-- repair-pipeline-fix: 2026-03-07 -->

<!-- orchestration-engine-complete: 2026-03-07 -->

<!-- javari-memory-graph: 2026-03-07 -->

<!-- javari-company-builder: 2026-03-08 -->
