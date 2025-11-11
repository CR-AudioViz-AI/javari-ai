/**
 * Javari AI - Autonomous GitHub System
 * Enables Javari to read, write, commit, and manage code autonomously
 * 
 * Created: November 4, 2025 - 6:35 PM EST
 * Part of Phase 2: Autonomous & Self-Healing Build
 */

interface GitHubConfig {
  token: string;
  org: string;
  repo: string;
  defaultBranch?: string;
}

interface FileContent {
  path: string;
  content: string;
  sha?: string;
}

interface CommitResult {
  success: boolean;
  sha?: string;
  message?: string;
  url?: string;
  error?: string;
}

export class AutonomousGitHub {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = {
      ...config,
      defaultBranch: config.defaultBranch || 'main'
    };
  }

  /**
   * Read a file from the repository
   */
  async readFile(path: string, branch?: string): Promise<{ content: string; sha: string } | null> {
    try {
      const branchName = branch || this.config.defaultBranch;
      const url = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/contents/${path}?ref=${branchName}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // File doesn't exist
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      return {
        content,
        sha: data.sha
      };
    } catch (error: unknown) {
      console.error(`Error reading file ${path}:`, error);
      return null;
    }
  }

  /**
   * Write or update a file in the repository
   */
  async writeFile(
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<CommitResult> {
    try {
      const branchName = branch || this.config.defaultBranch;
      
      // First, check if file exists to get its SHA
      const existing = await this.readFile(path, branchName);
      
      // Encode content to base64
      const base64Content = Buffer.from(content, 'utf-8').toString('base64');
      
      const url = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/contents/${path}`;
      
      const body: any = {
        message,
        content: base64Content,
        branch: branchName
      };
      
      // If file exists, include its SHA for update
      if (existing) {
        body.sha = existing.sha;
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `GitHub API error: ${response.status} - ${error}`
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        sha: data.commit.sha,
        message: `File ${existing ? 'updated' : 'created'}: ${path}`,
        url: data.content.html_url
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create multiple file commits at once
   */
  async createCommit(
    files: FileContent[],
    message: string,
    branch?: string
  ): Promise<CommitResult> {
    try {
      const branchName = branch || this.config.defaultBranch;
      
      // Get the current commit SHA
      const refUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/git/ref/heads/${branchName}`;
      const refResponse = await fetch(refUrl, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!refResponse.ok) {
        throw new Error('Failed to get branch reference');
      }

      const refData = await refResponse.json();
      const baseCommitSha = refData.object.sha;

      // Get the base tree
      const commitUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/git/commits/${baseCommitSha}`;
      const commitResponse = await fetch(commitUrl, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const commitData = await commitResponse.json();
      const baseTreeSha = commitData.tree.sha;

      // Create blobs for each file
      const tree = await Promise.all(
        files.map(async (file) => {
          const blobUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/git/blobs`;
          const blobResponse = await fetch(blobUrl, {
            method: 'POST',
            headers: {
              'Authorization': `token ${this.config.token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: file.content,
              encoding: 'utf-8'
            })
          });

          const blobData = await blobResponse.json();
          
          return {
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
          };
        })
      );

      // Create new tree
      const treeUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/git/trees`;
      const treeResponse = await fetch(treeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree
        })
      });

      const treeData = await treeResponse.json();

      // Create new commit
      const newCommitUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/git/commits`;
      const newCommitResponse = await fetch(newCommitUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [baseCommitSha]
        })
      });

      const newCommitData = await newCommitResponse.json();

      // Update reference
      const updateRefUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/git/refs/heads/${branchName}`;
      await fetch(updateRefUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sha: newCommitData.sha
        })
      });

      return {
        success: true,
        sha: newCommitData.sha,
        message: `Created commit with ${files.length} file(s)`,
        url: `https://github.com/${this.config.org}/${this.config.repo}/commit/${newCommitData.sha}`
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify that a commit was successful
   */
  async verifyCommit(sha: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/commits/${sha}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return response.ok;
    } catch (error: unknown) {
      return false;
    }
  }

  /**
   * Rollback to a previous commit (create a revert commit)
   */
  async rollbackCommit(sha: string, reason: string): Promise<CommitResult> {
    try {
      // Get the commit to revert
      const commitUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/commits/${sha}`;
      const commitResponse = await fetch(commitUrl, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const commitData = await commitResponse.json();
      
      // Get parent commit
      const parentSha = commitData.parents[0].sha;
      
      // Create revert message
      const message = `Revert "${commitData.commit.message}"\n\nReason: ${reason}\n\nThis reverts commit ${sha}.`;
      
      // Update branch to parent commit
      const refUrl = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/git/refs/heads/${this.config.defaultBranch}`;
      await fetch(refUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sha: parentSha,
          force: true
        })
      });

      return {
        success: true,
        sha: parentSha,
        message: `Rolled back to commit before ${sha}`,
        url: `https://github.com/${this.config.org}/${this.config.repo}/commit/${parentSha}`
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string = '', branch?: string): Promise<string[]> {
    try {
      const branchName = branch || this.config.defaultBranch;
      const url = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/contents/${path}?ref=${branchName}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        return data.map(item => item.path);
      }
      
      return [];
    } catch (error: unknown) {
      console.error(`Error listing files in ${path}:`, error);
      return [];
    }
  }

  /**
   * Get commit history
   */
  async getCommitHistory(limit: number = 10): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/repos/${this.config.org}/${this.config.repo}/commits?per_page=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error: unknown) {
      logError('Error fetching commit history:', error);
      return [];
    }
  }
}

// Export singleton instance for Javari
export function createGitHubClient(config: GitHubConfig): AutonomousGitHub {
  return new AutonomousGitHub(config);
}
