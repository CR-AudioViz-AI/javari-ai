// app/api/tools/route.ts
// Javari Tool Execution API - Execute any tool
// Timestamp: 2025-11-30 07:00 AM EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { tool, params, userId } = await request.json();
    
    if (!tool) {
      return NextResponse.json({ error: 'No tool specified' }, { status: 400 });
    }

    // Get user credentials if needed
    let credentials: Record<string, any> = {};
    if (userId) {
      const { data } = await supabase
        .from('credential_vault')
        .select('service_name, credentials')
        .eq('user_id', userId);
      
      data?.forEach(c => { credentials[c.service_name] = c.credentials; });
    }

    // Execute tool
    const result = await executeTool(tool, params, credentials);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function executeTool(
  tool: string, 
  params: any, 
  credentials: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  
  switch (tool) {
    // ========== STRIPE ==========
    case 'stripe_create_product': {
      const key = credentials.stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
      if (!key) return { success: false, error: 'Stripe not connected' };
      
      const res = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ name: params.name, description: params.description || '' }).toString()
      });
      const data = await res.json();
      return res.ok ? { success: true, data } : { success: false, error: data.error?.message };
    }
    
    case 'stripe_create_price': {
      const key = credentials.stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
      if (!key) return { success: false, error: 'Stripe not connected' };
      
      const body: Record<string, string> = {
        product: params.product,
        unit_amount: String(params.amount),
        currency: params.currency || 'usd'
      };
      if (params.recurring) body['recurring[interval]'] = params.recurring;
      
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
    
    case 'stripe_create_payment_link': {
      const key = credentials.stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
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

    // ========== GITHUB ==========
    case 'github_create_file': {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return { success: false, error: 'GitHub not configured' };
      
      // Check if exists
      const checkRes = await fetch(
        `https://api.github.com/repos/CR-AudioViz-AI/${params.repo}/contents/${params.path}`,
        { headers: { 'Authorization': `token ${token}` } }
      );
      const existing = checkRes.ok ? await checkRes.json() : null;
      
      const res = await fetch(
        `https://api.github.com/repos/CR-AudioViz-AI/${params.repo}/contents/${params.path}`,
        {
          method: 'PUT',
          headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: params.message || 'Update via Javari',
            content: Buffer.from(params.content).toString('base64'),
            sha: existing?.sha,
            branch: 'main'
          })
        }
      );
      const data = await res.json();
      return res.ok ? { success: true, data: { sha: data.commit?.sha } } : { success: false, error: data.message };
    }

    // ========== VERCEL ==========
    case 'vercel_deploy': {
      const token = process.env.VERCEL_TOKEN;
      if (!token) return { success: false, error: 'Vercel not configured' };
      
      // Get project ID
      const projectsRes = await fetch('https://api.vercel.com/v9/projects?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const projects = await projectsRes.json();
      const project = projects.projects?.find((p: any) => p.name === params.project);
      if (!project) return { success: false, error: `Project ${params.project} not found` };
      
      const res = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.project,
          project: project.id,
          gitSource: { type: 'github', org: 'CR-AudioViz-AI', repo: params.repo, ref: 'main' }
        })
      });
      const data = await res.json();
      return data.id ? { success: true, data: { deploymentId: data.id, url: data.url } } : { success: false, error: data.error?.message };
    }

    // ========== IMAGE GENERATION ==========
    case 'generate_image': {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return { success: false, error: 'OpenAI not configured' };
      
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: params.prompt,
          n: 1,
          size: params.size || '1024x1024',
          style: params.style || 'vivid'
        })
      });
      const data = await res.json();
      return data.data?.[0]?.url 
        ? { success: true, data: { url: data.data[0].url } }
        : { success: false, error: data.error?.message || 'Failed to generate image' };
    }

    // ========== WEB SEARCH ==========
    case 'web_search': {
      const key = process.env.PERPLEXITY_API_KEY;
      if (!key) return { success: false, error: 'Perplexity not configured' };
      
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [{ role: 'user', content: params.query }],
          max_tokens: 2000
        })
      });
      const data = await res.json();
      return { success: true, data: { answer: data.choices?.[0]?.message?.content, citations: data.citations } };
    }

    // ========== EMAIL ==========
    case 'send_email': {
      const resendKey = credentials.resend?.api_key || process.env.RESEND_API_KEY;
      if (resendKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: params.from || 'Javari <noreply@craudiovizai.com>',
            to: params.to,
            subject: params.subject,
            html: params.body
          })
        });
        const data = await res.json();
        return res.ok ? { success: true, data } : { success: false, error: data.message };
      }
      return { success: false, error: 'No email service configured' };
    }

    // ========== DATABASE ==========
    case 'database_query': {
      let query = supabase.from(params.table).select(params.select || '*');
      if (params.filter) {
        for (const [k, v] of Object.entries(params.filter)) {
          query = query.eq(k, v);
        }
      }
      if (params.limit) query = query.limit(params.limit);
      const { data, error } = await query;
      return error ? { success: false, error: error.message } : { success: true, data };
    }
    
    case 'database_insert': {
      const { data, error } = await supabase.from(params.table).insert(params.data).select();
      return error ? { success: false, error: error.message } : { success: true, data };
    }

    default:
      return { success: false, error: `Unknown tool: ${tool}` };
  }
}

// GET - List available tools
export async function GET() {
  return NextResponse.json({
    tools: [
      { name: 'stripe_create_product', description: 'Create a Stripe product' },
      { name: 'stripe_create_price', description: 'Create a price for a product' },
      { name: 'stripe_create_payment_link', description: 'Create a payment link' },
      { name: 'github_create_file', description: 'Create/update a file in GitHub' },
      { name: 'vercel_deploy', description: 'Deploy a project to Vercel' },
      { name: 'generate_image', description: 'Generate an image with DALL-E 3' },
      { name: 'web_search', description: 'Search the web for current info' },
      { name: 'send_email', description: 'Send an email' },
      { name: 'database_query', description: 'Query the database' },
      { name: 'database_insert', description: 'Insert into the database' }
    ]
  });
}
