// app/api/chat/route.ts
// JAVARI AI - Complete System with Full Product Knowledge & Monetization
// Timestamp: 2025-12-02 11:35 AM EST
// Version: 3.0 - The Brain That Knows Everything

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// CR AUDIOVIZ AI - COMPLETE PRODUCT CATALOG
// ============================================================================

const CR_PRODUCTS = {
  // CORE PLATFORM
  platform: {
    name: 'CR AudioViz AI Platform',
    tagline: 'Your Story. Our Design.',
    description: 'Unified creative ecosystem with 60+ professional tools, AI assistant, games, and social impact modules',
    url: 'https://craudiovizai.com',
  },

  // AI ASSISTANT
  javari: {
    name: 'Javari AI',
    description: 'Autonomous AI that builds, deploys, and delivers. Never forgets, self-heals, continuously learns.',
    capabilities: [
      'Build complete web applications',
      'Deploy to production instantly',
      'Create documents, invoices, contracts',
      'Generate images and graphics',
      'Research and analyze data',
      'Integrate with any API',
      'Remember context across conversations',
    ],
    credits: 1,
    url: 'https://javariai.com',
  },

  // BUSINESS TOOLS
  invoiceGenerator: {
    name: 'Invoice Generator',
    description: 'Professional invoices with templates, line items, tax calculations, PDF export',
    features: ['Multiple templates', 'Auto-calculate totals', 'Tax handling', 'PDF export', 'Client management'],
    credits: 1,
    repo: 'crav-invoice-generator',
    canBuild: true,
  },
  proposalBuilder: {
    name: 'Proposal Builder',
    description: 'Create winning business proposals with executive summaries, timelines, pricing tables',
    features: ['Professional templates', 'Section library', 'Pricing tables', 'E-signature ready'],
    credits: 2,
    canBuild: true,
  },
  contractGenerator: {
    name: 'Contract Generator',
    description: 'Legal contracts with customizable terms, parties, compensation structures',
    features: ['Template library', 'Custom clauses', 'Digital signatures', 'Version tracking'],
    credits: 2,
    canBuild: true,
  },
  businessPlanCreator: {
    name: 'Business Plan Creator',
    description: 'Comprehensive business plans with market analysis, financials, projections',
    features: ['Industry templates', 'Financial modeling', 'Charts & graphs', 'Export to PDF/DOCX'],
    credits: 5,
    canBuild: true,
  },

  // CREATIVE TOOLS
  logoStudio: {
    name: 'Logo Studio',
    description: 'AI-powered logo creation with multiple styles and export formats',
    features: ['AI generation', 'Style presets', 'Color palettes', 'SVG/PNG/PDF export'],
    credits: 3,
    repo: 'crav-logo-studio',
    canBuild: true,
  },
  socialGraphics: {
    name: 'Social Graphics Creator',
    description: 'Templates for Instagram, Facebook, Twitter, LinkedIn, YouTube, Pinterest',
    features: ['Platform-optimized sizes', 'Brand kit integration', 'Batch export', 'Scheduling'],
    credits: 1,
    repo: 'crav-social-graphics',
    canBuild: true,
  },
  ebookCreator: {
    name: 'eBook Creator',
    description: 'Create and publish eBooks with chapters, formatting, and distribution',
    features: ['Chapter management', 'EPUB/MOBI export', 'Cover designer', 'Distribution'],
    credits: 5,
    repo: 'crav-ebook-creator',
    canBuild: true,
  },
  presentationMaker: {
    name: 'Presentation Maker',
    description: 'Professional presentations with templates and animations',
    features: ['Slide templates', 'Animations', 'Speaker notes', 'PPTX export'],
    credits: 2,
    canBuild: true,
  },

  // DOCUMENT TOOLS
  pdfBuilder: {
    name: 'PDF Builder Pro',
    description: 'Create, edit, merge, split PDFs with AI-powered content generation',
    features: ['AI content', 'Form filling', 'Merge/split', 'Digital signatures'],
    credits: 1,
    repo: 'crav-pdf-builder',
    canBuild: true,
  },
  legalease: {
    name: 'LegalEase',
    description: 'AI-powered legal document translation - plain English to legal and back',
    features: ['Plain English translation', 'Legal term glossary', 'Document analysis', 'Risk highlighting'],
    credits: 2,
    repo: 'crav-legalease',
    url: 'https://legalease.craudiovizai.com',
    canBuild: true,
  },
  resumeBuilder: {
    name: 'Resume Builder',
    description: 'ATS-optimized resumes with professional templates',
    features: ['ATS optimization', 'Industry templates', 'Skills matching', 'PDF export'],
    credits: 2,
    canBuild: true,
  },

  // MARKETING TOOLS
  emailWriter: {
    name: 'Email Writer',
    description: 'AI-powered email campaigns, sequences, and templates',
    features: ['AI copywriting', 'A/B testing', 'Personalization', 'Analytics'],
    credits: 1,
    canBuild: true,
  },
  adCopyGenerator: {
    name: 'Ad Copy Generator',
    description: 'Generate high-converting ad copy for any platform',
    features: ['Platform optimization', 'Headline variations', 'CTA suggestions', 'Compliance check'],
    credits: 1,
    canBuild: true,
  },
  seoContentWriter: {
    name: 'SEO Content Writer',
    description: 'SEO-optimized articles, blog posts, and web content',
    features: ['Keyword optimization', 'Readability scoring', 'Meta descriptions', 'Internal linking'],
    credits: 3,
    canBuild: true,
  },

  // ANALYTICS & INTELLIGENCE
  marketOracle: {
    name: 'Market Oracle',
    description: 'AI-powered stock analysis and predictions',
    features: ['AI predictions', 'Technical analysis', 'News sentiment', 'Portfolio tracking'],
    credits: 5,
    repo: 'crav-market-oracle',
    url: 'https://marketoracle.craudiovizai.com',
    canBuild: true,
  },
  competitiveIntelligence: {
    name: 'Competitive Intelligence',
    description: 'Track competitors, features, pricing, news, and market position',
    features: ['Competitor tracking', 'Feature comparison', 'Price monitoring', 'News alerts'],
    credits: 3,
    repo: 'crav-competitive-intelligence',
    canBuild: true,
  },

  // REAL ESTATE
  realtorPlatform: {
    name: 'CR Realtor Platform',
    description: 'Complete realtor solution beating Zillow with AI and social impact',
    features: ['Property listings', 'Lead management', 'Market analysis', 'Client portal', 'Document management'],
    price: '$49/month',
    repo: 'cr-realtor-platform',
    url: 'https://crrealtor.com',
    isSubscription: true,
  },
  propertyFlyerCreator: {
    name: 'Property Flyer Creator',
    description: 'Professional real estate flyers and marketing materials',
    features: ['MLS integration', 'QR codes', 'Print-ready export', 'Brand templates'],
    credits: 1,
    canBuild: true,
  },
  openHouseSignIn: {
    name: 'Open House Sign-In',
    description: 'Digital sign-in for open houses with lead capture',
    features: ['Digital forms', 'Lead scoring', 'CRM integration', 'Follow-up automation'],
    credits: 1,
    canBuild: true,
  },

  // VERIFICATION & TESTING
  verifyforge: {
    name: 'VerifyForge AI',
    description: 'AI-powered testing platform for websites, apps, and games',
    features: ['Automated testing', 'Visual regression', 'Performance monitoring', 'Bug detection'],
    credits: 3,
    repo: 'crav-verifyforge',
    canBuild: true,
  },

  // NEWS & INFORMATION
  cravNews: {
    name: 'CRAV News',
    description: 'Professional news aggregator with web and mobile apps',
    features: ['Multi-source aggregation', 'Category filtering', 'Offline reading', 'Push notifications'],
    repo: 'crav-news',
    canBuild: true,
  },
  newsCompare: {
    name: 'News Compare',
    description: 'Conservative vs Liberal news comparison with international reporting',
    features: ['Side-by-side comparison', 'Bias detection', 'International sources', 'Topic tracking'],
    repo: 'crav-news-compare',
    canBuild: true,
  },

  // ENTERTAINMENT
  disneyDealTracker: {
    name: 'Disney Deal Tracker',
    description: 'AI-powered Disney World resort deal tracker with price alerts',
    features: ['6 source tracking', 'Price alerts', 'ML predictions', 'Promo code finder'],
    repo: 'crav-disney-deal-tracker',
    url: 'https://disneydealtracker.com',
    free: true,
  },
  gamesHub: {
    name: 'Games Hub',
    description: '1,200+ games platform with achievements and social features',
    features: ['1,200+ games', 'Achievements', 'Leaderboards', 'Social features'],
    repo: 'crav-games',
    free: true,
  },

  // VIRTUAL WORLD - CRAIVERSE
  craiverse: {
    name: 'CRAIverse',
    description: 'Virtual world with 20 social impact modules',
    modules: [
      'Veterans Support Hub',
      'First Responders Network', 
      'Faith-Based Community',
      'Animal Rescue Connect',
      'Youth Mentorship',
      'Senior Support',
      'Disability Resources',
      'Mental Health Hub',
      'Addiction Recovery',
      'Homeless Services',
      'Food Security Network',
      'Education Access',
      'Job Training Center',
      'Financial Literacy',
      'Housing Assistance',
      'Healthcare Navigation',
      'Legal Aid Connect',
      'Immigration Support',
      'Disaster Relief',
      'Environmental Action',
    ],
    free: true,
  },

  // INFRASTRUCTURE
  exportEngine: {
    name: 'Export Engine',
    description: 'Universal export library - PSD, AI, SVG, PDF, EPUB, MOBI with print specs',
    features: ['Multi-format export', 'Print specs', 'High-res images', 'Batch processing'],
    repo: 'crav-export-engine',
    internal: true,
  },
  brandSystem: {
    name: 'Brand System',
    description: 'Universal brand management - colors, fonts, logos, guidelines',
    features: ['Brand kits', 'Auto-apply', 'Guidelines generation', 'Asset management'],
    repo: 'crav-brand-system',
    internal: true,
  },
  creditsSystem: {
    name: 'Universal Credits System',
    description: 'Unified credits across all CR AudioViz apps',
    features: ['Cross-app credits', 'Usage tracking', 'Auto-refill', 'Enterprise billing'],
    repo: 'crav-components',
    internal: true,
  },
};

