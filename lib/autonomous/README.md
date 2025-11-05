# Javari AI - Autonomous & Self-Healing Systems

**Created: November 4, 2025 - 6:30 PM EST**
**Status: Phase 2 - Core Autonomous Capabilities Complete**

## Overview

This module contains the autonomous capabilities that make Javari AI truly self-sufficient:

1. **Autonomous GitHub** - Read, write, commit code without human intervention
2. **Autonomous Vercel** - Trigger, monitor, and manage deployments
3. **Self-Healing** - Detect errors, diagnose with AI, auto-fix, and deploy
4. **Continuous Learning** - Learn from conversations, code generation, and web crawls

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Javari AI Core                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   GitHub     │  │   Vercel     │  │   Learning   │  │
│  │  Automation  │  │  Automation  │  │    System    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│                   ┌────────▼────────┐                    │
│                   │  Self-Healing   │                    │
│                   │     System      │                    │
│                   └─────────────────┘                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Autonomous GitHub (`autonomous-github.ts`)

Enables Javari to interact with GitHub repositories programmatically.

**Capabilities:**
- Read files from repository
- Write/update files with commits
- Create multi-file commits
- Verify commit success
- Rollback failed commits
- List files and directories
- Get commit history

**Example:**
```typescript
import { createGitHubClient } from './autonomous-github';

const github = createGitHubClient({
  token: 'ghp_xxx',
  org: 'CR-AudioViz-AI',
  repo: 'crav-javari'
});

// Read a file
const file = await github.readFile('package.json');

// Write a file
await github.writeFile(
  'lib/new-feature.ts',
  'export function newFeature() { }',
  'feat: Add new feature'
);

// Create multi-file commit
await github.createCommit([
  { path: 'file1.ts', content: '...' },
  { path: 'file2.ts', content: '...' }
], 'feat: Add multiple files');
```

### 2. Autonomous Vercel (`autonomous-deploy.ts`)

Manages Vercel deployments without human intervention.

**Capabilities:**
- Trigger new deployments
- Monitor deployment status
- Get build logs
- Verify deployment health
- Cancel deployments
- Promote to production
- List recent deployments

**Example:**
```typescript
import { createVercelClient } from './autonomous-deploy';

const vercel = createVercelClient({
  token: 'xxx',
  teamId: 'team_xxx',
  projectId: 'prj_xxx'
});

// Trigger deployment
const deployment = await vercel.triggerDeployment('main');

// Monitor until complete
const result = await vercel.monitorDeployment(deployment.deploymentId);

if (result.success) {
  console.log('Deployment successful!');
} else {
  console.error('Deployment failed:', result.buildLogs);
}
```

### 3. Self-Healing System (`self-healing.ts`)

Automatically detects, diagnoses, and fixes errors.

**Process Flow:**
1. **Detect** - Monitor deployments, logs, and APIs for errors
2. **Diagnose** - Use GPT-4 to analyze errors and determine root cause
3. **Fix** - Generate code fixes using AI
4. **Deploy** - Commit fixes and trigger deployment
5. **Verify** - Ensure fix worked, rollback if not
6. **Escalate** - If can't auto-fix, notify human operator

**Confidence Thresholds:**
- `>90%` - Auto-fix without approval
- `70-90%` - Auto-fix but notify Roy
- `<70%` - Create ticket, don't auto-fix

**Example:**
```typescript
import { createSelfHealingSystem } from './self-healing';

const selfHealing = createSelfHealingSystem({
  github: githubClient,
  vercel: vercelClient,
  openaiApiKey: 'sk-xxx',
  autoFixThreshold: 70,
  notificationWebhook: 'https://...'
});

// Run healing cycle
await selfHealing.runHealingCycle();

// Get statistics
const stats = selfHealing.getStatistics();
console.log(`Success rate: ${stats.successRate}%`);
```

### 4. Continuous Learning System (`learning-system.ts`)

Learns from multiple sources to improve over time.

**Learning Sources:**
1. **Admin Dashboard** - Roy manually feeds knowledge
2. **Conversations** - Learns patterns from successful interactions
3. **Code Generation** - Learns what code works and what doesn't
4. **Web Crawls** - Automated crawling of AI news, best practices, etc.

**Web Crawl Schedule:**
- **Daily (6 AM)** - AI industry news
- **Weekly (Monday 6 AM)** - Development best practices
- **Weekly (Friday 6 AM)** - Competitor activity
- **Monthly (1st 6 AM)** - Grant opportunities

