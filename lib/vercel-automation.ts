/**
 * Vercel Automation System
 * Autonomous deployment, monitoring, and management
 * Part of Javari Autonomous System - Phase D.4
 * 
 * Created: November 20, 2025, 2:40 PM EST
 */

import { Logger } from './logger';

const logger = new Logger('VercelAutomation');

interface VercelConfig {
  token: string;
  teamId?: string;
  orgId?: string;
}

interface DeploymentConfig {
  name: string;
  gitSource: {
    type: 'github';
    repo: string;
    ref?: string;
  };
  target?: 'production' | 'preview';
  projectSettings?: {
    framework?: string;
    buildCommand?: string;
    outputDirectory?: string;
    installCommand?: string;
    devCommand?: string;
  };
  env?: Record<string, string>;
}

interface Project {
  id: string;
  name: string;
  framework: string;
  targets: {
    production?: {
      alias?: string[];
      url?: string;
    };
  };
  latestDeployments?: any[];
}

interface Deployment {
  uid: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  readyState: string;
  createdAt: number;
  creator: {
    uid: string;
    email?: string;
    username?: string;
  };
  meta?: {
    githubCommitSha?: string;
    githubCommitRef?: string;
    githubCommitMessage?: string;
  };
  target?: 'production' | 'preview';
}

interface DeploymentError {
  code: string;
  message: string;
}

export class VercelAutomation {
  private config: VercelConfig;
  private baseUrl = 'https://api.vercel.com';

  constructor(config: VercelConfig) {
    this.config = config;
    logger.info('Vercel Automation initialized', { teamId: config.teamId });
  }

