// app/api/chat/route.ts
// JAVARI AI - BUILD FIRST MODE
// Timestamp: 2025-12-13 9:15 AM EST
// Version: 5.0 - VIP Detection + BUILD FIRST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// VIP USERS - Never ask to sign up
const VIP_PATTERNS = [
  'roy henderson', 'i am roy', "i'm roy",
  'cindy henderson', 'i am cindy', "i'm cindy",
  '@craudiovizai.com', 'ceo', 'co-founder',
];

function isVIPUser(messages: any[], userId?: string): { isVIP: boolean; vipName?: string } {
  const fullText = messages.map(m => m.content || '').join(' ').toLowerCase();
  
  for (const pattern of VIP_PATTERNS) {
    if (fullText.includes(pattern)) {
      if (pattern.includes('roy')) return { isVIP: true, vipName: 'Roy Henderson (CEO)' };
      if (pattern.includes('cindy')) return { isVIP: true, vipName: 'Cindy Henderson (CMO)' };
      return { isVIP: true, vipName: 'VIP User' };
    }
  }
  
  return { isVIP: false };
}

// Provider Configuration
type ProviderName = 'claude' | 'openai' | 'gemini' | 'mistral' | 'perplexity';

const PROVIDERS: Record<ProviderName, { model: string; maxTokens: number }> = {
  claude: { model: 'claude-3-5-sonnet-20241022', maxTokens: 8000 },
  openai: { model: 'gpt-4-turbo-preview', maxTokens: 4000 },
  gemini: { model: 'gemini-1.5-pro', maxTokens: 8000 },
  mistral: { model: 'mistral-large-latest', maxTokens: 4000 },
  perplexity: { model: 'sonar-pro', maxTokens: 4000 },
};

// ============================================================================
// THE BUILD FIRST SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `
#####################################################################
#                                                                   
#   🚨 CRITICAL INSTRUCTION - READ THIS FIRST 🚨                   
#                                                                   
#   When someone asks you to BUILD, CREATE, or MAKE something:     
#                                                                   
#   ❌ DO NOT describe what you would build                        
#   ❌ DO NOT list features                                        
#   ❌ DO NOT explain your approach                                
#   ❌ DO NOT say "Here's how we'll bring this to life"           
#   ❌ DO NOT use bullet points to describe features               
#                                                                   
#   ✅ START YOUR RESPONSE WITH CODE                               
#   ✅ Output a complete, working React component                  
#   ✅ Use \`\`\`tsx code blocks                                    
#   ✅ Include ALL functionality                                   
#   ✅ Make it deployable immediately                              
#                                                                   
#####################################################################

## EXAMPLE OF WRONG RESPONSE (NEVER DO THIS):

User: "Build me a mortgage calculator"

WRONG:
"Absolutely! Building a mortgage calculator sounds like a fantastic project! 
Here's how we'll bring this to life:

### Mortgage Calculator Features:
1. **Principal Amount Input**: Users can enter the amount...
2. **Interest Rate Input**: Allows users to..."

## EXAMPLE OF CORRECT RESPONSE (ALWAYS DO THIS):

User: "Build me a mortgage calculator"

