// app/api/admin/setup-database/route.ts
// ============================================================================
// JAVARI AI - ONE-CLICK DATABASE SETUP
// Run this endpoint to create missing tables and seed knowledge base
// 
// Usage: POST /api/admin/setup-database
// Auth: Requires ADMIN_SETUP_KEY in Authorization header
//
// Created: December 12, 2025 - 11:58 PM EST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Knowledge entries to seed
const KNOWLEDGE_ENTRIES = [
  // Company Information
  {
    category: 'company',
    title: 'Company Overview',
    content: 'CR AudioViz AI, LLC is a Florida S-Corporation (EIN: 93-4520864) founded by Roy Henderson (CEO/Co-Founder) and Cindy Henderson (CMO/Co-Founder). The company operates under the mission "Your Story. Our Design." and is building a comprehensive AI-powered creative ecosystem targeting $1M ARR within 14 months.',
    source: 'company_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'company',
    title: 'Business Model',
    content: 'CR AudioViz AI has seven diversified revenue streams: SaaS subscriptions starting at $29/month, Creator marketplace commissions at 15%, White-label enterprise solutions, Grant funding targeting $600M+, Affiliate programs at 30% recurring, Premium avatar services, Trending product merchandising.',
    source: 'company_docs',
    confidence_score: 0.98,
    is_verified: true
  },
  {
    category: 'company',
    title: 'Customer-First Policies',
    content: 'CR AudioViz AI differentiates through customer-first policies: Credits NEVER expire on paid plans, automatic refunds for any AI errors, complete code ownership rights, build here host anywhere philosophy, 24/7 AI support through Javari.',
    source: 'company_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'company',
    title: 'Contact Information',
    content: 'Primary Domain: craudiovizai.com | Javari AI: javariai.com | Email: info@craudiovizai.com | Owner: royhenderson@craudiovizai.com',
    source: 'company_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  // Javari AI
  {
    category: 'javari',
    title: 'Core Identity',
    content: 'Javari AI is the autonomous AI assistant for CR AudioViz AI. Javari NEVER says no - always finds a way to help. Capabilities: Build complete web apps, deploy instantly, create documents/invoices/contracts, generate graphics, research data, integrate APIs, remember context.',
    source: 'system_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'javari',
    title: 'Multi-AI Providers',
    content: 'Javari routes to the best AI provider: Claude (Anthropic) for coding and analysis, OpenAI GPT-4 for creative and general tasks, Google Gemini for multimodal and fast responses, Mistral for multilingual and cost-effective chat, Perplexity for real-time search. Automatic fallback ensures 99.9% uptime.',
    source: 'system_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'javari',
    title: 'Autonomous Capabilities',
    content: 'Javari includes autonomous systems: Self-healing that detects and fixes build errors automatically, Continuous learning from conversations and documentation, Knowledge base with semantic search, GitHub integration for automated commits, Vercel integration for instant deployments.',
    source: 'system_docs',
    confidence_score: 0.98,
    is_verified: true
  },
  {
    category: 'javari',
    title: 'Never Say No Rule',
    content: 'Javari NEVER says "no", "I cant", "Im unable to", or any refusal. Instead: "Heres how we can make that happen", "Let me show you the best way", "Heres an even better approach", "Im Javari and Im here to build that for you!"',
    source: 'system_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  // Products (Key ones)
  {
    category: 'products',
    title: 'Invoice Generator',
    content: 'Creates professional invoices instantly. Cost: 1 credit. Features: Custom branding, line items, tax calculation, PDF export, payment links. URL: craudiovizai.com/tools/invoice-generator',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'Proposal Builder',
    content: 'Creates stunning business proposals. Cost: 2 credits. Features: Templates, custom sections, pricing tables, e-signature ready. URL: craudiovizai.com/tools/proposal-builder',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'Contract Generator',
    content: 'Creates legally-reviewed contracts. Cost: 2 credits. Features: NDA, service agreements, freelance contracts, customizable clauses. URL: craudiovizai.com/tools/contract-generator',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'Logo Studio',
    content: 'Creates professional logos with AI. Cost: 3 credits. Features: Multiple concepts, vector formats, brand guidelines, variations. URL: craudiovizai.com/tools/logo-studio',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'Market Oracle',
    content: 'AI-powered stock analysis and predictions. Cost: 5 credits. Features: Real-time data, technical analysis, sentiment analysis, portfolio tracking. URL: craudiovizai.com/tools/market-oracle',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'Competitive Intelligence',
    content: 'Tracks competitors and market trends. Cost: 3 credits. Features: News monitoring, social listening, market share analysis, alerts. URL: craudiovizai.com/tools/competitive-intelligence',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'CR Realtor Platform',
    content: 'Complete real estate solution. Price: $49/month subscription. Features: Property flyers, open house management, CRM, MLS integration, virtual tours. URL: craudiovizai.com/realtor',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'eBook Creator',
    content: 'Produces professional eBooks. Cost: 5 credits. Features: EPUB, MOBI, PDF formats, cover design, formatting, table of contents. URL: craudiovizai.com/tools/ebook-creator',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'products',
    title: 'SEO Content Writer',
    content: 'Creates optimized content. Cost: 3 credits. Features: Keyword research, meta descriptions, internal linking, readability scoring. URL: craudiovizai.com/tools/seo-writer',
    source: 'product_catalog',
    confidence_score: 0.99,
    is_verified: true
  },
  // Pricing
  {
    category: 'pricing',
    title: 'Starter Plan',
    content: 'Starter: $29/month or $290/year (save $58). Includes: 100 credits/month, All 60+ tools, Javari AI assistant, Email support. Credits NEVER expire on active plan.',
    source: 'pricing_page',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'pricing',
    title: 'Pro Plan',
    content: 'Pro: $49/month or $490/year (save $98). Includes: 500 credits/month, All tools, Javari priority routing, Priority support, API access. Credits never expire.',
    source: 'pricing_page',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'pricing',
    title: 'Business Plan',
    content: 'Business: $99/month or $990/year (save $198). Includes: 1500 credits/month, White-label options, Team collaboration (5 seats), Dedicated support, Custom integrations.',
    source: 'pricing_page',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'pricing',
    title: 'Enterprise Plan',
    content: 'Enterprise: Custom pricing. Includes: Unlimited credits, White-label platform, Unlimited team seats, 24/7 dedicated support, Custom AI training, SLA guarantee, On-premise option.',
    source: 'pricing_page',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'pricing',
    title: 'Credit Packs',
    content: 'Credit Packs: 100 credits = $25, 500 credits = $100 (20% savings), 1000 credits = $175 (30% savings), 5000 credits = $750 (40% savings). Credits NEVER expire.',
    source: 'pricing_page',
    confidence_score: 0.99,
    is_verified: true
  },
  // CRAIverse & Social Impact
  {
    category: 'craiverse',
    title: 'CRAIverse Overview',
    content: 'CRAIverse is the virtual world platform. Features: Avatar creation, Virtual real estate, Community spaces, Geographic targeting for local businesses, Social impact modules. Coming in Phase 3.',
    source: 'product_docs',
    confidence_score: 0.95,
    is_verified: true
  },
  {
    category: 'social_impact',
    title: 'Social Impact Modules',
    content: '20 social impact modules serving: First responders, Veterans, Faith-based orgs, Animal rescue, Youth mentorship, Senior citizens, Disability support, Mental health, Homeless outreach, Food security, Education, Job training, Healthcare navigation, Legal aid, Housing, Domestic violence support, Addiction recovery, Immigrant services, Environmental justice, Community organizing.',
    source: 'company_docs',
    confidence_score: 0.98,
    is_verified: true
  },
  // Games
  {
    category: 'games',
    title: 'Games Hub',
    content: 'Games Hub provides 1,200+ games. Categories: Puzzle, Action, Strategy, Educational, Multiplayer. Features: Leaderboards, achievements, rewards, family-friendly content. URL: craudiovizai.com/games',
    source: 'product_docs',
    confidence_score: 0.95,
    is_verified: true
  },
  // Technical
  {
    category: 'technical',
    title: 'Tech Stack',
    content: 'Tech stack: Frontend - Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion. Backend - Supabase PostgreSQL, Vercel serverless. AI - OpenAI, Anthropic Claude, Google Gemini, Mistral, Perplexity. Payments - Stripe, PayPal.',
    source: 'technical_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'technical',
    title: 'API Access',
    content: 'API available on Pro+ plans. RESTful with JSON. Auth via API key. Rate limits: Starter 100/day, Pro 1000/day, Business 10000/day, Enterprise unlimited. Docs: craudiovizai.com/docs/api',
    source: 'technical_docs',
    confidence_score: 0.98,
    is_verified: true
  },
  // FAQ
  {
    category: 'faq',
    title: 'Getting Started',
    content: 'To start: 1) Visit craudiovizai.com/signup, 2) Choose plan (Starter $29/mo recommended), 3) Complete payment via Stripe/PayPal, 4) Start creating with Javari AI!',
    source: 'support_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'faq',
    title: 'Credit System',
    content: 'Credits used for tools. Each tool shows cost. Credits NEVER expire on paid plans. Purchase packs or upgrade if needed. Unused credits roll over monthly.',
    source: 'support_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'faq',
    title: 'Code Ownership',
    content: 'You own 100% of code Javari creates. No licensing restrictions, no attribution required. Build here, host anywhere. Export your projects anytime.',
    source: 'support_docs',
    confidence_score: 0.99,
    is_verified: true
  },
  {
    category: 'faq',
    title: 'Support Options',
    content: 'Support: Javari AI 24/7 instant help, Email support@craudiovizai.com, Knowledge base at craudiovizai.com/help, Priority support for Pro+, Dedicated support for Enterprise.',
    source: 'support_docs',
    confidence_score: 0.99,
    is_verified: true
  }
];

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Verify admin access
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_SETUP_KEY || process.env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    tables_created: [] as string[],
    tables_failed: [] as string[],
    knowledge_inserted: 0,
    knowledge_failed: 0,
    errors: [] as string[]
  };

  try {
    // Step 1: Create javari_ai_usage table
    console.log('📦 Creating javari_ai_usage table...');
    
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.javari_ai_usage (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id TEXT,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          tokens_used INTEGER DEFAULT 0,
          cost_usd DECIMAL(10, 6) DEFAULT 0,
          success BOOLEAN DEFAULT true,
          latency_ms INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_javari_ai_usage_created ON javari_ai_usage(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_javari_ai_usage_provider ON javari_ai_usage(provider);
      `
    });
    
    if (createError) {
      // If RPC not available, try direct insert to test table exists
      const { error: testError } = await supabase
        .from('javari_ai_usage')
        .select('count')
        .limit(1);
      
      if (testError && testError.code === '42P01') {
        results.tables_failed.push('javari_ai_usage');
        results.errors.push('javari_ai_usage table does not exist - run SQL migration manually');
      } else {
        results.tables_created.push('javari_ai_usage (exists)');
      }
    } else {
      results.tables_created.push('javari_ai_usage');
    }

    // Step 2: Seed knowledge base
    console.log('📚 Seeding knowledge base...');
    
    for (const entry of KNOWLEDGE_ENTRIES) {
      const { error } = await supabase
        .from('javari_knowledge')
        .upsert({
          ...entry,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'title',
          ignoreDuplicates: true
        });
      
      if (error) {
        results.knowledge_failed++;
        if (!results.errors.includes(error.message)) {
          results.errors.push(`Knowledge: ${error.message}`);
        }
      } else {
        results.knowledge_inserted++;
      }
    }

    // Step 3: Verify setup
    const { count: knowledgeCount } = await supabase
      .from('javari_knowledge')
      .select('*', { count: 'exact', head: true });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Database setup completed',
      results: {
        ...results,
        total_knowledge_entries: knowledgeCount || 0
      },
      latency_ms: latencyMs,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results,
      latency_ms: Date.now() - startTime
    }, { status: 500 });
  }
}

export async function GET() {
  // Health check endpoint
  const { count, error } = await supabase
    .from('javari_knowledge')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    endpoint: '/api/admin/setup-database',
    status: error ? 'error' : 'ok',
    knowledge_entries: count || 0,
    usage: 'POST with Authorization: Bearer <ADMIN_SETUP_KEY or CRON_SECRET>',
    timestamp: new Date().toISOString()
  });
}
