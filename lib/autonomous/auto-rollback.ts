/**
 * JAVARI AI - AUTO-ROLLBACK SYSTEM
 * 
 * Automatically rolls back failed deployments to the last working version.
 * Part of the 24x7x365 autonomous self-healing system.
 * 
 * Created: January 3, 2026
 */

interface DeploymentInfo {
  id: string;
  url: string;
  state: 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  createdAt: number;
  meta: {
    githubCommitSha: string;
    githubCommitMessage: string;
  };
}

interface RollbackResult {
  success: boolean;
  previousDeployment?: string;
  newDeployment?: string;
  error?: string;
  timestamp: string;
}

export class AutoRollbackSystem {
  private vercelToken: string;
  private teamId: string;
  private baseUrl = 'https://api.vercel.com';

  constructor(config: { vercelToken: string; teamId: string }) {
    this.vercelToken = config.vercelToken;
    this.teamId = config.teamId;
  }

  /**
   * Check if a deployment failed and needs rollback
   */
  async checkDeploymentHealth(projectId: string): Promise<{
    needsRollback: boolean;
    failedDeployment?: DeploymentInfo;
    lastGoodDeployment?: DeploymentInfo;
  }> {
    try {
      // Get recent deployments
      const response = await fetch(
        `${this.baseUrl}/v6/deployments?projectId=${projectId}&teamId=${this.teamId}&limit=10&target=production`,
        {
          headers: {
            Authorization: `Bearer ${this.vercelToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.status}`);
      }

      const data = await response.json();
      const deployments: DeploymentInfo[] = data.deployments || [];

      // Find the most recent deployment
      const latest = deployments[0];
      
      if (!latest) {
        return { needsRollback: false };
      }

      // Check if latest deployment failed
      if (latest.state === 'ERROR') {
        // Find the last successful deployment
        const lastGood = deployments.find(d => d.state === 'READY');
        
        return {
          needsRollback: true,
          failedDeployment: latest,
          lastGoodDeployment: lastGood,
        };
      }

      return { needsRollback: false };
    } catch (error) {
      console.error('Error checking deployment health:', error);
      return { needsRollback: false };
    }
  }

  /**
   * Perform automatic rollback to last good deployment
   */
  async performRollback(
    projectId: string,
    targetDeploymentId: string
  ): Promise<RollbackResult> {
    try {
      console.log(`🔄 Initiating rollback to deployment: ${targetDeploymentId}`);

      // Create a new deployment from the target (rollback)
      const response = await fetch(
        `${this.baseUrl}/v13/deployments?teamId=${this.teamId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectId,
            deploymentId: targetDeploymentId,
            target: 'production',
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Rollback failed: ${response.status} - ${errorText}`);
      }

      const newDeployment = await response.json();

      return {
        success: true,
        previousDeployment: targetDeploymentId,
        newDeployment: newDeployment.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Monitor and auto-rollback if needed
   */
  async monitorAndRollback(projectId: string): Promise<{
    checked: boolean;
    rolledBack: boolean;
    details?: RollbackResult;
  }> {
    const health = await this.checkDeploymentHealth(projectId);

    if (!health.needsRollback) {
      return { checked: true, rolledBack: false };
    }

    if (!health.lastGoodDeployment) {
      console.warn('No good deployment found to rollback to');
      return {
        checked: true,
        rolledBack: false,
        details: {
          success: false,
          error: 'No previous good deployment found',
          timestamp: new Date().toISOString(),
        },
      };
    }

    console.log(`⚠️ Failed deployment detected: ${health.failedDeployment?.id}`);
    console.log(`🎯 Rolling back to: ${health.lastGoodDeployment.id}`);

    const result = await this.performRollback(
      projectId,
      health.lastGoodDeployment.id
    );

    return {
      checked: true,
      rolledBack: result.success,
      details: result,
    };
  }
}

export default AutoRollbackSystem;
