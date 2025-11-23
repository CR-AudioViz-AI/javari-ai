import { NextRequest, NextResponse } from 'next/server';
import { ChatService, AutonomousService } from '@/lib/javari-services';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, aiProvider = 'gpt-4', conversationId } = body;

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

        // Save to database if conversationId provided
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

    // Regular chat - call AI provider
    const aiResponse = await callAIProvider(messages, aiProvider);

    // Save to database if conversationId provided
    if (conversationId && aiResponse) {
      await ChatService.saveMessage(conversationId, 'assistant', aiResponse, aiProvider);
    }

    return NextResponse.json({
      message: aiResponse,
      provider: aiProvider,
      isAutonomous: false,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Sorry, I encountered an error. Please try again.' },
      { status: 500 }
    );
  }
}

async function callAIProvider(messages: any[], provider: string): Promise<string> {
  // Map provider names
  const providerMap: Record<string, string> = {
    'gpt-4': 'openai',
    'claude-sonnet': 'anthropic',
    'gemini': 'google',
    'auto': 'openai', // Default to OpenAI
  };

  const actualProvider = providerMap[provider] || 'openai';

  try {
    switch (actualProvider) {
      case 'openai':
        return await callOpenAI(messages);
      case 'anthropic':
        return await callAnthropic(messages);
      case 'google':
        return await callGemini(messages);
      default:
        return await callOpenAI(messages);
    }
  } catch (error) {
    console.error(`Error calling ${actualProvider}:`, error);
    throw error;
  }
}

async function callOpenAI(messages: any[]): Promise<string> {
  // Add system prompt for direct, crisp responses
  const systemPrompt = {
    role: 'system',
    content: 'You are Javari, an autonomous AI assistant. Be DIRECT and CRISP. No long explanations unless asked. Give actionable answers in 2-3 sentences max. Customers want to build, not read essays.'
  };

  const messagesWithSystem = messages[0]?.role === 'system' 
    ? messages 
    : [systemPrompt, ...messages];

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
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(messages: any[]): Promise<string> {
  // Convert messages format for Anthropic
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const systemPrompt = systemMessage?.content || 'You are Javari, an autonomous AI assistant. Be DIRECT and CRISP. No long explanations unless asked. Give actionable answers in 2-3 sentences max. Customers want to build, not read essays.';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: conversationMessages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGemini(messages: any[]): Promise<string> {
  // Convert to Gemini format
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
