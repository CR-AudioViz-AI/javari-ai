// app/api/chat/route.ts
// Javari Autonomous Chat with Memory & Continuity

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getJavariSystemPrompt } from '@/lib/javari-system-prompt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string;
  userId?: string;
}

// Get session memory (documents + context)
async function getSessionContext(sessionId: string, userId: string): Promise<string> {
  try {
    // Get documents
    const { data: docs } = await supabase
      .from('uploaded_documents')
      .select('filename, content')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(5);

    let context = '';

    if (docs && docs.length > 0) {
      const docContext = docs
        .map((doc, idx) => `[Document ${idx + 1}: ${doc.filename}]\n${doc.content}`)
        .join('\n\n---\n\n');
      context += `\n## DOCUMENTS IN SESSION\n\n${docContext}\n\n`;
    }

    // Get recent conversation goals/context
    const { data: goals } = await supabase
      .from('session_goals')
      .select('goal, status')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (goals && goals.length > 0) {
      const goalsContext = goals
        .map(g => `- ${g.goal} (${g.status})`)
        .join('\n');
      context += `\n## CURRENT PROJECT GOALS\n\n${goalsContext}\n\n`;
    }

    return context;
  } catch (err) {
    console.error('Session context error:', err);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, sessionId, userId } = body;

    // Build full system prompt with memory
    let systemPrompt = getJavariSystemPrompt();

    if (sessionId && userId) {
      const sessionContext = await getSessionContext(sessionId, userId);
      if (sessionContext) {
        systemPrompt += sessionContext;
      }
    }

    // Add system prompt
    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Call AI provider
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: messagesWithSystem,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const data = await response.json();

    return NextResponse.json({
      message: data.choices[0].message.content,
      usage: data.usage,
    });

  } catch (error: any) {
    // RECOVER_MODE: Graceful degradation
    console.error('Chat error:', error);
    
    return NextResponse.json({
      message: "I encountered an issue but I'm still operational. Let me try a different approach. What would you like me to build?",
      error: error.message,
      mode: 'RECOVER_MODE'
    }, { status: 200 }); // Return 200 to avoid frontend errors
  }
}
