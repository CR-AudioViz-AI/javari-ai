// lib/javari-github-write-tool.ts
// PR-ONLY GitHub Write Tool - NO direct main pushes

import { Tool, ToolResult } from './javari-tool-registry';

interface GitHubWriteConfig {
  token?: string;
  defaultOwner?: string;
  defaultRepo?: string;
  defaultBranch?: string;
}

interface BranchInfo {
  name: string;
  sha: string;
}

interface PullRequest {
  number: number;
  url: string;
  html_url: string;
  title: string;
  state: string;
}

export class GitHubWriteTool implements Tool {
  name = 'github_write';
  description = 'PR-only GitHub write access (create branches, commit, open PRs)';
  
  private config: GitHubWriteConfig;

  constructor(config: GitHubWriteConfig = {}) {
    this.config = {
      token: process.env.GITHUB_WRITE_TOKEN,
      defaultOwner: process.env.GITHUB_DEFAULT_OWNER || 'CR-AudioViz-AI',
      defaultRepo: process.env.GITHUB_DEFAULT_REPO || 'javari-ai',
      defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || 'main',
      ...config,
    };
  }

  enabled(): boolean {
    const featureEnabled = process.env.FEATURE_GITHUB_WRITE === '1';
    const hasToken = !!this.config.token;
    
    return featureEnabled && hasToken;
  }

  async execute(params: any): Promise<ToolResult> {
    const { action, ...rest } = params;

    switch (action) {
      case 'createBranch':
        return await this.createBranch(rest);
      case 'upsertFile':
        return await this.upsertFile(rest);
      case 'createPullRequest':
        return await this.createPullRequest(rest);
      case 'addPrComment':
        return await this.addPrComment(rest);
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Available: createBranch, upsertFile, createPullRequest, addPrComment`,
        };
    }
  }

  /**
   * Create a new branch from base branch
   */
  async createBranch(params: {
    baseBranch?: string;
    newBranch: string;
    owner?: string;
    repo?: string;
  }): Promise<ToolResult<BranchInfo>> {
    const owner = params.owner || this.config.defaultOwner!;
    const repo = params.repo || this.config.defaultRepo!;
    const baseBranch = params.baseBranch || this.config.defaultBranch!;
    const { newBranch } = params;

    if (!newBranch) {
      return {
        success: false,
        error: 'newBranch parameter is required',
      };
    }

    try {
      // Get base branch SHA
      const refUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`;
      const refResponse = await fetch(refUrl, {
        headers: this.getHeaders(),
      });

      if (!refResponse.ok) {
        throw new Error(`Failed to get base branch: ${refResponse.status}`);
      }

      const refData = await refResponse.json();
      const baseSha = refData.object.sha;

      // Create new branch
      const createUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha: baseSha,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(`Failed to create branch: ${error.message || createResponse.status}`);
      }

      return {
        success: true,
        data: {
          name: newBranch,
          sha: baseSha,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        error: `GitHub API error: ${error.message}`,
      };
    }
  }

  /**
   * Upsert (create or update) a file
   */
  async upsertFile(params: {
    path: string;
    content: string;
    branch: string;
    commitMessage: string;
    owner?: string;
    repo?: string;
  }): Promise<ToolResult<{ path: string; sha: string }>> {
    const owner = params.owner || this.config.defaultOwner!;
    const repo = params.repo || this.config.defaultRepo!;
    const { path, content, branch, commitMessage } = params;

    if (!path || !content || !branch || !commitMessage) {
      return {
        success: false,
        error: 'path, content, branch, and commitMessage are required',
      };
    }

    try {
      // Check if file exists (get SHA)
      const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const getResponse = await fetch(getUrl, {
        headers: this.getHeaders(),
      });

      let existingSha: string | undefined;
      if (getResponse.ok) {
        const existingData = await getResponse.json();
        existingSha = existingData.sha;
      }

      // Upsert file
      const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const body: any = {
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch,
      };

      if (existingSha) {
        body.sha = existingSha;
      }

      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!putResponse.ok) {
        const error = await putResponse.json();
        throw new Error(`Failed to upsert file: ${error.message || putResponse.status}`);
      }

      const data = await putResponse.json();

      return {
        success: true,
        data: {
          path: data.content.path,
          sha: data.content.sha,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        error: `GitHub API error: ${error.message}`,
      };
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(params: {
    branch: string;
    title: string;
    body: string;
    baseBranch?: string;
    owner?: string;
    repo?: string;
  }): Promise<ToolResult<PullRequest>> {
    const owner = params.owner || this.config.defaultOwner!;
    const repo = params.repo || this.config.defaultRepo!;
    const baseBranch = params.baseBranch || this.config.defaultBranch!;
    const { branch, title, body } = params;

    if (!branch || !title || !body) {
      return {
        success: false,
        error: 'branch, title, and body are required',
      };
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          title,
          body,
          head: branch,
          base: baseBranch,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create PR: ${error.message || response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          number: data.number,
          url: data.url,
          html_url: data.html_url,
          title: data.title,
          state: data.state,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        error: `GitHub API error: ${error.message}`,
      };
    }
  }

  /**
   * Add a comment to a pull request
   */
  async addPrComment(params: {
    prNumber: number;
    comment: string;
    owner?: string;
    repo?: string;
  }): Promise<ToolResult<{ id: number }>> {
    const owner = params.owner || this.config.defaultOwner!;
    const repo = params.repo || this.config.defaultRepo!;
    const { prNumber, comment } = params;

    if (!prNumber || !comment) {
      return {
        success: false,
        error: 'prNumber and comment are required',
      };
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ body: comment }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to add comment: ${error.message || response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          id: data.id,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        error: `GitHub API error: ${error.message}`,
      };
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `token ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }
}

// Export singleton instance
export const githubWriteTool = new GitHubWriteTool();
