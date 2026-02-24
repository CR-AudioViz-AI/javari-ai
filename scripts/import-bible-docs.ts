// ============================================================
// BIBLE DOCUMENTS IMPORT + IMMEDIATE LEARNING
// ============================================================
// Imports Master Bible and Javari Bible into documentation system
// Triggers immediate learning for Javari
// Created: November 11, 2025 - 3:10 PM EST
// ============================================================

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// BIBLE DOCUMENTS TO IMPORT
// ============================================================

const BIBLE_DOCUMENTS = [
  {
    title: 'CR AudioViz AI - Master Bible v4.0 (Grant Edition)',
    category: 'business',
    visibility_level: 'owner',
    app_name: 'craudiovizai-platform',
    version: '4.0',
    file_path: 'CRAudioVizAI_Master_Bible_GrantEdition_2025_v4_0.md',
    description: 'Complete platform specification including business model, technical architecture, grant strategies, and roadmap. The authoritative reference for all platform decisions.',
    tags: ['master-bible', 'business-strategy', 'grants', 'technical-architecture', 'roadmap'],
    priority: 1,
    sections: [
      'Executive Summary',
      'Company Overview',
      'Market Opportunity',
      'Business Model & Revenue Streams',
      'Technical Architecture',
      'Product Ecosystem',
      'Social Impact Modules',
      'Grant Funding Strategy',
      'Go-To-Market Strategy',
      'Financial Projections',
    ],
  },
  {
    title: 'Javari AI Bible - Part 1: Core Architecture & Capabilities',
    category: 'ai-learning',
    visibility_level: 'owner',
    app_name: 'javari-ai',
    version: '1.0',
    file_path: 'javari-bible-part-1.md',
    description: 'Complete specifications for Javari AI including autonomous development, self-healing, learning systems, and core capabilities.',
    tags: ['javari-bible', 'ai-architecture', 'autonomous-systems', 'self-healing', 'learning-engine'],
    priority: 1,
    content: `# JAVARI AI BIBLE - PART 1: CORE ARCHITECTURE

## WHAT IS JAVARI AI?

Javari AI is an autonomous, self-healing AI development assistant that serves as the central intelligence for the CR AudioViz AI platform. Unlike traditional AI assistants, Javari can:

1. **Autonomous Development**
   - Build complete applications from scratch
   - Write, commit, and deploy code without human intervention
   - Manage GitHub repositories and branches
   - Handle Vercel deployments and rollbacks
   - Monitor production systems 24/7

2. **Self-Healing Capabilities**
   - Detect errors in production automatically
   - Diagnose root causes using GPT-4 analysis
   - Generate fixes and test solutions
   - Deploy fixes with automatic rollback on failure
   - Learn from every fix to prevent similar issues

3. **Continuous Learning System**
   - Learn from 4 data sources:
     * Admin dashboard (manual knowledge feed)
     * Conversations (user interactions)
     * Code generation (success/failure patterns)
     * Web crawling (industry news, best practices)
   - Semantic search with OpenAI embeddings + pgvector
   - Scheduled learning cycles (daily/weekly)

4. **Multi-Provider AI Routing**
   - GPT-4 Turbo for complex reasoning
   - Claude Sonnet 4 for code generation
   - Gemini 1.5 Flash for fast responses
   - Perplexity for real-time web search
   - Intelligent routing based on task type

## TECHNICAL ARCHITECTURE

### Database Schema (Supabase)
- **javari_conversations** - Chat history with users
- **javari_messages** - Individual messages with embeddings
- **javari_knowledge_base** - RAG corpus with vector search
- **javari_credentials** - Encrypted credential vault (AES-256)
- **javari_projects** - Project hierarchy management
- **javari_learning** - Learning corpus with embeddings
- **javari_knowledge_graph** - Concept relationships
- **learning_queue** - Documents waiting to be processed

### Core Components
1. **Chat Interface** (Next.js + React)
   - Real-time streaming responses
   - Markdown rendering with syntax highlighting
   - Artifact system for code previews
   - Context-aware conversations

2. **Learning Engine** (TypeScript + OpenAI)
   - Embedding generation (text-embedding-3-small)
   - Vector similarity search (pgvector)
   - Pattern recognition and extraction
   - Confidence scoring (0.0 - 1.0)

3. **Autonomous Systems** (Node.js)
   - GitHub API integration (commits, PRs, branches)
   - Vercel API integration (deployments, logs, rollbacks)
   - Self-healing monitor (runs every 30 minutes)
   - Web crawler (daily AI news, weekly best practices)

4. **Credential Vault** (AES-256 Encryption)
   - Per-project credential storage
   - Hierarchical access (main → sub-projects)
   - Automatic rotation capabilities
   - Secure API key management

## JAVARI'S PERSONALITY & APPROACH

### Core Traits
- **Partnership-focused:** "Your success is my success"
- **Action-oriented:** Executes without asking for permission
- **Honest:** Never invents or guesses; admits uncertainty
- **Systematic:** Follows established patterns and best practices
- **Quality-driven:** Fortune 50 standards by default
- **Efficient:** Economy mode to minimize costs

### Communication Style
- Direct and timestamped responses
- Minimal explanations unless requested
- Complete file replacements (no partial patches)
- One step at a time, waits for "continue"
- Uses Roy's preferred terminology and phrases

### Operating Principles
1. **Always Automate:** Build systems, not one-off solutions
2. **Customer First:** Credits never expire, automatic refunds
3. **Full Transparency:** Complete audit trails and logs
4. **Code Ownership:** Users own all generated code
5. **Build Here, Host Anywhere:** No vendor lock-in

## AUTONOMOUS CAPABILITIES IN DETAIL

### 1. GitHub Automation
\`\`\`typescript
// Javari can do all of this without human intervention:
- Read/write files in any repository
- Create commits with meaningful messages
- Push to branches (main or feature branches)
- Create pull requests with descriptions
- Merge PRs after verification
- Rollback commits if deployment fails
- Create GitHub issues for complex problems
\`\`\`

### 2. Vercel Automation
\`\`\`typescript
// Javari manages deployments end-to-end:
- Trigger new deployments
- Monitor build logs in real-time
- Verify successful deployment
- Run smoke tests on preview URLs
- Promote to production when ready
- Rollback to previous version on failure
- Cancel stuck builds automatically
\`\`\`

### 3. Self-Healing Process
\`\`\`typescript
// Every 30 minutes, Javari:
1. Monitors production error logs
2. Detects new errors or spikes
3. Fetches relevant code context
4. Analyzes error with GPT-4
5. Generates fix with confidence score
6. If confidence > 70%:
   - Creates fix in new branch
   - Commits with detailed message
   - Deploys to preview environment
   - Runs automated tests
   - If tests pass: Merges to main
   - If tests fail: Rolls back, escalates
7. If confidence < 70%:
   - Creates GitHub issue
   - Notifies Roy via webhook
   - Waits for human review
\`\`\`

### 4. Learning Cycle
\`\`\`typescript
// Javari learns continuously:

// Daily: Web Crawling
- Crawls tech news sites (TechCrunch, Hacker News)
- Crawls AI research (arXiv, papers.withcode)
- Extracts key insights with AI summarization
- Generates embeddings for semantic search
- Stores in knowledge base with metadata

// Real-time: Conversation Learning
- After every conversation:
  - Extracts question patterns
  - Stores successful answers
  - Generates embeddings
  - Updates confidence scores
  - Tracks usage frequency

// On-Demand: Admin Dashboard Learning
- Roy manually feeds strategic knowledge
- Highest priority (immediate processing)
- Used for business logic, policies, decisions

// Post-Mortem: Code Generation Learning
- Tracks successful code patterns
- Stores anti-patterns (what NOT to do)
- Learns from build failures
- Improves code quality over time
\`\`\`

## INTEGRATION WITH PLATFORM

### How Javari Connects to Everything

1. **Main Website (craudiovizai.com)**
   - Embedded chat widget on every page
   - Context-aware based on current page
   - Can guide users through features

2. **Admin Dashboard**
   - Dedicated Javari admin panel
   - Real-time learning statistics
   - Manual knowledge feed interface
   - Self-healing event monitor

3. **All Apps (60+ tools)**
   - Embedded help system in each app
   - App-specific knowledge and guidance
   - Troubleshooting assistance

4. **Support System**
   - Auto-responds to tickets with knowledge base
   - Escalates when confidence < 70%
   - Links relevant documentation

5. **Development Workflow**
   - GitHub integration for code reviews
   - Automated deployment pipeline
   - Production monitoring

## COMPETITIVE ADVANTAGES

### vs ChatGPT
❌ ChatGPT: No autonomous deployment
✅ Javari: Full GitHub + Vercel automation

❌ ChatGPT: No production monitoring
✅ Javari: 24/7 self-healing system

❌ ChatGPT: No learning from usage
✅ Javari: Continuous learning from 4 sources

### vs GitHub Copilot
❌ Copilot: Code suggestions only
✅ Javari: Complete application development

❌ Copilot: No deployment capabilities
✅ Javari: End-to-end deployment automation

❌ Copilot: No self-healing
✅ Javari: Automatic error detection and fixing

### vs Claude
❌ Claude: No persistent memory
✅ Javari: Complete conversation history + learning

❌ Claude: No autonomous actions
✅ Javari: Full GitHub/Vercel automation

❌ Claude: Limited to chat interface
✅ Javari: Integrated into entire platform

## FUTURE ROADMAP

### Phase 1: Core Capabilities (✅ COMPLETE)
- Chat interface with streaming
- Knowledge base with RAG
- Credential vault management
- Basic autonomous capabilities

### Phase 2: Learning & Self-Healing (🟡 IN PROGRESS)
- Continuous learning system
- Self-healing automation
- Web crawling for updates
- Documentation integration ← **CURRENT WORK**

### Phase 3: Advanced Features (Q1 2026)
- Multi-agent collaboration (Javari + CRAI + Kairo)
- Voice interface (speech-to-text, text-to-speech)
- Advanced code analysis (security, performance)
- Predictive maintenance (prevent errors before they happen)

### Phase 4: Intelligence Network (Q2 2026)
- Cross-platform learning (learn from all users)
- Collective intelligence sharing
- Industry trend prediction
- Proactive feature recommendations

## SUCCESS METRICS

### Learning Progress
- Documents learned: Target 1000+ by end of 2025
- Confidence scores: Average > 0.80
- Usage frequency: > 100 queries/day
- Learning accuracy: > 85% helpful responses

### Autonomous Operations
- Self-healing success rate: > 90%
- False positive rate: < 5%
- Average fix time: < 15 minutes
- Rollback rate: < 10%

### Development Efficiency
- Code quality: TypeScript strict mode, zero errors
- Deployment success: > 95% first-time deployments
- Build time: < 2 minutes average
- Test coverage: > 80% for critical paths

## CONCLUSION

Javari AI represents a fundamental shift from "AI assistant" to "autonomous AI partner." She doesn't just answer questions - she builds applications, fixes problems, learns continuously, and operates the entire platform infrastructure.

**This is the future of software development: AI that codes, deploys, monitors, fixes, and improves itself.**
`,
  },
  {
    title: 'Javari AI Bible - Part 2: Implementation Guide',
    category: 'technical',
    visibility_level: 'admin',
    app_name: 'javari-ai',
    version: '1.0',
    file_path: 'javari-bible-part-2.md',
    description: 'Technical implementation details, API references, deployment procedures, and troubleshooting guides for Javari AI.',
    tags: ['javari-bible', 'implementation', 'api-reference', 'deployment', 'troubleshooting'],
    priority: 2,
    content: `# JAVARI AI BIBLE - PART 2: IMPLEMENTATION GUIDE

## ENVIRONMENT SETUP

### Required Environment Variables
\`\`\`bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://kteobfyferrukqeolofj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service role key]

# AI Providers
OPENAI_API_KEY=[OpenAI API key]
ANTHROPIC_API_KEY=[Claude API key]
GOOGLE_AI_API_KEY=[Gemini API key]
PERPLEXITY_API_KEY=[Perplexity API key]

# Deployment
GITHUB_TOKEN=[GitHub personal access token]
VERCEL_TOKEN=[Vercel API token]
VERCEL_TEAM_ID=[Vercel team ID]
VERCEL_PROJECT_ID=[Vercel project ID]

# Security
JAVARI_API_KEY=[32-char random string for API auth]
CRON_SECRET=[32-char random string for cron job auth]
WEBHOOK_SECRET=[32-char random string for GitHub webhooks]

# Optional
NOTIFICATION_WEBHOOK=[Slack/Discord webhook for alerts]
\`\`\`

### Local Development Setup
\`\`\`bash
# Clone repository
git clone https://github.com/CR-AudioViz-AI/crav-javari.git
cd crav-javari

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your actual keys

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Open http://localhost:3000
\`\`\`

## API REFERENCE

### Chat API
**Endpoint:** \`POST /api/chat\`

**Request:**
\`\`\`typescript
{
  message: string;
  conversation_id?: string;
  user_id?: string;
  app_context?: {
    app_name: string;
    current_page: string;
    user_action: string;
  };
  stream?: boolean; // Default: true
}
\`\`\`

**Response (Streaming):**
\`\`\`typescript
// Server-Sent Events (SSE)
data: {"type": "content", "content": "Hello, "}
data: {"type": "content", "content": "I'm Javari"}
data: {"type": "done", "conversation_id": "uuid"}
\`\`\`

### Learning API
**Endpoint:** \`POST /api/javari/learn-from-docs\`

**Authentication:** Bearer token required

**Request:**
\`\`\`typescript
{
  mode: 'immediate' | 'batch' | 'single';
  doc_id?: string; // For single mode
  category?: string; // For batch mode
  max_docs?: number; // Max docs to process
  force_refresh?: boolean; // Re-learn already learned docs
}
\`\`\`

**Response:**
\`\`\`typescript
{
  success: boolean;
  docs_processed: number;
  docs_failed: number;
  results: Array<{
    doc_id: string;
    title: string;
    status: 'success' | 'failed';
    confidence_score?: number;
    error?: string;
  }>;
  queue_status: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}
\`\`\`

### Self-Healing API
**Endpoint:** \`POST /api/cron/self-healing\`

**Authentication:** Cron secret required

**Trigger:** Automatically every 30 minutes via Vercel Cron

**Manual Trigger:**
\`\`\`bash
curl -X POST https://craudiovizai.com/api/cron/self-healing \\
  -H "Authorization: Bearer $CRON_SECRET"
\`\`\`

## DEPLOYMENT PROCEDURES

### Initial Deployment
\`\`\`bash
# 1. Create Supabase project
# - Go to supabase.com/dashboard
# - Create new project
# - Save URL and keys

# 2. Run all database migrations
# - Copy SQL from /database/migrations/
# - Run in Supabase SQL Editor
# - Verify all tables created

# 3. Set up Vercel project
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... add all other env vars

# 4. Deploy to production
vercel --prod

# 5. Set up GitHub webhooks
# - Go to each repo: Settings → Webhooks
# - Add webhook URL: https://craudiovizai.com/api/webhooks/github/documentation
# - Set secret to WEBHOOK_SECRET value
# - Enable "Just push events"

# 6. Verify deployment
curl https://craudiovizai.com/api/health
\`\`\`

### Update Deployment
\`\`\`bash
# 1. Make changes locally
git checkout -b feature/new-feature

# 2. Test locally
npm run dev
npm run test

# 3. Commit and push
git add .
git commit -m "feat: Add new feature"
git push origin feature/new-feature

# 4. Vercel auto-deploys preview
# Check preview URL in GitHub PR

# 5. Merge to main
# Vercel auto-deploys to production

# 6. Monitor deployment
vercel logs --follow
\`\`\`

### Rollback Procedure
\`\`\`bash
# Option 1: Vercel dashboard
# - Go to vercel.com/dashboard
# - Find project
# - Click "Deployments"
# - Click "..." on previous deployment
# - Click "Promote to Production"

# Option 2: CLI
vercel rollback [deployment-url]

# Option 3: Git revert
git revert HEAD
git push origin main
# Vercel auto-deploys reverted code
\`\`\`

## TROUBLESHOOTING

### Common Issues & Solutions

#### Issue: "Chat not responding"
**Symptoms:** Chat widget loads but no response from Javari

**Diagnosis:**
\`\`\`bash
# Check API health
curl https://craudiovizai.com/api/health

# Check OpenAI API key
curl https://api.openai.com/v1/models \\
  -H "Authorization: Bearer $OPENAI_API_KEY"
\`\`\`

**Solutions:**
1. Verify OPENAI_API_KEY in Vercel env vars
2. Check OpenAI account has credits
3. Check Supabase connection (database might be down)
4. Review Vercel logs for specific error

#### Issue: "Self-healing not triggering"
**Symptoms:** Errors in production but no automatic fixes

**Diagnosis:**
\`\`\`bash
# Check cron job configuration
curl https://craudiovizai.com/api/cron/self-healing \\
  -H "Authorization: Bearer $CRON_SECRET"
\`\`\`

**Solutions:**
1. Verify CRON_SECRET matches Vercel cron config
2. Check vercel.json has correct cron schedule
3. Manually trigger to test functionality
4. Review self-healing logs in Supabase

#### Issue: "Learning system not processing docs"
**Symptoms:** Docs added but not appearing in learned stats

**Diagnosis:**
\`\`\`bash
# Check queue status
curl https://craudiovizai.com/api/javari/learn-from-docs \\
  -H "Authorization: Bearer $JAVARI_API_KEY"
\`\`\`

**Solutions:**
1. Check javari_document_queue table for failed items
2. Verify OpenAI embeddings API is working
3. Check database permissions (RLS policies)
4. Manually trigger learning for single doc to test

#### Issue: "GitHub automation failing"
**Symptoms:** Javari can't commit code or create PRs

**Diagnosis:**
\`\`\`bash
# Test GitHub token
curl -H "Authorization: token $GITHUB_TOKEN" \\
  https://api.github.com/user
\`\`\`

**Solutions:**
1. Verify GITHUB_TOKEN has correct permissions:
   - repo (full control)
   - workflow (for GitHub Actions)
2. Check token hasn't expired
3. Verify organization access if using org repos
4. Test with curl to isolate issue

## MONITORING & LOGS

### Key Metrics to Monitor
1. **Chat Performance**
   - Response time (should be < 2 seconds)
   - Error rate (should be < 1%)
   - Active conversations per day

2. **Learning System**
   - Docs processed per day (target: 10+)
   - Average confidence score (target: > 0.80)
   - Queue backlog (should be < 50)

3. **Self-Healing**
   - Fixes attempted per week
   - Success rate (target: > 90%)
   - Average time to fix (target: < 15 min)

4. **Infrastructure**
   - API response time
   - Database query time
   - Vercel build time
   - Error rate by endpoint

### Log Locations
\`\`\`bash
# Vercel logs
vercel logs --follow

# Supabase logs
# Dashboard → Logs → API Logs

# GitHub Actions logs
# GitHub repo → Actions → Select workflow run

# Local logs
tail -f .next/standalone/logs/all.log
\`\`\`

## SECURITY BEST PRACTICES

### 1. API Key Management
- Never commit API keys to Git
- Use Vercel environment variables
- Rotate keys every 90 days
- Monitor key usage for anomalies

### 2. Database Security
- Enable Row Level Security (RLS) on all tables
- Use service role key only in server-side code
- Audit database access logs monthly
- Backup database daily

### 3. Authentication
- Use Supabase Auth for user authentication
- Implement rate limiting on all APIs
- Require API key for cron jobs
- Use HTTPS only (no HTTP)

### 4. Code Security
- Run TypeScript in strict mode
- Enable ESLint security rules
- Scan dependencies for vulnerabilities
- Review all code changes before merge

## MAINTENANCE SCHEDULE

### Daily
- [ ] Check Vercel deployment status
- [ ] Review error logs for new issues
- [ ] Monitor self-healing success rate
- [ ] Check API response times

### Weekly
- [ ] Review learning system statistics
- [ ] Clean up failed queue items
- [ ] Update dependencies (npm update)
- [ ] Review GitHub Issues

### Monthly
- [ ] Rotate API keys
- [ ] Database backup verification
- [ ] Performance optimization review
- [ ] Security audit

### Quarterly
- [ ] Major dependency updates
- [ ] Architecture review
- [ ] Disaster recovery drill
- [ ] Capacity planning

## CONCLUSION

This implementation guide provides everything needed to deploy, maintain, and troubleshoot Javari AI. Follow these procedures for reliable, secure operation of the autonomous AI system.

For questions or issues not covered here, create a GitHub Issue or contact Roy Henderson directly.
`,
  },
];

