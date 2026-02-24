// lib/javari-services.ts
// Updated: December 23, 2025 - Session-based conversations (no auth required)
// Timestamp: 2025-12-23 02:58 PM EST

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get or create a session ID for this browser
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-' + Date.now();
  
  let sessionId = localStorage.getItem('javari_session_id');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('javari_session_id', sessionId);
  }
  return sessionId;
}

export interface Conversation {
  id: string;
  user_id?: string;
  session_id?: string;
  title: string;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  created_at: string;
}

export class ChatService {
  static async loadConversations(): Promise<Conversation[]> {
    try {
      const sessionId = getSessionId();
      
      // Try to get authenticated user first
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100);
      
      // Filter by user_id if logged in, otherwise by session_id
      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  }

  static async loadMessages(conversationId: string): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  }

  static async createConversation(title: string): Promise<Conversation | null> {
    try {
      const sessionId = getSessionId();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user?.id || null,
          session_id: sessionId,
          title: title.substring(0, 100),
          starred: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }

  static async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    provider?: string
  ): Promise<Message | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          provider,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  }

  static async toggleStar(conversationId: string, starred: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ starred })
        .eq('id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling star:', error);
      return false;
    }
  }

  static async updateConversationTitle(conversationId: string, title: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title: title.substring(0, 100) })
        .eq('id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      return false;
    }
  }

  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }
}

export class AutonomousService {
  /**
   * Detect if a message is a build request
   * UPDATED: More conservative detection to avoid false positives
   */
  static detectBuildRequest(message: string): { isBuild: boolean; appName?: string; description?: string } {
    // Only trigger autonomous build for EXPLICIT build requests
    // Must include specific trigger words AND app-like context
    const explicitBuildPatterns = [
      /^build\s+(?:me\s+)?(?:a\s+|an\s+)?(\w[\w\s-]{2,30})\s+(?:app|application|website|site|page|tool)$/i,
      /^create\s+(?:me\s+)?(?:a\s+|an\s+)?(\w[\w\s-]{2,30})\s+(?:app|application|website|site|page|tool)$/i,
      /^make\s+(?:me\s+)?(?:a\s+|an\s+)?(\w[\w\s-]{2,30})\s+(?:app|application|website|site|page|tool)$/i,
      /^deploy\s+(?:a\s+)?(\w[\w\s-]{2,30})\s+(?:app|application)$/i,
    ];

    for (const pattern of explicitBuildPatterns) {
      const match = message.match(pattern);
      if (match) {
        const appName = match[1]
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50);
        return { isBuild: true, appName, description: message };
      }
    }
    
