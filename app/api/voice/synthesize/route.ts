// app/api/voice/synthesize/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - VOICE SYNTHESIS
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 13, 2025 - 6:50 PM EST
// Version: 1.0 - GIVE JAVARI A VOICE
//
// Capabilities:
// - Text-to-speech with multiple voices
// - Streaming audio for real-time playback
// - Voice selection for different contexts
// - Audio format options (mp3, wav, ogg)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const VOICES = {
  // ElevenLabs voice IDs
  javari: {
    id: 'EXAVITQu4vr4xnSDxMaL', // Rachel - warm, professional female
    name: 'Javari',
    description: 'Default Javari voice - warm, professional, helpful'
  },
  professional: {
    id: '21m00Tcm4TlvDq8ikWAM', // Rachel
    name: 'Professional',
    description: 'Formal business voice'
  },
  friendly: {
    id: 'AZnzlk1XvdvUeBnXmlld', // Domi - young, friendly
    name: 'Friendly',
    description: 'Casual, approachable voice'
  },
  narrator: {
    id: 'pNInz6obpgDQGcFmaJgB', // Adam - deep, authoritative
    name: 'Narrator',
    description: 'Deep, authoritative narrator voice'
  },
  assistant: {
    id: 'ThT5KcBeYPX3keUQqHPh', // Dorothy - helpful assistant
    name: 'Assistant',
    description: 'Helpful assistant voice'
  }
};

const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
};

// ═══════════════════════════════════════════════════════════════════════════════
// ELEVENLABS API
// ═══════════════════════════════════════════════════════════════════════════════

async function synthesizeSpeech(
  text: string,
  voiceId: string,
  outputFormat: string = 'mp3_44100_128'
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: VOICE_SETTINGS
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(`ElevenLabs error: ${error.detail || response.statusText}`);
  }
  
  return response.arrayBuffer();
}

async function synthesizeSpeechStreaming(
  text: string,
  voiceId: string
): Promise<ReadableStream> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: VOICE_SETTINGS
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`ElevenLabs streaming error: ${response.statusText}`);
  }
  
  return response.body!;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART VOICE SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

function selectVoiceForContext(text: string, requestedVoice?: string): string {
  // If specific voice requested, use it
  if (requestedVoice && VOICES[requestedVoice as keyof typeof VOICES]) {
    return VOICES[requestedVoice as keyof typeof VOICES].id;
  }
  
  const lowerText = text.toLowerCase();
  
  // Select based on content type
  if (/error|warning|alert|critical|failed/i.test(lowerText)) {
    return VOICES.professional.id;
  }
  if (/welcome|hello|hi there|great job|congratulations/i.test(lowerText)) {
    return VOICES.friendly.id;
  }
  if (/once upon|chapter|story|narrative/i.test(lowerText)) {
    return VOICES.narrator.id;
  }
  
  // Default to Javari voice
  return VOICES.javari.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT PREPROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

function preprocessTextForSpeech(text: string): string {
  return text
    // Remove markdown formatting
    .replace(/```[\s\S]*?```/g, '(code block omitted)')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, '(link)')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    // Limit length for API
    .slice(0, 5000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      text, 
      voice, 
      format = 'mp3',
      stream = false,
      preprocess = true
    } = body;
    
    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'Text is required'
      }, { status: 400 });
    }
    
    // Preprocess text for better speech
    const processedText = preprocess ? preprocessTextForSpeech(text) : text;
    
    if (processedText.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Text is empty after preprocessing'
      }, { status: 400 });
    }
    
    // Select voice
    const voiceId = selectVoiceForContext(processedText, voice);
    
    // Log request
    await supabase.from('voice_synthesis').insert({
      text_length: processedText.length,
      voice_id: voiceId,
      format,
      streaming: stream,
      created_at: new Date().toISOString()
    });
    
    if (stream) {
      // Return streaming audio
      const audioStream = await synthesizeSpeechStreaming(processedText, voiceId);
      
      return new Response(audioStream, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Transfer-Encoding': 'chunked',
          'X-Voice-Used': voiceId,
          'X-Duration': String(Date.now() - startTime)
        }
      });
    }
    
    // Generate audio
    const outputFormat = format === 'wav' ? 'pcm_44100' : 
                        format === 'ogg' ? 'ogg_opus' : 'mp3_44100_128';
    
    const audioBuffer = await synthesizeSpeech(processedText, voiceId, outputFormat);
    
    // Return audio file
    const contentType = format === 'wav' ? 'audio/wav' :
                       format === 'ogg' ? 'audio/ogg' : 'audio/mpeg';
    
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(audioBuffer.byteLength),
        'X-Voice-Used': voiceId,
        'X-Text-Length': String(processedText.length),
        'X-Duration': String(Date.now() - startTime)
      }
    });
    
  } catch (error) {
    console.error('[Voice] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}

export async function GET() {
  // Check if ElevenLabs is configured
  const isConfigured = !!process.env.ELEVENLABS_API_KEY;
  
  // Get usage stats
  const { data: stats } = await supabase
    .from('voice_synthesis')
    .select('text_length, voice_id')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const totalCharacters = stats?.reduce((a, s) => a + (s.text_length || 0), 0) || 0;
  
  return NextResponse.json({
    status: isConfigured ? 'ok' : 'not_configured',
    name: 'Javari Voice Synthesis',
    version: '1.0',
    provider: 'ElevenLabs',
    configured: isConfigured,
    voices: Object.entries(VOICES).map(([key, voice]) => ({
      key,
      name: voice.name,
      description: voice.description
    })),
    formats: ['mp3', 'wav', 'ogg'],
    features: [
      'Multiple voice personas',
      'Streaming audio',
      'Smart voice selection',
      'Text preprocessing',
      'Markdown removal'
    ],
    usage: {
      last24Hours: {
        requests: stats?.length || 0,
        totalCharacters
      }
    },
    apiUsage: {
      method: 'POST',
      body: {
        text: 'Text to synthesize (required)',
        voice: 'Voice key: javari | professional | friendly | narrator | assistant',
        format: 'mp3 | wav | ogg (default: mp3)',
        stream: 'boolean - stream audio (default: false)',
        preprocess: 'boolean - clean markdown etc (default: true)'
      }
    },
    timestamp: new Date().toISOString()
  });
}