  /**
   * Create deployment (preview or production)
   */
  async createDeployment(config: DeploymentConfig): Promise<Deployment> {
    try {
      logger.info('Creating deployment', { name: config.name, target: config.target });

      const payload: any = {
        name: config.name,
        gitSource: config.gitSource,
        target: config.target || 'preview',
      };

      // Add project settings if provided
      if (config.projectSettings) {
        payload.projectSettings = config.projectSettings;
      }

      // Add environment variables if provided
      if (config.env) {
        payload.env = Object.entries(config.env).map(([key, value]) => ({
          key,
          value,
          type: 'encrypted',
          target: ['production', 'preview'],
        }));
      }

      const response = await this.makeRequest('/v13/deployments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      logger.info('Deployment created', {
        id: response.id,
        url: response.url,
        state: response.readyState,
      });

      return response;
    } catch (error) {
      logger.error('Failed to create deployment', { error, config });
      throw error;
    }
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    try {
      const deployment = await this.makeRequest(`/v13/deployments/${deploymentId}`);
      return deployment;
    } catch (error) {
      logger.error('Failed to get deployment', { error, deploymentId });
      throw error;
    }
  }

  /**
   * List deployments for a project
   */
  async listDeployments(projectId: string, limit = 20): Promise<Deployment[]> {
    try {
      const params = new URLSearchParams({
        projectId,
        limit: limit.toString(),
      });

      const response = await this.makeRequest(`/v6/deployments?${params}`);
      return response.deployments || [];
    } catch (error) {
      logger.error('Failed to list deployments', { error, projectId });
      throw error;
    }
  }

  /**
   * Cancel a deployment
   */
  async cancelDeployment(deploymentId: string): Promise<void> {
    try {
      await this.makeRequest(`/v12/deployments/${deploymentId}/cancel`, {
        method: 'PATCH',
      });
      logger.info('Deployment canceled', { deploymentId });
    } catch (error) {
      logger.error('Failed to cancel deployment', { error, deploymentId });
      throw error;
    }
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    try {
      await this.makeRequest(`/v13/deployments/${deploymentId}`, {
        method: 'DELETE',
      });
      logger.info('Deployment deleted', { deploymentId });
    } catch (error) {
      logger.error('Failed to delete deployment', { error, deploymentId });
      throw error;
    }
  }

  /**
   * Wait for deployment to complete
   */
  async waitForDeployment(
    deploymentId: string,
    timeout = 600000, // 10 minutes
    pollInterval = 5000 // 5 seconds
  ): Promise<Deployment> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const deployment = await this.getDeployment(deploymentId);

      if (deployment.readyState === 'READY') {
        logger.info('Deployment ready', {
          id: deploymentId,
          url: deployment.url,
          duration: Date.now() - startTime,
        });
        return deployment;
      }

      if (deployment.readyState === 'ERROR') {
        logger.error('Deployment failed', { id: deploymentId });
        throw new Error(`Deployment failed: ${deploymentId}`);
      }

      if (deployment.readyState === 'CANCELED') {
        logger.warn('Deployment canceled', { id: deploymentId });
        throw new Error(`Deployment canceled: ${deploymentId}`);
      }

      // Still building, wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Deployment timeout after ${timeout}ms: ${deploymentId}`);
  }

  /**
   * Create project
   */
  async createProject(config: {
    name: string;
    framework?: string;
    gitRepository?: {
      type: 'github';
      repo: string;
    };
    buildCommand?: string;
    devCommand?: string;
    installCommand?: string;
    outputDirectory?: string;
    rootDirectory?: string;
    environmentVariables?: Array<{
      key: string;
      value: string;
      target: string[];
    }>;
  }): Promise<Project> {
    try {
      logger.info('Creating project', { name: config.name });

      const response = await this.makeRequest('/v9/projects', {
        method: 'POST',
        body: JSON.stringify(config),
      });

      logger.info('Project created', { id: response.id, name: response.name });
      return response;
    } catch (error) {
      logger.error('Failed to create project', { error, config });
      throw error;
    }
  }

  /**
   * Get project by ID or name
   */
  async getProject(projectIdOrName: string): Promise<Project> {
    try {
      const project = await this.makeRequest(`/v9/projects/${projectIdOrName}`);
      return project;
    } catch (error) {
      logger.error('Failed to get project', { error, projectIdOrName });
      throw error;
    }
  }

  /**
   * List all projects
   */
  async listProjects(limit = 100): Promise<Project[]> {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      const response = await this.makeRequest(`/v9/projects?${params}`);
      return response.projects || [];
    } catch (error) {
      logger.error('Failed to list projects', { error });
      throw error;
    }
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    updates: {
      name?: string;
      framework?: string;
      buildCommand?: string;
      devCommand?: string;
      installCommand?: string;
      outputDirectory?: string;
    }
  ): Promise<Project> {
    try {
      logger.info('Updating project', { projectId, updates });

      const response = await this.makeRequest(`/v9/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      logger.info('Project updated', { id: response.id });
      return response;
    } catch (error) {
      logger.error('Failed to update project', { error, projectId });
      throw error;
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      await this.makeRequest(`/v9/projects/${projectId}`, {
        method: 'DELETE',
      });
      logger.info('Project deleted', { projectId });
    } catch (error) {
      logger.error('Failed to delete project', { error, projectId });
      throw error;
    }
  }

  /**
   * Set environment variables
   */
  async setEnvironmentVariables(
    projectId: string,
    variables: Array<{
      key: string;
      value: string;
      target: ('production' | 'preview' | 'development')[];
    }>
  ): Promise<void> {
    try {
      logger.info('Setting environment variables', {
        projectId,
        count: variables.length,
      });

      // Delete existing variables first
      const existing = await this.getEnvironmentVariables(projectId);
      for (const env of existing) {
        await this.deleteEnvironmentVariable(projectId, env.id);
      }

      // Create new variables
      for (const variable of variables) {
        await this.makeRequest(`/v10/projects/${projectId}/env`, {
          method: 'POST',
          body: JSON.stringify({
            key: variable.key,
            value: variable.value,
            type: 'encrypted',
            target: variable.target,
          }),
        });
      }

      logger.info('Environment variables set', { projectId, count: variables.length });
    } catch (error) {
      logger.error('Failed to set environment variables', { error, projectId });
      throw error;
    }
  }

  /**
   * Get environment variables
   */
  async getEnvironmentVariables(projectId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/v9/projects/${projectId}/env`);
      return response.envs || [];
    } catch (error) {
      logger.error('Failed to get environment variables', { error, projectId });
      throw error;
    }
  }

  /**
   * Delete environment variable
   */
  async deleteEnvironmentVariable(projectId: string, envId: string): Promise<void> {
    try {
      await this.makeRequest(`/v9/projects/${projectId}/env/${envId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logger.error('Failed to delete environment variable', { error, projectId, envId });
      throw error;
    }
  }

  /**
   * Get deployment logs
   */
  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    try {
      const response = await this.makeRequest(`/v2/deployments/${deploymentId}/events`);
      return response.map((event: any) => event.text || '').filter(Boolean);
    } catch (error) {
      logger.error('Failed to get deployment logs', { error, deploymentId });
      throw error;
    }
  }

  /**
   * Promote deployment to production
   */
  async promoteToProduction(deploymentId: string): Promise<void> {
    try {
      logger.info('Promoting deployment to production', { deploymentId });

      await this.makeRequest(`/v13/deployments/${deploymentId}/promote`, {
        method: 'POST',
      });

      logger.info('Deployment promoted to production', { deploymentId });
    } catch (error) {
      logger.error('Failed to promote deployment', { error, deploymentId });
      throw error;
    }
  }

  /**
   * Make HTTP request to Vercel API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };

    if (this.config.teamId) {
      headers['X-Vercel-Team-Id'] = this.config.teamId;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Vercel API error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Build complete app and deploy (autonomous workflow)
   */
  async buildAndDeploy(config: {
    appName: string;
    repoName: string;
    framework: 'nextjs' | 'react' | 'vue';
    env?: Record<string, string>;
    autoPromote?: boolean;
  }): Promise<{ projectId: string; deploymentUrl: string; deploymentId: string }> {
    try {
      logger.info('Starting autonomous build and deploy', { appName: config.appName });

      // 1. Check if project exists
      let project: Project;
      try {
        project = await this.getProject(config.appName);
        logger.info('Project exists', { id: project.id });
      } catch {
        // 2. Create project if it doesn't exist
        project = await this.createProject({
          name: config.appName,
          framework: config.framework,
          gitRepository: {
            type: 'github',
            repo: config.repoName,
          },
        });
        logger.info('Project created', { id: project.id });
      }

      // 3. Set environment variables if provided
      if (config.env && Object.keys(config.env).length > 0) {
        const variables = Object.entries(config.env).map(([key, value]) => ({
          key,
          value,
          target: ['production', 'preview', 'development'] as const,
        }));
        await this.setEnvironmentVariables(project.id, variables);
      }

      // 4. Create deployment (preview first)
      const deployment = await this.createDeployment({
        name: config.appName,
        gitSource: {
          type: 'github',
          repo: config.repoName,
          ref: 'main',
        },
        target: 'preview',
      });

      logger.info('Deployment created', { id: deployment.uid, url: deployment.url });

      // 5. Wait for deployment to complete
      const completedDeployment = await this.waitForDeployment(deployment.uid);

      // 6. Optionally promote to production
      if (config.autoPromote) {
        await this.promoteToProduction(deployment.uid);
        logger.info('Deployment promoted to production');
      }

      return {
        projectId: project.id,
        deploymentUrl: completedDeployment.url,
        deploymentId: completedDeployment.uid,
      };
    } catch (error) {
      logger.error('Build and deploy failed', { error, config });
      throw error;
    }
  }
}

// Export singleton instance
let instance: VercelAutomation | null = null;

export function getVercelAutomation(config?: VercelConfig): VercelAutomation {
  if (!instance && config) {
    instance = new VercelAutomation(config);
  }
  if (!instance) {
    throw new Error('VercelAutomation not initialized. Provide config on first call.');
  }
  return instance;
}