    // For messages that mention "build" but aren't explicit app requests,
    // let the AI handle it conversationally
    return { isBuild: false };
  }

  /**
   * Trigger autonomous deployment
   * FIXED: Uses absolute URL and handles auth properly
   */
  static async deploy(appName: string, description: string, authToken?: string): Promise<{ workflowId: string } | null> {
    try {
      const files = this.generateAppFiles(appName, description);
      
      // Use absolute URL - get base URL from environment
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                      'https://javariai.com';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add auth token if provided
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${baseUrl}/api/autonomous/deploy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ appName, files }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Deployment API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deploying app:', error);
      return null;
    }
  }

  /**
   * Poll deployment status
   */
  static async getDeploymentStatus(workflowId: string) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                      'https://javariai.com';
                      
      const response = await fetch(`${baseUrl}/api/autonomous/status/${workflowId}`);
      if (!response.ok) throw new Error('Failed to get status');

      const data = await response.json();
      return data.workflow;
    } catch (error) {
      console.error('Error getting deployment status:', error);
      return null;
    }
  }

  /**
   * Generate comprehensive app files
   * ENHANCED: Better templates for real apps
   */
  private static generateAppFiles(appName: string, description: string) {
    const displayName = appName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    return [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: appName,
          version: '1.0.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
          },
          dependencies: {
            next: '14.2.15',
            react: '^18.3.1',
            'react-dom': '^18.3.1',
            'lucide-react': '^0.263.1',
          },
          devDependencies: {
            '@types/node': '^20.10.0',
            '@types/react': '^18.3.12',
            typescript: '^5.3.3',
            tailwindcss: '^3.4.1',
            postcss: '^8.4.33',
            autoprefixer: '^10.4.17',
          },
        }, null, 2),
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'es5',
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
            paths: { '@/*': ['./*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
          exclude: ['node_modules'],
        }, null, 2),
      },
      {
        path: 'tailwind.config.js',
        content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`,
      },
      {
        path: 'postcss.config.js',
        content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
      },
      {
        path: 'next.config.js',
        content: '/** @type {import(\'next\').NextConfig} */\nconst nextConfig = {}\nmodule.exports = nextConfig\n',
      },
      {
        path: 'app/globals.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
`,
      },
      {
        path: 'app/page.tsx',
        content: `import { ArrowRight, Sparkles, Zap, Shield } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                ${displayName}
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              ${description}
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <button className="px-8 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition flex items-center gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
              <button className="px-8 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Sparkles className="w-8 h-8 text-purple-500" />}
              title="Powerful Features"
              description="Everything you need to succeed, built right in."
            />
            <FeatureCard 
              icon={<Zap className="w-8 h-8 text-yellow-500" />}
              title="Lightning Fast"
              description="Optimized for speed and performance."
            />
            <FeatureCard 
              icon={<Shield className="w-8 h-8 text-green-500" />}
              title="Secure & Reliable"
              description="Your data is safe with enterprise-grade security."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-gray-500 text-sm">
        <p>Built with ❤️ by Javari AI for CR AudioViz AI</p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}
`,
      },
      {
        path: 'app/layout.tsx',
        content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${displayName}',
  description: '${description}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`,
      },
      {
        path: 'README.md',
        content: `# ${displayName}

${description}

## Built with Javari AI

This application was automatically generated and deployed by Javari AI, the autonomous development assistant for CR AudioViz AI.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Features

- Modern React with Next.js 14
- Tailwind CSS for styling
- TypeScript for type safety
- Responsive design
- Dark mode support

## Powered By

- [CR AudioViz AI](https://craudiovizai.com)
- [Javari AI](https://javariai.com)
`,
      },
    ];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMOUS CONTINUATION METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export class ProjectService {
  // Create a new project (for autonomous work)
  static async createProject(params: {
    name: string;
    goal: string;
    sessionId?: string;
  }): Promise<any> {
    try {
      const sessionId = params.sessionId || getSessionId();
      
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: params.name,
          goal: params.goal,
          session_id: sessionId,
          status: 'active',
          progress_percent: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      return null;
    }
  }

  // Get active project for session
  static async getActiveProject(sessionId?: string): Promise<any> {
    try {
      const sid = sessionId || getSessionId();
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('session_id', sid)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  // Update project progress
  static async updateProgress(projectId: string, progress: number, currentTask?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          progress_percent: progress,
          current_task: currentTask,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating progress:', error);
      return false;
    }
  }

  // Link conversation to project
  static async linkConversationToProject(conversationId: string, projectId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ project_id: projectId })
        .eq('id', conversationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error linking conversation:', error);
      return false;
    }
  }

  // Create continuation conversation
  static async createContinuation(params: {
    projectId: string;
    previousConversationId: string;
    contextSummary: string;
  }): Promise<any> {
    try {
      const sessionId = getSessionId();
      
      // Get project name
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', params.projectId)
        .single();

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          session_id: sessionId,
          title: `${project?.name || 'Project'} (continued)`,
          project_id: params.projectId,
          is_continuation: true,
          previous_conversation_id: params.previousConversationId,
          context_summary: params.contextSummary,
          starred: true, // Auto-star continuations so they stay active
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating continuation:', error);
      return null;
    }
  }
}
