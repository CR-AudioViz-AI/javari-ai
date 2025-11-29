// app/api/chat/route.ts
// Javari AI Chat API - ENHANCED with Full System Prompt & Knowledge Retrieval
// Timestamp: 2025-11-29 15:40 UTC
// ENHANCED: Added automatic background learning from conversations
// FIX: Corrected javari_knowledge table reference and column names

import { NextRequest, NextResponse } from 'next/server';
import { ChatService, AutonomousService } from '@/lib/javari-services';
import { JAVARI_SYSTEM_PROMPT } from '@/lib/javari-system-prompt';
import { createClient } from '@supabase/supabase-js';
import { learnFromConversation } from '@/lib/javari-learning';

// Initialize Supabase client for knowledge retrieval
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Platform apps for context (loaded from database)
let cachedApps: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Knowledge cache
let cachedKnowledge: any[] | null = null;
let knowledgeCacheTimestamp = 0;

async function getAppsContext(): Promise<string> {
  const now = Date.now();
  
  // Use cache if valid
  if (cachedApps && (now - cacheTimestamp) < CACHE_TTL) {
    return formatAppsContext(cachedApps);
  }

  try {
    const { data: apps } = await supabase
      .from('apps')
      .select('name, slug, description, category, url, is_active')
      .eq('is_active', true)
      .order('category');

    cachedApps = apps || [];
    cacheTimestamp = now;
    return formatAppsContext(cachedApps);
  } catch (error) {
    console.error('Error fetching apps:', error);
    return '';
  }
}

function formatAppsContext(apps: any[]): string {
  if (!apps.length) return '';
  
  const byCategory: Record<string, any[]> = {};
  apps.forEach(app => {
    const cat = app.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(app);
  });

  let context = '\n\n## CURRENT PLATFORM APPS (Live in Database)\n';
  for (const [category, categoryApps] of Object.entries(byCategory)) {
    context += `\n### ${category}\n`;
    categoryApps.forEach(app => {
      context += `- **${app.name}** (${app.slug}): ${app.description || 'No description'}\n`;
      if (app.url) context += `  URL: ${app.url}\n`;
    });
  }
  return context;
}

async function getRelevantKnowledge(query: string): Promise<string> {
  const now = Date.now();
  
  try {
    // Use cache if valid (knowledge doesn't change often)
    if (cachedKnowledge && (now - knowledgeCacheTimestamp) < CACHE_TTL) {
      return formatKnowledgeContext(cachedKnowledge, query);
    }

    // Query the correct table: javari_knowledge (not javari_knowledge_base)
    // With correct column names: topic, subtopic, concept, explanation
    const { data: knowledge, error } = await supabase
      .from('javari_knowledge')
      .select('id, topic, subtopic, concept, explanation, examples, best_practices, tags, keywords')
      .eq('verified', true)
      .order('topic');

    if (error) {
      console.error('Error fetching knowledge:', error);
      return '';
    }

    if (!knowledge || knowledge.length === 0) {
      return '';
    }

    cachedKnowledge = knowledge;
    knowledgeCacheTimestamp = now;
    
    return formatKnowledgeContext(knowledge, query);
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    return '';
  }
}

