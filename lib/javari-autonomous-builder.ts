// lib/javari-autonomous-builder.ts
import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

interface AppRequest {
  name: string;
  description: string;
  features: string[];
  category: 'revenue' | 'collector' | 'social-impact' | 'business' | 'consumer' | 'specialty';
  userId: string;
}

interface GeneratedApp {
  repoName: string;
  repoUrl: string;
  deploymentUrl: string;
  files: Record<string, string>;
}

export class JavariAutonomousBuilder {
  
  async buildCompleteApp(request: AppRequest): Promise<GeneratedApp> {
    console.log(`🏗️  Building ${request.name}...`);
    
    // Step 1: Generate complete app structure
    const structure = await this.generateAppStructure(request);
    
    // Step 2: Generate all code files
    const files = await this.generateAllFiles(request, structure);
    
    // Step 3: Create GitHub repository
    const repo = await this.createRepository(request);
    
    // Step 4: Push all files to GitHub
    await this.pushFilesToGitHub(repo.name, files);
    
    // Step 5: Deploy to Vercel
    const deployment = await this.deployToVercel(repo.name);
    
    // Step 6: Track in database
    await this.trackAppCreation(request, repo, deployment);
    
    console.log(`✅ ${request.name} built successfully!`);
    console.log(`📦 Repo: ${repo.html_url}`);
    console.log(`🚀 Live: ${deployment.url}`);
    
    return {
      repoName: repo.name,
      repoUrl: repo.html_url,
      deploymentUrl: deployment.url,
      files
    };
  }
  
