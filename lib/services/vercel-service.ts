// lib/services/vercel-service.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - VERCEL SERVICE
// Handles project creation, deployment, and Vercel integration
// ═══════════════════════════════════════════════════════════════════════════════

const VERCEL_API = 'https://api.vercel.com';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_Z0yef7NlFu1coCJWz8UmUdI5';

interface CreateProjectResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  error?: string;
}

interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
  productionUrl?: string;
  status?: string;
  error?: string;
}

interface DeploymentStatus {
  id: string;
  state: 'BUILDING' | 'READY' | 'ERROR' | 'QUEUED' | 'CANCELED';
  url: string;
  readyState: string;
}

export class VercelService {
  private token: string;
  private teamId: string;

  constructor() {
    this.token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || '';
    this.teamId = VERCEL_TEAM_ID;
    
    if (!this.token) {
      console.warn('[VercelService] No Vercel token configured');
    }
  }

  /**
   * Create a new Vercel project linked to a GitHub repository
   */
  async createProject(
    projectName: string,
    githubRepoName: string,
    framework: string = 'nextjs'
  ): Promise<CreateProjectResult> {
    try {
      console.log(`[VercelService] Creating project: ${projectName}`);

      const response = await fetch(`${VERCEL_API}/v10/projects?teamId=${this.teamId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          framework: framework,
          gitRepository: {
            type: 'github',
            repo: `CR-AudioViz-AI/${githubRepoName}`,
          },
          buildCommand: framework === 'nextjs' ? 'next build' : undefined,
          installCommand: 'npm install',
          outputDirectory: framework === 'nextjs' ? '.next' : 'dist',
          publicSource: true,
          rootDirectory: null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[VercelService] Failed to create project:', error);
        return {
          success: false,
          error: error.error?.message || 'Failed to create Vercel project',
        };
      }

      const project = await response.json();
      console.log(`[VercelService] Project created: ${project.id}`);

      return {
        success: true,
        projectId: project.id,
        projectName: project.name,
      };
    } catch (error) {
      console.error('[VercelService] Error creating project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Trigger a deployment for a project
   */
  async triggerDeployment(
    projectId: string,
    gitRef: string = 'main'
  ): Promise<DeploymentResult> {
    try {
      console.log(`[VercelService] Triggering deployment for project: ${projectId}`);

      const response = await fetch(
        `${VERCEL_API}/v13/deployments?teamId=${this.teamId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectId,
            project: projectId,
            target: 'production',
            gitSource: {
              type: 'github',
              ref: gitRef,
              repoId: projectId,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Failed to trigger deployment',
        };
      }

      const deployment = await response.json();
      console.log(`[VercelService] Deployment triggered: ${deployment.id}`);

      return {
        success: true,
        deploymentId: deployment.id,
        deploymentUrl: `https://${deployment.url}`,
        status: deployment.readyState,
      };
    } catch (error) {
      console.error('[VercelService] Error triggering deployment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    try {
      const response = await fetch(
        `${VERCEL_API}/v13/deployments/${deploymentId}?teamId=${this.teamId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const deployment = await response.json();
      return {
        id: deployment.id,
        state: deployment.readyState,
        url: deployment.url,
        readyState: deployment.readyState,
      };
    } catch {
      return null;
    }
  }

  /**
   * Wait for deployment to be ready (with timeout)
   */
  async waitForDeployment(
    deploymentId: string,
    timeoutMs: number = 120000, // 2 minutes default
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    
    console.log(`[VercelService] Waiting for deployment ${deploymentId} to be ready...`);

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getDeploymentStatus(deploymentId);
      
      if (!status) {
        return {
          success: false,
          error: 'Could not get deployment status',
        };
      }

      console.log(`[VercelService] Deployment status: ${status.state}`);

      if (status.state === 'READY') {
        return {
          success: true,
          deploymentId: status.id,
          deploymentUrl: `https://${status.url}`,
          productionUrl: `https://${status.url}`,
          status: 'READY',
        };
      }

      if (status.state === 'ERROR' || status.state === 'CANCELED') {
        return {
          success: false,
          deploymentId: status.id,
          status: status.state,
          error: `Deployment ${status.state.toLowerCase()}`,
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return {
      success: false,
      error: 'Deployment timed out',
    };
  }

  /**
   * Get all deployments for a project
   */
  async listDeployments(projectId: string, limit: number = 5): Promise<DeploymentStatus[]> {
    try {
      const response = await fetch(
        `${VERCEL_API}/v6/deployments?projectId=${projectId}&teamId=${this.teamId}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.deployments.map((d: any) => ({
        id: d.uid,
        state: d.readyState,
        url: d.url,
        readyState: d.readyState,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Add environment variables to a project
   */
  async setEnvironmentVariables(
    projectId: string,
    variables: Record<string, string>
  ): Promise<boolean> {
    try {
      const envVars = Object.entries(variables).map(([key, value]) => ({
        key,
        value,
        target: ['production', 'preview', 'development'],
        type: 'encrypted',
      }));

      const response = await fetch(
        `${VERCEL_API}/v10/projects/${projectId}/env?teamId=${this.teamId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(envVars),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${VERCEL_API}/v9/projects/${projectId}?teamId=${this.teamId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );
      return response.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Get a shareable URL for a deployment
   */
  async getShareableUrl(deploymentUrl: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${VERCEL_API}/v1/deployments/${encodeURIComponent(deploymentUrl)}/share?teamId=${this.teamId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.url || deploymentUrl;
    } catch {
      return deploymentUrl;
    }
  }
}

export const vercelService = new VercelService();