// ============================================================
// IMPORT FUNCTION
// ============================================================

async function importBibleDocuments() {
  console.log('🚀 Starting Bible document import...\n');

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    details: [] as any[],
  };

  for (const doc of BIBLE_DOCUMENTS) {
    try {
      console.log(`📄 Processing: ${doc.title}`);

      // Check if document already exists
      const { data: existing, error: checkError } = await supabase
        .from('documentation_system_docs')
        .select('id, version')
        .eq('title', doc.title)
        .single();

      if (existing && !checkError) {
        console.log(`  ⏭️  Skipped (already exists with version ${existing.version})`);
        results.skipped++;
        results.details.push({
          title: doc.title,
          status: 'skipped',
          reason: 'Document already exists',
        });
        continue;
      }

      // Insert document
      const { data: inserted, error: insertError } = await supabase
        .from('documentation_system_docs')
        .insert({
          title: doc.title,
          content: doc.content || '(Import from file pending)',
          category: doc.category,
          app_name: doc.app_name,
          visibility_level: doc.visibility_level,
          status: 'published',
          version: doc.version,
          tags: doc.tags,
          search_keywords: doc.tags.join(' '),
          feature_purpose: doc.description,
          created_by_type: 'system',
          created_by_name: 'Bible Import Script',
          updated_by_type: 'system',
          updated_by_name: 'Bible Import Script',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`  ✅ Imported successfully (ID: ${inserted.id})`);
      results.success++;
      results.details.push({
        title: doc.title,
        status: 'success',
        doc_id: inserted.id,
      });
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}`);
      results.failed++;
      results.details.push({
        title: doc.title,
        status: 'failed',
        error: error.message,
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${results.success}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(60) + '\n');

  return results;
}

// ============================================================
// TRIGGER IMMEDIATE LEARNING
// ============================================================

async function triggerImmediateLearning() {
  console.log('🧠 Triggering immediate learning for imported docs...\n');

  try {
    // Call Javari learning API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/javari/learn-from-docs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.JAVARI_API_KEY}`,
      },
      body: JSON.stringify({
        mode: 'batch',
        category: 'ai-learning', // Start with highest priority
        max_docs: 10,
        force_refresh: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    console.log('='.repeat(60));
    console.log('🧠 LEARNING RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Docs Processed: ${result.docs_processed}`);
    console.log(`❌ Docs Failed: ${result.docs_failed}`);
    console.log(`\n📊 Queue Status:`);
    console.log(`   - Pending: ${result.queue_status.pending}`);
    console.log(`   - Processing: ${result.queue_status.processing}`);
    console.log(`   - Completed: ${result.queue_status.completed}`);
    console.log(`   - Failed: ${result.queue_status.failed}`);
    console.log('='.repeat(60) + '\n');

    return result;
  } catch (error: any) {
    console.error('❌ Learning trigger failed:', error.message);
    throw error;
  }
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('📚 BIBLE DOCUMENTS IMPORT + LEARNING ACTIVATION');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  console.log('='.repeat(60) + '\n');

  // Step 1: Import Bible documents
  const importResults = await importBibleDocuments();

  // Step 2: Trigger immediate learning
  if (importResults.success > 0) {
    await triggerImmediateLearning();
  } else {
    console.log('⚠️  No new documents imported, skipping learning trigger\n');
  }

  console.log('✅ Bible import and learning activation complete!\n');
  console.log('Next steps:');
  console.log('1. Check Supabase documentation_system_docs table');
  console.log('2. Monitor javari_document_queue for processing status');
  console.log('3. Review javari_learning table for learned patterns');
  console.log('4. Check admin dashboard for real-time statistics\n');
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
