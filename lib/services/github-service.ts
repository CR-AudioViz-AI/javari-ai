// lib/services/github-service.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - GITHUB SERVICE
// Handles repository creation, code pushing, and GitHub integration
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_ORG = 'CR-AudioViz-AI';
const GITHUB_API = 'https://api.github.com';

interface GitHubFile {
  path: string;
  content: string;
}

interface CreateRepoResult {
  success: boolean;
  repoName?: string;
  repoUrl?: string;
  cloneUrl?: string;
  error?: string;
}

interface PushFilesResult {
  success: boolean;
  commitSha?: string;
  error?: string;
}

export class GitHubService {
  private token: string;
  private org: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '';
    this.org = GITHUB_ORG;
    
    if (!this.token) {
      console.warn('[GitHubService] No GitHub token configured');
    }
  }

  /**
   * Generate a unique repository name based on app type
   */
  generateRepoName(appType: string, userPrefix?: string): string {
    const timestamp = Date.now().toString(36);
    const prefix = userPrefix || 'javari-app';
    const sanitizedType = appType.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${prefix}-${sanitizedType}-${timestamp}`;
  }

  /**
   * Check if a repository exists
   */
  async repoExists(repoName: string): Promise<boolean> {
    try {
      const response = await fetch(`${GITHUB_API}/repos/${this.org}/${repoName}`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Create a new repository in the organization
   */
  async createRepository(
    repoName: string,
    description: string,
    isPrivate: boolean = false
  ): Promise<CreateRepoResult> {
    try {
      console.log(`[GitHubService] Creating repository: ${this.org}/${repoName}`);
      
      const response = await fetch(`${GITHUB_API}/orgs/${this.org}/repos`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repoName,
          description: `${description} - Built by Javari AI`,
          private: isPrivate,
          auto_init: true, // Creates with README
          has_issues: true,
          has_projects: false,
          has_wiki: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[GitHubService] Failed to create repo:', error);
        return {
          success: false,
          error: error.message || 'Failed to create repository',
        };
      }

      const repo = await response.json();
      console.log(`[GitHubService] Repository created: ${repo.html_url}`);

      return {
        success: true,
        repoName: repo.name,
        repoUrl: repo.html_url,
        cloneUrl: repo.clone_url,
      };
    } catch (error) {
      console.error('[GitHubService] Error creating repository:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the SHA of a file (needed for updates)
   */
  async getFileSha(repoName: string, filePath: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.sha;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Push a single file to the repository
   */
  async pushFile(
    repoName: string,
    filePath: string,
    content: string,
    commitMessage: string
  ): Promise<PushFilesResult> {
    try {
      // Check if file exists to get SHA for update
      const existingSha = await this.getFileSha(repoName, filePath);
      
      const body: Record<string, string> = {
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch: 'main',
      };

      if (existingSha) {
        body.sha = existingSha;
      }

      const response = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || `Failed to push ${filePath}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        commitSha: result.commit?.sha,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Push multiple files to the repository using Git tree API
   * More efficient for multiple files
   */
  async pushFiles(
    repoName: string,
    files: GitHubFile[],
    commitMessage: string
  ): Promise<PushFilesResult> {
    try {
      console.log(`[GitHubService] Pushing ${files.length} files to ${repoName}`);

      // 1. Get the latest commit SHA
      const refResponse = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}/git/ref/heads/main`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!refResponse.ok) {
        // If main doesn't exist, try master
        const masterResponse = await fetch(
          `${GITHUB_API}/repos/${this.org}/${repoName}/git/ref/heads/master`,
          {
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        
        if (!masterResponse.ok) {
          return { success: false, error: 'Could not find default branch' };
        }
      }

      const refData = await refResponse.json();
      const latestCommitSha = refData.object.sha;

      // 2. Get the tree SHA from the latest commit
      const commitResponse = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}/git/commits/${latestCommitSha}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      const commitData = await commitResponse.json();
      const baseTreeSha = commitData.tree.sha;

      // 3. Create blobs for each file
      const treeItems = await Promise.all(
        files.map(async (file) => {
          const blobResponse = await fetch(
            `${GITHUB_API}/repos/${this.org}/${repoName}/git/blobs`,
            {
              method: 'POST',
              headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: file.content,
                encoding: 'utf-8',
              }),
            }
          );

          const blobData = await blobResponse.json();
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blobData.sha,
          };
        })
      );

      // 4. Create a new tree
      const treeResponse = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}/git/trees`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeItems,
          }),
        }
      );

      const treeData = await treeResponse.json();

      // 5. Create a new commit
      const newCommitResponse = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}/git/commits`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: commitMessage,
            tree: treeData.sha,
            parents: [latestCommitSha],
          }),
        }
      );

      const newCommitData = await newCommitResponse.json();

      // 6. Update the reference
      const updateRefResponse = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}/git/refs/heads/main`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sha: newCommitData.sha,
            force: false,
          }),
        }
      );

      if (!updateRefResponse.ok) {
        const error = await updateRefResponse.json();
        return {
          success: false,
          error: error.message || 'Failed to update reference',
        };
      }

      console.log(`[GitHubService] Successfully pushed ${files.length} files`);
      return {
        success: true,
        commitSha: newCommitData.sha,
      };
    } catch (error) {
      console.error('[GitHubService] Error pushing files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a repository (cleanup for failed builds)
   */
  async deleteRepository(repoName: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${GITHUB_API}/repos/${this.org}/${repoName}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      return response.status === 204;
    } catch {
      return false;
    }
  }
}

export const githubService = new GitHubService();
