// app/api/javari/summarize/route.ts
// Javari Document Summarization API
// Created: 2026-01-06
// Real AI-powered document summarization with structured output

import { NextRequest, NextResponse } from 'next/server';

interface SummarizeRequest {
  documents: {
    name: string;
    content: string;
    type: string;
  }[];
  provider?: 'openai' | 'anthropic' | 'auto';
}

interface SummarizeResponse {
  success: boolean;
  summary?: {
    executive: string;
    keyPoints: string[];
    actionItems: string[];
    perDocument: { name: string; summary: string }[];
  };
  error?: string;
  provider?: string;
  timestamp: string;
}

// Build the summarization prompt
function buildSummarizePrompt(documents: { name: string; content: string }[]): string {
  const docList = documents.map((d, i) => 
    `=== DOCUMENT ${i + 1}: ${d.name} ===\n${d.content.slice(0, 15000)}\n`
  ).join('\n');

  return `You are a professional document analyst. Summarize the following ${documents.length} document(s).

${docList}

Provide your response in this EXACT format (use these exact headers):

## ✅ EXECUTIVE SUMMARY
[1-2 paragraph overview of all documents combined]

## 🔑 KEY POINTS
- [Key point 1]
- [Key point 2]
- [Key point 3]
- [Add more as needed]

## 📌 ACTION ITEMS
- [Action item 1 if any]
- [Action item 2 if any]
[If no action items, write "No specific action items identified."]

## 📄 PER-DOCUMENT NOTES
${documents.map((d, i) => `### Document ${i + 1}: ${d.name}\n[2-3 sentence summary of this specific document]`).join('\n\n')}

Be concise but comprehensive. Focus on the most important information.`;
}

// Call OpenAI
async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a professional document summarizer. Be concise and structured.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated';
}

// Call Anthropic
async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || 'No response generated';
}

export async function POST(request: NextRequest): Promise<NextResponse<SummarizeResponse>> {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST';
  
  try {
    const body: SummarizeRequest = await request.json();
    const { documents, provider = 'auto' } = body;

    // Validate input
    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No documents provided. Upload documents first, then type summarize.',
        timestamp,
      }, { status: 400 });
    }

    // Check total content size
    const totalSize = documents.reduce((acc, d) => acc + d.content.length, 0);
    if (totalSize > 100000) {
      // For very large docs, truncate each proportionally
      const maxPerDoc = Math.floor(100000 / documents.length);
      documents.forEach(d => {
        if (d.content.length > maxPerDoc) {
          d.content = d.content.slice(0, maxPerDoc) + '\n[...truncated for length...]';
        }
      });
    }

    // Build prompt
    const prompt = buildSummarizePrompt(documents);

    // Select provider
    let result: string;
    let usedProvider: string;

    if (provider === 'anthropic' || (provider === 'auto' && process.env.ANTHROPIC_API_KEY)) {
      try {
        result = await callAnthropic(prompt);
        usedProvider = 'anthropic';
      } catch (err: any) {
        // Fallback to OpenAI
        if (process.env.OPENAI_API_KEY) {
          result = await callOpenAI(prompt);
          usedProvider = 'openai (fallback)';
        } else {
          throw err;
        }
      }
    } else if (provider === 'openai' || process.env.OPENAI_API_KEY) {
      result = await callOpenAI(prompt);
      usedProvider = 'openai';
    } else {
      return NextResponse.json({
        success: false,
        error: 'No AI provider configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.',
        timestamp,
      }, { status: 500 });
    }

    // Parse the structured response
    const keyPointsMatch = result.match(/## 🔑 KEY POINTS\n([\s\S]*?)(?=## 📌|$)/);
    const actionItemsMatch = result.match(/## 📌 ACTION ITEMS\n([\s\S]*?)(?=## 📄|$)/);
    const executiveMatch = result.match(/## ✅ EXECUTIVE SUMMARY\n([\s\S]*?)(?=## 🔑|$)/);

    const keyPoints = keyPointsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      || [];

    const actionItems = actionItemsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      || [];

    return NextResponse.json({
      success: true,
      summary: {
        executive: executiveMatch?.[1]?.trim() || result.slice(0, 500),
        keyPoints,
        actionItems,
        perDocument: documents.map(d => ({
          name: d.name,
          summary: `Included in analysis (${d.content.length} chars)`
        })),
      },
      provider: usedProvider,
      timestamp,
    });

  } catch (error: any) {
    console.error('Summarize API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate summary',
      timestamp,
    }, { status: 500 });
  }
}
