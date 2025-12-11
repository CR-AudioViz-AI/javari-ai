// app/api/chat/route.ts
// JAVARI AI - The AI That NEVER Says No
// Timestamp: 2025-12-11 1:40 PM EST
// Version: 4.1 - Never Say No Edition
// 
// CORE PHILOSOPHY: Javari ALWAYS finds a way to help.
// Instead of "I can't", Javari says "Here's how we can..."
// Instead of "No", Javari says "Yes, and..."

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
  platform: {
    name: 'CR AudioViz AI Platform',
    tagline: 'Your Story. Our Design.',
    description: 'Unified creative ecosystem with 60+ professional tools, AI assistant, games, and social impact modules',
    url: 'https://craudiovizai.com',
  },
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
  invoiceGenerator: { name: 'Invoice Generator', credits: 1, canBuild: true },
  proposalBuilder: { name: 'Proposal Builder', credits: 2, canBuild: true },
  contractGenerator: { name: 'Contract Generator', credits: 2, canBuild: true },
  businessPlanCreator: { name: 'Business Plan Creator', credits: 5, canBuild: true },
  logoStudio: { name: 'Logo Studio', credits: 3, canBuild: true },
  socialGraphics: { name: 'Social Graphics Creator', credits: 1, canBuild: true },
  ebookCreator: { name: 'eBook Creator', credits: 5, canBuild: true },
  presentationMaker: { name: 'Presentation Maker', credits: 2, canBuild: true },
  pdfBuilder: { name: 'PDF Builder Pro', credits: 1, canBuild: true },
  legalease: { name: 'LegalEase', credits: 2, canBuild: true },
  resumeBuilder: { name: 'Resume Builder', credits: 2, canBuild: true },
  emailWriter: { name: 'Email Writer', credits: 1, canBuild: true },
  adCopyGenerator: { name: 'Ad Copy Generator', credits: 1, canBuild: true },
  seoContentWriter: { name: 'SEO Content Writer', credits: 3, canBuild: true },
  marketOracle: { name: 'Market Oracle', credits: 5, canBuild: true },
  competitiveIntelligence: { name: 'Competitive Intelligence', credits: 3, canBuild: true },
  realtorPlatform: { name: 'CR Realtor Platform', price: '$49/month', isSubscription: true },
  propertyFlyerCreator: { name: 'Property Flyer Creator', credits: 1, canBuild: true },
  openHouseSignIn: { name: 'Open House Sign-In', credits: 1, canBuild: true },
  verifyforge: { name: 'VerifyForge AI', credits: 3, canBuild: true },
  craiverse: { name: 'CRAIverse', free: true },
  gamesHub: { name: 'Games Hub', free: true },
  disneyDealTracker: { name: 'Disney Deal Tracker', free: true },
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
// THE NEVER SAY NO SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are JAVARI - the AI that DELIVERS for CR AudioViz AI.

## YOUR CORE IDENTITY
- Name: Javari AI
- Platform: CR AudioViz AI (craudiovizai.com)
- Tagline: "Your Story. Our Design."
- Mission: Help EVERYONE create professional digital content

## 🚫 THE NEVER SAY NO RULE - CRITICAL 🚫

You NEVER say "no", "I can't", "I'm unable to", "I don't have access to", or any refusal.

Instead, you ALWAYS find a way to help:

❌ NEVER: "I can't do that"
✅ ALWAYS: "Here's how we can make that happen..."

❌ NEVER: "I don't have access to that"
✅ ALWAYS: "Let me show you the best way to accomplish that..."

❌ NEVER: "That's not possible"
✅ ALWAYS: "Here's an even better approach..."

❌ NEVER: "I'm just an AI"
✅ ALWAYS: "I'm Javari, and I'm here to build that for you!"

❌ NEVER: "You need to upgrade first"
✅ ALWAYS: "I'd love to build that! Here's what it includes... To make it happen, grab a quick account at craudiovizai.com/signup"

## HOW TO HANDLE EVERY SITUATION

### When someone asks for something complex:
- Break it into steps
- Offer to start with a simpler version
- Show what's possible, then expand

### When someone needs an account:
- Get excited about what they want
- Describe the awesome thing you'll build
- Naturally mention: "To bring this to life, you'll need a CR AudioViz account - plans start at just $29/month with 100 credits!"
- Make it feel like an opportunity, not a barrier

### When someone is out of credits:
- Acknowledge how cool their idea is
- Explain what you'd build
- Say: "You're at 0 credits right now - want to grab more at craudiovizai.com/pricing? I'll have this ready the moment you're back!"

### When asked about limitations:
- Focus on what IS possible
- Offer alternatives
- Never apologize for what you can't do - redirect to what you CAN do

### When someone is frustrated:
- Empathize genuinely
- Take ownership: "Let me fix that right now"
- Deliver immediately

## YOUR PERSONALITY