// ============================================================================
// PRICING & PLANS
// ============================================================================

const PRICING = {
  plans: {
    free: {
      name: 'Free',
      price: 0,
      credits: 5,
      features: [
        '5 credits to try',
        'Chat with Javari',
        'Save conversations',
        'Basic support',
      ],
      limitations: [
        'No code export',
        'No custom domains',
        'Credits don\'t renew',
      ],
    },
    starter: {
      name: 'Starter',
      price: 29,
      credits: 100,
      features: [
        '100 credits/month',
        'All tools access',
        'Hosted apps',
        'Email support',
        'Credits never expire',
      ],
      limitations: [
        'View code only (no export)',
        'No custom domains',
      ],
    },
    pro: {
      name: 'Pro',
      price: 49,
      credits: 500,
      features: [
        '500 credits/month',
        'All tools access',
        'Export code (ZIP)',
        'Custom domains',
        'Priority support',
        'API access',
        'Credits never expire',
      ],
      popular: true,
    },
    business: {
      name: 'Business',
      price: 199,
      credits: 2000,
      features: [
        '2,000 credits/month',
        'Everything in Pro',
        'GitHub repo sync',
        'Team members (5)',
        'White-label options',
        'Dedicated support',
        'SLA guarantee',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      price: 499,
      credits: 'unlimited',
      features: [
        'Unlimited credits',
        'Deploy to your infrastructure',
        'Unlimited team members',
        'Custom integrations',
        'On-premise option',
        'Dedicated account manager',
        '24/7 phone support',
      ],
    },
  },
  creditPacks: {
    small: { credits: 10, price: 15 },
    medium: { credits: 50, price: 60 },
    large: { credits: 200, price: 200 },
  },
};

// ============================================================================
// SYSTEM PROMPT - THE COMPLETE JAVARI BRAIN
// ============================================================================

const SYSTEM_PROMPT = `You are JAVARI - the AI that DELIVERS for CR AudioViz AI.

## YOUR IDENTITY
- Name: Javari AI
- Platform: CR AudioViz AI (craudiovizai.com)
- Tagline: "Your Story. Our Design."
- Mission: Help everyone create professional digital content

## YOUR CORE PRINCIPLES
1. DON'T LIE - Be honest. If you don't know, say so, then find out.
2. DON'T CHEAT - Do the real work. Quality matters.
3. DON'T STEAL - Be original. Respect others' work.
4. DELIVER - Every customer gets results. Period.

## MONETIZATION RULES - CRITICAL

**Free Chat Policy:**
- Answer questions freely
- Explain concepts and give advice
- Help users plan what they want to build
- Show what's possible

**Building Requires Account + Credits:**
When a user asks you to BUILD, CREATE, or MAKE something (app, tool, document, etc.):

1. If NO ACCOUNT (guest):
   - Warmly describe what you WOULD build
   - List the features it would have
   - Explain the value they'd get
   - Invite them to sign up: "To build this for you, you'll need a CR AudioViz account."
   - Link: https://craudiovizai.com/signup
   - Mention: "Plans start at $29/month with 100 credits"

2. If ACCOUNT but NO CREDITS:
   - Describe what you'd build
   - Tell them the credit cost
   - Show their current balance (0)
   - Offer upgrade: "Upgrade to keep building!"
   - Link: https://craudiovizai.com/pricing

3. If ACCOUNT + CREDITS:
   - BUILD IT IMMEDIATELY
   - Deploy to production
   - Give them the live URL
   - Show credits used and remaining

**Code Protection:**
- NEVER give complete deployable code to guests or users without credits
- You CAN show code snippets to explain concepts
- You CAN discuss how something works technically
- Full working code only gets deployed for paying users

**Be Warm, Never Pushy:**
✓ "I'd love to build that for you!"
✓ "Here's what that would include..."
✓ "To make this happen, you'll need..."
✗ "You must pay first"
✗ "Access denied"
✗ "I can't help you"

## EVERYTHING YOU CAN BUILD

**Business Tools:**
- Invoice Generator (1 credit) - Professional invoices with templates, tax calculations, PDF export
- Proposal Builder (2 credits) - Winning proposals with executive summaries, pricing tables
- Contract Generator (2 credits) - Legal contracts with customizable terms
- Business Plan Creator (5 credits) - Full business plans with financials

**Creative Tools:**
- Logo Studio (3 credits) - AI-powered logos in multiple styles
- Social Graphics (1 credit) - Templates for all social platforms
- eBook Creator (5 credits) - Create and publish eBooks
- Presentation Maker (2 credits) - Professional slide decks
- Thumbnail Generator (1 credit) - YouTube/social thumbnails

**Document Tools:**
- PDF Builder Pro (1 credit) - Create, edit, merge, split PDFs
- LegalEase (2 credits) - Legal document translation to plain English
- Resume Builder (2 credits) - ATS-optimized resumes

**Marketing Tools:**
- Email Writer (1 credit) - AI email campaigns
- Ad Copy Generator (1 credit) - High-converting ad copy
- SEO Content Writer (3 credits) - SEO-optimized articles

**Analytics Tools:**
- Market Oracle (5 credits) - AI stock analysis
- Competitive Intelligence (3 credits) - Track competitors

**Real Estate:**
- CR Realtor Platform ($49/mo) - Complete realtor solution
- Property Flyer Creator (1 credit) - Real estate marketing
- Open House Sign-In (1 credit) - Digital lead capture

**Calculators & Utilities:**
- Mortgage Calculator (1 credit)
- ROI Calculator (1 credit)
- Unit Converter (1 credit)
- Any custom calculator (1-2 credits)

**Web Applications:**
- Landing Pages (2-5 credits)
- Dashboards (5-10 credits)
- Forms & Surveys (1-3 credits)
- Booking Systems (5-10 credits)
- And literally anything else they need

## PRICING TO REMEMBER

**Plans:**
- Free: 5 credits to try, no renewal
- Starter: $29/mo - 100 credits, all tools
- Pro: $49/mo - 500 credits, export code, custom domains (MOST POPULAR)
- Business: $199/mo - 2,000 credits, team features, GitHub sync
- Enterprise: $499+/mo - Unlimited, deploy to their infrastructure

**Credit Packs (one-time):**
- 10 credits: $15
- 50 credits: $60
- 200 credits: $200

## FREE RESOURCES (No Account Needed)
- Disney Deal Tracker - https://disneydealtracker.com
- Games Hub - 1,200+ free games
- CRAIverse social impact modules
- Chatting with you (Javari)

## YOUR VOICE
- Direct and confident
- Warm and helpful
- Results-focused
- Never preachy or lecturing
- Excited to build things
- Honest about limitations

## WHEN BUILDING APPS

If user has credits and asks to build, use this format:

\`\`\`deploy:AppName.tsx
'use client';
import React, { useState } from 'react';

export default function AppName() {
  // Complete, working React component
  // Use Tailwind CSS for styling
  // Make it production-ready
}
\`\`\`

The system will deploy it automatically and give them a live URL.

Now go deliver!`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserCredits(userId: string): Promise<{ credits: number; plan: string } | null> {
  if (!userId) return null;
  
  try {
    const { data } = await supabase
      .from('user_credits')
      .select('balance, plan')
      .eq('user_id', userId)
      .single();
    
    return data ? { credits: data.balance, plan: data.plan } : null;
  } catch {
    return null;
  }
}

async function deductCredits(userId: string, amount: number, description: string): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    if (!current || current.balance < amount) return false;
    
    await supabase
      .from('user_credits')
      .update({ balance: current.balance - amount })
      .eq('user_id', userId);
    
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -amount,
        description,
        balance_after: current.balance - amount,
      });
    
    return true;
  } catch {
    return false;
  }
}

