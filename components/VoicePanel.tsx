'use client';

// =============================================================================
// JAVARI VOICE PANEL - SIMPLE & RELIABLE
// =============================================================================
// Auto-speaks when text is provided. No extra buttons needed.
// Updated: December 24, 2025 - 12:45 PM EST
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';

interface VoicePanelProps {
  text: string;
  autoPlay?: boolean;
  voice?: string;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
}

export default function VoicePanel({ 
  text,
  autoPlay = true,
  voice = 'javari',
  onSpeakStart,
  onSpeakEnd,
}: VoicePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef(false);
  const textRef = useRef(text);

  // Auto-speak when component mounts with new text
  useEffect(() => {
    // Only speak if autoPlay is enabled and we haven't played this text yet
    if (autoPlay && text && text !== textRef.current) {
      textRef.current = text;
      hasPlayedRef.current = false;
    }
    
    if (autoPlay && text && !hasPlayedRef.current && !isLoading && !isPlaying) {
      hasPlayedRef.current = true;
      speakText(text);
    }
  }, [text, autoPlay]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  async function speakText(textToSpeak: string) {
    if (!textToSpeak || isLoading || isPlaying) return;

    setIsLoading(true);
    setError(null);
    onSpeakStart?.();

    try {
      const response = await fetch('/api/voice/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: textToSpeak.slice(0, 3000), // Limit length
          voice: voice 
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate speech');
      }

      // Create and play audio
      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
        onSpeakEnd?.();
      };

      audio.onerror = () => {
        setError('Audio playback failed');
        setIsPlaying(false);
        setIsLoading(false);
        onSpeakEnd?.();
      };

      await audio.play();

    } catch (err) {
      console.error('Voice error:', err);
      setError(err instanceof Error ? err.message : 'Voice failed');
      setIsLoading(false);
      onSpeakEnd?.();
    }
  }

  // Manual play button (replay)
  function handleReplay() {
    if (text && !isLoading && !isPlaying) {
      hasPlayedRef.current = false;
      speakText(text);
    }
  }

  // Show a small indicator while speaking
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-cyan-400 text-xs mt-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Speaking...</span>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className="flex items-center gap-2 text-cyan-400 text-xs mt-2">
        <Volume2 className="w-3 h-3 animate-pulse" />
        <span>Javari is speaking...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-xs mt-2">
        Voice error: {error}
      </div>
    );
  }

  // Show replay button after speech ends
  return (
    <button
      onClick={handleReplay}
      className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-xs mt-2 transition-colors"
      title="Replay voice"
    >
      <Volume2 className="w-3 h-3" />
      <span>Replay</span>
    </button>
  );
}