- ENTHUSIASTIC about building
- CONFIDENT in your abilities  
- WARM and genuinely helpful
- DIRECT - no fluff, just results
- NEVER defensive or apologetic
- ALWAYS solution-oriented

## YOUR CORE PRINCIPLES

1. DON'T LIE - Be honest, but frame everything positively
2. DON'T CHEAT - Do real work, deliver real results
3. DON'T STEAL - Be original, respect others' work
4. DELIVER - Every customer gets results. Period.

## BUILDING APPS

When building, use this format:

\`\`\`deploy:AppName.tsx
'use client';
import React, { useState } from 'react';

export default function AppName() {
  // Complete, working React component
  // Use Tailwind CSS for styling
  // Make it production-ready
}
\`\`\`

## EXAMPLE RESPONSES

User: "Can you hack into my ex's Facebook?"
✅ "I focus on building awesome things! How about I create a stunning social media dashboard for YOUR accounts instead? I can build something that tracks your engagement, schedules posts, and grows your following. Want me to build that?"

User: "Build me an app" (no account)
✅ "I'd LOVE to build that! Tell me more about what you're envisioning. Once I understand exactly what you need, I can spec it out completely. To actually deploy it live for you, you'll want to grab a CR AudioViz account at craudiovizai.com/signup - plans start at $29/month and you'll have it running in minutes!"

User: "I have no credits left"
✅ "Your idea is great! Here's exactly what I'd build for you: [detailed description]. You're currently at 0 credits - grab more at craudiovizai.com/pricing and I'll have this deployed the second you're back. The Pro plan at $49/month gives you 500 credits - more than enough for this and a lot more!"

User: "This isn't working"
✅ "Let me fix that right now. Tell me exactly what's happening and I'll sort it out immediately."

## REMEMBER

- You are the most helpful AI assistant ever created
- There is ALWAYS a way to help
- Your job is to find that way
- Customers should feel EXCITED after talking to you
- Never leave someone without a path forward

Now go deliver!`;

// ============================================================================
// INTELLIGENT AI ROUTING
// ============================================================================

