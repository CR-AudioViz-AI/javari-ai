// app/api/build/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - BUILD PIPELINE API
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 20, 2025
// Version: 1.0 - Full Autonomous Build Pipeline
//
// This is the REAL DEAL - Javari builds and deploys actual applications:
// 1. Receives component code from AI
// 2. Generates complete Next.js project
// 3. Creates GitHub repository
// 4. Pushes all code
// 5. Vercel auto-deploys
// 6. Returns live URL
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_ORG = 'CR-AudioViz-AI';
const GITHUB_API = 'https://api.github.com';
const VERCEL_API = 'https://api.vercel.com';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_Z0yef7NlFu1coCJWz8UmUdI5';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface BuildRequest {
  componentCode: string;
  componentName?: string;
  appName: string;
  appDescription: string;
  userId?: string;
  conversationId?: string;
}

interface BuildResult {
  success: boolean;
  deploymentUrl?: string;
  repoUrl?: string;
  projectName?: string;
  status: 'queued' | 'building' | 'deploying' | 'ready' | 'error';
  message: string;
  buildId?: string;
  error?: string;
}

interface ProjectFile {
  path: string;
  content: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT GENERATOR - Creates complete Next.js project files
// ═══════════════════════════════════════════════════════════════════════════════

function generatePackageJson(projectName: string, description: string): string {
  return JSON.stringify({
    name: projectName,
    version: "1.0.0",
    description: description,
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint"
    },
    dependencies: {
      "next": "14.2.15",
      "react": "^18.2.0",
      "react-dom": "^18.2.0"
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      "autoprefixer": "^10.4.20",
      "postcss": "^8.4.47",
      "tailwindcss": "^3.4.13",
      "typescript": "^5"
    }
  }, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./*"] }
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"]
  }, null, 2);
}

function generateTailwindConfig(): string {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
`;
}

function generatePostCssConfig(): string {
  return `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`;
}

function generateNextConfig(): string {
  return `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;
}

function generateGlobalsCss(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0f172a;
  --foreground: #e2e8f0;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
}
`;
}

function generateLayout(projectName: string): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${projectName}",
  description: "Built by Javari AI - CR AudioViz AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
`;
}

function generatePage(componentName: string): string {
  return `import ${componentName} from "@/components/${componentName}";

export default function Home() {
  return (
    <main className="min-h-screen">
      <${componentName} />
    </main>
  );
}
`;
}

function generateReadme(projectName: string, description: string): string {
  return `# ${projectName}

${description}

## Built by Javari AI

This application was automatically generated and deployed by [Javari AI](https://javariai.com), the autonomous development assistant from CR AudioViz AI.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view in browser.

## Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Deployed on:** Vercel

---

*"Your Story. Our Design."* - CR AudioViz AI
`;
}

function generateGitignore(): string {
  return `# Dependencies
/node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
`;
}

function generateNextEnvDts(): string {
  return `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`;
}

// Extract component name from code
function extractComponentName(code: string): string {
  const defaultExportMatch = code.match(/export\s+default\s+(?:function|const)\s+(\w+)/);
  if (defaultExportMatch) return defaultExportMatch[1];

  const fcMatch = code.match(/const\s+(\w+)\s*:\s*React\.FC/);
  if (fcMatch) return fcMatch[1];

  const functionMatch = code.match(/(?:export\s+)?function\s+([A-Z]\w+)/);
  if (functionMatch) return functionMatch[1];

  const arrowMatch = code.match(/(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*\(/);
  if (arrowMatch) return arrowMatch[1];

  return 'MainComponent';
}

// Clean and prepare component code
function prepareComponentCode(code: string): { code: string; name: string } {
  let cleanCode = code;
  
  // Remove markdown code fences
  cleanCode = cleanCode.replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gm, '');
  cleanCode = cleanCode.replace(/```$/gm, '');
  cleanCode = cleanCode.trim();
  
  const componentName = extractComponentName(cleanCode);
  
  // Ensure export default exists
  if (!cleanCode.includes('export default')) {
    cleanCode = cleanCode.replace(
      new RegExp(`(const|function)\\s+${componentName}`),
      `export default $1 ${componentName}`
    );
  }
  
  // Ensure React hooks import if needed
  if (!cleanCode.includes("from 'react'") && !cleanCode.includes('from "react"')) {
    const hookMatches = cleanCode.match(/use[A-Z]\w+/g) || [];
    const validHooks = ['useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useContext', 'useReducer'];
    const uniqueHooks = [...new Set(hookMatches)].filter(h => validHooks.includes(h));
    if (uniqueHooks.length > 0) {
      cleanCode = `import { ${uniqueHooks.join(', ')} } from 'react';\n\n${cleanCode}`;
    }
  }
  
  return { code: cleanCode, name: componentName };
}

// Generate all project files
function generateProjectFiles(
  projectName: string,
  description: string,
  componentCode: string,
  componentName: string
): ProjectFile[] {
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  return [
    { path: 'package.json', content: generatePackageJson(sanitizedName, description) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'tailwind.config.ts', content: generateTailwindConfig() },
    { path: 'postcss.config.mjs', content: generatePostCssConfig() },
    { path: 'next.config.ts', content: generateNextConfig() },
    { path: '.gitignore', content: generateGitignore() },
    { path: 'next-env.d.ts', content: generateNextEnvDts() },
    { path: 'README.md', content: generateReadme(projectName, description) },
    { path: 'app/globals.css', content: generateGlobalsCss() },
    { path: 'app/layout.tsx', content: generateLayout(projectName) },
    { path: 'app/page.tsx', content: generatePage(componentName) },
    { path: `components/${componentName}.tsx`, content: componentCode },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

async function createGitHubRepo(
  repoName: string,
  description: string,
  token: string
): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  try {
    const response = await fetch(`${GITHUB_API}/orgs/${GITHUB_ORG}/repos`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        description: `${description} - Built by Javari AI`,
        private: false,
        auto_init: true,
        has_issues: true,
        has_projects: false,
        has_wiki: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Failed to create repo' };
    }

    const repo = await response.json();
    return { success: true, repoUrl: repo.html_url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function pushFilesToGitHub(
  repoName: string,
  files: ProjectFile[],
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Wait a moment for repo to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get latest commit SHA
    const refResponse = await fetch(
      `${GITHUB_API}/repos/${GITHUB_ORG}/${repoName}/git/ref/heads/main`,
      { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
    );

    if (!refResponse.ok) {
      return { success: false, error: 'Could not find main branch' };
    }

    const refData = await refResponse.json();
    const latestCommitSha = refData.object.sha;

    // Get tree SHA
    const commitResponse = await fetch(
      `${GITHUB_API}/repos/${GITHUB_ORG}/${repoName}/git/commits/${latestCommitSha}`,
      { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const treeItems = await Promise.all(
      files.map(async (file) => {
        const blobResponse = await fetch(
          `${GITHUB_API}/repos/${GITHUB_ORG}/${repoName}/git/blobs`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
          }
        );
        const blobData = await blobResponse.json();
        return { path: file.path, mode: '100644' as const, type: 'blob' as const, sha: blobData.sha };
      })
    );

    // Create new tree
    const treeResponse = await fetch(
      `${GITHUB_API}/repos/${GITHUB_ORG}/${repoName}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
      }
    );
    const treeData = await treeResponse.json();

    // Create commit
    const newCommitResponse = await fetch(
      `${GITHUB_API}/repos/${GITHUB_ORG}/${repoName}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: '🚀 Initial deploy by Javari AI',
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );
    const newCommitData = await newCommitResponse.json();

    // Update ref
    const updateRefResponse = await fetch(
      `${GITHUB_API}/repos/${GITHUB_ORG}/${repoName}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sha: newCommitData.sha, force: false }),
      }
    );

    if (!updateRefResponse.ok) {
      return { success: false, error: 'Failed to update ref' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERCEL SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

async function createVercelProject(
  projectName: string,
  repoName: string,
  token: string
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    const response = await fetch(`${VERCEL_API}/v10/projects?teamId=${VERCEL_TEAM_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        framework: 'nextjs',
        gitRepository: {
          type: 'github',
          repo: `${GITHUB_ORG}/${repoName}`,
        },
        buildCommand: 'next build',
        installCommand: 'npm install',
        publicSource: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'Failed to create Vercel project' };
    }

    const project = await response.json();
    return { success: true, projectId: project.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function waitForDeployment(
  projectName: string,
  token: string,
  timeoutMs: number = 120000
): Promise<{ success: boolean; url?: string; error?: string }> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(
        `${VERCEL_API}/v6/deployments?projectId=${projectName}&teamId=${VERCEL_TEAM_ID}&limit=1`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const deployment = data.deployments?.[0];
        
        if (deployment) {
          if (deployment.readyState === 'READY') {
            return { success: true, url: `https://${deployment.url}` };
          }
          if (deployment.readyState === 'ERROR') {
            return { success: false, error: 'Deployment failed' };
          }
        }
      }
    } catch {
      // Continue polling
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  return { success: false, error: 'Deployment timed out' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BUILD HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[BUILD] ═══════════════════════════════════════════════════════════`);
  console.log(`[BUILD] Build ${buildId} started at ${new Date().toISOString()}`);
  
  try {
    // Get tokens
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '';
    const vercelToken = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || '';
    
    if (!githubToken || !vercelToken) {
      return NextResponse.json({
        success: false,
        status: 'error',
        message: 'Build service not configured',
        error: 'Missing GitHub or Vercel tokens',
        buildId,
      } as BuildResult, { status: 500 });
    }

    // Parse request
    const body: BuildRequest = await request.json();
    const { componentCode, appName, appDescription, userId, conversationId } = body;
    
    if (!componentCode || !appName) {
      return NextResponse.json({
        success: false,
        status: 'error',
        message: 'Missing component code or app name',
        buildId,
      } as BuildResult, { status: 400 });
    }

    // Generate unique names
    const timestamp = Date.now().toString(36);
    const sanitizedAppName = appName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const repoName = `javari-${sanitizedAppName}-${timestamp}`;
    const projectName = repoName;
    
    console.log(`[BUILD] App: ${appName}`);
    console.log(`[BUILD] Repo: ${repoName}`);
    
    // STEP 1: Prepare component code
    console.log(`[BUILD] Step 1: Preparing component code...`);
    const { code: cleanCode, name: componentName } = prepareComponentCode(componentCode);
    
    // STEP 2: Generate project files
    console.log(`[BUILD] Step 2: Generating project files...`);
    const files = generateProjectFiles(appName, appDescription || appName, cleanCode, componentName);
    console.log(`[BUILD] Generated ${files.length} files`);
    
    // STEP 3: Create GitHub repository
    console.log(`[BUILD] Step 3: Creating GitHub repository...`);
    const repoResult = await createGitHubRepo(repoName, appDescription || appName, githubToken);
    
    if (!repoResult.success) {
      console.error(`[BUILD] Failed to create repo:`, repoResult.error);
      return NextResponse.json({
        success: false,
        status: 'error',
        message: 'Failed to create GitHub repository',
        error: repoResult.error,
        buildId,
      } as BuildResult, { status: 500 });
    }
    
    console.log(`[BUILD] Repository created: ${repoResult.repoUrl}`);
    
    // STEP 4: Push files to GitHub
    console.log(`[BUILD] Step 4: Pushing files to GitHub...`);
    const pushResult = await pushFilesToGitHub(repoName, files, githubToken);
    
    if (!pushResult.success) {
      console.error(`[BUILD] Failed to push files:`, pushResult.error);
      return NextResponse.json({
        success: false,
        status: 'error',
        message: 'Failed to push code to GitHub',
        error: pushResult.error,
        repoUrl: repoResult.repoUrl,
        buildId,
      } as BuildResult, { status: 500 });
    }
    
    console.log(`[BUILD] Files pushed successfully`);
    
    // STEP 5: Create Vercel project
    console.log(`[BUILD] Step 5: Creating Vercel project...`);
    const vercelResult = await createVercelProject(projectName, repoName, vercelToken);
    
    if (!vercelResult.success) {
      console.error(`[BUILD] Failed to create Vercel project:`, vercelResult.error);
      return NextResponse.json({
        success: false,
        status: 'error',
        message: 'Failed to create Vercel project',
        error: vercelResult.error,
        repoUrl: repoResult.repoUrl,
        buildId,
      } as BuildResult, { status: 500 });
    }
    
    console.log(`[BUILD] Vercel project created: ${vercelResult.projectId}`);
    
    // STEP 6: Wait for deployment
    console.log(`[BUILD] Step 6: Waiting for deployment...`);
    const deployResult = await waitForDeployment(projectName, vercelToken);
    
    const latency = Date.now() - startTime;
    
    if (!deployResult.success) {
      console.error(`[BUILD] Deployment failed:`, deployResult.error);
      return NextResponse.json({
        success: false,
        status: 'error',
        message: 'Deployment failed or timed out',
        error: deployResult.error,
        repoUrl: repoResult.repoUrl,
        projectName,
        buildId,
      } as BuildResult, { status: 500 });
    }
    
    console.log(`[BUILD] ═══════════════════════════════════════════════════════════`);
    console.log(`[BUILD] 🎉 SUCCESS! App deployed to: ${deployResult.url}`);
    console.log(`[BUILD] Total time: ${latency}ms`);
    console.log(`[BUILD] ═══════════════════════════════════════════════════════════`);
    
    // Log to database
    try {
      await supabase.from('build_logs').insert({
        build_id: buildId,
        user_id: userId,
        conversation_id: conversationId,
        app_name: appName,
        repo_name: repoName,
        repo_url: repoResult.repoUrl,
        deployment_url: deployResult.url,
        status: 'success',
        build_time_ms: latency,
        created_at: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error('[BUILD] Failed to log build:', dbError);
    }
    
    return NextResponse.json({
      success: true,
      status: 'ready',
      message: `🚀 Your app is LIVE!`,
      deploymentUrl: deployResult.url,
      repoUrl: repoResult.repoUrl,
      projectName,
      buildId,
    } as BuildResult);
    
  } catch (error) {
    console.error(`[BUILD] ═══════════════════════════════════════════════════════════`);
    console.error(`[BUILD] Build ${buildId} FAILED:`, error);
    console.error(`[BUILD] ═══════════════════════════════════════════════════════════`);
    
    return NextResponse.json({
      success: false,
      status: 'error',
      message: 'Build pipeline error',
      error: error instanceof Error ? error.message : 'Unknown error',
      buildId,
    } as BuildResult, { status: 500 });
  }
}

// Health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'Javari AI Build Pipeline',
    version: '1.0',
    capabilities: [
      'Next.js project generation',
      'GitHub repository creation',
      'Automatic Vercel deployment',
      'Live URL delivery',
    ],
    timestamp: new Date().toISOString(),
  });
}
