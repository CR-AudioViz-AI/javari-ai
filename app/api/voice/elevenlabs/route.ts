// =============================================================================
// ELEVENLABS VOICE API - JAVARI AI
// =============================================================================
// Female-focused voice presets for sophisticated AI assistant
// Updated: December 24, 2025 - 12:15 PM EST
// =============================================================================

import { NextRequest } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Female voice presets - Javari is a sophisticated, experienced woman
const VOICE_PRESETS = {
  // PRIMARY - Javari's default voice
  javari: 'XB0fDUnXU5powFXDhCwa',         // Charlotte - sophisticated, confident British
  default: 'XB0fDUnXU5powFXDhCwa',         // Charlotte
  
  // Alternative female voices
  professional: '21m00Tcm4TlvDq8ikWAM',    // Rachel - calm, professional American
  warm: 'ThT5KcBeYPX3keUQqHPh',            // Dorothy - British, pleasant, mature
  friendly: 'EXAVITQu4vr4xnSDxMaL',        // Bella - soft, approachable
  intimate: 'piTKgcLEGmPE4e6mEKli',        // Nicole - whisper, intimate
  confident: 'XrExE9yKIg1WjnnlVkGX',       // Matilda - friendly, warm
  
  // Legacy male voices (kept for backwards compatibility)
  male_professional: 'pNInz6obpgDQGcFmaJgB',  // Adam
  male_authoritative: 'VR6AewLTigWG4xSOukaG', // Arnold
};

// Voice settings for more natural speech
const VOICE_SETTINGS = {
  stability: 0.5,           // Balance between stability and expressiveness
  similarity_boost: 0.75,   // How closely to match the original voice
  style: 0.4,               // Expressiveness (0-1)
  use_speaker_boost: true,  // Enhance clarity
};

// Helper for error responses
function errorResponse(message: string, status = 500, details?: unknown) {
  console.error('ElevenLabs API error:', message, details);
  return Response.json(
    { success: false, error: message, details },
    { status }
  );
}

// GET handler - status and presets
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'status') {
    if (!ELEVENLABS_API_KEY) {
      return Response.json({
        success: true,
        configured: false,
        status: 'not_configured',
        message: 'ElevenLabs API key not set'
      });
    }

    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
        headers: { 'xi-api-key': ELEVENLABS_API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        return Response.json({
          success: true,
          configured: true,
          status: 'active',
          subscription: data.tier,
          characterCount: data.character_count,
          characterLimit: data.character_limit,
        });
      } else {
        return Response.json({
          success: true,
          configured: true,
          status: 'error',
          error: 'Could not verify API key'
        });
      }
    } catch (error) {
      return errorResponse('Failed to check status', 500, error);
    }
  }

  if (action === 'presets') {
    return Response.json({
      success: true,
      presets: VOICE_PRESETS,
      default: 'javari',
      description: 'Javari uses Charlotte - a sophisticated, confident female voice',
      voices: [
        { id: 'javari', name: 'Javari (Charlotte)', category: 'primary', description: 'Sophisticated, confident British woman' },
        { id: 'professional', name: 'Professional (Rachel)', category: 'female', description: 'Calm, professional American' },
        { id: 'warm', name: 'Warm (Dorothy)', category: 'female', description: 'British, pleasant, mature' },
        { id: 'friendly', name: 'Friendly (Bella)', category: 'female', description: 'Soft, approachable' },
        { id: 'intimate', name: 'Intimate (Nicole)', category: 'female', description: 'Whisper, intimate' },
        { id: 'confident', name: 'Confident (Matilda)', category: 'female', description: 'Friendly, warm' },
      ]
    });
  }

  // Default response
  return Response.json({
    success: true,
    message: 'ElevenLabs Voice API - Use POST to generate speech',
    endpoints: {
      'GET ?action=status': 'Check API status',
      'GET ?action=presets': 'Get available voice presets',
      'POST': 'Generate speech from text'
    }
  });
}

// POST handler - generate speech
export async function POST(request: NextRequest) {
  if (!ELEVENLABS_API_KEY) {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  try {
    const body = await request.json();
    const { text, voice = 'javari', voiceId } = body;

    if (!text || text.trim().length === 0) {
      return errorResponse('Text is required', 400);
    }

    // Limit text length to prevent abuse
    const maxLength = 5000;
    const trimmedText = text.slice(0, maxLength);

    // Resolve voice ID - default to Javari (Charlotte)
    const resolvedVoiceId = voiceId || VOICE_PRESETS[voice as keyof typeof VOICE_PRESETS] || VOICE_PRESETS.javari;

    // Call ElevenLabs API with enhanced settings
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
          model_id: 'eleven_turbo_v2_5',  // Fast, high-quality model
          voice_settings: VOICE_SETTINGS,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', response.status, errorText);
      return errorResponse(
        `ElevenLabs API error: ${response.status}`,
        response.status,
        errorText
      );
    }

    // Convert audio to base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return Response.json({
      success: true,
      audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
      voice: voice,
      voiceId: resolvedVoiceId,
      characterCount: trimmedText.length,
      duration: trimmedText.length / 15, // Rough estimate
    });

  } catch (error) {
    console.error('Speech generation error:', error);
    return errorResponse('Failed to generate speech', 500, error);
  }
}