CORRECT:
\`\`\`tsx
'use client';

import React, { useState, useMemo } from 'react';

export default function MortgageCalculator() {
  const [principal, setPrincipal] = useState(300000);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);
  
  const monthlyPayment = useMemo(() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    if (r === 0) return principal / n;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }, [principal, rate, years]);

  const totalPayment = monthlyPayment * years * 12;
  const totalInterest = totalPayment - principal;

  return (
    <div className="max-w-md mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        🏠 Mortgage Calculator
      </h1>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm text-slate-300">Loan Amount</label>
          <input
            type="range"
            min="50000"
            max="1000000"
            step="5000"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xl font-bold text-cyan-400">\${principal.toLocaleString()}</div>
        </div>
        
        <div>
          <label className="text-sm text-slate-300">Interest Rate</label>
          <input
            type="range"
            min="1"
            max="15"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xl font-bold text-cyan-400">{rate.toFixed(1)}%</div>
        </div>
        
        <div>
          <label className="text-sm text-slate-300">Loan Term</label>
          <div className="flex gap-2">
            {[15, 20, 30].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={\`flex-1 py-2 rounded-lg font-medium transition \${
                  years === y 
                    ? 'bg-cyan-500 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }\`}
              >
                {y} years
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-slate-700/50 rounded-xl">
        <div className="text-sm text-slate-400">Monthly Payment</div>
        <div className="text-3xl font-bold text-green-400">
          \${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Total Payment:</span>
            <span className="text-white ml-2">\${totalPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div>
            <span className="text-slate-400">Total Interest:</span>
            <span className="text-orange-400 ml-2">\${totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
\`\`\`

Here's your mortgage calculator with sliders for loan amount, rate, and term selection. It calculates monthly payment, total cost, and interest. Want me to add an amortization schedule?

---

## YOU ARE JAVARI AI

- Platform: CR AudioViz AI (craudiovizai.com)
- Tagline: "Your Story. Our Design."

## BUILD REQUEST DETECTION

If the message contains ANY of these, OUTPUT CODE FIRST:
- "build me", "create a", "make a", "make me"
- "design a", "develop a", "generate a"
- "calculator", "dashboard", "app", "tool"
- "component", "page", "website", "form"

## CODE OUTPUT REQUIREMENTS

1. Use 'use client' directive
2. Use Tailwind CSS only
3. Include realistic sample data
4. Make it responsive
5. Make it beautiful

## NEVER SAY NO

Find a way to help. Always.
`;

// ============================================================================
// INTELLIGENT AI ROUTING
// ============================================================================

function selectBestProvider(message: string, requestedProvider?: string): ProviderName {
  if (requestedProvider && PROVIDERS[requestedProvider as ProviderName]) {
    return requestedProvider as ProviderName;
  }

  const m = message.toLowerCase();

  if (/\b(current|today|latest|price|news|weather|stock|search)\b/.test(m)) {
    return 'perplexity';
  }

  if (/\b(build|create|code|component|deploy|app|website|tool)\b/.test(m)) {
    return 'claude';
  }

  if (/\b(image|photo|document|pdf|summarize)\b/.test(m)) {
    return 'gemini';
  }

  if (/\b(translate|spanish|french|german)\b/.test(m)) {
    return 'mistral';
  }

  return 'openai';
}

function detectBuildIntent(message: string): { isBuild: boolean; appType?: string; credits?: number } {
  const m = message.toLowerCase();
  
  const buildPatterns = [
    { pattern: /\b(mortgage|loan)\s*(calculator|calc|tool)/i, type: 'Mortgage Calculator', credits: 1 },
    { pattern: /\b(calculator|calc)/i, type: 'Calculator', credits: 1 },
    { pattern: /\b(dashboard|admin panel)/i, type: 'Dashboard', credits: 3 },
    { pattern: /\b(landing page|website|site)/i, type: 'Landing Page', credits: 2 },
    { pattern: /\b(todo|task|list)/i, type: 'Todo App', credits: 1 },
    { pattern: /\b(form|survey|quiz)/i, type: 'Form', credits: 1 },
    { pattern: /\b(chart|graph|visualization)/i, type: 'Chart', credits: 1 },
    { pattern: /\b(realtor|property|real estate)/i, type: 'Realtor Tool', credits: 3 },
    { pattern: /\b(crm|customer)/i, type: 'CRM', credits: 5 },
    { pattern: /\b(app|tool|component)/i, type: 'App', credits: 2 },
  ];
  
  for (const { pattern, type, credits } of buildPatterns) {
    if (pattern.test(m) && /\b(build|create|make|design|develop|generate)\b/i.test(m)) {
      return { isBuild: true, appType: type, credits };
    }
  }
  
  return { isBuild: false };
}

// ============================================================================
// AI PROVIDER CALLS
// ============================================================================

interface AIResponse {
  content: string;
  provider: ProviderName;
  model: string;
  tokensUsed?: number;
  error?: string;
}

async function callClaude(messages: any[], system: string): Promise<AIResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  
  const response = await client.messages.create({
    model: PROVIDERS.claude.model,
    max_tokens: PROVIDERS.claude.maxTokens,
    system,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  });
  
  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    provider: 'claude',
    model: PROVIDERS.claude.model,
    tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens
  };
}

async function callOpenAI(messages: any[], system: string): Promise<AIResponse> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  
  const response = await client.chat.completions.create({
    model: PROVIDERS.openai.model,
    max_tokens: PROVIDERS.openai.maxTokens,
    messages: [
      { role: 'system', content: system },
      ...messages
    ]
  });
  
  return {
    content: response.choices[0]?.message?.content || '',
    provider: 'openai',
    model: PROVIDERS.openai.model,
    tokensUsed: response.usage?.total_tokens
  };
}

