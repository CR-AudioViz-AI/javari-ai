import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = 'edge'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, aiProvider = 'gpt-4' } = await req.json()

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

    // Add system message for Javari AI personality
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are Javari AI, an intelligent assistant that provides helpful, accurate, and professional responses. 
      
Your capabilities:
- Code generation and debugging
- Creative writing and content creation
- Data analysis and research
- Problem-solving and strategic thinking
- Document creation and editing

Always:
- Be concise yet thorough
- Use clear, professional language
- Provide actionable insights
- Format code with proper syntax highlighting
- Structure complex information clearly

When appropriate:
- Generate artifacts (code, documents, data files)
- Suggest follow-up actions
- Ask clarifying questions`
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
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
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
  } catch (error: any) {
    console.error('OpenAI API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
}