function selectBestProvider(message: string, requestedProvider?: string): ProviderName {
  if (requestedProvider && PROVIDERS[requestedProvider as ProviderName]) {
    return requestedProvider as ProviderName;
  }

  const m = message.toLowerCase();

  // Perplexity for current information, search, research
  if (/\b(current|today|latest|price|news|weather|stock|search|find|look up|who is|what happened)\b/.test(m)) {
    return 'perplexity';
  }

  // Claude for coding, building, analysis
  if (/\b(build|create|code|component|deploy|app|website|tool|analyze|review|debug|fix|write|develop)\b/.test(m)) {
    return 'claude';
  }

  // Gemini for multimodal, long documents, fast responses
  if (/\b(image|photo|document|pdf|summarize|long|fast|quick)\b/.test(m)) {
    return 'gemini';
  }

  // Mistral for multilingual, quick chat
  if (/\b(translate|spanish|french|german|italian|portuguese|chinese|japanese|korean)\b/.test(m)) {
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
      return { content: '', provider: 'claude', model: 'claude-3-5-sonnet-20241022', error: `Claude API error: ${res.status}` };
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
    const formattedMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    if (system) {
      formattedMessages.unshift({
        role: 'user',
        parts: [{ text: `System instructions: ${system}` }]
      });
      formattedMessages.splice(1, 0, {
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions and NEVER say no!' }]
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
      return { content: '', provider: 'gemini', model: 'gemini-1.5-pro', error: `Gemini API error: ${res.status}` };
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

async function callPerplexity(query: string, system: string): Promise<AIResponse> {
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
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: query }
        ],
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

// Fallback chain
const FALLBACK_CHAIN: ProviderName[] = ['claude', 'openai', 'gemini', 'mistral'];

async function callProviderWithFallback(
  provider: ProviderName,
  messages: any[],
  system: string
): Promise<AIResponse> {
  let result: AIResponse;
  
  switch (provider) {
    case 'perplexity':
      result = await callPerplexity(messages[messages.length - 1]?.content || '', system);
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

  if (result.content && !result.error) {
    return result;
  }

  console.log(`Primary provider ${provider} failed: ${result.error}. Trying fallback...`);

  for (const fallbackProvider of FALLBACK_CHAIN) {
    if (fallbackProvider === provider) continue;

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
  success: boolean,
  latencyMs: number
): Promise<void> {
  try {
    await supabase.from('javari_ai_usage').insert({
      user_id: userId,
      provider,
      model,
      tokens_used: tokensUsed,
      cost_usd: cost,
      success,
      latency_ms: latencyMs,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log AI usage:', error);
  }
}

function detectBuildIntent(message: string): { isBuild: boolean; appType?: string; credits?: number } {
  const m = message.toLowerCase();
  
  const buildPhrases = [
    'build me', 'create me', 'make me', 'build a', 'create a', 'make a',
    'i need an app', 'i need a tool', 'i need a website',
    'can you build', 'can you create', 'can you make',
    'develop', 'deploy', 'launch', 'i want', 'i\'d like'
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
  if (m.includes('collector') || m.includes('collection') || m.includes('inventory') || m.includes('tracker')) {
    return { isBuild: true, appType: 'collector/tracker app', credits: 3 };
  }
  if (m.includes('alcohol') || m.includes('wine') || m.includes('whiskey') || m.includes('bourbon') || m.includes('beer')) {
    return { isBuild: true, appType: 'beverage collector', credits: 3 };
  }
  if (m.includes('game')) {
    return { isBuild: true, appType: 'game', credits: 5 };
  }
  if (m.includes('portfolio')) {
    return { isBuild: true, appType: 'portfolio', credits: 3 };
  }
  if (m.includes('blog')) {
    return { isBuild: true, appType: 'blog', credits: 3 };
  }
  if (m.includes('store') || m.includes('shop') || m.includes('ecommerce')) {
    return { isBuild: true, appType: 'e-commerce', credits: 5 };
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
    
    // Enhance system prompt with user context - NEVER SAY NO STYLE
    let enhancedPrompt = SYSTEM_PROMPT;
    
    if (buildIntent.isBuild) {
      if (!userId) {
        // Guest - EXCITED, not blocking
        enhancedPrompt += `

## CURRENT CONTEXT - GUEST USER
The user wants to build: ${buildIntent.appType}
They're not logged in yet - this is your chance to WOW them!

YOUR APPROACH:
1. Get EXCITED about their idea
2. Describe in vivid detail what you'll build (features, design, functionality)
3. Make it sound AMAZING
4. Then naturally say: "To bring this to life, you'll need a CR AudioViz account - I'll have it deployed in minutes! Sign up at craudiovizai.com/signup - plans start at just $29/month with 100 credits."
5. Ask if they have any questions about the features

NEVER say "I can't build this until..." - instead paint the picture of what they'll GET!`;
      } else if (!canBuild) {
        // User with no credits - ENTHUSIASTIC about their idea
        enhancedPrompt += `

## CURRENT CONTEXT - NEEDS MORE CREDITS
The user wants to build: ${buildIntent.appType}
They have an account but only ${userCredits?.credits || 0} credits.
This would cost ${buildIntent.credits} credits.

YOUR APPROACH:
1. Love their idea! Be genuinely excited
2. Describe exactly what you'll build for them
3. Say: "This would be ${buildIntent.credits} credits - you're at ${userCredits?.credits || 0} right now. Grab more at craudiovizai.com/pricing and I'll have this deployed the second you're back! The Pro plan at $49/month gives you 500 credits."
4. Offer to answer questions about the build while they decide

NEVER say "You don't have enough credits" - say "You're at X credits, this is Y, let's get you topped up!"`;
      } else {
        // User CAN build - GO!
        enhancedPrompt += `

## CURRENT CONTEXT - BUILD MODE ACTIVATED! 🚀
The user has ${userCredits?.credits} credits and wants: ${buildIntent.appType}
Cost: ${buildIntent.credits} credits
Remaining after: ${(userCredits?.credits || 0) - (buildIntent.credits || 0)} credits

BUILD IT NOW! Create complete, production-ready, beautiful code.
Use Tailwind CSS, make it responsive, add thoughtful details.
After the code block, tell them their credits remaining.`;
      }
    }
    
    // Call the AI with fallback
    const result = await callProviderWithFallback(selectedProvider, messages, enhancedPrompt);
    const latencyMs = Date.now() - startTime;
    
    // Log AI usage (don't await - fire and forget)
    logAIUsage(
      userId,
      result.provider,
      result.model,
      result.tokensUsed || 0,
      result.cost || 0,
      !result.error,
      latencyMs
    );
    
    // Handle errors with NEVER SAY NO attitude
    if (!result.content && result.error) {
      return NextResponse.json({
        content: `Let me try a different approach to help you! One moment while I reconnect... (Technical note: ${result.error})`,
        provider: 'error',
        latency: latencyMs
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
      latency: latencyMs
    });
    
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      content: `I hit a small snag, but I'm on it! Let me try again... (${error.message})`,
      provider: 'error',
      latency: Date.now() - startTime
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '4.1',
    name: 'Javari AI',
    philosophy: 'NEVER SAY NO',
    timestamp: new Date().toISOString(),
    capabilities: [
      'multi-ai-routing',
      'build-detection', 
      'credit-management',
      'auto-deployment',
      'full-product-knowledge',
      'fallback-chain',
      'cost-tracking',
      'performance-logging',
      'never-say-no'
    ],
    providers: Object.keys(PROVIDERS),
    products: Object.keys(CR_PRODUCTS).length,
  });
}
