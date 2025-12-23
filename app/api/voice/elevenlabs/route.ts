// API Route: /api/voice/elevenlabs
// ElevenLabs Text-to-Speech Integration - V2
// Updated: December 22, 2025 - 11:00 PM EST

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Default voice presets
const VOICE_PRESETS = {
  professional: 'pNInz6obpgDQGcFmaJgB',  // Adam
  friendly: 'EXAVITQu4vr4xnSDxMaL',       // Bella  
  authoritative: 'VR6AewLTigWG4xSOukaG',  // Arnold
  warm: 'pFZP5JQG7iQjIQuC4Bku',           // Lily
  default: 'pNInz6obpgDQGcFmaJgB',         // Adam
};

// Helper for error responses
function errorResponse(message: string, status = 500, details?: unknown) {
  console.error('ElevenLabs API error:', message, details);
  return NextResponse.json({ 
    success: false, 
    error: message,
    details: typeof details === 'string' ? details : undefined,
  }, { status });
}

// POST - Generate speech from text
export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return errorResponse('ElevenLabs API key not configured', 500);
    }

    const body = await req.json();
    const {
      text,
      voice = 'default',
      voiceId,
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.5,
    } = body;

    if (!text || text.trim().length === 0) {
      return errorResponse('Text is required', 400);
    }

    // Limit text length (prevent abuse)
    const maxLength = 5000;
    const trimmedText = text.slice(0, maxLength);

    // Resolve voice ID from preset or use provided
    const resolvedVoiceId = voiceId || VOICE_PRESETS[voice as keyof typeof VOICE_PRESETS] || VOICE_PRESETS.default;

    // Call ElevenLabs API
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${resolvedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: trimmedText,
          model_id: 'eleven_turbo_v2_5',
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
      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail?.message || errorJson.detail?.status || errorText;
      } catch {
        // Keep as text
      }
      
      // Handle specific error cases
      if (response.status === 401) {
        return errorResponse('ElevenLabs API key invalid or expired', 401, errorDetail);
      }
      if (errorDetail.includes('unusual_activity')) {
        return errorResponse('Free tier blocked - upgrade to paid plan required', 403, errorDetail);
      }
      
      return errorResponse(`ElevenLabs API error: ${response.status}`, response.status, errorDetail);
    }

    // Get audio buffer
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    // Estimate duration
    const wordCount = trimmedText.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    return NextResponse.json({
      success: true,
      audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
      duration: estimatedDuration,
      characterCount: trimmedText.length,
      voiceId: resolvedVoiceId,
    });

  } catch (error) {
    return errorResponse('Internal server error', 500, (error as Error).message);
  }
}

// GET - Get available voices or voice presets
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'presets';

  try {
    if (action === 'presets') {
      // Return preset voices (no API call needed)
      return NextResponse.json({
        success: true,
        presets: VOICE_PRESETS,
        voices: Object.entries(VOICE_PRESETS).map(([name, id]) => ({
          id,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          category: 'preset',
        })),
      });
    }

    if (action === 'voices') {
      // Fetch all voices from ElevenLabs
      if (!ELEVENLABS_API_KEY) {
        return errorResponse('ElevenLabs API key not configured', 500);
      }

      const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });

      if (!response.ok) {
        return errorResponse(`Failed to fetch voices: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      return NextResponse.json({
        success: true,
        voices: data.voices.map((voice: {
          voice_id: string;
          name: string;
          category: string;
          labels?: Record<string, string>;
        }) => ({
          id: voice.voice_id,
          name: voice.name,
          category: voice.category,
          labels: voice.labels || {},
        })),
      });
    }

    if (action === 'status') {
      // Check API key validity
      if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({
          success: true,
          configured: false,
          status: 'not_configured',
        });
      }

      // Try to get user info
      const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });

      if (response.ok) {
        const user = await response.json();
        return NextResponse.json({
          success: true,
          configured: true,
          status: 'active',
          subscription: user.subscription?.tier || 'unknown',
          characterCount: user.subscription?.character_count || 0,
          characterLimit: user.subscription?.character_limit || 0,
        });
      } else {
        return NextResponse.json({
          success: true,
          configured: true,
          status: 'error',
          error: 'Could not verify API key',
        });
      }
    }

    return NextResponse.json({
      success: true,
      api: 'ElevenLabs Voice API',
      actions: ['presets', 'voices', 'status'],
      usage: {
        GET: '?action=presets|voices|status',
        POST: '{ text, voice?, voiceId?, stability?, similarityBoost?, style? }',
      },
    });

  } catch (error) {
    return errorResponse('Internal server error', 500, (error as Error).message);
  }
}