**Example:**
```typescript
import { createLearningSystem } from './learning-system';

const learning = createLearningSystem({
  supabaseUrl: 'https://xxx.supabase.co',
  supabaseKey: 'xxx',
  openaiApiKey: 'sk-xxx',
  crawlTargets: [
    { url: 'https://openai.com/blog', category: 'ai_news', frequency: 'daily' }
  ]
});

// Manual knowledge injection
await learning.ingestFromDashboard({
  topic: 'Roy prefers TypeScript',
  content: 'Always use TypeScript for new projects',
  importance: 'high'
});

// Query relevant learnings
const relevant = await learning.queryLearnings('How to optimize React?');
```

## Integration

### Complete Setup

```typescript
import { initializeAutonomousSystems } from './index';

const systems = initializeAutonomousSystems({
  github: {
    token: process.env.GITHUB_TOKEN,
    org: 'CR-AudioViz-AI',
    repo: 'crav-javari'
  },
  vercel: {
    token: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID
  },
  openaiApiKey: process.env.OPENAI_API_KEY,
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  autoFixThreshold: 70,
  crawlTargets: [
    { url: 'https://openai.com/blog', category: 'ai_news', frequency: 'daily' },
    { url: 'https://nextjs.org/blog', category: 'best_practices', frequency: 'weekly' }
  ]
});

// Access all systems
const { github, vercel, selfHealing, learning } = systems;
```

### Cron Jobs (Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/self-healing",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/web-crawl",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Create `/app/api/cron/self-healing/route.ts`:

```typescript
import { initializeAutonomousSystems } from '@/lib/autonomous';

export async function GET() {
  const systems = initializeAutonomousSystems({...});
  await systems.selfHealing.runHealingCycle();
  return Response.json({ success: true });
}
```

Create `/app/api/cron/web-crawl/route.ts`:

```typescript
import { initializeAutonomousSystems } from '@/lib/autonomous';

export async function GET() {
  const systems = initializeAutonomousSystems({...});
  await systems.learning.runScheduledCrawls();
  return Response.json({ success: true });
}
```

## Database Schema

Required Supabase table for learning system:

```sql
CREATE TABLE javari_self_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_pattern TEXT NOT NULL,
  answer TEXT NOT NULL,
  confidence_score DECIMAL NOT NULL DEFAULT 0.5,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL, -- 'admin_dashboard', 'conversation', 'code_generation', 'web_crawl'
  embedding vector(1536), -- For semantic search with pgvector
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable vector similarity search
CREATE INDEX javari_self_answers_embedding_idx ON javari_self_answers 
USING ivfflat (embedding vector_cosine_ops);

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_javari_learnings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  question_pattern TEXT,
  answer TEXT,
  confidence_score DECIMAL,
  usage_count INTEGER,
  success_rate DECIMAL,
  source TEXT,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    javari_self_answers.id,
    javari_self_answers.question_pattern,
    javari_self_answers.answer,
    javari_self_answers.confidence_score,
    javari_self_answers.usage_count,
    javari_self_answers.success_rate,
    javari_self_answers.source,
    javari_self_answers.embedding,
    javari_self_answers.created_at,
    javari_self_answers.updated_at,
    1 - (javari_self_answers.embedding <=> query_embedding) AS similarity
  FROM javari_self_answers
  WHERE 1 - (javari_self_answers.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

## Testing

```bash
# Run self-healing test
npm run test:self-healing

# Run learning system test
npm run test:learning

# Run full autonomous system test
npm run test:autonomous
```

## Monitoring

View autonomous system activity in the admin dashboard:

- **Self-Healing Stats** - `/admin/javari/self-healing`
- **Learning Progress** - `/admin/javari/learning`
- **Deployment History** - `/admin/javari/deployments`
- **GitHub Activity** - `/admin/javari/github`

## Success Metrics

**Self-Healing:**
- ✅ 70%+ auto-fix success rate
- ✅ <10 minute average fix time
- ✅ <5% false positive rate

**Learning:**
- ✅ 1000+ learnings after 30 days
- ✅ 4+ sources contributing
- ✅ 85%+ relevance score

**Deployment:**
- ✅ <5 minute build time
- ✅ 99%+ deployment success rate
- ✅ Zero downtime deployments

## Roadmap

**Phase 2 (Current):**
- ✅ Autonomous GitHub capabilities
- ✅ Autonomous Vercel deployment
- ✅ Self-healing system
- ✅ Continuous learning system

**Phase 3 (Next):**
- Performance optimization learning
- Database query optimization
- Automated A/B testing
- Predictive error prevention
- Multi-repository management

**Phase 4 (Future):**
- Voice interface integration
- Computer vision capabilities
- Cross-platform deployment (AWS, GCP)
- Team collaboration features

## Support

For issues or questions:
- Email: roy@craudiovizai.com
- Create GitHub issue
- Admin dashboard support ticket

---

**Built with ❤️ by Claude & Roy Henderson**
**November 4, 2025 - 7:00 PM EST**
