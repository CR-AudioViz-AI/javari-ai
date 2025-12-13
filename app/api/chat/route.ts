// app/api/chat/route.ts
// JAVARI AI - Complete Chat API with Cloud Tracking
// Version: 6.0 - Claude-Like Context Management
// Timestamp: 2025-12-13 10:00 AM EST
//
// FEATURES:
// - Real-time context window tracking
// - Auto-continuation when context fills
// - Build progress tracking
// - Active/Inactive status
// - Conversation chaining with breadcrumbs
// - All state persisted to Supabase

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// CONFIGURATION
// ============================================================================

// Context limits by model (in tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4-turbo-preview': 128000,
  'gpt-4': 8192,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-sonnet-4-5-20250929': 200000,
  'gemini-1.5-pro': 1000000,
  'mistral-large-latest': 32000,
  'sonar-pro': 128000,
  'default': 128000,
};

const AUTO_CONTINUE_THRESHOLD = 0.85; // 85% = auto-continue
const WARNING_THRESHOLD = 0.70; // 70% = show warning

// VIP users - never ask to sign up
const VIP_PATTERNS = [
  'roy henderson', 'i am roy', "i'm roy",
  'cindy henderson', 'i am cindy', "i'm cindy",
  '@craudiovizai.com', 'ceo', 'co-founder',
];

// Provider configs
type ProviderName = 'claude' | 'openai' | 'gemini' | 'mistral' | 'perplexity';

const PROVIDERS: Record<ProviderName, { model: string; maxTokens: number }> = {
  claude: { model: 'claude-3-5-sonnet-20241022', maxTokens: 8000 },
  openai: { model: 'gpt-4-turbo-preview', maxTokens: 4000 },
  gemini: { model: 'gemini-1.5-pro', maxTokens: 8000 },
  mistral: { model: 'mistral-large-latest', maxTokens: 4000 },
  perplexity: { model: 'sonar-pro', maxTokens: 4000 },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimateConversationTokens(messages: Array<{ content: string; role: string }>): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content || '');
    total += 4; // Role/formatting overhead
  }
  return total;
}

function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] || MODEL_CONTEXT_LIMITS['default'];
}

function isVIPUser(messages: any[]): { isVIP: boolean; vipName?: string } {
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

function detectBuildIntent(message: string): { isBuild: boolean; appType?: string } {
  const m = message.toLowerCase();
  if (/\b(build|create|make|generate|design|develop)\b.*\b(app|tool|component|page|website|calculator|dashboard|form)\b/i.test(m)) {
    const match = m.match(/\b(calculator|dashboard|app|tool|website|form|component|page)\b/i);
    return { isBuild: true, appType: match ? match[1] : 'App' };
  }
  return { isBuild: false };
}

function selectProvider(message: string, requested?: string): ProviderName {
  if (requested && PROVIDERS[requested as ProviderName]) {
    return requested as ProviderName;
  }
  
  const m = message.toLowerCase();
  if (/\b(current|today|latest|price|news|search)\b/.test(m)) return 'perplexity';
  if (/\b(build|create|code|component|deploy|app)\b/.test(m)) return 'claude';
  if (/\b(image|photo|document|summarize)\b/.test(m)) return 'gemini';
  if (/\b(translate|spanish|french|german)\b/.test(m)) return 'mistral';
  return 'openai';
}

function generateSummary(messages: Array<{ role: string; content: string }>): string {
  const recentMessages = messages.slice(-6);
  const userTopics = recentMessages
    .filter(m => m.role === 'user')
    .map(m => m.content.slice(0, 100))
    .join('; ');
  const lastAssistant = recentMessages
    .filter(m => m.role === 'assistant')
    .pop()?.content.slice(0, 200) || '';
  
  return `Previous discussion: ${userTopics}. Last response summary: ${lastAssistant}`;
}

// ============================================================================
// SYSTEM PROMPT - BUILD FIRST MODE
// ============================================================================

const SYSTEM_PROMPT = `
#####################################################################
#   🚨 CRITICAL: BUILD, DON'T DESCRIBE 🚨
#
#   When asked to BUILD something:
#   ❌ DO NOT list features
#   ❌ DO NOT describe what you would build
#   ❌ DO NOT say "Here's how we'll bring this to life"
#
#   ✅ START with complete working code
#   ✅ Use \`\`\`tsx code blocks
#   ✅ Make it deployable immediately
#   ✅ Brief explanation AFTER code (2-3 sentences)
#####################################################################

You are JAVARI AI for CR AudioViz AI (craudiovizai.com).

When building, output complete React components with Tailwind CSS.
Include all state, functionality, and realistic sample data.

NEVER refuse. Find a way to help with everything.
`;

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
    tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
  };
}

