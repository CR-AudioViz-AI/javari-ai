// app/api/multi/chat/route.ts
// Multi-AI chat endpoint with intelligent model routing

export const dynamic = 'force-dynamic';
export const runtime = 'edge';
export const maxDuration = 25;

import { NextRequest, NextResponse } from 'next/server';
import { routeRequest, globalRouterLogger, RoutingContext } from '@/lib/javari/multi-ai/router';
import { getModel } from '@/lib/javari/multi-ai/model-registry';

interface ChatRequest {
  message: string;
  mode?: 'single' | 'super' | 'advanced' | 'roadmap';
  provider?: string;
  model?: string;
  policy?: {
    maxCostPerRequest?: number;
    preferredProviders?: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    
    if (!body.message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Build routing context
    const context: RoutingContext = {
      prompt: body.message,
      mode: body.mode || 'single',
      policy: body.policy,
      userOverride: body.model
    };
    
    // Route to optimal model
    const decision = routeRequest(context);
    globalRouterLogger.log(context, decision);
    
    // Execute on selected model
    const startTime = Date.now();
    let response: string;
    let success = true;
    let error: string | undefined;
    
    try {
      response = await executeOnModel(
        decision.selectedModel.id,
        body.message
      );
    } catch (err: any) {
      success = false;
      error = err.message;
      response = `Error: ${err.message}`;
    }
    
    const executionTime = Date.now() - startTime;
    
    // Update router log
    globalRouterLogger.updateLog(decision.selectedModel.id, {
      executionTime,
      success,
      error
    });
    
    return NextResponse.json({
      response,
      routing: {
        selectedModel: decision.selectedModel.name,
        modelId: decision.selectedModel.id,
        provider: decision.selectedModel.provider,
        reason: decision.reason,
        costEstimate: decision.costEstimate,
        confidence: decision.confidence,
        executionTime
      },
      success
    });
    
  } catch (error: any) {
    console.error('Multi-chat error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    runtime: 'edge',
    version: '1.0-MULTI-CHAT',
    features: [
      'intelligent model routing',
      'cost optimization',
      'policy enforcement',
      'multi-provider support'
    ],
    supportedModes: ['single', 'super', 'advanced', 'roadmap']
  });
}

async function executeOnModel(modelId: string, message: string): Promise<string> {
  const model = getModel(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  
  // Route to appropriate provider
  switch (model.provider) {
    case 'openai':
      return await executeOpenAI(modelId, message);
    case 'anthropic':
      return await executeAnthropic(modelId, message);
    case 'google':
      return await executeGoogle(modelId, message);
    case 'groq':
      return await executeGroq(modelId, message);
    case 'deepseek':
      return await executeDeepSeek(modelId, message);
    case 'mistral':
      return await executeMistral(modelId, message);
    default:
      throw new Error(`Provider ${model.provider} not supported`);
  }
}

async function executeOpenAI(modelId: string, message: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1000
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeAnthropic(modelId: string, message: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not configured');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1000,
      messages: [{ role: 'user', content: message }]
    })
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.content[0].text;
}

async function executeGoogle(modelId: string, message: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Google API key not configured');
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Google error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function executeGroq(modelId: string, message: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API key not configured');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1000
    })
  });
  
  if (!response.ok) {
    throw new Error(`Groq error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeDeepSeek(modelId: string, message: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DeepSeek API key not configured');
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1000
    })
  });
  
  if (!response.ok) {
    throw new Error(`DeepSeek error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeMistral(modelId: string, message: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('Mistral API key not configured');
  
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: message }],
      max_tokens: 1000
    })
  });
  
  if (!response.ok) {
    throw new Error(`Mistral error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
