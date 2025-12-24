'use client';

// Voice Panel Component for Javari
// ElevenLabs Text-to-Speech Integration
// Updated: December 24, 2025 - Now uses Charlotte (sophisticated female voice) - 11:05 PM EST

import React, { useState, useRef, useEffect } from 'react';

interface VoicePreset {
  id: string;
  name: string;
}

interface VoiceStatus {
  configured: boolean;
  status: string;
  subscription?: string;
  characterCount?: number;
  characterLimit?: number;
}

const DEFAULT_PRESETS: VoicePreset[] = [
  { id: 'professional', name: 'Professional' },
  { id: 'friendly', name: 'Friendly' },
  { id: 'authoritative', name: 'Authoritative' },
  { id: 'warm', name: 'Warm' },
];

export default function VoicePanel({ 
  text,
  autoPlay = false,
  onPlayStart,
  onPlayEnd,
  onError,
}: {
  text?: string;
  autoPlay?: boolean;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState('professional');
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTextRef = useRef<string>('');

  // Check voice API status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Auto-play when text changes (if enabled and autoPlay is true)
  useEffect(() => {
    if (autoPlay && enabled && text && text !== lastTextRef.current) {
      lastTextRef.current = text;
      speak(text);
    }
  }, [text, enabled, autoPlay]);

  async function checkStatus() {
    try {
      const res = await fetch('/api/voice/elevenlabs?action=status');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to check voice status:', err);
    }
  }

  async function speak(textToSpeak: string) {
    if (!textToSpeak || loading || playing) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/voice/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          voice,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate speech');
      }

      // Create and play audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlaying(true);
        onPlayStart?.();
      };

      audio.onended = () => {
        setPlaying(false);
        onPlayEnd?.();
      };

      audio.onerror = () => {
        setPlaying(false);
        setError('Failed to play audio');
        onError?.('Failed to play audio');
      };

      await audio.play();
    } catch (err) {
      const errorMsg = (err as Error).message;
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    }
  }

  function toggleEnabled() {
    const newState = !enabled;
    setEnabled(newState);
    if (!newState && audioRef.current) {
      stop();
    }
  }

  // Compact toggle for embedding in chat
  if (!enabled) {
    return (
      <button
        onClick={toggleEnabled}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-600 transition-colors"
        title="Enable voice responses"
      >
        <VolumeOffIcon className="w-4 h-4" />
        <span>Voice Off</span>
      </button>
    );
  }

  // Full panel when enabled
  return (
    <div className="bg-blue-50 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VolumeIcon className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-blue-800">Voice Enabled</span>
        </div>
        <button
          onClick={toggleEnabled}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Disable
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Voice:</label>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
          disabled={loading || playing}
        >
          {DEFAULT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        {playing ? (
          <button
            onClick={stop}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            <StopIcon className="w-4 h-4" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => text && speak(text)}
            disabled={loading || !text}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded ${
              loading || !text
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <LoadingIcon className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                Speak Response
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {status?.characterLimit && status.characterLimit > 0 && (
        <div className="text-xs text-gray-500">
          Usage: {status.characterCount?.toLocaleString()} / {status.characterLimit.toLocaleString()} characters
        </div>
      )}
    </div>
  );
}

// Simple icons as components
function VolumeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

