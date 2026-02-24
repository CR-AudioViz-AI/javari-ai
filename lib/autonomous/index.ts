/**
 * Javari AI - Autonomous System Integration
 * Main export file for all autonomous capabilities
 * 
 * Created: November 4, 2025 - 6:55 PM EST
 * Part of Phase 2: Autonomous & Self-Healing Build
 */

export {
  AutonomousGitHub,
  createGitHubClient
} from './autonomous-github';

export {
  AutonomousVercel,
  createVercelClient
} from './autonomous-deploy';

export {
  SelfHealingSystem,
  createSelfHealingSystem
} from './self-healing';

export {
  ContinuousLearningSystem,
  createLearningSystem
} from './learning-system';

/**
 * Initialize all autonomous systems at once
 */
export function initializeAutonomousSystems(config: {
  github: {
    token: string;
    org: string;
    repo: string;
  };
  vercel: {
    token: string;
    teamId: string;
    projectId: string;
  };
  openaiApiKey: string;
  supabase: {
    url: string;
    key: string;
  };
  autoFixThreshold?: number;
  notificationWebhook?: string;
  crawlTargets?: Array<{
    url: string;
    category: 'ai_news' | 'best_practices' | 'competitor' | 'grants';
    frequency: 'daily' | 'weekly' | 'monthly';
  }>;
}) {
  // Create clients
  const githubClient = createGitHubClient({
    token: config.github.token,
    org: config.github.org,
    repo: config.github.repo
  });

  const vercelClient = createVercelClient({
    token: config.vercel.token,
    teamId: config.vercel.teamId,
    projectId: config.vercel.projectId
  });

  // Create self-healing system
  const selfHealing = createSelfHealingSystem({
    github: githubClient,
    vercel: vercelClient,
    openaiApiKey: config.openaiApiKey,
    autoFixThreshold: config.autoFixThreshold || 70,
    notificationWebhook: config.notificationWebhook
  });

  // Create learning system
  const learning = createLearningSystem({
    supabaseUrl: config.supabase.url,
    supabaseKey: config.supabase.key,
    openaiApiKey: config.openaiApiKey,
    crawlTargets: config.crawlTargets || []
  });

  return {
    github: githubClient,
    vercel: vercelClient,
    selfHealing,
    learning
  };
}

/**
 * Example usage:
 * 
 * const systems = initializeAutonomousSystems({
 *   github: {
 *     token: process.env.GITHUB_TOKEN,
 *     org: 'CR-AudioViz-AI',
 *     repo: 'crav-javari'
 *   },
 *   vercel: {
 *     token: process.env.VERCEL_TOKEN,
 *     teamId: process.env.VERCEL_TEAM_ID,
 *     projectId: process.env.VERCEL_PROJECT_ID
 *   },
 *   openaiApiKey: process.env.OPENAI_API_KEY,
 *   supabase: {
 *     url: process.env.SUPABASE_URL,
 *     key: process.env.SUPABASE_SERVICE_ROLE_KEY
 *   },
 *   autoFixThreshold: 70,
 *   notificationWebhook: process.env.NOTIFICATION_WEBHOOK,
 *   crawlTargets: [
 *     { url: 'https://openai.com/blog', category: 'ai_news', frequency: 'daily' }
 *   ]
 * });
 * 
 * // Run self-healing cycle
 * await systems.selfHealing.runHealingCycle();
 * 
 * // Query learnings
 * const relevantInfo = await systems.learning.queryLearnings('How to optimize React performance?');
 * 
 * // Ingest manual knowledge
 * await systems.learning.ingestFromDashboard({
 *   topic: 'Roy prefers TypeScript over JavaScript',
 *   content: 'Always use TypeScript for new projects. Roy values type safety.',
 *   importance: 'high'
 * });
 */
