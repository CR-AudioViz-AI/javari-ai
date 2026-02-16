// app/api/test-providers/route.ts
// Diagnostic endpoint to test AI provider connectivity
// Timestamp: 2025-12-12 10:55 AM EST
// Version: 1.1 - Updated models and API key order

import { NextResponse } from 'next/server';

interface TestResult {
  status: 'success' | 'error';
  httpStatus?: number;
  message?: string;
  response?: string;
  model?: string;
  latencyMs?: number;
}

async function testClaude(): Promise<TestResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { status: 'error', message: 'ANTHROPIC_API_KEY not set' };

  const start = Date.now();
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
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say "Claude works!" in 3 words or less.' }]
      })
    });

    const latencyMs = Date.now() - start;
    
    if (!res.ok) {
      const errorText = await res.text();
      return { status: 'error', httpStatus: res.status, message: errorText.substring(0, 200), latencyMs };
    }

    const data = await res.json();
    return { 
      status: 'success', 
      response: data.content?.[0]?.text || 'No response',
      model: 'claude-3-5-sonnet-20241022',
      latencyMs
    };
  } catch (error: any) {
    return { status: 'error', message: error.message, latencyMs: Date.now() - start };
  }
}

async function testOpenAI(): Promise<TestResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: 'error', message: 'OPENAI_API_KEY not set' };

  const start = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: 'Say "GPT works!" in 3 words or less.' }],
        max_tokens: 50
      })
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errorText = await res.text();
      return { status: 'error', httpStatus: res.status, message: errorText.substring(0, 200), latencyMs };
    }

    const data = await res.json();
    return { 
      status: 'success', 
      response: data.choices?.[0]?.message?.content || 'No response',
      model: 'gpt-4-turbo-preview',
      latencyMs
    };
  } catch (error: any) {
    return { status: 'error', message: error.message, latencyMs: Date.now() - start };
  }
}

async function testPerplexity(): Promise<TestResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { status: 'error', message: 'PERPLEXITY_API_KEY not set' };

  const start = Date.now();
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        // FIXED v4.2: Updated from deprecated 'llama-3.1-sonar-large-128k-online' to 'sonar-pro'
        model: 'sonar-pro',
        messages: [{ role: 'user', content: 'Say "Perplexity works!" in 3 words or less.' }],
        max_tokens: 50
      })
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errorText = await res.text();
      return { status: 'error', httpStatus: res.status, message: errorText.substring(0, 200), latencyMs };
    }

    const data = await res.json();
    return { 
      status: 'success', 
      response: data.choices?.[0]?.message?.content || 'No response',
      model: 'sonar-pro',
      latencyMs
    };
  } catch (error: any) {
    return { status: 'error', message: error.message, latencyMs: Date.now() - start };
  }
}

async function testMistral(): Promise<TestResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return { status: 'error', message: 'MISTRAL_API_KEY not set' };

  const start = Date.now();
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: 'Say "Mistral works!" in 3 words or less.' }],
        max_tokens: 50
      })
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errorText = await res.text();
      return { status: 'error', httpStatus: res.status, message: errorText.substring(0, 200), latencyMs };
    }

    const data = await res.json();
    return { 
      status: 'success', 
      response: data.choices?.[0]?.message?.content || 'No response',
      model: 'mistral-large-latest',
      latencyMs
    };
  } catch (error: any) {
    return { status: 'error', message: error.message, latencyMs: Date.now() - start };
  }
}

export async function GET() {
  console.log('[Javari Diagnostic] Starting provider tests...');
  
  // Run all tests in parallel
  const [claude, openai, perplexity, mistral] = await Promise.all([
    testClaude(),
    testOpenAI(),
    testPerplexity(),
    testMistral()
  ]);

  const results = {
    timestamp: new Date().toISOString(),
    version: '5.0',
    tests: {
      claude,
      openai,
      perplexity,
      mistral
    },
    summary: {
      total: 4,
      success: [claude, openai, perplexity, mistral].filter(t => t.status === 'success').length,
      failed: [claude, openai, perplexity, mistral].filter(t => t.status === 'error').length
    },
    envKeysPresent: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      PERPLEXITY_API_KEY: !!process.env.PERPLEXITY_API_KEY,
      MISTRAL_API_KEY: !!process.env.MISTRAL_API_KEY
    }
  };

  console.log('[Javari Diagnostic] Results:', JSON.stringify(results.summary));
  
  return NextResponse.json(results);
}
// Deployment trigger: 1771256525
// Final deployment: 1771256929
// Production deployment: 1771258134
