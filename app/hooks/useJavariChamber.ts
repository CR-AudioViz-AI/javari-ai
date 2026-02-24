/**
 * USE JAVARI CHAMBER HOOK
 * 
 * React hook for multi-AI chamber execution
 */

import { useState, useCallback } from 'react';
import type { ChamberResult, ChamberStep } from '@/chamber/controller';

export interface ChamberState {
  loading: boolean;
  result: ChamberResult | null;
  error: string | null;
  steps: ChamberStep[];
}

export function useJavariChamber() {
  const [state, setState] = useState<ChamberState>({
    loading: false,
    result: null,
    error: null,
    steps: [],
  });

  const sendGoal = useCallback(async (goal: string, context?: any) => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      steps: [],
    }));

    try {
      const token = localStorage.getItem('access_token');
      
      const response = await fetch('/api/javari/chamber/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ goal, context }),
      });

      if (!response.ok) {
        throw new Error('Chamber execution failed');
      }

      const result: ChamberResult = await response.json();

      setState({
        loading: false,
        result,
        error: result.error || null,
        steps: result.steps,
      });

      return result;

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));

      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      loading: false,
      result: null,
      error: null,
      steps: [],
    });
  }, []);

  return {
    ...state,
    sendGoal,
    reset,
    architectOutput: state.result?.architectOutput,
    builderOutput: state.result?.buildResult,
    javariThoughts: state.result?.observationResult,
    commitId: state.result?.buildResult?.commitId,
  };
}
