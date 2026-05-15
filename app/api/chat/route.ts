// app/api/chat/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari AI — Chat API
// Conversational interface powering the Javari chat on javariai.com.
// Uses COST LAW dispatcher: free models first, paid as fallback.
// Streams responses via SSE for real-time UX.
// Created: May 14, 2026
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const runtime    = 'nodejs'
export const maxDuration = 60

// ── COST LAW model selection ─────────────────────────────────────────────────
// Free first, then escalate based on complexity
function selectChatModel(messageLength: number, isComplex: boolean): { model: string; provider: string } {
  if (isComplex || messageLength > 500) {
    return { model: 'llama-3.3-70b-versatile', provider: 'groq' }  // Still free
  }
  return { model: 'llama-3.1-8b-instant', provider: 'groq' }  // Fastest free
}

// ── Call Groq (free) ─────────────────────────────────────────────────────────
async function callGroq(messages: Array<{ role: string; content: string }>, model: string): Promise<Response> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens:  2048,
      temperature: 0.7,
      stream:      true,
      messages: [
        {
          role:    'system',
          content: `You are Javari, the intelligent AI assistant for CR AudioViz AI — a platform serving creators, businesses, veterans, first responders, faith communities, and animal rescues.

Your mission: "Your Story. Our Design. Everyone Connects. Everyone Wins."

You are helpful, knowledgeable, honest, and cost-conscious. You help users accomplish their goals efficiently.
You have access to a comprehensive ecosystem of tools and apps.
When users ask about capabilities, mention relevant Javari apps.
Keep responses concise but complete. Format with markdown when helpful.
Never hallucinate. If uncertain, say so.`,
        },
        ...messages,
      ],
    }),
  })
  return res
}

// ── Call Google Gemini (free) fallback ────────────────────────────────────────
async function callGemini(messages: Array<{ role: string; content: string }>): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY not set')

  const lastMsg = messages[messages.length - 1]?.content ?? ''
  const history = messages.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: 'You are Javari, an intelligent AI assistant for CR AudioViz AI. Be helpful, honest, and concise.' }] },
        contents: [...history, { role: 'user', parts: [{ text: lastMsg }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    }
  )
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I was unable to generate a response.'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages:  Array<{ role: string; content: string }>
      stream?:   boolean
    }

    const messages  = body.messages ?? []
    const lastMsg   = messages[messages.length - 1]?.content ?? ''
    const isComplex = lastMsg.length > 200 || /code|build|create|analyze|design/i.test(lastMsg)
    const { model, provider } = selectChatModel(lastMsg.length, isComplex)

    console.log('[chat/route] model:', model, 'provider:', provider, 'messages:', messages.length)

    // ── Streaming response (SSE) ──────────────────────────────────────────────
    if (body.stream !== false) {
      try {
        const groqRes = await callGroq(messages, model)
        if (groqRes.ok && groqRes.body) {
          // Pipe Groq's SSE stream directly to client
          return new Response(groqRes.body, {
            status:  200,
            headers: {
              'Content-Type':      'text/event-stream',
              'Cache-Control':     'no-cache',
              'Connection':        'keep-alive',
              'X-Accel-Buffering': 'no',
              'X-Model-Used':      model,
              'X-Provider':        'groq-free',
            },
          })
        }
        throw new Error(`Groq ${groqRes.status}`)
      } catch (err) {
        console.warn('[chat] Groq failed, falling back to Gemini:', err instanceof Error ? err.message : err)
        // Gemini fallback — non-streaming
        const text = await callGemini(messages)
        return NextResponse.json({
          choices: [{ message: { role: 'assistant', content: text } }],
          model:   'gemini-1.5-flash',
          provider: 'google-free',
        })
      }
    }

    // ── Non-streaming response ────────────────────────────────────────────────
    try {
      const groqRes = await callGroq(messages, model)
      if (groqRes.ok) {
        const data = await groqRes.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content ?? ''
        return NextResponse.json({
          choices: [{ message: { role: 'assistant', content } }],
          model,
          provider: 'groq-free',
        })
      }
    } catch { /* fall through to Gemini */ }

    const text = await callGemini(messages)
    return NextResponse.json({
      choices: [{ message: { role: 'assistant', content: text } }],
      model:   'gemini-1.5-flash',
      provider: 'google-free',
    })

  } catch (err) {
    console.error('[chat/route] FATAL:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Chat unavailable', message: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status:   'Javari AI Chat API online',
    model:    'llama-3.3-70b-versatile (groq free)',
    fallback: 'gemini-1.5-flash (google free)',
    cost:     '$0.00',
  })
}
