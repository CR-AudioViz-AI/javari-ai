# Javari AI

**Your Story. Our Design.**

Javari AI is the autonomous intelligence layer powering the CR AudioViz AI platform.
Built to Fortune 50 standards by CR AudioViz AI, LLC — Fort Myers, Florida.

---

## Deployment Workflow

```
preview branch  →  automatic Preview deployment  →  test via preview URL
                ↓
         merge preview → main
                ↓
         main branch  →  Production deployment (javariai.com)
```

### Rules

- **Never push directly to `main`.** All changes go to `preview` first.
- **Every commit to `preview`** triggers an automatic Vercel Preview deployment.
- **Test the preview URL** before opening a pull request to `main`.
- **Pull request required** to merge `preview` → `main`. Status checks must pass.
- **Production deploys** happen only when a PR is merged into `main`.

### Branch Roles

| Branch    | Purpose                    | Vercel Target |
|-----------|----------------------------|---------------|
| `preview` | Active development         | Preview       |
| `main`    | Stable, production-ready   | Production    |

---

## Stack

- **Framework:** Next.js 14 App Router + TypeScript (strict)
- **Database:** Supabase PostgreSQL with Row Level Security
- **Hosting:** Vercel (iad1)
- **Payments:** Stripe + PayPal (live)
- **AI Routing:** Anthropic Claude, OpenAI GPT-4o, OpenRouter
- **Domains:** javariai.com / craudiovizai.com

---

## Autonomous Systems

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `GET /api/javari/queue` | Every 1 min (cron) | Execute pending roadmap tasks |
| `GET /api/javari/autonomy/cycle` | Every 3 min (cron) | Trigger planner when queue is empty |

---

*CR AudioViz AI, LLC — EIN 39-3646201*
