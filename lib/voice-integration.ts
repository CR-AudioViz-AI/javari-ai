// Javari Voice Integration
// Google Cloud TTS and Speech-to-Text

export interface VoiceConfig {
  language: string;
  voice: string;
  speed: number;
  pitch: number;
}

const DEFAULT_CONFIG: VoiceConfig = {
  language: 'en-US',
  voice: 'en-US-Neural2-J', // Google Cloud TTS voice
  speed: 1.0,
  pitch: 0,
};

/**
 * Convert text to speech using Google Cloud TTS
 */
export async function textToSpeech(
  text: string,
  config: Partial<VoiceConfig> = {}
): Promise<{ audioUrl: string; duration: number }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const response = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: finalConfig.language,
        voice: finalConfig.voice,
        speed: finalConfig.speed,
        pitch: finalConfig.pitch,
      }),
    });

    const data = await response.json();
    return {
      audioUrl: data.audioUrl,
      duration: data.duration,
    };
  } catch (error) {
    console.error('TTS error:', error);
    throw error;
  }
}

/**
 * Convert speech to text using Google Cloud Speech-to-Text
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
      confidence: data.confidence,
    };
  } catch (error) {
    console.error('STT error:', error);
    throw error;
  }
}

/**
 * Start listening to microphone
 */
export function startListening(
  onTranscript: (text: string) => void,
  onError?: (error: Error) => void
): () => void {
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
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

      mediaRecorder.start();
    })
    .catch(error => {
      onError?.(error as Error);
    });

  // Return stop function
  return () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };
}

/**
 * Play audio from URL
 */
export async function playAudio(audioUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Failed to play audio'));
    audio.play();
  });
}

/**
 * Stream TTS response (play while generating)
 */
export async function streamTTS(
  text: string,
  onChunkReady: (audioUrl: string) => void
): Promise<void> {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  for (const sentence of sentences) {
    const { audioUrl } = await textToSpeech(sentence.trim());
    onChunkReady(audioUrl);
  }
}
