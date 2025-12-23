// Javari Voice Integration
// ElevenLabs (primary), Google Cloud TTS (fallback)
// Updated: December 22, 2025

export type VoiceProvider = 'elevenlabs' | 'google';

export interface VoiceConfig {
  provider: VoiceProvider;
  language: string;
  voice: string;
  speed: number;
  pitch: number;
  stability?: number;      // ElevenLabs-specific
  similarityBoost?: number; // ElevenLabs-specific
  style?: number;          // ElevenLabs-specific
}

// ElevenLabs voice presets for Javari personality
export const ELEVENLABS_VOICES = {
  professional: 'pNInz6obpgDQGcFmaJgB', // Adam - professional male
  friendly: 'EXAVITQu4vr4xnSDxMaL',     // Bella - friendly female
  authoritative: 'VR6AewLTigWG4xSOukaG', // Arnold - authoritative
  warm: 'pFZP5JQG7iQjIQuC4Bku',         // Lily - warm female
  default: 'pNInz6obpgDQGcFmaJgB',       // Adam as default
} as const;

const DEFAULT_CONFIG: VoiceConfig = {
  provider: 'elevenlabs',
  language: 'en-US',
  voice: ELEVENLABS_VOICES.professional,
  speed: 1.0,
  pitch: 0,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.5,
};

// Google Cloud fallback config
const GOOGLE_FALLBACK_CONFIG: VoiceConfig = {
  provider: 'google',
  language: 'en-US',
  voice: 'en-US-Neural2-J',
  speed: 1.0,
  pitch: 0,
};

/**
 * Convert text to speech using ElevenLabs (primary) or Google Cloud (fallback)
 */
export async function textToSpeech(
  text: string,
  config: Partial<VoiceConfig> = {}
): Promise<{ audioUrl: string; duration: number; provider: VoiceProvider }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Try ElevenLabs first
    if (finalConfig.provider === 'elevenlabs') {
      const result = await elevenLabsTTS(text, finalConfig);
      return { ...result, provider: 'elevenlabs' };
    }
  } catch (error) {
    console.warn('ElevenLabs failed, falling back to Google TTS:', error);
  }

  // Fallback to Google
  const result = await googleTTS(text, { ...GOOGLE_FALLBACK_CONFIG, ...config });
  return { ...result, provider: 'google' };
}

/**
 * ElevenLabs Text-to-Speech
 */
async function elevenLabsTTS(
  text: string,
  config: VoiceConfig
): Promise<{ audioUrl: string; duration: number }> {
  const response = await fetch('/api/voice/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceId: config.voice,
      stability: config.stability,
      similarityBoost: config.similarityBoost,
      style: config.style,
      speed: config.speed,
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    audioUrl: data.audioUrl,
    duration: data.duration || estimateDuration(text),
  };
}

/**
 * Google Cloud Text-to-Speech (fallback)
 */
async function googleTTS(
  text: string,
  config: VoiceConfig
): Promise<{ audioUrl: string; duration: number }> {
  const response = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language: config.language,
      voice: config.voice,
      speed: config.speed,
      pitch: config.pitch,
    }),
  });

  const data = await response.json();
  return {
    audioUrl: data.audioUrl,
    duration: data.duration || estimateDuration(text),
  };
}

/**
 * Estimate audio duration based on text length
 */
function estimateDuration(text: string): number {
  const wordsPerMinute = 150;
  const words = text.split(/\s+/).length;
  return (words / wordsPerMinute) * 60;
}

/**
 * Convert speech to text using Whisper API (via ElevenLabs or OpenAI)
 */
export async function speechToText(
  audioBlob: Blob
): Promise<{ text: string; confidence: number }> {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    const response = await fetch('/api/voice/stt', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return {
      text: data.text,
      confidence: data.confidence ?? 0.95,
    };
  } catch (error) {
    console.error('STT error:', error);
    throw error;
  }
}

/**
 * Start listening to microphone with real-time transcription
 */
export function startListening(
  onTranscript: (text: string) => void,
  onError?: (error: Error) => void
): () => void {
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        chunks = [];

        try {
          const result = await speechToText(audioBlob);
          onTranscript(result.text);
        } catch (error) {
          onError?.(error as Error);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
    })
    .catch(error => {
      onError?.(error as Error);
    });

  return () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };
}

/**
 * Play audio from URL or base64
 */
export async function playAudio(audioUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Failed to play audio'));
    audio.play().catch(reject);
  });
}

/**
 * Stream TTS response - speak while generating
 */
export async function streamTTS(
  text: string,
  onChunkReady: (audioUrl: string) => void,
  config: Partial<VoiceConfig> = {}
): Promise<void> {
  // Split by sentences for natural streaming
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed) {
      const { audioUrl } = await textToSpeech(trimmed, config);
      onChunkReady(audioUrl);
    }
  }
}

/**
 * Get available ElevenLabs voices
 */
export async function getAvailableVoices(): Promise<Array<{
  id: string;
  name: string;
  category: string;
}>> {
  try {
    const response = await fetch('/api/voice/voices');
    const data = await response.json();
    return data.voices || [];
  } catch {
    // Return default voices if API fails
    return Object.entries(ELEVENLABS_VOICES).map(([name, id]) => ({
      id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      category: 'preset',
    }));
  }
}

/**
 * Voice-enabled Javari response
 */
export async function speakJavariResponse(
  response: string,
  personality: 'professional' | 'friendly' | 'authoritative' | 'warm' = 'professional'
): Promise<void> {
  const voice = ELEVENLABS_VOICES[personality] || ELEVENLABS_VOICES.default;
  
  await streamTTS(response, async (audioUrl) => {
    await playAudio(audioUrl);
  }, { voice });
}

/**
 * Check if voice features are available
 */
export function isVoiceSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia &&
    window.Audio
  );
}
