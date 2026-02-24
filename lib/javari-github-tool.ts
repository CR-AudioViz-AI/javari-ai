// lib/javari-github-tool.ts
// READ-ONLY GitHub Tool for Javari autonomous repo access

import { Tool, ToolResult } from './javari-tool-registry';

interface GitHubConfig {
  token?: string;
  defaultOwner?: string;
  defaultRepo?: string;
  defaultBranch?: string;
}

interface RepoTreeNode {
  path: string;
  type: 'file' | 'dir' | 'tree' | 'blob';
  sha: string;
  size?: number;
  url?: string;
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  sha: string;
}

export class GitHubReadTool implements Tool {
  name = 'github_read';
  description = 'Read-only access to GitHub repositories (list tree, get files)';
  
  private config: GitHubConfig;

  constructor(config: GitHubConfig = {}) {
    this.config = {
      token: process.env.GITHUB_READ_TOKEN,
      defaultOwner: process.env.GITHUB_DEFAULT_OWNER || 'CR-AudioViz-AI',
      defaultRepo: process.env.GITHUB_DEFAULT_REPO || 'javari-ai',
      defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || 'fix/recenterror-type',
      ...config,
    };
  }

  enabled(): boolean {
    // Check feature flag
    const featureEnabled = process.env.FEATURE_GITHUB_READ === '1';
    const hasToken = !!this.config.token;
    
    return featureEnabled && hasToken;
  }

  async execute(params: any): Promise<ToolResult> {
    const { action, ...rest } = params;

    switch (action) {
      case 'listRepoTree':
        return await this.listRepoTree(rest);
      case 'getFile':
        return await this.getFile(rest);
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Available: listRepoTree, getFile`,
        };
    }
  }

  /**
   * List repository tree structure
   */
  async listRepoTree(params: {
    owner?: string;
    repo?: string;
    branch?: string;
    path?: string;
  }): Promise<ToolResult<RepoTreeNode[]>> {
    const owner = params.owner || this.config.defaultOwner!;
    const repo = params.repo || this.config.defaultRepo!;
    const branch = params.branch || this.config.defaultBranch!;
    const path = params.path || '';

    try {
      // First, get the branch's commit SHA
      const branchUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`;
      const branchResponse = await fetch(branchUrl, {
        headers: this.getHeaders(),
      });

      if (!branchResponse.ok) {
        throw new Error(`Failed to get branch: ${branchResponse.status} ${branchResponse.statusText}`);
      }

      const branchData = await branchResponse.json();
      const commitSha = branchData.object.sha;

      // Get the tree (recursive for full structure)
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`;
      const treeResponse = await fetch(treeUrl, {
        headers: this.getHeaders(),
      });

      if (!treeResponse.ok) {
        throw new Error(`Failed to get tree: ${treeResponse.status} ${treeResponse.statusText}`);
      }

      const treeData = await treeResponse.json();
      
      // Filter by path if specified
      let nodes: RepoTreeNode[] = treeData.tree.map((item: any) => ({
        path: item.path,
        type: item.type === 'blob' ? 'file' : 'dir',
        sha: item.sha,
        size: item.size,
        url: item.url,
      }));

      if (path) {
        nodes = nodes.filter(node => node.path.startsWith(path));
      }

      return {
        success: true,
        data: nodes,
      };

    } catch (error: any) {
      return {
        success: false,
        error: `GitHub API error: ${error.message}`,
      };
    }
  }

  /**
   * Get file contents from repository
   */
  async getFile(params: {
    owner?: string;
    repo?: string;
    branch?: string;
    path: string;
  }): Promise<ToolResult<FileContent>> {
    const owner = params.owner || this.config.defaultOwner!;
    const repo = params.repo || this.config.defaultRepo!;
    const branch = params.branch || this.config.defaultBranch!;
    const { path } = params;

    if (!path) {
      return {
        success: false,
        error: 'path parameter is required',
      };
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get file: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      return {
        success: true,
        data: {
          path: data.path,
          content,
          size: data.size,
          sha: data.sha,
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
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Javari-AI',
    };

    if (this.config.token) {
      headers['Authorization'] = `token ${this.config.token}`;
    }

    return headers;
  }
}

// Export singleton instance
export const githubReadTool = new GitHubReadTool();
