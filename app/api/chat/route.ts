// app/api/chat/route.ts
// Javari Final - Autonomous system with learning, orchestration, roadmap execution

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getJavariSystemPrompt } from '@/lib/javari-system-prompt';
import { javariLearning } from '@/lib/javari-learning-system';
import { javariOrchestrator } from '@/lib/javari-multi-model-orchestrator';
import { javariRoadmap } from '@/lib/javari-roadmap-system';

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

// Detect task type from message
function detectTaskType(message: string): 'code' | 'analysis' | 'research' | 'reasoning' {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('build') || lowerMsg.includes('create') || lowerMsg.includes('code')) {
    return 'code';
  }
  if (lowerMsg.includes('analyze') || lowerMsg.includes('compare') || lowerMsg.includes('review')) {
    return 'analysis';
  }
  if (lowerMsg.includes('research') || lowerMsg.includes('find') || lowerMsg.includes('search')) {
    return 'research';
  }
  return 'reasoning';
}

// Get session context
async function getSessionContext(sessionId: string, userId: string): Promise<string> {
  try {
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
      context += `\n## SESSION DOCUMENTS\n\n${docContext}\n\n`;
    }

    // Add roadmap context
    const roadmapSummary = javariRoadmap.formatRoadmapSummary();
    context += `\n## PLATFORM ROADMAP\n\n${roadmapSummary}\n\n`;

    return context;
  } catch (err) {
    console.error('Session context error:', err);
    return '';
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ChatRequest = await request.json();
    const { messages, sessionId, userId } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const userMessage = messages[messages.length - 1].content;
    const taskType = detectTaskType(userMessage);

    // Build full system prompt
    let systemPrompt = getJavariSystemPrompt();

    if (sessionId && userId) {
      const sessionContext = await getSessionContext(sessionId, userId);
      if (sessionContext) {
        systemPrompt += sessionContext;
      }
    }

    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Call AI (using GPT-4 for now, orchestrator will route later)
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

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Track success
    javariLearning.trackAction(taskType, 'success', {
      model: 'gpt-4',
    });

    return NextResponse.json({
      message: assistantMessage,
      usage: data.usage,
      taskType,
      processingTime: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('Chat error:', error);

    // Track failure
    javariLearning.trackAction('chat_request', 'failure', {
      error: error.message,
    });

    // RECOVER_MODE: Return helpful response even on error
    return NextResponse.json({
      message: "I encountered an issue but I'm still operational. Let me try a different approach. What would you like me to build?",
      error: error.message,
      mode: 'RECOVER_MODE',
      processingTime: Date.now() - Date.now(),
    }, { status: 200 });
  }
}
