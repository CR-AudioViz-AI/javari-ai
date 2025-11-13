import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined, toString, safeGet } from '@/lib/typescript-helpers';
import { JAVARI_SYSTEM_PROMPT } from '@/lib/javari-system-prompt';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = 'edge'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  aiProvider?: string;
}

export async function POST(req: NextRequest) {
  return await safeAsync(
    async () => {
      // Parse and validate request body
      const body = await req.json() as ChatRequestBody;
      const messages = body.messages;
      const aiProvider = toString(body.aiProvider, 'gpt-4');

      // Validate messages array
      if (!isDefined(messages) || !Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json(
          { error: 'Messages array is required' },
          { status: 400 }
        );
      }

      // Validate OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured' },
          { status: 500 }
        )
      }

      // Map AI provider to OpenAI model
      const modelMap: Record<string, string> = {
        'gpt-4': 'gpt-4-turbo-preview',
        'claude': 'gpt-4-turbo-preview', // We'll use GPT-4 for now, can add Claude API later
        'gemini': 'gpt-4-turbo-preview', // Can add Gemini API later
        'perplexity': 'gpt-4-turbo-preview', // Can add Perplexity API later
      }

      const model = modelMap[aiProvider] || 'gpt-4-turbo-preview'

      // Get current date and time for context
      const now = new Date()
      const currentDateTime = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      })
      const currentTimeEST = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      })

      // Add system message with full Javari AI personality and time awareness
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `${JAVARI_SYSTEM_PROMPT}

## CURRENT DATE & TIME AWARENESS

**Current Date & Time:** ${currentDateTime} EST
**Current Time:** ${currentTimeEST} EST
**User Location:** Fort Myers, Florida (Eastern Time Zone)

You ALWAYS know the current date and time. When users ask about time, date, or anything time-related, use the information above. You can tell time, you can reference today's date, and you understand temporal context.

Examples:
- "What time is it?" → "${currentTimeEST} EST"
- "What's today's date?" → "${currentDateTime}"
- "Is it morning/afternoon/evening?" → Determine based on current time
- "What day of the week is it?" → Extracted from the date above

NEVER say "I'm unable to provide real-time updates" or "I don't have access to current time." You DO have this information - use it!`
      }

      const fullMessages = [systemMessage, ...messages]

      // Create streaming response
      const stream = await openai.chat.completions.create({
        model,
        messages: fullMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      })

      // Create readable stream for client
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = safeGet(chunk, 'choices.0.delta.content', '');
              if (text && typeof text === 'string') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error: unknown) {
            handleError(error, { file: 'chat/route.ts', function: 'stream' });
            controller.error(error)
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    },
    { file: 'chat/route.ts', function: 'POST' },
    NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  ) || NextResponse.json(
    { error: 'Unexpected error' },
    { status: 500 }
  );
}
