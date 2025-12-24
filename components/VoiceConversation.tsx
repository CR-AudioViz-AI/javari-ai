'use client';

// =============================================================================
// VOICE CONVERSATION MODE - HANDS-FREE CHAT WITH JAVARI
// =============================================================================
// ONE button. Talk naturally. She responds. Loop continues.
// Fixed: December 24, 2025 - 4:45 PM EST
// =============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, Loader2, Square } from 'lucide-react';

interface VoiceConversationProps {
  onUserMessage: (message: string) => Promise<string>;
  isProcessing?: boolean;
}

export default function VoiceConversation({ 
  onUserMessage,
  isProcessing = false 
}: VoiceConversationProps) {
  // State
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [status, setStatus] = useState('');
  
  // Refs for values that need to persist across renders
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef(''); // Use ref to avoid stale closures
  const isProcessingRef = useRef(false);
  const lastSpeechTimeRef = useRef(Date.now());

  // Clear silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Send message to Javari
  const sendToJavari = useCallback(async () => {
    const message = transcriptRef.current.trim();
    
    if (!message || isProcessingRef.current) {
      return;
    }
    
    console.log('Sending to Javari:', message);
    isProcessingRef.current = true;
    setIsThinking(true);
    setStatus('Javari is thinking...');
    
    // Stop listening while processing
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    
    try {
      // Get response from Javari
      const response = await onUserMessage(message);
      
      // Clear transcript for next round
      transcriptRef.current = '';
      setDisplayText('');
      
      // Speak the response
      if (response) {
        await speakResponse(response);
      }
    } catch (error) {
      console.error('Error:', error);
      setStatus('Error - try again');
    } finally {
      isProcessingRef.current = false;
      setIsThinking(false);
      
      // Resume listening
      if (voiceModeActive) {
        setTimeout(() => startListening(), 500);
      }
    }
  }, [onUserMessage, voiceModeActive]);

  // Start silence detection timer
  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    
    silenceTimerRef.current = setTimeout(() => {
      // Check if we have text and enough time has passed since last speech
      const timeSinceLastSpeech = Date.now() - lastSpeechTimeRef.current;
      
      if (transcriptRef.current.trim() && timeSinceLastSpeech >= 1500) {
        console.log('Silence detected, sending message...');
        sendToJavari();
      }
    }, 2000); // 2 seconds of silence
  }, [clearSilenceTimer, sendToJavari]);

  // Speak Javari's response
  const speakResponse = async (text: string): Promise<void> => {
    setIsSpeaking(true);
    setStatus('Javari is speaking...');
    
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
        await new Promise<void>((resolve) => {
          const audio = new Audio(data.audioUrl);
          audioRef.current = audio;
          
          audio.onended = () => {
            setIsSpeaking(false);
            setStatus('Listening...');
            resolve();
          };
          
          audio.onerror = () => {
            setIsSpeaking(false);
            resolve();
          };
          
          audio.play().catch(() => {
            setIsSpeaking(false);
            resolve();
          });
        });
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('Speech error:', error);
      setIsSpeaking(false);
    }
  };

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening || isSpeaking || isProcessingRef.current) {
      return;
    }
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setStatus('Listening... speak now');
      lastSpeechTimeRef.current = Date.now();
    } catch (e) {
      console.error('Failed to start listening:', e);
    }
  }, [isListening, isSpeaking]);

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
      let finalTranscript = '';
      let interimTranscript = '';
      
      // Process all results
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += text + ' ';
        } else {
          interimTranscript = text;
        }
      }
      
      // Update transcript
      if (finalTranscript) {
        transcriptRef.current = finalTranscript.trim();
        setDisplayText(finalTranscript.trim());
        lastSpeechTimeRef.current = Date.now();
        
        // Start/reset silence timer when we get final text
        startSilenceTimer();
      } else if (interimTranscript) {
        // Show interim but don't save to ref yet
        setDisplayText(transcriptRef.current + (transcriptRef.current ? ' ' : '') + interimTranscript + '...');
        lastSpeechTimeRef.current = Date.now();
        
        // Reset timer on interim results too
        clearSilenceTimer();
      }
    };
    
    recognition.onerror = (event: Event) => {
      console.error('Speech recognition error:', event);
      setIsListening(false);
      
      // Try to restart if voice mode still active
      if (voiceModeActive && !isProcessingRef.current && !isSpeaking) {
        setTimeout(() => startListening(), 1000);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      
      // Auto-restart if voice mode active and not processing
      if (voiceModeActive && !isProcessingRef.current && !isSpeaking) {
        setTimeout(() => startListening(), 500);
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, [voiceModeActive, isSpeaking, startListening, startSilenceTimer, clearSilenceTimer]);

  // Toggle voice mode
  const toggleVoiceMode = () => {
    if (voiceModeActive) {
      // Turn OFF
      setVoiceModeActive(false);
      setIsListening(false);
      setDisplayText('');
      setStatus('');
      transcriptRef.current = '';
      clearSilenceTimer();
      
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      // Turn ON
      setVoiceModeActive(true);
      setDisplayText('');
      transcriptRef.current = '';
      setStatus('Starting...');
      
      // Start listening after a brief delay
      setTimeout(() => {
        startListening();
      }, 300);
    }
  };

  // Manual send button (backup)
  const handleManualSend = () => {
    if (transcriptRef.current.trim() && !isProcessingRef.current) {
      clearSilenceTimer();
      sendToJavari();
    }
  };

  // Check browser support
  const isSupported = typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!isSupported) {
    return (
      <div className="p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-200">
        <p className="font-medium">Voice chat requires Chrome or Edge browser</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main toggle button */}
      <button
        onClick={toggleVoiceMode}
        disabled={isProcessing}
        className={`
          w-full flex items-center justify-center gap-3 
          px-6 py-5 rounded-xl font-semibold text-lg
          transition-all duration-300 
          ${voiceModeActive 
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 hover:from-red-600 hover:to-red-700' 
            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30 hover:from-cyan-600 hover:to-blue-600'
          }
        `}
      >
        {voiceModeActive ? (
          <>
            <Square className="w-6 h-6" />
            <span>Stop Voice Chat</span>
          </>
        ) : (
          <>
            <Mic className="w-6 h-6" />
            <span>Start Voice Chat</span>
          </>
        )}
      </button>

      {/* Active voice chat display */}
      {voiceModeActive && (
        <div className="space-y-3">
          {/* Status indicator */}
          <div className={`
            flex items-center justify-center gap-2 py-3 px-4 rounded-lg
            ${isListening ? 'bg-green-500/20 border border-green-500/50' : 
              isSpeaking ? 'bg-cyan-500/20 border border-cyan-500/50' :
              isThinking ? 'bg-yellow-500/20 border border-yellow-500/50' :
              'bg-gray-800/50 border border-gray-600'}
          `}>
            {isListening && (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 font-medium">Listening... speak now</span>
              </>
            )}
            {isSpeaking && (
              <>
                <Volume2 className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span className="text-cyan-400 font-medium">Javari is speaking...</span>
              </>
            )}
            {isThinking && (
              <>
                <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                <span className="text-yellow-400 font-medium">Javari is thinking...</span>
              </>
            )}
            {!isListening && !isSpeaking && !isThinking && (
              <span className="text-gray-400">Connecting...</span>
            )}
          </div>

          {/* Live transcript */}
          {displayText && (
            <div className="p-4 rounded-lg bg-gray-800/70 border border-cyan-500/30">
              <div className="text-xs text-cyan-400 mb-2 font-medium">You said:</div>
              <div className="text-white text-lg leading-relaxed">{displayText}</div>
              
              {/* Manual send button if auto-send doesn't trigger */}
              {!isThinking && !isSpeaking && transcriptRef.current.trim() && (
                <button
                  onClick={handleManualSend}
                  className="mt-3 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Send Now
                </button>
              )}
            </div>
          )}

          {/* Instructions */}
          {!displayText && isListening && (
            <div className="text-center text-gray-400 text-sm">
              <p>Speak naturally. Pause for 2 seconds when done.</p>
              <p className="mt-1 text-xs">Javari will respond automatically.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Type declarations
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