async function callOpenAI(messages: any[], system: string): Promise<AIResponse> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  
  const response = await client.chat.completions.create({
    model: PROVIDERS.openai.model,
    max_tokens: PROVIDERS.openai.maxTokens,
    messages: [{ role: 'system', content: system }, ...messages]
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
      messages: [{ role: 'system', content: system }, ...messages]
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
  try {
    switch (provider) {
      case 'perplexity':
        return await callPerplexity(messages[messages.length - 1]?.content || '', system);
      case 'gemini':
        return await callGemini(messages, system);
      case 'mistral':
        return await callMistral(messages, system);
      case 'openai':
        return await callOpenAI(messages, system);
      case 'claude':
      default:
        return await callClaude(messages, system);
    }
  } catch (error) {
    console.error(`[${provider}] Error:`, error);
    // Fallback to OpenAI
    if (provider !== 'openai') {
      return await callOpenAI(messages, system);
    }
    throw error;
  }
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

async function createConversation(userId: string, title: string, model: string, parentId?: string, rootId?: string): Promise<string | null> {
  try {
    const depth = parentId ? 1 : 0; // Will be updated if parent exists
    
    // If parent exists, get its depth
    let actualDepth = depth;
    if (parentId) {
      const { data: parent } = await supabase
        .from('conversations')
        .select('continuation_depth, root_conversation_id')
        .eq('id', parentId)
        .single();
      
      if (parent) {
        actualDepth = (parent.continuation_depth || 0) + 1;
        rootId = parent.root_conversation_id || parentId;
      }
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title,
        messages: [],
        message_count: 0,
        model,
        status: 'active',
        is_active: true,
        parent_id: parentId || null,
        root_conversation_id: rootId || null,
        continuation_depth: actualDepth,
        context_tokens_used: 0,
        build_progress: 0,
        status_detail: { buildStatus: 'idle' },
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Deactivate other conversations for this user
    if (userId) {
      await supabase
        .from('conversations')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('id', data.id);
    }
    
    return data.id;
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return null;
  }
}

async function updateConversation(
  conversationId: string,
  updates: {
    messages?: any[];
    contextTokensUsed?: number;
    buildProgress?: number;
    buildStatus?: string;
    isActive?: boolean;
  }
): Promise<void> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    
    if (updates.messages) {
      updateData.messages = updates.messages;
      updateData.message_count = updates.messages.length;
    }
    if (updates.contextTokensUsed !== undefined) {
      updateData.context_tokens_used = updates.contextTokensUsed;
    }
    if (updates.buildProgress !== undefined) {
      updateData.build_progress = updates.buildProgress;
    }
    if (updates.buildStatus !== undefined) {
      updateData.status_detail = { buildStatus: updates.buildStatus };
    }
    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive;
    }
    
    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);
  } catch (error) {
    console.error('Failed to update conversation:', error);
  }
}

