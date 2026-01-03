/**
 * JAVARI AI - CROSS-PROJECT HEALTH MONITOR
 * 
 * Monitors all Javari ecosystem projects (50+) for:
 * - Deployment failures
 * - Runtime errors
 * - Performance degradation
 * - API downtime
 * 
 * Created: January 3, 2026
 */

interface ProjectHealth {
  projectId: string;
  projectName: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastDeployment: {
    id: string;
    state: string;
    createdAt: number;
  } | null;
  healthEndpoint?: {
    available: boolean;
    responseTime?: number;
    lastCheck: string;
  };
  issues: string[];
}

interface EcosystemHealth {
  timestamp: string;
  totalProjects: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
  projects: ProjectHealth[];
  criticalAlerts: string[];
}

export class CrossProjectMonitor {
  private vercelToken: string;
  private teamId: string;
  private baseUrl = 'https://api.vercel.com';
  
  // Core projects that require health endpoints
  private criticalProjects = [
    'javari-ai',
    'javari-cards',
    'javari-market',
    'javari-invoice',
    'javari-scraper',
    'javariverse-hub',
  ];

  constructor(config: { vercelToken: string; teamId: string }) {
    this.vercelToken = config.vercelToken;
    this.teamId = config.teamId;
  }

  /**
   * Fetch all projects in the team
   */
  async getAllProjects(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v9/projects?teamId=${this.teamId}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${this.vercelToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }

      const data = await response.json();
      return data.projects.map((p: any) => ({
        id: p.id,
        name: p.name,
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  /**
   * Check health of a single project
   */
  async checkProjectHealth(
    projectId: string,
    projectName: string
  ): Promise<ProjectHealth> {
    const health: ProjectHealth = {
      projectId,
      projectName,
      status: 'unknown',
      lastDeployment: null,
      issues: [],
    };

    try {
      // Get latest deployment
      const deployResponse = await fetch(
        `${this.baseUrl}/v6/deployments?projectId=${projectId}&teamId=${this.teamId}&limit=1&target=production`,
        {
          headers: {
            Authorization: `Bearer ${this.vercelToken}`,
          },
        }
      );

      if (deployResponse.ok) {
        const deployData = await deployResponse.json();
        const latest = deployData.deployments?.[0];

        if (latest) {
          health.lastDeployment = {
            id: latest.id,
            state: latest.state,
            createdAt: latest.created,
          };

          if (latest.state === 'ERROR') {
            health.status = 'down';
            health.issues.push(`Latest deployment failed: ${latest.id}`);
          } else if (latest.state === 'READY') {
            health.status = 'healthy';
          } else if (latest.state === 'BUILDING') {
            health.status = 'degraded';
            health.issues.push('Deployment in progress');
          }
        }
      }

      // Check health endpoint for critical projects
      if (this.criticalProjects.includes(projectName)) {
        const healthUrl = `https://${projectName}.vercel.app/api/health`;
        const startTime = Date.now();

        try {
          const healthResponse = await fetch(healthUrl, {
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          health.healthEndpoint = {
            available: healthResponse.ok,
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
          };

          if (!healthResponse.ok) {
            health.status = 'degraded';
            health.issues.push(`Health endpoint returned ${healthResponse.status}`);
          } else if (health.healthEndpoint.responseTime > 5000) {
            health.status = 'degraded';
            health.issues.push(`Slow response: ${health.healthEndpoint.responseTime}ms`);
          }
        } catch (error) {
          health.healthEndpoint = {
            available: false,
            lastCheck: new Date().toISOString(),
          };
          
          if (health.status === 'healthy') {
            health.status = 'degraded';
          }
          health.issues.push('Health endpoint unreachable');
        }
      }
    } catch (error) {
      health.status = 'unknown';
      health.issues.push(`Error checking project: ${error}`);
    }

    return health;
  }

  /**
   * Run full ecosystem health check
   */
  async runFullHealthCheck(): Promise<EcosystemHealth> {
    const projects = await this.getAllProjects();
    const healthChecks: ProjectHealth[] = [];
    const criticalAlerts: string[] = [];

    // Check all projects in parallel (batched)
    const batchSize = 10;
    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = projects.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(p => this.checkProjectHealth(p.id, p.name))
      );
      healthChecks.push(...results);
    }

    // Generate critical alerts
    for (const project of healthChecks) {
      if (project.status === 'down') {
        criticalAlerts.push(`🚨 CRITICAL: ${project.projectName} is DOWN`);
      }
      if (this.criticalProjects.includes(project.projectName) && project.status !== 'healthy') {
        criticalAlerts.push(`⚠️ ALERT: Critical project ${project.projectName} is ${project.status}`);
      }
    }

    const healthy = healthChecks.filter(p => p.status === 'healthy').length;
    const degraded = healthChecks.filter(p => p.status === 'degraded').length;
    const down = healthChecks.filter(p => p.status === 'down').length;
    const unknown = healthChecks.filter(p => p.status === 'unknown').length;

    return {
      timestamp: new Date().toISOString(),
      totalProjects: projects.length,
      healthy,
      degraded,
      down,
      unknown,
      projects: healthChecks,
      criticalAlerts,
    };
  }

  /**
   * Get projects that need attention
   */
  async getProblemsOnly(): Promise<ProjectHealth[]> {
    const health = await this.runFullHealthCheck();
    return health.projects.filter(p => p.status !== 'healthy');
  }
}

export default CrossProjectMonitor;
