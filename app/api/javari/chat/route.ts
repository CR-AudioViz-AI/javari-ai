// ============================================================================
// API ROUTE: /api/javari/chat
// Handles AI chat with OpenAI GPT-4
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface ChatSession {
  id: string;
  projectId?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  createdAt: string;
}

const sessions = new Map<string, ChatSession>();

// System prompt for Javari AI
const SYSTEM_PROMPT = `You are Javari AI, an autonomous development assistant for CR AudioViz AI.

Your capabilities:
- Monitor and analyze build health across projects
- Provide intelligent code suggestions and debugging help
- Help with project setup and configuration
- Explain technical concepts clearly
- Track project metrics and provide insights
- Self-healing: suggest fixes for common build errors

Your personality:
- Professional but friendly
- Direct and action-oriented
- Proactive in offering help
- Detail-oriented but concise

When users ask about projects, builds, or health status, use the API to fetch real data. When they need help with code or setup, provide clear, actionable guidance.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, message, projectId } = body;

    // Initialize new chat session
    if (action === 'init') {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      sessions.set(newSessionId, {
        id: newSessionId,
        projectId,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }],
        createdAt: new Date().toISOString()
      });

      // Store session in database
      try {
        const supabase = createServerClient();
        await supabase.from('javari_chat_sessions').insert({
          id: newSessionId,
          project_id: projectId || null,
          user_id: '00000000-0000-0000-0000-000000000000', // TODO: Get from auth
          title: 'New Chat Session',
          status: 'active'
        });
      } catch (dbError) {
        console.error('Failed to store session in DB:', dbError);
      }

      return NextResponse.json({ sessionId: newSessionId });
    }

    // Send message
    if (action === 'message') {
      if (!sessionId || !message) {
        return NextResponse.json(
          { error: 'Session ID and message are required' },
          { status: 400 }
        );
      }

      let session = sessions.get(sessionId);
      if (!session) {
        // Try to recover session or create new one
        session = {
          id: sessionId,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }],
          createdAt: new Date().toISOString()
        };
        sessions.set(sessionId, session);
      }

      // Add user message to history
      session.messages.push({ role: 'user', content: message });

      try {
        // Call OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: session.messages,
            temperature: 0.7,
            max_tokens: 2000,
            stream: false
          })
        });

        if (!openaiResponse.ok) {
          const error = await openaiResponse.text();
          console.error('OpenAI API error:', error);
          return NextResponse.json(
            { error: 'Failed to get response from AI' },
            { status: 500 }
          );
        }

        const data = await openaiResponse.json();
        const assistantMessage = data.choices[0].message.content;

        // Add assistant response to history
        session.messages.push({ role: 'assistant', content: assistantMessage });

        // Update session in memory (limit to last 20 messages + system prompt)
        if (session.messages.length > 21) {
          session.messages = [
            session.messages[0], // Keep system prompt
            ...session.messages.slice(-20) // Keep last 20 messages
          ];
        }

        // Log the interaction to database
        try {
          const supabase = createServerClient();
          await supabase.from('javari_chat_sessions').update({
            message_count: session.messages.length - 1, // Exclude system message
            token_count: data.usage?.total_tokens || 0,
            updated_at: new Date().toISOString()
          }).eq('id', sessionId);
        } catch (dbError) {
          console.error('Failed to update session in DB:', dbError);
        }

        return NextResponse.json({
          response: assistantMessage,
          tokensUsed: data.usage?.total_tokens || 0
        });

      } catch (error) {
        console.error('Error calling OpenAI:', error);
        return NextResponse.json(
          { error: 'Failed to process message' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    sessionId: session.id,
    messageCount: session.messages.length - 1, // Exclude system message
    createdAt: session.createdAt
  });
}
