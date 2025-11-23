import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Conversation {
  id: string;
  user_id: string;
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
  /**
   * Load all conversations for the current user
   */
  static async loadConversations(): Promise<Conversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  }

  /**
   * Load messages for a specific conversation
   */
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

  /**
   * Create a new conversation
   */
  static async createConversation(title: string): Promise<Conversation | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
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

  /**
   * Save a message to the database
   */
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

      // Update conversation timestamp
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

  /**
   * Update conversation title
   */
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

  /**
   * Delete a conversation and all its messages
   */
  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      // Messages will be deleted via CASCADE
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
   */
  static detectBuildRequest(message: string): { isBuild: boolean; appName?: string; description?: string } {
    const patterns = [
      /build\s+(?:me\s+)?(?:a\s+)?(.+?)(?:\s+app)?$/i,
      /create\s+(?:a\s+)?(.+?)(?:\s+app)?$/i,
      /make\s+(?:me\s+)?(?:a\s+)?(.+?)(?:\s+app)?$/i,
    ];

    for (const pattern of patterns) {
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
    return { isBuild: false };
  }

  /**
   * Trigger autonomous deployment
   */
  static async deploy(appName: string, description: string): Promise<{ workflowId: string } | null> {
    try {
      // Generate basic app structure
      const files = this.generateAppFiles(appName, description);

      const response = await fetch('/api/autonomous/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, files }),
      });

      if (!response.ok) throw new Error('Deployment failed');

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
      const response = await fetch(`/api/autonomous/status/${workflowId}`);
      if (!response.ok) throw new Error('Failed to get status');

      const data = await response.json();
      return data.workflow;
    } catch (error) {
      console.error('Error getting deployment status:', error);
      return null;
    }
  }

  /**
   * Generate basic app files
   */
  private static generateAppFiles(appName: string, description: string) {
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
          },
          dependencies: {
            next: '14.2.15',
            react: '^18.3.1',
            'react-dom': '^18.3.1',
          },
          devDependencies: {
            '@types/node': '^20.10.0',
            '@types/react': '^18.3.12',
            typescript: '^5.3.3',
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
        path: 'next.config.js',
        content: '/** @type {import(\'next\').NextConfig} */\nconst nextConfig = {}\nmodule.exports = nextConfig\n',
      },
      {
        path: 'app/page.tsx',
        content: `export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">${appName}</h1>
      <p className="text-gray-600">${description}</p>
      <p className="mt-4 text-sm text-gray-500">Built by Javari AI</p>
    </main>
  )
}
`,
      },
      {
        path: 'app/layout.tsx',
        content: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${appName}',
  description: '${description}',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
      },
      {
        path: 'README.md',
        content: `# ${appName}

${description}

## Built with Javari AI

This application was automatically generated and deployed by Javari AI.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to see the result.
`,
      },
    ];
  }
}
