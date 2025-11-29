// app/api/chat/route.ts
// Javari AI Chat API - ENHANCED with Full System Prompt & Knowledge Retrieval
// Timestamp: 2025-11-28 15:58 UTC

import { NextRequest, NextResponse } from 'next/server';
import { ChatService, AutonomousService } from '@/lib/javari-services';
import { JAVARI_SYSTEM_PROMPT } from '@/lib/javari-system-prompt';
import { JAVARI_KNOWLEDGE_BASE } from '@/lib/javari-knowledge-base';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for knowledge retrieval
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Platform apps for context (loaded from database)
let cachedApps: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  try {
    // Search knowledge base for relevant entries
    const { data: knowledge } = await supabase
      .from('javari_knowledge_base')
      .select('topic, content, category')
      .limit(5);

    if (!knowledge || knowledge.length === 0) {
      return '';
    }

    let context = '\n\n## RELEVANT KNOWLEDGE\n';
    knowledge.forEach(k => {
      context += `\n### ${k.topic}\n${k.content}\n`;
    });
    return context;
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    return '';
  }
}

async function buildEnhancedSystemPrompt(userMessage: string): Promise<string> {
  // Start with the full system prompt
  let enhancedPrompt = JAVARI_SYSTEM_PROMPT;

  // Add live apps context
  const appsContext = await getAppsContext();
  if (appsContext) {
    enhancedPrompt += appsContext;
  }

  // Add relevant knowledge (RAG-style)
  const knowledgeContext = await getRelevantKnowledge(userMessage);
  if (knowledgeContext) {
    enhancedPrompt += knowledgeContext;
  }

  // Add current date/time context
  enhancedPrompt += `\n\n## CURRENT CONTEXT\n- Date: ${new Date().toISOString()}\n- Mode: Full Knowledge Active\n`;

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

    return NextResponse.json({
      message: aiResponse,
      provider: aiProvider,
      isAutonomous: false,
      knowledgeEnabled: useFullKnowledge,
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