  private async generateAppStructure(request: AppRequest) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are an expert Next.js architect. Generate a complete app structure for:

Name: ${request.name}
Description: ${request.description}
Features: ${request.features.join(', ')}
Category: ${request.category}

Return ONLY a JSON object with this structure:
{
  "folders": ["app", "components", "lib", "hooks", "types"],
  "files": {
    "app/page.tsx": "description",
    "app/layout.tsx": "description",
    "components/Feature1.tsx": "description",
    ...
  },
  "features": ["auth", "credits", "ai-generation", "export"],
  "integrations": ["supabase", "stripe", "anthropic"]
}

Make it production-ready, include all necessary files.`
      }]
    });
    
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```/g, ''));
  }
  
  private async generateAllFiles(request: AppRequest, structure: any): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    
    // Generate each file
    for (const [filepath, description] of Object.entries(structure.files)) {
      console.log(`  📝 Generating ${filepath}...`);
      
      const content = await this.generateFile(
        filepath,
        description as string,
        request,
        structure
      );
      
      files[filepath] = content;
    }
    
    // Add standard files
    files['package.json'] = this.generatePackageJson(request);
    files['tailwind.config.ts'] = this.getTailwindConfig();
    files['app/globals.css'] = this.getGlobalCSS();
    files['.env.example'] = this.getEnvExample();
    files['README.md'] = this.generateReadme(request);
    files['.gitignore'] = this.getGitignore();
    files['tsconfig.json'] = this.getTSConfig();
    files['next.config.js'] = this.getNextConfig();
    
    return files;
  }
  
  private async generateFile(
    filepath: string,
    description: string,
    request: AppRequest,
    structure: any
  ): Promise<string> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `Generate the complete code for: ${filepath}

Description: ${description}
App: ${request.name} - ${request.description}
Structure: ${JSON.stringify(structure, null, 2)}

Requirements:
- Use Next.js 14 App Router
- TypeScript with strict mode
- Tailwind CSS with official CR AudioViz AI colors (Navy #1E3A5F, Red #E31937, Cyan #00B4D8)
- Integrate with Supabase for database/auth
- Use Anthropic Claude for AI features
- Include credit system integration
- Production-ready, error handling included
- Follow CR AudioViz AI brand standards

Return ONLY the complete file contents, no explanations.`
      }]
    });
    
    let content = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Strip markdown code fences if present
    content = content.replace(/```[a-z]*\n?/g, '').trim();
    
    return content;
  }
  
  private async createRepository(request: AppRequest) {
    const repoName = `javari-${request.name.toLowerCase().replace(/\s+/g, '-')}`;
    
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: request.description,
      private: false,
      auto_init: false
    });
    
    return data;
  }
  
  private async pushFilesToGitHub(repoName: string, files: Record<string, string>) {
    // Get default branch
    const { data: repo } = await octokit.repos.get({
      owner: 'CR-AudioViz-AI',
      repo: repoName
    });
    
    const branch = repo.default_branch || 'main';
    
    // Create initial commit with all files
    const tree = await this.createGitTree(repoName, files);
    const commit = await this.createCommit(repoName, tree, 'Initial commit - Generated by Javari AI');
    await this.updateBranch(repoName, branch, commit);
  }
  
  private async createGitTree(repoName: string, files: Record<string, string>) {
    const tree = Object.entries(files).map(([path, content]) => ({
      path,
      mode: '100644' as const,
      type: 'blob' as const,
      content
    }));
    
    const { data } = await octokit.git.createTree({
      owner: 'CR-AudioViz-AI',
      repo: repoName,
      tree
    });
    
    return data.sha;
  }
  
  private async createCommit(repoName: string, treeSha: string, message: string) {
    const { data } = await octokit.git.createCommit({
      owner: 'CR-AudioViz-AI',
      repo: repoName,
      message,
      tree: treeSha,
      parents: []
    });
    
    return data.sha;
  }
  
  private async updateBranch(repoName: string, branch: string, commitSha: string) {
    await octokit.git.createRef({
      owner: 'CR-AudioViz-AI',
      repo: repoName,
      ref: `refs/heads/${branch}`,
      sha: commitSha
    });
  }
  
  private async deployToVercel(repoName: string) {
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repoName,
        gitSource: {
          type: 'github',
          repo: `CR-AudioViz-AI/${repoName}`,
          ref: 'main'
        },
        projectSettings: {
          framework: 'nextjs',
          buildCommand: 'npm run build',
          outputDirectory: '.next'
        }
      })
    });
    
    return await response.json();
  }
  
  private async trackAppCreation(request: AppRequest, repo: any, deployment: any) {
    // Store in Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabase.from('javari_built_apps').insert({
      user_id: request.userId,
      app_name: request.name,
      description: request.description,
      category: request.category,
      repo_name: repo.name,
      repo_url: repo.html_url,
      deployment_url: deployment.url,
      features: request.features,
      created_at: new Date().toISOString()
    });
  }
  
  // Template files
  
  private generatePackageJson(request: AppRequest): string {
    return JSON.stringify({
      name: request.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint'
      },
      dependencies: {
        'next': '^14.0.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        '@supabase/supabase-js': '^2.39.0',
        '@anthropic-ai/sdk': '^0.27.0',
        'lucide-react': '^0.263.1',
        'stripe': '^14.0.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.2.0',
        'typescript': '^5.0.0',
        'tailwindcss': '^3.4.0',
        'postcss': '^8.4.0',
        'autoprefixer': '^10.4.0'
      }
    }, null, 2);
  }
  
  private getTailwindConfig(): string {
    return `import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#1E3A5F',
          700: '#243b53',
          800: '#102a43',
          900: '#0d1f2e',
          950: '#081420'
        },
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#E31937',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a'
        },
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#00B4D8',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344'
        }
      }
    }
  },
  plugins: []
}

export default config`;
  }
  
  private getGlobalCSS(): string {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --cr-navy: #1E3A5F;
  --cr-red: #E31937;
  --cr-cyan: #00B4D8;
}

@layer base {
  body {
    @apply bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100;
  }
}`;
  }
  
  private getEnvExample(): string {
    return `# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=`;
  }
  
  private generateReadme(request: AppRequest): string {
    return `# ${request.name}

${request.description}

**Generated by Javari AI** - CR AudioViz AI's autonomous app builder

## Features

${request.features.map(f => `- ${f}`).join('\n')}

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase
- Anthropic Claude AI
- Stripe Payments

## Getting Started

\`\`\`bash
npm install
cp .env.example .env.local
# Add your environment variables
npm run dev
\`\`\`

## Deployment

Deployed automatically to Vercel on push to main branch.

---

Built with ❤️ by CR AudioViz AI
`;
  }
  
  private getGitignore(): string {
    return `.next/
node_modules/
.env*.local
.DS_Store
*.log
.vercel`;
  }
  
  private getTSConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    }, null, 2);
  }
  
  private getNextConfig(): string {
    return `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com']
  }
}

module.exports = nextConfig`;
  }
}

export const javariBuilder = new JavariAutonomousBuilder();
