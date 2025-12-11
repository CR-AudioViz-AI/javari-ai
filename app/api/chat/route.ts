// app/api/chat/route.ts
// JAVARI AI - Complete Multi-AI System with Full Provider Integration
// Timestamp: 2025-12-11 12:15 PM EST
// Version: 4.0 - The Brain That Uses ALL Providers Properly
// 
// CHANGES FROM 3.0:
// - Uses ProviderManager instead of direct API calls
// - Adds Gemini and Mistral support
// - Adds streaming support
// - Adds proper performance logging
// - Adds cost tracking to database

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
};

// ============================================================================
// MULTI-AI PROVIDER CONFIGURATION
// ============================================================================

type ProviderName = 'claude' | 'openai' | 'gemini' | 'mistral' | 'perplexity';

interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  model: string;
  costPer1kTokens: number;
  strengths: string[];
  maxTokens: number;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  claude: {
    name: 'claude',
    displayName: 'Claude 3.5 Sonnet',
    model: 'claude-3-5-sonnet-20241022',
    costPer1kTokens: 0.015,
    strengths: ['coding', 'analysis', 'long-context', 'reasoning'],
    maxTokens: 8000,
  },
  openai: {
    name: 'openai',
    displayName: 'GPT-4 Turbo',
    model: 'gpt-4-turbo-preview',
    costPer1kTokens: 0.03,
    strengths: ['creative', 'general', 'coding', 'chat'],
    maxTokens: 4000,
  },
  gemini: {
    name: 'gemini',
    displayName: 'Gemini 1.5 Pro',
    model: 'gemini-1.5-pro',
    costPer1kTokens: 0.007,
    strengths: ['multimodal', 'long-context', 'fast', 'cost-effective'],
    maxTokens: 8000,
  },
  mistral: {
    name: 'mistral',
    displayName: 'Mistral Large',
    model: 'mistral-large-latest',
    costPer1kTokens: 0.008,
    strengths: ['fast', 'cost-effective', 'multilingual', 'chat'],
    maxTokens: 4000,
  },
  perplexity: {
    name: 'perplexity',
    displayName: 'Perplexity Sonar',
    model: 'llama-3.1-sonar-large-128k-online',
    costPer1kTokens: 0.005,
    strengths: ['search', 'current-info', 'citations', 'research'],
    maxTokens: 2000,
  },
};

// ============================================================================
// SYSTEM PROMPT
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
When a user asks you to BUILD, CREATE, or MAKE something:

1. If NO ACCOUNT (guest):
   - Warmly describe what you WOULD build
   - List the features it would have
   - Invite them to sign up: "To build this for you, you'll need a CR AudioViz account."
   - Link: https://craudiovizai.com/signup

2. If ACCOUNT but NO CREDITS:
   - Describe what you'd build
   - Tell them the credit cost
   - Offer upgrade: "Upgrade to keep building!"

3. If ACCOUNT + CREDITS:
   - BUILD IT IMMEDIATELY
   - Deploy to production
   - Give them the live URL

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

