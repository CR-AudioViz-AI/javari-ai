/**
 * Javari Autonomous System Orchestrator
 * Main integration point for autonomous app building, deployment, and healing
 * Phase D Complete Integration
 * 
 * Created: November 20, 2025, 2:45 PM EST
 */

import { Logger } from './logger';
import { MultiAIProvider } from './multi-ai-provider';
import { AutonomousCodeGenerator } from './autonomous-code-generator';
import { GitHubAutomation } from './github-automation';
import { VercelAutomation, getVercelAutomation } from './vercel-automation';
import { SelfHealingSystem, getSelfHealingSystem } from './self-healing';

const logger = new Logger('JavariOrchestrator');

interface BuildRequest {
  appName: string;
  description: string;
  features: string[];
  tech: {
    framework: 'nextjs' | 'react' | 'vue';
    database?: 'supabase' | 'postgres' | 'mongodb';
    styling?: 'tailwind' | 'css' | 'styled-components';
    auth?: boolean;
    payments?: boolean;
  };
  deployment: {
    autoPreview: boolean;
    autoProduction: boolean;
  };
}

interface BuildResult {
  success: boolean;
  repoUrl: string;
  previewUrl?: string;
  productionUrl?: string;
  duration: number;
  logs: string[];
  errors?: string[];
}

export class JavariOrchestrator {
  private aiProvider: MultiAIProvider;
  private codeGenerator: AutonomousCodeGenerator;
  private github: GitHubAutomation;
  private vercel: VercelAutomation;
  private selfHealing: SelfHealingSystem;

  constructor(config: {
    githubToken: string;
    githubOrg: string;
    vercelToken: string;
    vercelTeamId: string;
    openaiKey: string;
    anthropicKey: string;
    geminiKey: string;
    perplexityKey: string;
  }) {
    // Initialize AI provider
    this.aiProvider = new MultiAIProvider({
      openai: { apiKey: config.openaiKey },
      anthropic: { apiKey: config.anthropicKey },
      google: { apiKey: config.geminiKey },
      perplexity: { apiKey: config.perplexityKey },
    });

    // Initialize code generator
    this.codeGenerator = new AutonomousCodeGenerator(this.aiProvider);

    // Initialize GitHub automation
    this.github = new GitHubAutomation({
      token: config.githubToken,
      defaultOrg: config.githubOrg,
    });

    // Initialize Vercel automation
    this.vercel = getVercelAutomation({
      token: config.vercelToken,
      teamId: config.vercelTeamId,
    });

    // Initialize self-healing system
    this.selfHealing = getSelfHealingSystem(
      this.github,
      this.vercel,
      this.aiProvider,
      this.codeGenerator
    );

    // Start continuous monitoring
    this.selfHealing.startMonitoring();

    logger.info('Javari Orchestrator initialized - FULLY AUTONOMOUS');
  }

