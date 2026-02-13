// lib/javari/multi-ai/useMultiAI.ts
// React hook for Multi-AI integration

import { useState, useCallback } from 'react';
import { multiAI, MultiChatResponse, CouncilResponse } from './client';
import { MultiAIMode } from '@/components/multi/ModeSelector';

export interface MultiAIState {
  isLoading: boolean;
  error: string | null;
  lastResponse: MultiChatResponse | null;
  lastCouncil: CouncilResponse | null;
}

export function useMultiAI() {
  const [state, setState] = useState<MultiAIState>({
    isLoading: false,
    error: null,
    lastResponse: null,
    lastCouncil: null
  });

  const sendMessage = useCallback(async (
    message: string,
    mode: MultiAIMode
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (mode === 'council') {
        // Use council mode
        const response = await multiAI.council({ message });
        
        setState({
          isLoading: false,
          error: null,
          lastResponse: null,
          lastCouncil: response
        });

        return {
          type: 'council' as const,
          data: response
        };
      } else {
        // Use regular multi-chat
        const response = await multiAI.chat({ message, mode });
        
        setState({
          isLoading: false,
          error: null,
          lastResponse: response,
          lastCouncil: null
        });

        return {
          type: 'chat' as const,
          data: response
        };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Request failed';
      
      setState({
        isLoading: false,
        error: errorMessage,
        lastResponse: null,
        lastCouncil: null
      });

      throw error;
    }
  }, []);

  const analyzePrompt = useCallback(async (
    prompt: string,
    mode: MultiAIMode
  ) => {
    try {
      return await multiAI.analyze(prompt, mode);
    } catch (error: any) {
      console.error('Analyze error:', error);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      lastResponse: null,
      lastCouncil: null
    });
  }, []);

  return {
    ...state,
    sendMessage,
    analyzePrompt,
    reset
  };
}
