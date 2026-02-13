// app/api/multi/council/route.ts
// Multi-AI Council endpoint for collaborative multi-model execution

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { CouncilOrchestrator, DEFAULT_COUNCIL } from '@/lib/javari/multi-ai/council';
import { getModel } from '@/lib/javari/multi-ai/model-registry';

interface CouncilRequest {
  message: string;
  config?: {
    architect?: string;
    builder?: string;
    validator?: string;
    summarizer?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: CouncilRequest = await req.json();
    
    if (!body.message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Create orchestrator with custom or default config
    const config = body.config || DEFAULT_COUNCIL;
    const orchestrator = new CouncilOrchestrator(config);
    
    // Execute council workflow
    const result = await orchestrator.executeCouncil(
      body.message,
      executeModel
    );
    
    // Format response
    return NextResponse.json({
      success: result.success,
      finalOutput: result.finalOutput,
      steps: result.steps.map(step => ({
        step: step.step,
        role: step.role,
        model: step.model.name,
        modelId: step.model.id,
        provider: step.model.provider,
        duration: step.duration,
        success: step.success,
        error: step.error,
        responsePreview: step.response?.substring(0, 200)
      })),
      metrics: {
        totalDuration: result.totalDuration,
        totalCost: result.totalCost,
        stepsCompleted: result.steps.filter(s => s.success).length,
        stepsFailed: result.steps.filter(s => !s.success).length
      }
    });
    
  } catch (error: any) {
    console.error('Council error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    runtime: 'nodejs',
    version: '1.0-COUNCIL',
    features: [
      'multi-model collaboration',
      'architect-builder-validator-summarizer workflow',
      'configurable model selection',
      'detailed step tracking'
    ],
    defaultConfig: DEFAULT_COUNCIL,
    maxDuration: 60
  });
}

async function executeModel(modelId: string, prompt: string): Promise<string> {
  const model = getModel(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  
  // Route to appropriate provider
  switch (model.provider) {
    case 'openai':
      return await executeOpenAI(modelId, prompt);
    case 'anthropic':
      return await executeAnthropic(modelId, prompt);
    case 'google':
      return await executeGoogle(modelId, prompt);
    case 'groq':
      return await executeGroq(modelId, prompt);
    case 'deepseek':
      return await executeDeepSeek(modelId, prompt);
    case 'mistral':
      return await executeMistral(modelId, prompt);
    default:
      throw new Error(`Provider ${model.provider} not supported`);
  }
}

// Provider execution functions (same as multi/chat but with higher token limits for council)

async function executeOpenAI(modelId: string, prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeAnthropic(modelId: string, prompt: string): Promise<string> {
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
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${error}`);
  }
  
  const data = await response.json();
  return data.content[0].text;
}

async function executeGoogle(modelId: string, prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Google API key not configured');
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2000 }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google error: ${error}`);
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function executeGroq(modelId: string, prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq error: ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeDeepSeek(modelId: string, prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek error: ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeMistral(modelId: string, prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral error: ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