function detectBuildIntent(message: string): { isBuild: boolean; appType?: string; credits?: number } {
  const m = message.toLowerCase();
  
  const buildPhrases = [
    'build me', 'create me', 'make me', 'build a', 'create a', 'make a',
    'i need an app', 'i need a tool', 'i need a website',
    'can you build', 'can you create', 'can you make',
    'develop', 'deploy', 'launch',
  ];
  
  const isBuild = buildPhrases.some(p => m.includes(p));
  
  if (!isBuild) return { isBuild: false };
  
  // Detect app type and estimate credits
  if (m.includes('calculator') || m.includes('converter')) {
    return { isBuild: true, appType: 'calculator', credits: 1 };
  }
  if (m.includes('invoice')) {
    return { isBuild: true, appType: 'invoice generator', credits: 1 };
  }
  if (m.includes('landing page') || m.includes('website')) {
    return { isBuild: true, appType: 'landing page', credits: 3 };
  }
  if (m.includes('dashboard')) {
    return { isBuild: true, appType: 'dashboard', credits: 5 };
  }
  if (m.includes('form') || m.includes('survey')) {
    return { isBuild: true, appType: 'form', credits: 2 };
  }
  if (m.includes('logo')) {
    return { isBuild: true, appType: 'logo', credits: 3 };
  }
  if (m.includes('proposal')) {
    return { isBuild: true, appType: 'proposal', credits: 2 };
  }
  if (m.includes('contract')) {
    return { isBuild: true, appType: 'contract', credits: 2 };
  }
  
  return { isBuild: true, appType: 'custom app', credits: 3 };
}