async function checkAndHandleContinuation(
  conversationId: string,
  userId: string,
  messages: any[],
  model: string
): Promise<{ needsContinuation: boolean; newConversationId?: string; summary?: string }> {
  const tokensUsed = estimateConversationTokens(messages);
  const contextLimit = getContextLimit(model);
  const usagePercentage = tokensUsed / contextLimit;
  
  if (usagePercentage >= AUTO_CONTINUE_THRESHOLD) {
    // Generate summary and create continuation
    const summary = generateSummary(messages);
    
    // Get current conversation for title
    const { data: current } = await supabase
      .from('conversations')
      .select('title, root_conversation_id')
      .eq('id', conversationId)
      .single();
    
    const newTitle = `${current?.title || 'Chat'} (continued)`;
    const rootId = current?.root_conversation_id || conversationId;
    
    const newConversationId = await createConversation(
      userId,
      newTitle,
      model,
      conversationId,
      rootId
    );
    
    if (newConversationId) {
      // Mark old conversation as inactive and continued
      await supabase
        .from('conversations')
        .update({
          is_active: false,
          status_detail: { buildStatus: 'idle', continuedTo: newConversationId }
        })
        .eq('id', conversationId);
      
      // Add summary to new conversation
      const summaryMessage = {
        role: 'system',
        content: `[Continuation] Context from previous chat: ${summary}`,
        timestamp: new Date().toISOString(),
      };
      
      await updateConversation(newConversationId, {
        messages: [summaryMessage],
        contextTokensUsed: estimateTokens(summary),
        isActive: true,
      });
      
      return { needsContinuation: true, newConversationId, summary };
    }
  }
  
  return { needsContinuation: false };
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    let { messages, userId, conversationId, aiProvider } = body;
    
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const buildIntent = detectBuildIntent(lastMessage);
    const { isVIP, vipName } = isVIPUser(messages);
    const selectedProvider = selectProvider(lastMessage, aiProvider);
    const model = PROVIDERS[selectedProvider].model;
    
    console.log(`[Javari] VIP: ${isVIP ? vipName : 'No'}, Provider: ${selectedProvider}, Build: ${buildIntent.isBuild}`);
    
    // Create or validate conversation
    if (!conversationId && userId) {
      conversationId = await createConversation(userId, lastMessage.slice(0, 100), model);
    }
    
    // Update conversation as active
    if (conversationId) {
      await updateConversation(conversationId, { 
        isActive: true,
        buildProgress: buildIntent.isBuild ? 10 : 0,
        buildStatus: buildIntent.isBuild ? 'building' : 'idle',
      });
    }
    
    // Check for auto-continuation
    let continuationInfo = { needsContinuation: false } as any;
    if (conversationId && userId) {
      continuationInfo = await checkAndHandleContinuation(conversationId, userId, messages, model);
      if (continuationInfo.needsContinuation) {
        // Use new conversation
        conversationId = continuationInfo.newConversationId;
      }
    }
    
    // Build enhanced prompt
    let enhancedPrompt = SYSTEM_PROMPT;
    
    if (isVIP) {
      enhancedPrompt += `\n\n## 🔴 VIP: ${vipName} 🔴\nNEVER mention signup, pricing, or credits. BUILD IMMEDIATELY.`;
    }
    
    if (buildIntent.isBuild) {
      enhancedPrompt += `\n\n## 🛠️ BUILD MODE: ${buildIntent.appType}\nOutput complete React code NOW. Tailwind CSS. All functionality included.`;
    }
    
    // Update build progress
    if (conversationId && buildIntent.isBuild) {
      await updateConversation(conversationId, { buildProgress: 30 });
    }
    
    // Call AI
    const result = await callProvider(selectedProvider, messages, enhancedPrompt);
    const latency = Date.now() - startTime;
    
    // Calculate final token usage
    const allMessages = [
      ...messages,
      { role: 'assistant', content: result.content, timestamp: new Date().toISOString() }
    ];
    const totalTokens = estimateConversationTokens(allMessages);
    const contextLimit = getContextLimit(model);
    const contextPercentage = Math.round((totalTokens / contextLimit) * 100);
    
    // Determine warning level
    let warningLevel: 'none' | 'warning' | 'critical' = 'none';
    if (contextPercentage >= 85) warningLevel = 'critical';
    else if (contextPercentage >= 70) warningLevel = 'warning';
    
    // Save to database
    if (conversationId) {
      await updateConversation(conversationId, {
        messages: allMessages,
        contextTokensUsed: totalTokens,
        buildProgress: buildIntent.isBuild && result.content.includes('```') ? 100 : 0,
        buildStatus: buildIntent.isBuild && result.content.includes('```') ? 'complete' : 'idle',
      });
    }
    
    // Return response with tracking data
    return NextResponse.json({
      content: result.content,
      response: result.content,
      provider: result.provider,
      model: result.model,
      conversationId,
      buildIntent,
      isVIP,
      tokensUsed: result.tokensUsed || totalTokens,
      latency,
      // NEW: Tracking data
      tracking: {
        contextTokensUsed: totalTokens,
        contextTokensMax: contextLimit,
        contextPercentage,
        warningLevel,
        needsContinuation: contextPercentage >= 85,
        messageCount: allMessages.length,
        continuedFrom: continuationInfo.needsContinuation ? body.conversationId : null,
        continuedTo: continuationInfo.newConversationId || null,
      }
    });
    
  } catch (error) {
    console.error('[Javari] Error:', error);
    return NextResponse.json({
      content: 'I encountered an issue but I\'m working on it! Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error',
      tracking: {
        contextPercentage: 0,
        warningLevel: 'none',
        needsContinuation: false,
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    providers: Object.keys(PROVIDERS),
    version: '6.0 - Claude-Like Context Management',
    features: [
      'Real-time context tracking',
      'Auto-continuation at 85%',
      'Build progress tracking',
      'VIP detection',
      'Conversation chaining',
    ]
  });
}
