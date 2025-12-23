// API Route: /api/voice/elevenlabs
// ElevenLabs Text-to-Speech Integration
// Updated: December 22, 2025

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

interface TTSRequest {
  text: string;
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
}

export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const body: TTSRequest = await req.json();
    const { 
      text, 
      voiceId = 'pNInz6obpgDQGcFmaJgB', // Adam - default
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.5,
      speed = 1.0
    } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    const maxLength = 5000;
    const trimmedText = text.slice(0, maxLength);

    // Call ElevenLabs API
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: trimmedText,
          model_id: 'eleven_turbo_v2_5', // Latest turbo model
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      return NextResponse.json(
        { error: 'ElevenLabs API error', details: errorText },
        { status: response.status }
      );
    }

    // Get audio buffer
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    // Estimate duration (roughly 150 words per minute at normal speed)
    const wordCount = trimmedText.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60 / speed;

    return NextResponse.json({
      audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
      duration: estimatedDuration,
      characterCount: trimmedText.length,
      voiceId,
    });

  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET - Get available voices
export async function GET() {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'Accept': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Format voices for frontend
    const voices = data.voices.map((voice: {
      voice_id: string;
      name: string;
      category: string;
      labels?: Record<string, string>;
    }) => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      labels: voice.labels || {},
    }));

    return NextResponse.json({ voices });

  } catch (error) {
    console.error('ElevenLabs voices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voices' },
      { status: 500 }
    );
  }
}
