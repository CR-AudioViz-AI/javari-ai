// app/api/test-providers/route.ts
// Diagnostic endpoint to test AI provider connectivity
// Timestamp: 2025-12-12 9:15 AM EST

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test Claude
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      results.tests.claude = { status: 'error', message: 'ANTHROPIC_API_KEY not set' };
    } else {
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
          messages: [{ role: 'user', content: 'Say "Claude works!" in 3 words' }]
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        results.tests.claude = { 
          status: 'success', 
          response: data.content?.[0]?.text?.substring(0, 50),
          model: 'claude-3-5-sonnet-20241022'
        };
      } else {
        const errorText = await res.text();
        results.tests.claude = { 
          status: 'error', 
          httpStatus: res.status,
          message: errorText.substring(0, 200)
        };
      }
    }
  } catch (error: any) {
    results.tests.claude = { status: 'exception', message: error.message };
  }

  // Test OpenAI
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      results.tests.openai = { status: 'error', message: 'OPENAI_API_KEY not set' };
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: 'Say "GPT works!" in 3 words' }],
          max_tokens: 50
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        results.tests.openai = { 
          status: 'success', 
          response: data.choices?.[0]?.message?.content?.substring(0, 50),
          model: 'gpt-4-turbo-preview'
        };
      } else {
        const errorText = await res.text();
        results.tests.openai = { 
          status: 'error', 
          httpStatus: res.status,
          message: errorText.substring(0, 200)
        };
      }
    }
  } catch (error: any) {
    results.tests.openai = { status: 'exception', message: error.message };
  }

  // Test Gemini
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      results.tests.gemini = { status: 'error', message: 'GOOGLE_API_KEY not set' };
    } else {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Say "Gemini works!" in 3 words' }] }],
            generationConfig: { maxOutputTokens: 50 }
          })
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        results.tests.gemini = { 
          status: 'success', 
          response: data.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 50),
          model: 'gemini-1.5-pro'
        };
      } else {
        const errorText = await res.text();
        results.tests.gemini = { 
          status: 'error', 
          httpStatus: res.status,
          message: errorText.substring(0, 200)
        };
      }
    }
  } catch (error: any) {
    results.tests.gemini = { status: 'exception', message: error.message };
  }

  // Test Perplexity
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      results.tests.perplexity = { status: 'error', message: 'PERPLEXITY_API_KEY not set' };
    } else {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [{ role: 'user', content: 'Say "Perplexity works!" in 3 words' }],
          max_tokens: 50
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        results.tests.perplexity = { 
          status: 'success', 
          response: data.choices?.[0]?.message?.content?.substring(0, 50),
          model: 'llama-3.1-sonar-large-128k-online'
        };
      } else {
        const errorText = await res.text();
        results.tests.perplexity = { 
          status: 'error', 
          httpStatus: res.status,
          message: errorText.substring(0, 200)
        };
      }
    }
  } catch (error: any) {
    results.tests.perplexity = { status: 'exception', message: error.message };
  }

  return NextResponse.json(results);
}