function formatKnowledgeContext(knowledge: any[], query: string): string {
  if (!knowledge || knowledge.length === 0) return '';

  // Simple relevance scoring based on query keywords
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const scored = knowledge.map(k => {
    let score = 0;
    const searchableText = [
      k.topic,
      k.subtopic,
      k.concept,
      k.explanation,
      ...(k.keywords || []),
      ...(k.tags || [])
    ].join(' ').toLowerCase();

    // Score based on keyword matches
    queryWords.forEach(word => {
      if (searchableText.includes(word)) score += 1;
    });

    // Boost for exact topic/concept matches
    if (k.topic?.toLowerCase().includes(queryLower)) score += 5;
    if (k.concept?.toLowerCase().includes(queryLower)) score += 3;

    return { ...k, score };
  });

  // Sort by relevance and take top 5
  const relevant = scored
    .filter(k => k.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // If no relevant matches, include core knowledge (Founders, Company, Values)
  const coreTpics = ['Founders', 'Company', 'Values', 'Platform'];
  const coreKnowledge = relevant.length === 0 
    ? knowledge.filter(k => coreTpics.includes(k.topic)).slice(0, 4)
    : relevant;

  if (coreKnowledge.length === 0) return '';

  let context = '\n\n## JAVARI KNOWLEDGE BASE (Verified)\n';
  
  // Group by topic for cleaner output
  const byTopic: Record<string, any[]> = {};
  coreKnowledge.forEach(k => {
    const topic = k.topic || 'General';
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(k);
  });

  for (const [topic, items] of Object.entries(byTopic)) {
    context += `\n### ${topic}\n`;
    items.forEach(k => {
      context += `**${k.concept}**: ${k.explanation}\n`;
      if (k.examples && k.examples.length > 0) {
        context += `Examples: ${k.examples.join(', ')}\n`;
      }
    });
  }

  return context;
}


// Background learning - don't block the response
async function triggerBackgroundLearning(
  userMessage: string,
  assistantResponse: string,
  conversationId?: string
): Promise<void> {
  // Only learn from substantive conversations (not greetings, not too short)
  if (userMessage.length < 20 || assistantResponse.length < 50) {
    return;
  }

  // Skip learning for certain patterns
  const skipPatterns = [
    /^(hi|hello|hey|good morning|good evening)/i,
    /^(thanks|thank you|okay|ok|got it)/i,
    /^(yes|no|maybe|sure)/i
  ];
  
  if (skipPatterns.some(p => p.test(userMessage.trim()))) {
    return;
  }

  // Fire and forget - don't await
  learnFromConversation({
    conversationId: conversationId || `chat_${Date.now()}`,
    userMessage,
    assistantResponse,
    wasHelpful: true, // Assume helpful by default, can be updated by feedback
    solutionWorked: true
  }).then(result => {
    if (result.success) {
      console.log(`[Learning] Saved knowledge: ${result.knowledgeId}`);
    }
  }).catch(err => {
    console.error('[Learning] Background learning error:', err);
  });
}

async function buildEnhancedSystemPrompt(userMessage: string): Promise<string> {
  // Start with the full system prompt
  let enhancedPrompt = JAVARI_SYSTEM_PROMPT;

  // Add live apps context
  const appsContext = await getAppsContext();
  if (appsContext) {
    enhancedPrompt += appsContext;
  }

  // Add relevant knowledge from javari_knowledge table (RAG-style)
  const knowledgeContext = await getRelevantKnowledge(userMessage);
  if (knowledgeContext) {
    enhancedPrompt += knowledgeContext;
  }

  // Add current date/time context
  enhancedPrompt += `\n\n## CURRENT CONTEXT\n- Date: ${new Date().toISOString()}\n- Mode: Full Knowledge Active\n- Knowledge Table: javari_knowledge (${cachedKnowledge?.length || 0} entries)\n`;

  return enhancedPrompt;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, aiProvider = 'gpt-4', conversationId, useFullKnowledge = true } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    
    // Check if this is a build request
    const buildRequest = AutonomousService.detectBuildRequest(lastMessage.content);

    if (buildRequest.isBuild && buildRequest.appName) {
      // Handle autonomous deployment
      const deployment = await AutonomousService.deploy(buildRequest.appName, buildRequest.description!);
      
      if (deployment) {
        const response = {
          message: `🚀 Building ${buildRequest.appName}...\n\nGenerating code → Creating repo → Deploying to Vercel\n\nLive URL in ~3 minutes.`,
          provider: 'javari-autonomous',
          workflowId: deployment.workflowId,
          isAutonomous: true,
        };

        if (conversationId) {
          await ChatService.saveMessage(conversationId, 'assistant', response.message, 'javari-autonomous');
        }

        return NextResponse.json(response);
      } else {
        return NextResponse.json({
          message: '❌ Sorry, I encountered an error starting the autonomous deployment. Please try again.',
          provider: 'error',
        });
      }
    }

    // Build enhanced system prompt with knowledge
    const systemPrompt = useFullKnowledge 
      ? await buildEnhancedSystemPrompt(lastMessage.content)
      : JAVARI_SYSTEM_PROMPT;

    // Regular chat - call AI provider with enhanced context
    const aiResponse = await callAIProvider(messages, aiProvider, systemPrompt);

    // Save to database if conversationId provided
    if (conversationId && aiResponse) {
      await ChatService.saveMessage(conversationId, 'assistant', aiResponse, aiProvider);
    }

    // Trigger background learning (non-blocking)
    triggerBackgroundLearning(lastMessage.content, aiResponse, conversationId);

    return NextResponse.json({
      message: aiResponse,
      provider: aiProvider,
      isAutonomous: false,
      knowledgeEnabled: useFullKnowledge,
      knowledgeCount: cachedKnowledge?.length || 0,
      learningEnabled: true,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Sorry, I encountered an error. Please try again.' },
      { status: 500 }
    );
  }
}

async function callAIProvider(messages: any[], provider: string, systemPrompt: string): Promise<string> {
  const providerMap: Record<string, string> = {
    'gpt-4': 'openai',
    'claude-sonnet': 'anthropic',
    'claude': 'anthropic',
    'gemini': 'google',
    'auto': 'openai',
  };

  const actualProvider = providerMap[provider] || 'openai';

  try {
    switch (actualProvider) {
      case 'openai':
        return await callOpenAI(messages, systemPrompt);
      case 'anthropic':
        return await callAnthropic(messages, systemPrompt);
      case 'google':
        return await callGemini(messages, systemPrompt);
      default:
        return await callOpenAI(messages, systemPrompt);
    }
  } catch (error) {
    console.error(`Error calling ${actualProvider}:`, error);
    // Fallback to another provider
    if (actualProvider !== 'openai') {
      console.log('Falling back to OpenAI...');
      return await callOpenAI(messages, systemPrompt);
    }
    throw error;
  }
}

async function callOpenAI(messages: any[], systemPrompt: string): Promise<string> {
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  // Filter out any existing system messages and add our enhanced one
  const userMessages = messages.filter(m => m.role !== 'system');
  const messagesWithSystem = [systemMessage, ...userMessages];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: messagesWithSystem,
      temperature: 0.7,
      max_tokens: 2000, // Increased for more detailed responses
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(messages: any[], systemPrompt: string): Promise<string> {
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: systemPrompt,
      messages: conversationMessages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGemini(messages: any[], systemPrompt: string): Promise<string> {
  // Gemini uses a different format - inject system prompt as first user message
  const formattedMessages = messages.filter(m => m.role !== 'system');
  
  const contents = [
    {
      role: 'user',
      parts: [{ text: `[System Context]\n${systemPrompt}\n\n[End System Context]\n\nPlease acknowledge you understand this context and are ready to help.` }],
    },
    {
      role: 'model',
      parts: [{ text: 'I understand. I am Javari AI, ready to help Roy and Cindy Henderson with CR AudioViz AI. How can I assist you?' }],
    },
    ...formattedMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

