// app/api/javari/voice/route.ts
// Javari AI Voice — ElevenLabs TTS + STT
// Created: May 15, 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? ''
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // Rachel — natural, warm

export async function GET() {
  return NextResponse.json({
    status: 'Javari Voice API online',
    tts: !!ELEVENLABS_API_KEY,
    voices: ['Rachel', 'Josh', 'Elli', 'Arnold', 'Adam', 'Domi', 'Bella', 'Antoni'],
    cost: '$0.00 (ElevenLabs free tier: 10,000 chars/month)'
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: string; voice_id?: string; model?: string }
    const text = body.text?.trim()
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    if (!ELEVENLABS_API_KEY) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 503 })

    const voiceId = body.voice_id ?? DEFAULT_VOICE_ID
    const model   = body.model ?? 'eleven_multilingual_v2'

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method:  'POST',
      headers: {
        'xi-api-key':    ELEVENLABS_API_KEY,
        'Content-Type':  'application/json',
        'Accept':        'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id:        model,
        voice_settings:  { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `ElevenLabs error: ${err.slice(0, 200)}` }, { status: res.status })
    }

    const audio = await res.arrayBuffer()
    return new Response(audio, {
      status:  200,
      headers: {
        'Content-Type':  'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'X-Voice-Id':    voiceId,
        'X-Chars-Used':  String(text.length),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
