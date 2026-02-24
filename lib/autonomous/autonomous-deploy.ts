/**
 * Javari AI - Autonomous Vercel Deployment System
 * Enables Javari to trigger, monitor, and manage deployments autonomously
 * 
 * Created: November 4, 2025 - 6:40 PM EST
 * Updated: November 21, 2025 - 4:56 PM EST - FIXED repoId issue
 * Part of Phase 2: Autonomous & Self-Healing Build
 */

interface VercelConfig {
  token: string;
  teamId: string;
  projectId: string;
  repoId: number; // ADDED: Required for proper Vercel deployments
}

interface DeploymentStatus {
  id: string;
  state: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED';
  readyState?: 'READY' | 'ERROR' | 'QUEUED' | 'CANCELED';
  url: string;
  created: number;
  buildingAt?: number;
  ready?: number;
}

interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  state?: string;
  error?: string;
  buildLogs?: string[];
}

interface BuildLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export class AutonomousVercel {
  private config: VercelConfig;
  private baseUrl = 'https://api.vercel.com';

  constructor(config: VercelConfig) {
    this.config = config;
  }

  /**
   * Trigger a new deployment
   * FIXED: Now includes repoId in gitSource
   */
  async triggerDeployment(
    gitRef: string = 'main',
    force: boolean = false
  ): Promise<DeploymentResult> {
    try {
      const url = `${this.baseUrl}/v13/deployments`;
      
      const body = {
        name: await this.getProjectName(),
        gitSource: {
          type: 'github',
          ref: gitRef,
          repoId: this.config.repoId // FIXED: Added repoId
        },
        project: this.config.projectId,
        target: 'production',
        ...(force && { forceNew: 1 })
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Vercel API error: ${response.status} - ${error}`
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        deploymentId: data.id,
        url: data.url,
        state: data.readyState
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Wait for deployment to complete (simplified version of monitorDeployment)
   */
  async waitForDeployment(
    deploymentId: string,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<DeploymentStatus> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getDeploymentStatus(deploymentId);
      
      if (!status) {
        throw new Error('Failed to get deployment status');
      }

      // Check if deployment is complete
      if (status.readyState === 'READY') {
        return status;
      }

      // Check if deployment failed
      if (status.readyState === 'ERROR' || status.state === 'ERROR') {
        throw new Error(`Deployment failed with state: ${status.readyState || status.state}`);
      }

      // Check if deployment was canceled
      if (status.readyState === 'CANCELED' || status.state === 'CANCELED') {
        throw new Error('Deployment was canceled');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Deployment monitoring timed out');
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    try {
      const url = `${this.baseUrl}/v13/deployments/${deploymentId}?teamId=${this.config.teamId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      return {
        id: data.id || data.uid,
        state: data.state,
        readyState: data.readyState,
        url: data.url,
        created: data.created || data.createdAt,
        buildingAt: data.buildingAt,
        ready: data.ready
      };
    } catch (error: unknown) {
      console.error('Error getting deployment status:', error);
      return null;
    }
  }

  /**
   * Monitor deployment until completion
   */
  async monitorDeployment(
    deploymentId: string,
    timeoutMs: number = 600000, // 10 minutes
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getDeploymentStatus(deploymentId);
      
      if (!status) {
        return {
          success: false,
          error: 'Failed to get deployment status'
        };
      }

      // Check if deployment is complete
      if (status.readyState === 'READY') {
        return {
          success: true,
          deploymentId: status.id,
          url: status.url,
          state: status.readyState
        };
      }

      // Check if deployment failed
      if (status.readyState === 'ERROR' || status.state === 'ERROR') {
        const logs = await this.getBuildLogs(deploymentId);
        return {
          success: false,
          deploymentId: status.id,
          state: 'ERROR',
          buildLogs: logs.map(log => log.message),
          error: 'Deployment failed - check build logs'
        };
      }

      // Check if deployment was canceled
      if (status.readyState === 'CANCELED' || status.state === 'CANCELED') {
        return {
          success: false,
          deploymentId: status.id,
          state: 'CANCELED',
          error: 'Deployment was canceled'
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return {
      success: false,
      error: 'Deployment monitoring timed out'
    };
  }

  /**
   * Get build logs for a deployment
   */
  async getBuildLogs(deploymentId: string): Promise<BuildLog[]> {
    try {
      const url = `${this.baseUrl}/v1/deployments/${deploymentId}/events?teamId=${this.config.teamId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const events = Array.isArray(data) ? data : (data.events || []);
      
      return events
        .filter((event: any) => event.type === 'stdout' || event.type === 'stderr')
        .map((event: any) => ({
          timestamp: event.created || event.timestamp,
          level: event.type === 'stderr' ? 'error' : 'info',
          message: event.payload?.text || event.text || ''
        }));
    } catch (error: unknown) {
      console.error('Error fetching build logs:', error);
      return [];
    }
  }

  /**
   * Verify deployment is healthy
   */
  async verifyDeployment(deploymentId: string): Promise<boolean> {
    try {
      const status = await this.getDeploymentStatus(deploymentId);
      
      if (!status || status.readyState !== 'READY') {
        return false;
      }

      // Try to fetch the deployed URL
      const response = await fetch(`https://${status.url}`, {
        method: 'HEAD'
      });

      return response.ok;
    } catch (error: unknown) {
      return false;
    }
  }

  /**
   * Get latest deployment for the project
   */
  async getLatestDeployment(): Promise<DeploymentStatus | null> {
    try {
      const url = `${this.baseUrl}/v6/deployments?projectId=${this.config.projectId}&teamId=${this.config.teamId}&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const deployments = data.deployments || [];
      
      if (deployments.length === 0) {
        return null;
      }

      const latest = deployments[0];
      return {
        id: latest.uid || latest.id,
        state: latest.state,
        readyState: latest.readyState,
        url: latest.url,
        created: latest.created
      };
    } catch (error: unknown) {
      console.error('Error getting latest deployment:', error);
      return null;
    }
  }

  /**
   * Get project name
   */
  private async getProjectName(): Promise<string> {
    try {
      const url = `${this.baseUrl}/v9/projects/${this.config.projectId}?teamId=${this.config.teamId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      if (!response.ok) {
        return 'unknown-project';
      }

      const data = await response.json();
      return data.name || 'unknown-project';
    } catch (error: unknown) {
      return 'unknown-project';
    }
  }

  /**
   * Cancel a running deployment
   */
  async cancelDeployment(deploymentId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/v12/deployments/${deploymentId}/cancel?teamId=${this.config.teamId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      return response.ok;
    } catch (error: unknown) {
      console.error('Error canceling deployment:', error);
      return false;
    }
  }

  /**
   * Promote deployment to production
   */
  async promoteToProduction(deploymentId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/v13/deployments/${deploymentId}/promote?teamId=${this.config.teamId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      return response.ok;
    } catch (error: unknown) {
      console.error('Error promoting deployment:', error);
      return false;
    }
  }

  /**
   * List recent deployments
   */
  async listDeployments(limit: number = 10): Promise<DeploymentStatus[]> {
    try {
      const url = `${this.baseUrl}/v6/deployments?projectId=${this.config.projectId}&teamId=${this.config.teamId}&limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const deployments = data.deployments || [];
      
      return deployments.map((d: any) => ({
        id: d.uid || d.id,
        state: d.state,
        readyState: d.readyState,
        url: d.url,
        created: d.created
      }));
    } catch (error: unknown) {
      console.error('Error listing deployments:', error);
      return [];
    }
  }
}

// Export singleton instance for Javari
export function createVercelClient(config: VercelConfig): AutonomousVercel {
  return new AutonomousVercel(config);
}

// Helper function for logging (can be replaced with proper logger)
function logError(message: string, error: unknown) {
  console.error(message, error instanceof Error ? error.message : error);
}
