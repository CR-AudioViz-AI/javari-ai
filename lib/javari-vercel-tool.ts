// lib/javari-vercel-tool.ts
// READ-ONLY Vercel Tool for deployment diagnostics

import { Tool, ToolResult } from './javari-tool-registry';

interface VercelConfig {
  token?: string;
  teamId?: string;
  projectId?: string;
}

interface Deployment {
  uid: string;
  name: string;
  url: string;
  state: string;
  created: number;
  ready?: number;
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
  };
}

interface DeploymentEvent {
  type: string;
  created: number;
  payload: {
    text?: string;
    deploymentId?: string;
    info?: any;
  };
}

export class VercelReadTool implements Tool {
  name = 'vercel_read';
  description = 'Read-only access to Vercel deployments (status, logs, events)';
  
  private config: VercelConfig;

  constructor(config: VercelConfig = {}) {
    this.config = {
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
      ...config,
    };
  }

  enabled(): boolean {
    const featureEnabled = process.env.FEATURE_VERCEL_READ === '1';
    const hasToken = !!this.config.token;
    const hasTeamId = !!this.config.teamId;
    const hasProjectId = !!this.config.projectId;
    
    return featureEnabled && hasToken && hasTeamId && hasProjectId;
  }

  async execute(params: any): Promise<ToolResult> {
    const { action, ...rest } = params;

    switch (action) {
      case 'getDeploymentStatus':
        return await this.getDeploymentStatus(rest);
      case 'listRecentDeployments':
        return await this.listRecentDeployments(rest);
      case 'getDeploymentEvents':
        return await this.getDeploymentEvents(rest);
      case 'getBuildLogs':
        return await this.getBuildLogs(rest);
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Available: getDeploymentStatus, listRecentDeployments, getDeploymentEvents, getBuildLogs`,
        };
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(params: {
    deploymentId?: string;
  }): Promise<ToolResult<Deployment>> {
    try {
      let deploymentId = params.deploymentId;
      
      // If no deployment ID provided, get latest
      if (!deploymentId) {
        const recentResult = await this.listRecentDeployments({ limit: 1 });
        if (!recentResult.success || !recentResult.data?.length) {
          throw new Error('No deployments found');
        }
        deploymentId = recentResult.data[0].uid;
      }

      const url = `https://api.vercel.com/v13/deployments/${deploymentId}?teamId=${this.config.teamId}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data: {
          uid: data.uid,
          name: data.name,
          url: data.url,
          state: data.readyState || data.state,
          created: data.createdAt,
          ready: data.ready,
          meta: data.meta,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Vercel API error: ${error.message}`,
      };
    }
  }

  /**
   * List recent deployments
   */
  async listRecentDeployments(params: {
    limit?: number;
  }): Promise<ToolResult<Deployment[]>> {
    const limit = params.limit || 10;

    try {
      const url = `https://api.vercel.com/v6/deployments?projectId=${this.config.projectId}&teamId=${this.config.teamId}&limit=${limit}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      const deployments: Deployment[] = data.deployments.map((d: any) => ({
        uid: d.uid,
        name: d.name,
        url: d.url,
        state: d.readyState || d.state,
        created: d.createdAt,
        ready: d.ready,
        meta: d.meta,
      }));

      return {
        success: true,
        data: deployments,
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Vercel API error: ${error.message}`,
      };
    }
  }

  /**
   * Get deployment events (includes build logs)
   */
  async getDeploymentEvents(params: {
    deploymentId: string;
    limit?: number;
  }): Promise<ToolResult<{ events: DeploymentEvent[]; errorSummary?: string }>> {
    const { deploymentId, limit = 100 } = params;

    try {
      const url = `https://api.vercel.com/v3/deployments/${deploymentId}/events?teamId=${this.config.teamId}&limit=${limit}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
      }

      // Read as text first (events are newline-delimited JSON)
      const text = await response.text();
      const events: DeploymentEvent[] = text
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      // Extract error summary
      const errorEvents = events.filter(e => 
        e.type === 'stderr' || 
        e.type === 'error' ||
        (e.payload?.text && e.payload.text.toLowerCase().includes('error'))
      );

      let errorSummary: string | undefined;
      if (errorEvents.length > 0) {
        const topErrors = errorEvents
          .slice(0, 5)
          .map(e => e.payload?.text || JSON.stringify(e.payload))
          .join('\n\n');
        
        errorSummary = `Found ${errorEvents.length} error events. Top errors:\n${topErrors}`;
      }

      return {
        success: true,
        data: {
          events,
          errorSummary,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Vercel API error: ${error.message}`,
      };
    }
  }

  /**
   * Get build logs (via events)
   */
  async getBuildLogs(params: {
    deploymentId: string;
  }): Promise<ToolResult<string>> {
    const eventsResult = await this.getDeploymentEvents({
      deploymentId: params.deploymentId,
      limit: 200,
    });

    if (!eventsResult.success) {
      return eventsResult as ToolResult<string>;
    }

    const events = eventsResult.data?.events || [];
    const logLines = events
      .filter(e => e.type === 'stdout' || e.type === 'stderr')
      .map(e => e.payload?.text || '')
      .filter(Boolean);

    return {
      success: true,
      data: logLines.join('\n'),
    };
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };
  }
}

// Export singleton instance
export const vercelReadTool = new VercelReadTool();
