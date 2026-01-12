// app/api/chat/route.ts
// Updated: Auto-include document context like ChatGPT/Claude

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

// Get documents from current session
async function getSessionDocuments(sessionId: string, userId: string): Promise<string> {
  try {
    const { data: docs, error } = await supabase
      .from('uploaded_documents')
      .select('filename, content, uploaded_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(10);

    if (error || !docs || docs.length === 0) {
      return '';
    }

    // Format documents for context
    const docContext = docs
      .map((doc, idx) => 
        `[Document ${idx + 1}: ${doc.filename}]\n${doc.content}\n`
      )
      .join('\n---\n\n');

    return `\n\n## DOCUMENTS IN THIS CONVERSATION\n\nThe user has provided these documents. Reference them naturally:\n\n${docContext}\n\n---\n\n`;
  } catch (err) {
    console.error('Error fetching session documents:', err);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, sessionId, userId } = body;

    // Get base system prompt (no document upload requests)
    let systemPrompt = getJavariSystemPrompt();

    // Auto-include documents if available
    if (sessionId && userId) {
      const docContext = await getSessionDocuments(sessionId, userId);
      if (docContext) {
        systemPrompt += docContext;
      }
    }

    // Add system prompt as first message
    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Forward to AI provider (OpenAI, Anthropic, etc.)
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
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Chat failed', details: error.message },
      { status: 500 }
    );
  }
}
