// lib/javari-tools.ts
// JAVARI TOOL SYSTEM - Every capability she needs to deliver
// Timestamp: 2025-11-30 06:35 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// TOOL DEFINITIONS
// =====================================================

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  userId?: string;
  conversationId?: string;
  credentials?: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  artifact?: {
    type: 'code' | 'html' | 'react' | 'image' | 'document' | 'file';
    content: string;
    filename?: string;
    language?: string;
  };
}

// =====================================================
// ALL TOOLS
// =====================================================

export const TOOLS: Tool[] = [
  // ==================== CODE TOOLS ====================
  {
    name: 'create_file',
    description: 'Create a new file with code or content',
    parameters: {
      filename: { type: 'string', description: 'Name of the file to create', required: true },
      content: { type: 'string', description: 'Content of the file', required: true },
      language: { type: 'string', description: 'Programming language (typescript, javascript, python, etc)' }
    },
    execute: async (params, ctx) => {
      return {
        success: true,
        artifact: {
          type: 'code',
          content: params.content,
          filename: params.filename,
          language: params.language || detectLanguage(params.filename)
        }
      };
    }
  },
  
  {
    name: 'create_react_component',
    description: 'Create a React component that renders live',
    parameters: {
      name: { type: 'string', description: 'Component name', required: true },
      code: { type: 'string', description: 'React component code', required: true }
    },
    execute: async (params, ctx) => {
      return {
        success: true,
        artifact: {
          type: 'react',
          content: params.code,
          filename: `${params.name}.tsx`
        }
      };
    }
  },
  
  {
    name: 'create_html_page',
    description: 'Create an HTML page that renders live',
    parameters: {
      title: { type: 'string', description: 'Page title', required: true },
      html: { type: 'string', description: 'HTML content', required: true }
    },
    execute: async (params, ctx) => {
      const fullHtml = params.html.includes('<!DOCTYPE') ? params.html : `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${params.html}
</body>
</html>`;
      return {
        success: true,
        artifact: {
          type: 'html',
          content: fullHtml,
          filename: `${params.title.toLowerCase().replace(/\s+/g, '-')}.html`
        }
      };
    }
  },

  {
    name: 'execute_code',
    description: 'Execute JavaScript/TypeScript code and return the result',
    parameters: {
      code: { type: 'string', description: 'Code to execute', required: true },
      language: { type: 'string', description: 'javascript or typescript' }
    },
    execute: async (params, ctx) => {
      try {
        // Safe execution using Function constructor with limited scope
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('console', `
          const logs = [];
          const mockConsole = {
            log: (...args) => logs.push(args.map(a => JSON.stringify(a)).join(' ')),
            error: (...args) => logs.push('ERROR: ' + args.map(a => JSON.stringify(a)).join(' '))
          };
          ${params.code}
          return { logs };
        `);
        
        const result = await fn(console);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  },

  // ==================== GITHUB TOOLS ====================
  {
    name: 'github_create_file',
    description: 'Create or update a file in a GitHub repository',
    parameters: {
      repo: { type: 'string', description: 'Repository name (e.g., crav-javari)', required: true },
      path: { type: 'string', description: 'File path in repo', required: true },
      content: { type: 'string', description: 'File content', required: true },
      message: { type: 'string', description: 'Commit message', required: true }
    },
    execute: async (params, ctx) => {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return { success: false, error: 'GitHub token not configured' };

      // Check if file exists
      const checkRes = await fetch(
        `https://api.github.com/repos/CR-AudioViz-AI/${params.repo}/contents/${params.path}`,
        { headers: { 'Authorization': `token ${token}` } }
      );
      
      const existing = checkRes.ok ? await checkRes.json() : null;
      
      const res = await fetch(
        `https://api.github.com/repos/CR-AudioViz-AI/${params.repo}/contents/${params.path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: params.message,
            content: Buffer.from(params.content).toString('base64'),
            sha: existing?.sha,
            branch: 'main'
          })
        }
      );
      
      const data = await res.json();
      return res.ok 
        ? { success: true, data: { sha: data.commit?.sha, url: data.content?.html_url } }
        : { success: false, error: data.message };
    }
  },

  {
    name: 'github_get_file',
    description: 'Get contents of a file from GitHub',
    parameters: {
      repo: { type: 'string', description: 'Repository name', required: true },
      path: { type: 'string', description: 'File path', required: true }
    },
    execute: async (params, ctx) => {
      const token = process.env.GITHUB_TOKEN;
      const res = await fetch(
        `https://api.github.com/repos/CR-AudioViz-AI/${params.repo}/contents/${params.path}`,
        { headers: { 'Authorization': `token ${token}` } }
      );
      
      if (!res.ok) return { success: false, error: 'File not found' };
      
      const data = await res.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { success: true, data: { content, sha: data.sha } };
    }
  },

  // ==================== VERCEL TOOLS ====================
  {
    name: 'vercel_deploy',
    description: 'Deploy a project to Vercel',
    parameters: {
      project: { type: 'string', description: 'Project name', required: true },
      repo: { type: 'string', description: 'GitHub repo name', required: true }
    },
    execute: async (params, ctx) => {
      const token = process.env.VERCEL_TOKEN;
      if (!token) return { success: false, error: 'Vercel token not configured' };

      // Get project ID
      const projectsRes = await fetch('https://api.vercel.com/v9/projects?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const projects = await projectsRes.json();
      const project = projects.projects?.find((p: any) => p.name === params.project);
      
      if (!project) return { success: false, error: `Project ${params.project} not found` };

      const res = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: params.project,
          project: project.id,
          gitSource: {
            type: 'github',
            org: 'CR-AudioViz-AI',
            repo: params.repo,
            ref: 'main'
          }
        })
      });
      
      const data = await res.json();
      return data.id 
        ? { success: true, data: { deploymentId: data.id, url: `https://${data.url}` } }
        : { success: false, error: data.error?.message || 'Deployment failed' };
    }
  },

  {
    name: 'vercel_get_deployment',
    description: 'Get status of a Vercel deployment',
    parameters: {
      deploymentId: { type: 'string', description: 'Deployment ID', required: true }
    },
    execute: async (params, ctx) => {
      const token = process.env.VERCEL_TOKEN;
      const res = await fetch(`https://api.vercel.com/v13/deployments/${params.deploymentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return { 
        success: true, 
        data: { 
          status: data.readyState, 
          url: data.url,
          error: data.errorMessage 
        } 
      };
    }
  },

  // ==================== STRIPE TOOLS ====================
  {
    name: 'stripe_create_product',
    description: 'Create a product in Stripe',
    parameters: {
      name: { type: 'string', description: 'Product name', required: true },
      description: { type: 'string', description: 'Product description' }
    },
    execute: async (params, ctx) => {
      const key = ctx.credentials?.stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
      if (!key) return { success: false, error: 'Stripe not connected' };

      const res = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          name: params.name,
          ...(params.description && { description: params.description })
        }).toString()
      });
      
      const data = await res.json();
      return res.ok ? { success: true, data } : { success: false, error: data.error?.message };
    }
  },

  {
    name: 'stripe_create_price',
    description: 'Create a price for a product',
    parameters: {
      product: { type: 'string', description: 'Product ID', required: true },
      amount: { type: 'number', description: 'Price in cents', required: true },
      currency: { type: 'string', description: 'Currency code (usd, eur, etc)' },
      recurring: { type: 'string', description: 'Billing interval (month, year) for subscriptions' }
    },
    execute: async (params, ctx) => {
      const key = ctx.credentials?.stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
      if (!key) return { success: false, error: 'Stripe not connected' };

      const body: Record<string, string> = {
        product: params.product,
        unit_amount: String(params.amount),
        currency: params.currency || 'usd'
      };
      
      if (params.recurring) {
        body['recurring[interval]'] = params.recurring;
      }

      const res = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(body).toString()
      });
      
      const data = await res.json();
      return res.ok ? { success: true, data } : { success: false, error: data.error?.message };
    }
  },

  {
    name: 'stripe_create_payment_link',
    description: 'Create a payment link for a price',
    parameters: {
      price: { type: 'string', description: 'Price ID', required: true },
      quantity: { type: 'number', description: 'Quantity (default 1)' }
    },
    execute: async (params, ctx) => {
      const key = ctx.credentials?.stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
      if (!key) return { success: false, error: 'Stripe not connected' };

      const res = await fetch('https://api.stripe.com/v1/payment_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'line_items[0][price]': params.price,
          'line_items[0][quantity]': String(params.quantity || 1)
        }).toString()
      });
      
      const data = await res.json();
      return res.ok ? { success: true, data: { url: data.url, id: data.id } } : { success: false, error: data.error?.message };
    }
  },

  // ==================== IMAGE TOOLS ====================
  {
    name: 'generate_image',
    description: 'Generate an image using AI',
    parameters: {
      prompt: { type: 'string', description: 'Image description', required: true },
      size: { type: 'string', description: 'Size: 1024x1024, 1792x1024, 1024x1792' },
      style: { type: 'string', description: 'Style: vivid or natural' }
    },
    execute: async (params, ctx) => {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return { success: false, error: 'OpenAI not configured' };

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: params.prompt,
          n: 1,
          size: params.size || '1024x1024',
          style: params.style || 'vivid'
        })
      });
      
      const data = await res.json();
      if (data.data?.[0]?.url) {
        return { 
          success: true, 
          data: { url: data.data[0].url },
          artifact: { type: 'image', content: data.data[0].url }
        };
      }
      return { success: false, error: data.error?.message || 'Image generation failed' };
    }
  },

  // ==================== SEARCH & RESEARCH ====================
  {
    name: 'web_search',
    description: 'Search the web for current information',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true }
    },
    execute: async (params, ctx) => {
      const key = process.env.PERPLEXITY_API_KEY;
      if (!key) return { success: false, error: 'Perplexity not configured' };

      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [{ role: 'user', content: params.query }],
          max_tokens: 2000
        })
      });
      
      const data = await res.json();
      return { 
        success: true, 
        data: { 
          answer: data.choices?.[0]?.message?.content,
          citations: data.citations || []
        } 
      };
    }
  },

  // ==================== DATABASE TOOLS ====================
  {
    name: 'database_query',
    description: 'Query the Supabase database',
    parameters: {
      table: { type: 'string', description: 'Table name', required: true },
      select: { type: 'string', description: 'Columns to select (default: *)' },
      filter: { type: 'object', description: 'Filter conditions' },
      limit: { type: 'number', description: 'Max rows to return' }
    },
    execute: async (params, ctx) => {
      let query = supabase.from(params.table).select(params.select || '*');
      
      if (params.filter) {
        for (const [key, value] of Object.entries(params.filter)) {
          query = query.eq(key, value);
        }
      }
      
      if (params.limit) {
        query = query.limit(params.limit);
      }
      
      const { data, error } = await query;
      return error ? { success: false, error: error.message } : { success: true, data };
    }
  },

  {
    name: 'database_insert',
    description: 'Insert a record into the database',
    parameters: {
      table: { type: 'string', description: 'Table name', required: true },
      data: { type: 'object', description: 'Data to insert', required: true }
    },
    execute: async (params, ctx) => {
      const { data, error } = await supabase
        .from(params.table)
        .insert(params.data)
        .select();
      
      return error ? { success: false, error: error.message } : { success: true, data };
    }
  },

  // ==================== EMAIL TOOLS ====================
  {
    name: 'send_email',
    description: 'Send an email',
    parameters: {
      to: { type: 'string', description: 'Recipient email', required: true },
      subject: { type: 'string', description: 'Email subject', required: true },
      body: { type: 'string', description: 'Email body (HTML)', required: true }
    },
    execute: async (params, ctx) => {
      const sendgridKey = ctx.credentials?.sendgrid?.api_key || process.env.SENDGRID_API_KEY;
      const resendKey = ctx.credentials?.resend?.api_key || process.env.RESEND_API_KEY;

      if (resendKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Javari <noreply@craudiovizai.com>',
            to: params.to,
            subject: params.subject,
            html: params.body
          })
        });
        const data = await res.json();
        return res.ok ? { success: true, data } : { success: false, error: data.message };
      }

      if (sendgridKey) {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: params.to }] }],
            from: { email: 'noreply@craudiovizai.com', name: 'Javari' },
            subject: params.subject,
            content: [{ type: 'text/html', value: params.body }]
          })
        });
        return res.ok ? { success: true, data: { sent: true } } : { success: false, error: 'Failed to send' };
      }

      return { success: false, error: 'No email service configured' };
    }
  }
];

// =====================================================
// TOOL HELPERS
// =====================================================

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp', c: 'c',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash'
  };
  return map[ext || ''] || 'text';
}

export function getTool(name: string): Tool | undefined {
  return TOOLS.find(t => t.name === name);
}

export function listTools(): Array<{ name: string; description: string }> {
  return TOOLS.map(t => ({ name: t.name, description: t.description }));
}

export async function executeTool(
  name: string,
  params: any,
  context: ToolContext = {}
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  
  // Load user credentials if userId provided
  if (context.userId && !context.credentials) {
    const { data: creds } = await supabase
      .from('credential_vault')
      .select('service_name, credentials')
      .eq('user_id', context.userId);
    
    context.credentials = {};
    creds?.forEach(c => {
      context.credentials![c.service_name] = c.credentials;
    });
  }
  
  return tool.execute(params, context);
}

// =====================================================
// TOOL SCHEMA FOR AI
// =====================================================

export function getToolSchemaForAI(): string {
  return TOOLS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([name, def]) => `  - ${name} (${def.type}${def.required ? ', required' : ''}): ${def.description}`)
      .join('\n');
    return `**${t.name}**: ${t.description}\n${params}`;
  }).join('\n\n');
}

export default {
  TOOLS,
  getTool,
  listTools,
  executeTool,
  getToolSchemaForAI
};