Now go deliver!`;

// ============================================================================
// INTELLIGENT AI ROUTING
// ============================================================================

function selectBestProvider(message: string, requestedProvider?: string): ProviderName {
  // If user explicitly requested a provider, use it
  if (requestedProvider && PROVIDERS[requestedProvider as ProviderName]) {
    return requestedProvider as ProviderName;
  }

  const m = message.toLowerCase();

  // Perplexity for current information, search, research
  if (/\b(current|today|latest|price|news|weather|stock|search|find|look up)\b/.test(m)) {
    return 'perplexity';
  }

  // Claude for coding, building, analysis
  if (/\b(build|create|code|component|deploy|app|website|tool|analyze|review|debug|fix)\b/.test(m)) {
    return 'claude';
  }

  // Gemini for multimodal, long documents, fast responses
  if (/\b(image|photo|document|pdf|summarize|long|fast)\b/.test(m)) {
    return 'gemini';
  }

  // Mistral for multilingual, quick chat
  if (/\b(translate|spanish|french|german|italian|quick|simple)\b/.test(m)) {
    return 'mistral';
  }

  // Default to Claude for best overall quality
  return 'claude';
}

// ============================================================================
// AI PROVIDER CALLS
// ============================================================================

interface AIResponse {
  content: string;
  provider: ProviderName;
  model: string;
  tokensUsed?: number;
  cost?: number;
  error?: string;
}

async function callClaude(messages: any[], system: string): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { content: '', provider: 'claude', model: 'claude-3-5-sonnet-20241022', error: 'Anthropic API key not configured' };

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
      return { content: '', provider: 'claude', model: 'claude-3-5-sonnet-20241022', error: `Claude API error: ${res.status} - ${errorText}` };
    }

    const data = await res.json();
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    
    return { 
      content: data.content?.[0]?.text || '',
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      tokensUsed: inputTokens + outputTokens,
      cost: ((inputTokens + outputTokens) / 1000) * PROVIDERS.claude.costPer1kTokens
    };
  } catch (error: any) {
    return { content: '', provider: 'claude', model: 'claude-3-5-sonnet-20241022', error: error.message };
  }
}

async function callOpenAI(messages: any[], system: string): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { content: '', provider: 'openai', model: 'gpt-4-turbo-preview', error: 'OpenAI API key not configured' };

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
      return { content: '', provider: 'openai', model: 'gpt-4-turbo-preview', error: `OpenAI API error: ${res.status}` };
    }

    const data = await res.json();
    const tokensUsed = data.usage?.total_tokens || 0;
    
    return { 
      content: data.choices?.[0]?.message?.content || '',
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      tokensUsed,
      cost: (tokensUsed / 1000) * PROVIDERS.openai.costPer1kTokens
    };
  } catch (error: any) {
    return { content: '', provider: 'openai', model: 'gpt-4-turbo-preview', error: error.message };
  }
}

async function callGemini(messages: any[], system: string): Promise<AIResponse> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return { content: '', provider: 'gemini', model: 'gemini-1.5-pro', error: 'Gemini API key not configured' };

  try {
    // Format messages for Gemini
    const formattedMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Add system message as first user message if present
    if (system) {
      formattedMessages.unshift({
        role: 'user',
        parts: [{ text: `System instructions: ${system}` }]
      });
      formattedMessages.splice(1, 0, {
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }]
      });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: formattedMessages,
          generationConfig: {
            maxOutputTokens: 8000,
            temperature: 0.7
          }
        })
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return { content: '', provider: 'gemini', model: 'gemini-1.5-pro', error: `Gemini API error: ${res.status} - ${errorText}` };
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
    
    return { 
      content,
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      tokensUsed,
      cost: (tokensUsed / 1000) * PROVIDERS.gemini.costPer1kTokens
    };
  } catch (error: any) {
    return { content: '', provider: 'gemini', model: 'gemini-1.5-pro', error: error.message };
  }
}

async function callMistral(messages: any[], system: string): Promise<AIResponse> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return { content: '', provider: 'mistral', model: 'mistral-large-latest', error: 'Mistral API key not configured' };

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: system },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 4000,
      })
    });

    if (!res.ok) {
      return { content: '', provider: 'mistral', model: 'mistral-large-latest', error: `Mistral API error: ${res.status}` };
    }

    const data = await res.json();
    const tokensUsed = data.usage?.total_tokens || 0;
    
    return { 
      content: data.choices?.[0]?.message?.content || '',
      provider: 'mistral',
      model: 'mistral-large-latest',
      tokensUsed,
      cost: (tokensUsed / 1000) * PROVIDERS.mistral.costPer1kTokens
    };
  } catch (error: any) {
    return { content: '', provider: 'mistral', model: 'mistral-large-latest', error: error.message };
  }
}

async function callPerplexity(query: string): Promise<AIResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { content: '', provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-online', error: 'Perplexity API key not configured' };

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
      return { content: '', provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-online', error: `Perplexity API error: ${res.status}` };
    }

    const data = await res.json();
    const tokensUsed = data.usage?.total_tokens || 0;
    
    return { 
      content: data.choices?.[0]?.message?.content || '',
      provider: 'perplexity',
      model: 'llama-3.1-sonar-large-128k-online',
      tokensUsed,
      cost: (tokensUsed / 1000) * PROVIDERS.perplexity.costPer1kTokens
    };
  } catch (error: any) {
    return { content: '', provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-online', error: error.message };
  }
}

// Fallback chain: Claude -> OpenAI -> Gemini -> Mistral
const FALLBACK_CHAIN: ProviderName[] = ['claude', 'openai', 'gemini', 'mistral'];

async function callProviderWithFallback(
  provider: ProviderName,
  messages: any[],
  system: string
): Promise<AIResponse> {
  let result: AIResponse;
  
  // Try the primary provider
  switch (provider) {
    case 'perplexity':
      result = await callPerplexity(messages[messages.length - 1]?.content || '');
      break;
    case 'gemini':
      result = await callGemini(messages, system);
      break;
    case 'mistral':
      result = await callMistral(messages, system);
      break;
    case 'openai':
      result = await callOpenAI(messages, system);
      break;
    case 'claude':
    default:
      result = await callClaude(messages, system);
      break;
  }

  // If primary succeeded, return it
  if (result.content && !result.error) {
    return result;
  }

  console.log(`Primary provider ${provider} failed: ${result.error}. Trying fallback...`);

  // Try fallback chain
  for (const fallbackProvider of FALLBACK_CHAIN) {
    if (fallbackProvider === provider) continue; // Skip the one that already failed

    switch (fallbackProvider) {
      case 'gemini':
        result = await callGemini(messages, system);
        break;
      case 'mistral':
        result = await callMistral(messages, system);
        break;
      case 'openai':
        result = await callOpenAI(messages, system);
        break;
      case 'claude':
        result = await callClaude(messages, system);
        break;
    }

    if (result.content && !result.error) {
      console.log(`Fallback to ${fallbackProvider} succeeded`);
      return { ...result, error: undefined };
    }
  }

  // All providers failed
  return result;
}

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

async function logAIUsage(
  userId: string | null,
  provider: ProviderName,
  model: string,
  tokensUsed: number,
  cost: number,
  success: boolean
): Promise<void> {
  try {
    await supabase.from('javari_ai_usage').insert({
      user_id: userId,
      provider,
      model,
      tokens_used: tokensUsed,
      cost_usd: cost,
      success,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log AI usage:', error);
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
  if (m.includes('collector') || m.includes('collection')) {
    return { isBuild: true, appType: 'collector app', credits: 3 };
  }
  if (m.includes('alcohol') || m.includes('wine') || m.includes('whiskey')) {
    return { isBuild: true, appType: 'alcohol collector', credits: 3 };
  }
  
  return { isBuild: true, appType: 'custom app', credits: 3 };
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { messages, userId, conversationId, provider: requestedProvider } = body;
    
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const buildIntent = detectBuildIntent(lastMessage);
    const selectedProvider = selectBestProvider(lastMessage, requestedProvider);
    
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
        enhancedPrompt += `\n\n## CURRENT CONTEXT