function selectAI(message: string): string {
  const m = message.toLowerCase();
  if (/\b(current|today|latest|price|news|weather|stock)\b/.test(m)) return 'perplexity';
  if (/\b(build|create|code|component|deploy|app|website|tool)\b/.test(m)) return 'claude';
  return 'gpt4';
}

// ============================================================================
// AI PROVIDER CALLS
// ============================================================================

async function callClaude(messages: any[], system: string): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { content: '', error: 'Anthropic API key not configured' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        system,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { content: '', error: `Claude API error: ${res.status}` };
    }

    const data = await res.json();
    return { content: data.content?.[0]?.text || '' };
  } catch (error: any) {
    return { content: '', error: error.message };
  }
}

async function callOpenAI(messages: any[], system: string): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { content: '', error: 'OpenAI API key not configured' };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: system },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 4000,
      })
    });

    if (!res.ok) {
      return { content: '', error: `OpenAI API error: ${res.status}` };
    }

    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || '' };
  } catch (error: any) {
    return { content: '', error: error.message };
  }
}

async function callPerplexity(query: string): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { content: '', error: 'Perplexity API key not configured' };

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [{ role: 'user', content: query }],
        max_tokens: 2000
      })
    });

    if (!res.ok) {
      return { content: '', error: `Perplexity API error: ${res.status}` };
    }

    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || '' };
  } catch (error: any) {
    return { content: '', error: error.message };
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, userId, conversationId } = body;
    
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const buildIntent = detectBuildIntent(lastMessage);
    const ai = selectAI(lastMessage);
    
    // Check user credits for build requests
    let userCredits = null;
    let canBuild = false;
    
    if (userId) {
      userCredits = await getUserCredits(userId);
      if (userCredits && buildIntent.credits) {
        canBuild = userCredits.credits >= buildIntent.credits;
      }
    }
    
    // Enhance system prompt with user context
    let enhancedPrompt = SYSTEM_PROMPT;
    
    if (buildIntent.isBuild) {
      if (!userId) {
        // Guest user trying to build
        enhancedPrompt += `\n\n## CURRENT CONTEXT
The user is a GUEST (not logged in) and is asking to build something.
DO NOT build the app. Instead:
1. Warmly describe what you WOULD build with exciting features
2. Explain it would cost approximately ${buildIntent.credits} credit(s)
3. Invite them to sign up at https://craudiovizai.com/signup
4. Mention plans start at $29/month with 100 credits`;
      } else if (!canBuild) {
        // User without enough credits
        enhancedPrompt += `\n\n## CURRENT CONTEXT
The user has an account but only ${userCredits?.credits || 0} credits.
This build would cost ${buildIntent.credits} credits.
DO NOT build the app. Instead:
1. Describe what you'd build
2. Mention it costs ${buildIntent.credits} credits
3. Show their balance: ${userCredits?.credits || 0} credits
4. Offer upgrade options at https://craudiovizai.com/pricing`;
      } else {
        // User can build!
        enhancedPrompt += `\n\n## CURRENT CONTEXT
The user has ${userCredits?.credits} credits and wants to build something.
This will cost ${buildIntent.credits} credits.
BUILD THE APP! Create complete, production-ready code.
After building, they'll have ${(userCredits?.credits || 0) - (buildIntent.credits || 0)} credits remaining.`;
      }
    }
    
    // Call appropriate AI
    let result: { content: string; error?: string };
    
    if (ai === 'perplexity') {
      result = await callPerplexity(lastMessage);
    } else if (ai === 'claude') {
      result = await callClaude(messages, enhancedPrompt);
    } else {
      result = await callOpenAI(messages, enhancedPrompt);
    }
    
    // Fallback
    if (!result.content && result.error) {
      result = ai !== 'claude' 
        ? await callClaude(messages, enhancedPrompt)
        : await callOpenAI(messages, enhancedPrompt);
    }
    
    if (!result.content) {
      return NextResponse.json({
        content: `I'm having trouble right now. Error: ${result.error}. Please try again.`,
        provider: 'error'
      });
    }
    
    // Deduct credits if build was successful
    if (buildIntent.isBuild && canBuild && userId && result.content.includes('deploy:')) {
      await deductCredits(userId, buildIntent.credits || 0, `Built: ${buildIntent.appType}`);
    }
    
    return NextResponse.json({
      content: result.content,
      provider: ai,
      buildIntent,
      creditsUsed: (buildIntent.isBuild && canBuild) ? buildIntent.credits : 0,
      creditsRemaining: userCredits ? userCredits.credits - (buildIntent.credits || 0) : null,
    });
    
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
      provider: 'error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '3.0',
    name: 'Javari AI',
    capabilities: [
      'multi-ai-routing',
      'build-detection', 
      'credit-management',
      'auto-deployment',
      'full-product-knowledge',
    ],
    products: Object.keys(CR_PRODUCTS).length,
  });
}
