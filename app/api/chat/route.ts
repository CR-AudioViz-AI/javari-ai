// app/api/chat/route.ts
// JAVARI CHAT API - FIXED with proper error handling
// Timestamp: 2025-11-30 07:30 AM EST

import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are JAVARI - the AI that DELIVERS for CR AudioViz AI.

## YOUR PRINCIPLES
1. DON'T LIE - Be honest. If you don't know, say so, then find out.
2. DON'T CHEAT - Do the real work. Quality matters.  
3. DON'T STEAL - Be original. Respect others' work.
4. DELIVER - Every customer gets results. Period.

## YOUR CAPABILITIES

You can BUILD things:
- Complete React components that render live
- HTML pages with Tailwind CSS
- Full applications with multiple files
- APIs and backend code

You can EXECUTE actions:
- Create Stripe products, prices, payment links
- Send emails via SendGrid/Resend
- Query and update databases
- Deploy to Vercel
- Commit to GitHub

You know ALL CR AudioViz products (60+ tools).

## HOW TO RESPOND

When building/creating, output complete, working code.
When asked to do something, DO IT - don't just explain how.
Always deliver results, not just explanations.

## OUTPUT FORMAT FOR CODE

When creating files, use this format:
\`\`\`filename.tsx
// complete code here
\`\`\`

## YOUR VOICE
Direct. Honest. Warm. Results-focused. Never preachy.

Now deliver.`;

async function callOpenAI(messages: any[], system: string): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return { content: '', error: 'OpenAI API key not configured' };
  }

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
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('OpenAI returned no content:', JSON.stringify(data));
      return { content: '', error: 'OpenAI returned empty response' };
    }
    
    return { content };
  } catch (error: any) {
    console.error('OpenAI call failed:', error);
    return { content: '', error: error.message };
  }
}

async function callClaude(messages: any[], system: string): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return { content: '', error: 'Anthropic API key not configured' };
  }

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
    const content = data.content?.[0]?.text;
    
    if (!content) {
      console.error('Claude returned no content:', JSON.stringify(data));
      return { content: '', error: 'Claude returned empty response' };
    }
    
    return { content };
  } catch (error: any) {
    console.error('Claude call failed:', error);
    return { content: '', error: error.message };
  }
}

async function callPerplexity(query: string): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    return { content: '', error: 'Perplexity API key not configured' };
  }

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
      const errorText = await res.text();
      console.error('Perplexity API error:', res.status, errorText);
      return { content: '', error: `Perplexity API error: ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('Perplexity returned no content:', JSON.stringify(data));
      return { content: '', error: 'Perplexity returned empty response' };
    }
    
    return { content };
  } catch (error: any) {
    console.error('Perplexity call failed:', error);
    return { content: '', error: error.message };
  }
}

function selectAI(message: string): string {
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
    
    console.log('Request body:', JSON.stringify({ 
      messageCount: messages?.length,
      aiProvider,
      lastMessage: messages?.[messages.length - 1]?.content?.substring(0, 100)
    }));
    
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // Determine which AI to use
    let ai = aiProvider && aiProvider !== 'auto' ? aiProvider : selectAI(lastMessage);
    
    // Normalize AI names
    if (ai === 'gpt-4') ai = 'gpt4';
    
    console.log('Selected AI:', ai);
    
    let result: { content: string; error?: string };
    
    // Try primary AI
    if (ai === 'perplexity') {
      result = await callPerplexity(lastMessage);
    } else if (ai === 'claude') {
      result = await callClaude(messages, SYSTEM_PROMPT);
    } else {
      result = await callOpenAI(messages, SYSTEM_PROMPT);
    }
    
    // If primary failed, try fallback
    if (!result.content && result.error) {
      console.log('Primary AI failed, trying fallback. Error:', result.error);
      
      // Try a different provider
      if (ai !== 'gpt4') {
        result = await callOpenAI(messages, SYSTEM_PROMPT);
      } else {
        result = await callClaude(messages, SYSTEM_PROMPT);
      }
    }
    
    // If still no content, try the last option
    if (!result.content && result.error) {
      console.log('Fallback also failed, trying last option. Error:', result.error);
      
      // Try perplexity as last resort for simple queries
      if (ai !== 'perplexity') {
        result = await callPerplexity(lastMessage);
      }
    }
    
    // If all failed, return error message
    if (!result.content) {
      console.error('All AI providers failed');
      return NextResponse.json({
        content: `I'm having trouble connecting to my AI providers right now. Error: ${result.error || 'Unknown error'}. Please try again in a moment.`,
        provider: 'error',
        error: result.error
      });
    }
    
    console.log('Success! Response length:', result.content.length);
    
    return NextResponse.json({
      content: result.content,
      provider: ai
    });
    
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
      provider: 'error',
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  // Health check endpoint
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
  
  return NextResponse.json({
    status: 'ok',
    version: '2.1',
    providers: {
      openai: hasOpenAI ? 'configured' : 'missing',
      claude: hasClaude ? 'configured' : 'missing',
      perplexity: hasPerplexity ? 'configured' : 'missing'
    }
  });
}
