'use client';

// =============================================================================
// VOICE CONVERSATION MODE - HANDS-FREE CHAT WITH JAVARI
// =============================================================================
// ONE button to toggle. Then just talk naturally.
// - You speak → your words appear on screen
// - You pause → Javari responds (text + voice)
// - She finishes → starts listening again automatically
// =============================================================================
// Updated: December 24, 2025 - 3:55 PM EST
// =============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';

interface VoiceConversationProps {
  onUserMessage: (message: string) => Promise<string>;
  isProcessing?: boolean;
}

// Silence detection - how long to wait after user stops speaking
const SILENCE_TIMEOUT_MS = 1500; // 1.5 seconds of silence = send message

export default function VoiceConversation({ 
  onUserMessage,
  isProcessing = false 
}: VoiceConversationProps) {
  // Voice mode state
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<string>('');
  
  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Clear silence timer on any speech
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }
      
      // Update display
      if (finalTranscript) {
        setTranscript(prev => (prev + ' ' + finalTranscript).trim());
      } else if (interimTranscript) {
        // Show interim in different style
        setTranscript(prev => {
          const base = prev.split('...')[0].trim();
          return base + (base ? ' ' : '') + interimTranscript + '...';
        });
      }
      
      // Start silence detection timer
      silenceTimerRef.current = setTimeout(() => {
        // User stopped speaking - send the message
        handleSilenceDetected();
      }, SILENCE_TIMEOUT_MS);
    };
    
    recognition.onerror = (event: Event) => {
      console.error('Speech recognition error:', event);
      if (voiceModeActive && !isProcessingRef.current) {
        // Try to restart
        setTimeout(() => startListening(), 500);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if voice mode is still active and we're not processing
      if (voiceModeActive && !isProcessingRef.current && !isSpeaking) {
        setTimeout(() => startListening(), 300);
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [voiceModeActive, isSpeaking]);

  // Handle silence detection - user stopped speaking
  const handleSilenceDetected = useCallback(async () => {
    const message = transcript.replace('...', '').trim();
    if (!message || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setStatus('Thinking...');
    
    // Stop listening while processing
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
    setIsListening(false);
    
    try {
      // Get Javari's response
      const response = await onUserMessage(message);
      
      // Clear transcript for next round
      setTranscript('');
      
      // Speak the response
      if (response) {
        await speakResponse(response);
      }
    } catch (error) {
      console.error('Error getting response:', error);
      setStatus('Error - tap to retry');
    } finally {
      isProcessingRef.current = false;
      setStatus('');
      
      // Resume listening after Javari finishes speaking
      if (voiceModeActive) {
        setTimeout(() => startListening(), 500);
      }
    }
  }, [transcript, onUserMessage, voiceModeActive]);

  // Speak Javari's response
  const speakResponse = async (text: string): Promise<void> => {
    setIsSpeaking(true);
    setStatus('Javari speaking...');
    
    try {
      const response = await fetch('/api/voice/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text.slice(0, 3000),
          voice: 'javari'
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.audioUrl) {
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(data.audioUrl);
          audioRef.current = audio;
          
          audio.onended = () => {
            setIsSpeaking(false);
            resolve();
          };
          
          audio.onerror = () => {
            setIsSpeaking(false);
            reject(new Error('Audio playback failed'));
          };
          
          audio.play().catch(reject);
        });
      }
    } catch (error) {
      console.error('Speech error:', error);
      setIsSpeaking(false);
    }
  };

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening || isSpeaking || isProcessingRef.current) return;
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setStatus('Listening...');
    } catch (e) {
      console.error('Failed to start listening:', e);
    }
  }, [isListening, isSpeaking]);

  // Toggle voice mode
  const toggleVoiceMode = () => {
    if (voiceModeActive) {
      // Turn OFF
      setVoiceModeActive(false);
      setIsListening(false);
      setTranscript('');
      setStatus('');
      try { recognitionRef.current?.stop(); } catch (e) {}
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      // Turn ON
      setVoiceModeActive(true);
      setTranscript('');
      setTimeout(() => startListening(), 100);
    }
  };

  // Check for browser support
  const isSupported = typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!isSupported) {
    return (
      <div className="text-yellow-500 text-sm p-2">
        Voice not supported. Use Chrome or Edge.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Main toggle button */}
      <button
        onClick={toggleVoiceMode}
        disabled={isProcessing}
        className={`
          flex items-center justify-center gap-3 
          px-6 py-4 rounded-xl font-medium text-lg
          transition-all duration-300 
          ${voiceModeActive 
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30' 
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
          }
          ${isListening ? 'animate-pulse' : ''}
        `}
      >
        {voiceModeActive ? (
          <>
            {isListening ? (
              <Mic className="w-6 h-6 text-white" />
            ) : isSpeaking ? (
              <Volume2 className="w-6 h-6 text-white animate-pulse" />
            ) : (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            )}
            <span>
              {isListening ? 'Listening... (tap to stop)' : 
               isSpeaking ? 'Javari speaking...' : 
               'Processing...'}
            </span>
          </>
        ) : (
          <>
            <MicOff className="w-6 h-6" />
            <span>Start Voice Chat</span>
          </>
        )}
      </button>
      
      {/* Live transcript display */}
      {voiceModeActive && transcript && (
        <div 
          className="p-4 rounded-lg bg-gray-800/50 border border-cyan-500/30"
          style={{ minHeight: '60px' }}
        >
          <div className="text-xs text-cyan-400 mb-1">You're saying:</div>
          <div className="text-white text-lg">{transcript}</div>
        </div>
      )}
      
      {/* Status indicator */}
      {voiceModeActive && status && !transcript && (
        <div className="text-center text-cyan-400 text-sm animate-pulse">
          {status}
        </div>
      )}
    </div>
  );
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
