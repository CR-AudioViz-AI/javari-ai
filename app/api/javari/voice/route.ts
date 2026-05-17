// app/api/javari/voice/route.ts
// Javari AI Voice — ElevenLabs TTS (text→speech) + Whisper STT (speech→text)
// Full production implementation
// Updated: May 17, 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 30

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? ''
const OPENAI_KEY     = process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? ''
const GROQ_KEY       = process.env.GROQ_API_KEY ?? ''

// ElevenLabs voice IDs
const VOICES = {
  rachel:      'EXAVITQu4vr4xnSDxMaL',
  josh:        'TxGEqnHWrfWFTfGW9XjX',
  elli:        'MF3mGyEYCl7XYWbV9V6O',
  adam:        'pNInz6obpgDQGcFmaJgB',
  bella:       'EXAVITQu4vr4xnSDxMaL',
  javari:      'EXAVITQu4vr4xnSDxMaL',  // default
}

export async function GET() {
  return NextResponse.json({
    status:      'Javari Voice API online',
    tts_enabled: !!ELEVENLABS_KEY,
    stt_enabled: !!(GROQ_KEY || OPENAI_KEY),
    voices:      Object.keys(VOICES),
    formats:     ['mp3', 'pcm', 'ulaw'],
    cost:        'ElevenLabs 10K chars/month FREE',
  })
}

export async function POST(req: NextRequest) {
  try {
    const ct   = req.headers.get('content-type') ?? ''
    const mode = req.nextUrl.searchParams.get('mode') ?? 'tts'

    // ── TTS: text → speech ──────────────────────────────────────────────────
    if (mode === 'tts' || !ct.includes('multipart')) {
      if (!ELEVENLABS_KEY) {
        return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 503 })
      }

      const body = await req.json() as {
        text:      string
        voice?:    keyof typeof VOICES
        stability?: number
        clarity?:   number
      }

      if (!body.text?.trim()) {
        return NextResponse.json({ error: 'text is required' }, { status: 400 })
      }

      const voiceId = VOICES[body.voice ?? 'javari'] ?? VOICES.javari
      const text    = body.text.slice(0, 5000)  // ElevenLabs limit

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method:  'POST',
          headers: {
            'xi-api-key':    ELEVENLABS_KEY,
            'Content-Type':  'application/json',
            'Accept':        'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability:        body.stability  ?? 0.5,
              similarity_boost: body.clarity    ?? 0.75,
            },
          }),
        }
      )

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `ElevenLabs error: ${err.slice(0, 100)}` }, { status: 502 })
      }

      const audioBuffer = await res.arrayBuffer()

      return new Response(audioBuffer, {
        headers: {
          'Content-Type':  'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
          'Cache-Control': 'no-cache',
          'X-Voice-Used':  body.voice ?? 'javari',
          'X-Chars-Used':  String(text.length),
        },
      })
    }

    // ── STT: speech → text (via Groq Whisper — free) ────────────────────────
    if (mode === 'stt') {
      if (!GROQ_KEY) {
        return NextResponse.json({ error: 'Speech-to-text not configured' }, { status: 503 })
      }

      const formData = await req.formData()
      const audio    = formData.get('audio') as Blob | null
      if (!audio) {
        return NextResponse.json({ error: 'audio file required in form data' }, { status: 400 })
      }

      const groqForm = new FormData()
      groqForm.append('file', audio, 'audio.webm')
      groqForm.append('model', 'whisper-large-v3')
      groqForm.append('language', 'en')

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body:    groqForm,
      })

      if (!res.ok) {
        return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
      }

      const d = await res.json() as { text?: string }
      return NextResponse.json({ transcript: d.text ?? '', provider: 'groq-whisper', cost: '$0.00' })
    }

    return NextResponse.json({ error: 'Invalid mode. Use ?mode=tts or ?mode=stt' }, { status: 400 })

  } catch (err) {
    console.error('[voice] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
