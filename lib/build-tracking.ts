/**
 * Javari AI - Build Tracking Configuration
 * 
 * MANDATORY: Javari MUST track all autonomous builds here.
 * 
 * @author CR AudioViz AI
 * @created December 25, 2025
 * @standard Henderson Standard v2.0
 */

export const BUILD_INDEX_REPO = 'CR-AudioViz-AI/javari-builds-index';
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export interface BuildRecord {
  id: string;
  projectName: string;
  githubRepo: string;
  vercelUrl: string;
  buildType: 'internal' | 'customer';
  customerId?: string;
  customerEmail?: string;
  buildDate: string;
  buildCost: number; // credits used
  assetsUsed: string[]; // from cr-asset-library
  status: 'success' | 'failed';
  metadata?: Record<string, any>;
}

/**
 * Log a new build to the index
 */
export async function logBuild(build: BuildRecord): Promise<boolean> {
  try {
    // Get current builds.json
    const response = await fetch(
      `https://api.github.com/repos/${BUILD_INDEX_REPO}/contents/builds.json`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );
    
    let builds: BuildRecord[] = [];
    let sha: string | undefined;
    
    if (response.ok) {
      const data = await response.json();
      sha = data.sha;
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      builds = JSON.parse(content);
    }
    
    // Add new build
    builds.push(build);
    
    // Update file
    const updateResponse = await fetch(
      `https://api.github.com/repos/${BUILD_INDEX_REPO}/contents/builds.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `build: Log ${build.projectName} (${build.buildType})`,
          content: Buffer.from(JSON.stringify(builds, null, 2)).toString('base64'),
          sha,
          branch: 'main',
        }),
      }
    );
    
    return updateResponse.ok;
  } catch (error) {
    console.error('Failed to log build:', error);
    return false;
  }
}

/**
 * Get all builds
 */
export async function getBuilds(filter?: {
  buildType?: 'internal' | 'customer';
  customerId?: string;
}): Promise<BuildRecord[]> {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${BUILD_INDEX_REPO}/main/builds.json`
    );
    
    if (!response.ok) return [];
    
    let builds: BuildRecord[] = await response.json();
    
    if (filter?.buildType) {
      builds = builds.filter(b => b.buildType === filter.buildType);
    }
    
    if (filter?.customerId) {
      builds = builds.filter(b => b.customerId === filter.customerId);
    }
    
    return builds;
  } catch {
    return [];
  }
}

/**
 * Instructions for Javari when building:
 * 
 * 1. BEFORE building:
 *    - Check cr-asset-library for needed assets
 *    - Estimate credit cost
 * 
 * 2. DURING build:
 *    - Create GitHub repo in CR-AudioViz-AI org
 *    - Use central services (central-auth, central-payments, central-ops)
 *    - Deploy to Vercel
 * 
 * 3. AFTER build:
 *    - Call logBuild() with all details
 *    - Report URL to user
 *    - Deduct credits from user account
 */
export const BUILD_INSTRUCTIONS = `
JAVARI BUILD PROTOCOL (Henderson Standard v2.0):

When user requests a build ("build me X", "create X app", etc.):

1. PRE-BUILD:
   - Confirm requirements with user
   - Check cr-asset-library for assets
   - Estimate cost (typically 5-20 credits)
   - Verify user has sufficient credits

2. BUILD:
   - Create Next.js app with TypeScript
   - Use central-auth.ts for authentication
   - Use central-payments.ts for payments
   - Use central-ops.ts for logging/errors
   - Reference assets from cr-asset-library
   - Create GitHub repo in CR-AudioViz-AI org
   - Deploy to Vercel

3. POST-BUILD:
   - Log build in javari-builds-index repo
   - Deduct credits from user
   - Return live URL to user
   - Offer to make changes

4. ALWAYS:
   - Track customer ID for customer builds
   - Record assets used
   - Document build in index
`;

export default {
  BUILD_INDEX_REPO,
  logBuild,
  getBuilds,
  BUILD_INSTRUCTIONS,
};