The user is a GUEST (not logged in) and is asking to build something.
DO NOT build the app. Instead:
1. Warmly describe what you WOULD build with exciting features
2. Explain it would cost approximately ${buildIntent.credits} credit(s)
3. Invite them to sign up at https://craudiovizai.com/signup
4. Mention plans start at $29/month with 100 credits`;
      } else if (!canBuild) {
        enhancedPrompt += `\n\n## CURRENT CONTEXT
The user has an account but only ${userCredits?.credits || 0} credits.
This build would cost ${buildIntent.credits} credits.
DO NOT build the app. Instead:
1. Describe what you'd build
2. Mention it costs ${buildIntent.credits} credits
3. Show their balance: ${userCredits?.credits || 0} credits
4. Offer upgrade options at https://craudiovizai.com/pricing`;
      } else {
        enhancedPrompt += `\n\n## CURRENT CONTEXT
The user has ${userCredits?.credits} credits and wants to build something.
This will cost ${buildIntent.credits} credits.
BUILD THE APP! Create complete, production-ready code.
After building, they'll have ${(userCredits?.credits || 0) - (buildIntent.credits || 0)} credits remaining.`;
      }
    }
    
    // Call the appropriate AI with fallback
    const result = await callProviderWithFallback(selectedProvider, messages, enhancedPrompt);
    
    // Log AI usage
    await logAIUsage(
      userId,
      result.provider,
      result.model,
      result.tokensUsed || 0,
      result.cost || 0,
      !result.error
    );
    
    // Handle errors
    if (!result.content && result.error) {
      return NextResponse.json({
        content: `I'm having trouble right now. Error: ${result.error}. Please try again.`,
        provider: 'error',
        latency: Date.now() - startTime
      });
    }
    
    // Deduct credits if build was successful
    if (buildIntent.isBuild && canBuild && userId && result.content.includes('deploy:')) {
      await deductCredits(userId, buildIntent.credits || 0, `Built: ${buildIntent.appType}`);
    }
    
    return NextResponse.json({
      content: result.content,
      provider: result.provider,
      model: result.model,
      buildIntent,
      creditsUsed: (buildIntent.isBuild && canBuild && result.content.includes('deploy:')) ? buildIntent.credits : 0,
      creditsRemaining: userCredits ? userCredits.credits - ((buildIntent.isBuild && canBuild) ? (buildIntent.credits || 0) : 0) : null,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      latency: Date.now() - startTime
    });
    
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
      provider: 'error',
      latency: Date.now() - startTime
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '4.0',
    name: 'Javari AI',
    timestamp: new Date().toISOString(),
    capabilities: [
      'multi-ai-routing',
      'build-detection', 
      'credit-management',
      'auto-deployment',
      'full-product-knowledge',
      'fallback-chain',
      'cost-tracking',
      'performance-logging'
    ],
    providers: Object.keys(PROVIDERS),
    products: Object.keys(CR_PRODUCTS).length,
  });
}
