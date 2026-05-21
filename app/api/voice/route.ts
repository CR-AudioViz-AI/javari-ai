// app/api/voice/route.ts
// Javari Voice — Text to Speech (ElevenLabs) + Speech to Text (Whisper)
// Free tier: browser Web Speech API | Pro: ElevenLabs quality voices
// CR AudioViz AI · EIN 39-3646201 · May 2026
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Text-to-Speech using ElevenLabs
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, voice_id = 'pNInz6obpgDQGcFmaJgB', model_id = 'eleven_monolingual_v1', action = 'tts' } = body

    if (action === 'tts') {
      const elevenKey = process.env.ELEVENLABS_API_KEY

      // If no ElevenLabs key, return instruction to use Web Speech API
      if (!elevenKey) {
        return NextResponse.json({
          method: 'web-speech',
          text,
          message: 'Using browser Web Speech API — upgrade for premium voice quality',
        })
      }

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenKey,
          },
          body: JSON.stringify({
            text,
            model_id,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      )

      if (!res.ok) {
        return NextResponse.json({ method: 'web-speech', text })
      }

      const audioBuffer = await res.arrayBuffer()
      return new Response(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        },
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Speech-to-Text using Whisper
export async function PUT(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File | null

    if (!audio) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'Transcription not configured' }, { status: 503 })
    }

    const fd = new FormData()
    fd.append('file', audio)
    fd.append('model', 'whisper-1')
    fd.append('language', 'en')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: fd,
    })

    if (!res.ok) throw new Error('Transcription failed')

    const data = await res.json()
    return NextResponse.json({ text: data.text, duration: data.duration })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