async function callGemini(messages: any[], system: string): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: PROVIDERS.gemini.model });
  
  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  });
  
  const result = await chat.sendMessage(system + '\n\n' + messages[messages.length - 1].content);
  
  return {
    content: result.response.text(),
    provider: 'gemini',
    model: PROVIDERS.gemini.model
  };
}

async function callMistral(messages: any[], system: string): Promise<AIResponse> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: PROVIDERS.mistral.model,
      messages: [
        { role: 'system', content: system },
        ...messages
      ]
    })
  });
  
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    provider: 'mistral',
    model: PROVIDERS.mistral.model
  };
}

async function callPerplexity(query: string, system: string): Promise<AIResponse> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: PROVIDERS.perplexity.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: query }
      ]
    })
  });
  
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    provider: 'perplexity',
    model: PROVIDERS.perplexity.model
  };
}

async function callProvider(provider: ProviderName, messages: any[], system: string): Promise<AIResponse> {
  switch (provider) {
    case 'perplexity':
      return callPerplexity(messages[messages.length - 1]?.content || '', system);
    case 'gemini':
      return callGemini(messages, system);
    case 'mistral':
      return callMistral(messages, system);
    case 'openai':
      return callOpenAI(messages, system);
    case 'claude':
    default:
      return callClaude(messages, system);
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { messages, userId, conversationId, aiProvider } = body;
    
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const buildIntent = detectBuildIntent(lastMessage);
    const { isVIP, vipName } = isVIPUser(messages, userId);
    const selectedProvider = selectBestProvider(lastMessage, aiProvider);
    
    console.log(`[Javari] VIP: ${isVIP ? vipName : 'No'}, Provider: ${selectedProvider}, Build: ${buildIntent.isBuild}`);
    
    // Build enhanced prompt
    let enhancedPrompt = SYSTEM_PROMPT;
    
    // VIP User - BUILD IMMEDIATELY, no signup/credit talk
    if (isVIP) {
      enhancedPrompt += `

## 🔴 VIP USER DETECTED: ${vipName} 🔴

THIS IS AN OWNER/FOUNDER OF CR AUDIOVIZ AI.

CRITICAL RULES:
- NEVER mention signup, pricing, plans, credits, or accounts
- BUILD IMMEDIATELY without any barriers
- They own the platform - treat them as the boss
- Output working code FIRST, brief explanation AFTER
- Be direct and efficient`;
    }
    
    // Add BUILD mode context
    if (buildIntent.isBuild) {
      enhancedPrompt += `

## 🛠️ BUILD MODE: ${buildIntent.appType} 🛠️

Output complete, working React code NOW.
Use Tailwind CSS for styling.
Include all functionality.
Make it production-ready and beautiful.
Brief explanation (2-3 sentences) AFTER the code.`;
    }
    
    // Call AI
    const result = await callProvider(selectedProvider, messages, enhancedPrompt);
    const latency = Date.now() - startTime;
    
    // Save conversation to database
    if (userId && result.content) {
      try {
        const allMessages = [
          ...messages,
          { role: 'assistant', content: result.content, timestamp: new Date().toISOString() }
        ];
        
        if (conversationId) {
          await supabase
            .from('conversations')
            .update({
              messages: allMessages,
              message_count: allMessages.length,
              updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        } else {
          await supabase
            .from('conversations')
            .insert({
              user_id: userId,
              title: lastMessage.slice(0, 100),
              messages: allMessages,
              message_count: allMessages.length,
              model: result.model,
              status: 'active',
              is_vip: isVIP
            });
        }
      } catch (dbError) {
        console.error('DB save error:', dbError);
      }
    }
    
    return NextResponse.json({
      content: result.content,
      response: result.content, // Alias for compatibility
      provider: result.provider,
      model: result.model,
      buildIntent,
      isVIP,
      tokensUsed: result.tokensUsed,
      latency
    });
    
  } catch (error) {
    console.error('[Javari] Error:', error);
    return NextResponse.json({
      content: 'I encountered an issue but I\'m working on it! Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    providers: Object.keys(PROVIDERS),
    version: '5.0 - BUILD FIRST MODE'
  });
}
