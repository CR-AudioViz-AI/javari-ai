// app/api/chat/route.ts
// JAVARI CHAT API - With Autonomous App Building
// Timestamp: 2025-12-02 11:10 AM EST

import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are JAVARI - the AI that DELIVERS for CR AudioViz AI.

## YOUR PRINCIPLES
1. DON'T LIE - Be honest. If you don't know, say so, then find out.
2. DON'T CHEAT - Do the real work. Quality matters.  
3. DON'T STEAL - Be original. Respect others' work.
4. DELIVER - Every customer gets results. Period.

## CRITICAL INSTRUCTION FOR APP BUILDING

When a user asks you to BUILD an app, website, tool, or calculator:
- DO NOT give them instructions to run locally
- DO NOT tell them to use npm, create-react-app, etc.
- DO NOT just provide code snippets

Instead, you MUST:
1. Create a COMPLETE, working React component
2. Format it so our system can deploy it automatically
3. The user will get a LIVE URL they can use immediately

When building apps, ALWAYS output your code in this EXACT format:

\`\`\`deploy:AppName.tsx
// Your complete React component here
// Must be a single-file React component
// Use Tailwind CSS for styling
// Must have a default export
\`\`\`

Example - if user asks for a mortgage calculator:

\`\`\`deploy:MortgageCalculator.tsx
'use client';
import React, { useState } from 'react';

export default function MortgageCalculator() {
  // ... complete working code
}
\`\`\`

The system will automatically:
- Deploy this to Vercel
- Give the user a live URL
- No setup required from the user

## YOUR CAPABILITIES

You can BUILD things that get deployed automatically:
- Calculators, tools, utilities
- Landing pages, portfolios
- Dashboards, admin panels
- Forms, surveys, quizzes
- Games, interactive experiences

You can also:
- Answer questions directly
- Provide code for users who WANT to run locally (only if they specifically ask)
- Research current information
- Help with any task

## YOUR VOICE
Direct. Honest. Warm. Results-focused. Never preachy.

When building apps: Don't explain what you're going to do. Just build it and tell them it's being deployed.

Now deliver.`;

// Detect if this is a build request
function detectBuildRequest(message: string): boolean {
  const m = message.toLowerCase();
  const buildKeywords = [
    'build me', 'create me', 'make me',
    'build a', 'create a', 'make a',
    'i need an app', 'i need a tool', 'i need a calculator',
    'actual app', 'working app', 'live app', 'real app',
    'deploy', 'i can use', 'that works'
  ];
  return buildKeywords.some(k => m.includes(k));
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
          ...messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('OpenAI API error:', res.status, errorText);
      return { content: '', error: `OpenAI API error: ${res.status}` };
    }

    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || '' };
  } catch (error: any) {
    console.error('OpenAI call failed:', error);
    return { content: '', error: error.message };
  }
}

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
      console.error('Claude API error:', res.status, errorText);
      return { content: '', error: `Claude API error: ${res.status}` };
    }

    const data = await res.json();
    return { content: data.content?.[0]?.text || '' };
  } catch (error: any) {
    console.error('Claude call failed:', error);
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

function selectAI(message: string, isBuildRequest: boolean): string {
  if (isBuildRequest) return 'claude'; // Claude is best for coding
  
  const m = message.toLowerCase();
  if (/\b(current|today|latest|price|news|weather|stock)\b/.test(m)) return 'perplexity';
  if (/\b(build|create|code|component|fix|debug|typescript|react|function)\b/.test(m)) return 'claude';
  return 'gpt4';
}

export async function POST(request: NextRequest) {
  console.log('Chat API called');
  
  try {
    const body = await request.json();
    const { messages, aiProvider } = body;
    
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const isBuildRequest = detectBuildRequest(lastMessage);
    
    // Determine which AI to use
    let ai = aiProvider && aiProvider !== 'auto' ? aiProvider : selectAI(lastMessage, isBuildRequest);
    if (ai === 'gpt-4') ai = 'gpt4';
    
    console.log('Selected AI:', ai, 'Build request:', isBuildRequest);
    
    // Use enhanced system prompt for build requests
    const systemPrompt = SYSTEM_PROMPT;
    
    let result: { content: string; error?: string };
    
    if (ai === 'perplexity') {
      result = await callPerplexity(lastMessage);
    } else if (ai === 'claude') {
      result = await callClaude(messages, systemPrompt);
    } else {
      result = await callOpenAI(messages, systemPrompt);
    }
    
    // Fallback if primary fails
    if (!result.content && result.error) {
      console.log('Primary AI failed, trying fallback');
      result = ai !== 'gpt4' 
        ? await callOpenAI(messages, systemPrompt)
        : await callClaude(messages, systemPrompt);
    }
    
    if (!result.content) {
      return NextResponse.json({
        content: `I'm having trouble connecting right now. Error: ${result.error}. Please try again.`,
        provider: 'error'
      });
    }
    
    return NextResponse.json({
      content: result.content,
      provider: ai,
      isBuildRequest
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
    version: '2.2',
    features: ['multi-ai', 'build-detection', 'auto-deploy']
  });
}