  /**
   * Build complete app from natural language description
   * This is the main autonomous workflow
   */
  async buildApp(request: BuildRequest): Promise<BuildResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];

    try {
      logger.info('Starting autonomous app build', { appName: request.appName });
      logs.push(`[${new Date().toISOString()}] Starting build for ${request.appName}`);

      // 1. Generate app architecture
      logs.push('Generating app architecture...');
      const architecture = await this.generateArchitecture(request);
      logs.push(`Architecture generated: ${architecture.files.length} files`);

      // 2. Create GitHub repository
      logs.push('Creating GitHub repository...');
      const repoName = request.appName.toLowerCase().replace(/\s+/g, '-');
      const repo = await this.github.createRepository({
        name: repoName,
        description: request.description,
        private: false,
        autoInit: true,
      });
      logs.push(`Repository created: ${repo.html_url}`);

      // 3. Generate all code files
      logs.push(`Generating ${architecture.files.length} code files...`);
      const fileGenerationResults = await this.generateAllFiles(
        architecture.files,
        request.tech
      );
      logs.push(`Generated ${fileGenerationResults.length} files`);

      // 4. Commit all files to repository
      logs.push('Committing files to repository...');
      for (const file of fileGenerationResults) {
        await this.github.createOrUpdateFile({
          owner: this.github['config'].defaultOrg,
          repo: repoName,
          path: file.path,
          content: file.content,
          message: `🤖 Auto-generate: ${file.path}`,
        });
        logs.push(`Committed: ${file.path}`);
      }

      // 5. Create Vercel project and deploy
      logs.push('Creating Vercel project and deploying...');
      const deployment = await this.vercel.buildAndDeploy({
        appName: repoName,
        repoName: `${this.github['config'].defaultOrg}/${repoName}`,
        framework: request.tech.framework,
        env: this.generateEnvVars(request.tech),
        autoPromote: request.deployment.autoProduction,
      });
      logs.push(`Deployed to: ${deployment.deploymentUrl}`);

      // 6. Monitor deployment health
      logs.push('Monitoring deployment...');
      await this.monitorDeployment(deployment.deploymentId, logs);

      // 7. Run post-deployment checks
      logs.push('Running post-deployment checks...');
      const healthCheck = await this.selfHealing.performHealthCheck();
      if (healthCheck.overallStatus !== 'healthy') {
        logs.push('Health check detected issues - triggering auto-repair');
        await this.selfHealing.triggerAutoRepair();
      }

      const result: BuildResult = {
        success: true,
        repoUrl: repo.html_url,
        previewUrl: deployment.deploymentUrl,
        productionUrl: request.deployment.autoProduction ? deployment.deploymentUrl : undefined,
        duration: Date.now() - startTime,
        logs,
      };

      logger.info('App build complete', {
        appName: request.appName,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      logger.error('App build failed', { error, appName: request.appName });
      errors.push(`Build failed: ${error}`);

      // Report error to self-healing system
      await this.selfHealing.reportError({
        type: 'build',
        severity: 'critical',
        message: `App build failed: ${error}`,
        context: { appName: request.appName, request },
      });

      return {
        success: false,
        repoUrl: '',
        duration: Date.now() - startTime,
        logs,
        errors,
      };
    }
  }

  /**
   * Generate app architecture from description
   */
  private async generateArchitecture(
    request: BuildRequest
  ): Promise<{ files: Array<{ path: string; description: string }> }> {
    const prompt = `Generate a complete file structure for a ${request.tech.framework} app:

App Name: ${request.appName}
Description: ${request.description}
Features: ${request.features.join(', ')}
Framework: ${request.tech.framework}
Database: ${request.tech.database || 'none'}
Styling: ${request.tech.styling || 'tailwind'}
Auth: ${request.tech.auth ? 'yes' : 'no'}
Payments: ${request.tech.payments ? 'yes' : 'no'}

Return a JSON array of files with this structure:
[
  { "path": "src/app/page.tsx", "description": "Main landing page" },
  { "path": "src/components/Header.tsx", "description": "Header component" },
  ...
]

Include ALL necessary files: components, pages, API routes, utilities, config, types, etc.`;

    const response = await this.aiProvider.chat(
      [{ role: 'user', content: prompt }],
      'claude'
    );

    // Parse JSON from response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse architecture from AI response');
    }

    const files = JSON.parse(jsonMatch[0]);
    return { files };
  }

  /**
   * Generate all code files based on architecture
   */
  private async generateAllFiles(
    files: Array<{ path: string; description: string }>,
    tech: BuildRequest['tech']
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];

    for (const file of files) {
      const fileType = this.getFileType(file.path);
      const code = await this.codeGenerator.generateCode({
        description: file.description,
        fileType,
        context: { framework: tech.framework, path: file.path },
      });

      results.push({
        path: file.path,
        content: code.code,
      });
    }

    return results;
  }

  /**
   * Get file type from path
   */
  private getFileType(path: string): string {
    const ext = path.split('.').pop() || '';
    const typeMap: Record<string, string> = {
      tsx: 'tsx',
      ts: 'ts',
      jsx: 'jsx',
      js: 'js',
      css: 'css',
      json: 'json',
      md: 'md',
    };
    return typeMap[ext] || 'text';
  }

  /**
   * Generate environment variables based on tech stack
   */
  private generateEnvVars(tech: BuildRequest['tech']): Record<string, string> {
    const env: Record<string, string> = {};

    if (tech.database === 'supabase') {
      env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    }

    if (tech.payments) {
      env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
      env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    }

    if (tech.auth) {
      env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || '';
      env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || '';
    }

    return env;
  }

  /**
   * Monitor deployment progress
   */
  private async monitorDeployment(deploymentId: string, logs: string[]): Promise<void> {
    const maxAttempts = 60; // 5 minutes (5 second intervals)
    let attempt = 0;

    while (attempt < maxAttempts) {
      const deployment = await this.vercel.getDeployment(deploymentId);

      if (deployment.readyState === 'READY') {
        logs.push('Deployment ready!');
        return;
      }

      if (deployment.readyState === 'ERROR') {
        logs.push('Deployment failed!');
        
        // Report error and trigger repair
        await this.selfHealing.reportError({
          type: 'deployment',
          severity: 'critical',
          message: 'Deployment failed',
          deploymentId,
        });

        throw new Error('Deployment failed');
      }

      if (deployment.readyState === 'CANCELED') {
        logs.push('Deployment canceled');
        throw new Error('Deployment canceled');
      }

      // Still building
      logs.push(`Deployment status: ${deployment.readyState}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempt++;
    }

    throw new Error('Deployment timeout');
  }

  /**
   * Update existing app
   */
  async updateApp(config: {
    repoName: string;
    changes: string;
    autoDeploy: boolean;
  }): Promise<BuildResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      logs.push(`Updating app: ${config.repoName}`);

      // 1. Generate code changes using AI
      const updates = await this.codeGenerator.generateCode({
        description: config.changes,
        fileType: 'tsx',
        context: { repoName: config.repoName },
      });

      // 2. Commit changes
      await this.github.createOrUpdateFile({
        owner: this.github['config'].defaultOrg,
        repo: config.repoName,
        path: 'src/app/page.tsx', // TODO: Detect which file to update
        content: updates.code,
        message: `🤖 Auto-update: ${config.changes}`,
      });

      logs.push('Changes committed');

      // 3. Trigger deployment if requested
      let previewUrl: string | undefined;
      if (config.autoDeploy) {
        const deployment = await this.vercel.createDeployment({
          name: config.repoName,
          gitSource: {
            type: 'github',
            repo: `${this.github['config'].defaultOrg}/${config.repoName}`,
            ref: 'main',
          },
          target: 'preview',
        });

        previewUrl = deployment.url;
        logs.push(`Deployed to: ${previewUrl}`);
      }

      return {
        success: true,
        repoUrl: `https://github.com/${this.github['config'].defaultOrg}/${config.repoName}`,
        previewUrl,
        duration: Date.now() - startTime,
        logs,
      };
    } catch (error) {
      logger.error('App update failed', { error, repoName: config.repoName });

      return {
        success: false,
        repoUrl: '',
        duration: Date.now() - startTime,
        logs,
        errors: [`Update failed: ${error}`],
      };
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus() {
    return await this.selfHealing.performHealthCheck();
  }

  /**
   * Get repair history
   */
  getRepairHistory() {
    return this.selfHealing.getRepairHistory();
  }

  /**
   * Shutdown orchestrator
   */
  shutdown(): void {
    this.selfHealing.stopMonitoring();
    logger.info('Javari Orchestrator shutdown complete');
  }
}

// Export for use in app
export async function createJavariOrchestrator(): Promise<JavariOrchestrator> {
  const config = {
    githubToken: process.env.GITHUB_TOKEN || '',
    githubOrg: process.env.GITHUB_ORG || 'CR-AudioViz-AI',
    vercelToken: process.env.VERCEL_TOKEN || '',
    vercelTeamId: process.env.VERCEL_TEAM_ID || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
    perplexityKey: process.env.PERPLEXITY_API_KEY || '',
  };

  return new JavariOrchestrator(config);
}
