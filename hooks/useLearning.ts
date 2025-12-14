// =============================================================================
// JAVARI AI - LEARNING FEEDBACK HOOK
// =============================================================================
// React hook for integrating with the learning feedback loop
// Makes it easy to track interactions and get optimized configs
// Created: Saturday, December 13, 2025 - 6:35 PM EST
// =============================================================================

'use client';

import { useCallback, useRef, useState } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type InteractionType = 'chat' | 'code_gen' | 'analysis' | 'search' | 'tool_use';
export type Outcome = 'success' | 'partial' | 'failure' | 'abandoned';

export interface InteractionContext {
  model_used: string;
  prompt_template?: string;
  temperature?: number;
  max_tokens?: number;
  tools_enabled?: string[];
  user_intent?: string;
}

export interface InteractionMetrics {
  response_time_ms?: number;
  tokens_used?: number;
  cost_usd?: number;
  user_satisfaction?: number;
  task_completed?: boolean;
  required_retries?: number;
  error_occurred?: boolean;
}

export interface FeedbackDetails {
  what_worked?: string;
  what_failed?: string;
  user_correction?: string;
  suggested_improvement?: string;
}

export interface OptimizedConfig {
  recommended_model: string;
  temperature: number;
  max_tokens: number;
  system_prompt_additions: string[];
  tools_to_enable: string[];
  confidence: number;
  reasoning: string;
}

export interface LearningInsight {
  insight_id: string;
  insight_type: string;
  title: string;
  description: string;
  confidence: number;
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
}

interface TrackedInteraction {
  id: string;
  type: InteractionType;
  startTime: number;
  context: InteractionContext;
}

// -----------------------------------------------------------------------------
// Generate Interaction ID
// -----------------------------------------------------------------------------

function generateInteractionId(): string {
  return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// -----------------------------------------------------------------------------
// Hook: useLearning
// -----------------------------------------------------------------------------

export function useLearning() {
  const [isRecording, setIsRecording] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<Outcome | null>(null);
  const currentInteraction = useRef<TrackedInteraction | null>(null);

  // ---------------------------------------------------------------------------
  // Start Tracking an Interaction
  // ---------------------------------------------------------------------------
  
  const startInteraction = useCallback((
    type: InteractionType,
    context: InteractionContext
  ): string => {
    const id = generateInteractionId();
    
    currentInteraction.current = {
      id,
      type,
      startTime: Date.now(),
      context
    };
    
    setIsRecording(true);
    setLastOutcome(null);
    
    return id;
  }, []);

  // ---------------------------------------------------------------------------
  // End Interaction & Record Feedback
  // ---------------------------------------------------------------------------
  
  const endInteraction = useCallback(async (
    outcome: Outcome,
    additionalMetrics?: Partial<InteractionMetrics>,
    feedback?: FeedbackDetails
  ): Promise<void> => {
    const interaction = currentInteraction.current;
    
    if (!interaction) {
      console.warn('[Learning] No active interaction to end');
      return;
    }
    
    const responseTime = Date.now() - interaction.startTime;
    
    const metrics: InteractionMetrics = {
      response_time_ms: responseTime,
      ...additionalMetrics
    };
    
    try {
      await fetch('/api/learn?action=feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_id: interaction.id,
          interaction_type: interaction.type,
          outcome,
          context: interaction.context,
          metrics,
          feedback
        })
      });
      
      setLastOutcome(outcome);
    } catch (error) {
      console.error('[Learning] Failed to record feedback:', error);
    } finally {
      currentInteraction.current = null;
      setIsRecording(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Quick Success/Failure Helpers
  // ---------------------------------------------------------------------------
  
  const recordSuccess = useCallback(async (
    metrics?: Partial<InteractionMetrics>,
    feedback?: FeedbackDetails
  ) => {
    return endInteraction('success', metrics, feedback);
  }, [endInteraction]);

  const recordFailure = useCallback(async (
    metrics?: Partial<InteractionMetrics>,
    feedback?: FeedbackDetails
  ) => {
    return endInteraction('failure', metrics, feedback);
  }, [endInteraction]);

  const recordPartial = useCallback(async (
    metrics?: Partial<InteractionMetrics>,
    feedback?: FeedbackDetails
  ) => {
    return endInteraction('partial', metrics, feedback);
  }, [endInteraction]);

  // ---------------------------------------------------------------------------
  // Get Optimized Config for Task
  // ---------------------------------------------------------------------------
  
  const getOptimizedConfig = useCallback(async (
    interactionType: InteractionType,
    userContext?: {
      expertise_level?: 'beginner' | 'intermediate' | 'expert';
      preferred_style?: 'concise' | 'detailed' | 'code_heavy';
    },
    constraints?: {
      max_cost_usd?: number;
      max_response_time_ms?: number;
    }
  ): Promise<OptimizedConfig | null> => {
    try {
      const response = await fetch('/api/learn?action=optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_type: interactionType,
          user_context: userContext,
          constraints
        })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.optimized;
    } catch {
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Get Learning Insights
  // ---------------------------------------------------------------------------
  
  const getInsights = useCallback(async (): Promise<LearningInsight[]> => {
    try {
      const response = await fetch('/api/learn?type=insights');
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.insights || [];
    } catch {
      return [];
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Return Hook Interface
  // ---------------------------------------------------------------------------
  
  return {
    // State
    isRecording,
    lastOutcome,
    currentInteractionId: currentInteraction.current?.id,
    
    // Core Methods
    startInteraction,
    endInteraction,
    
    // Quick Helpers
    recordSuccess,
    recordFailure,
    recordPartial,
    
    // Optimization
    getOptimizedConfig,
    getInsights
  };
}

// -----------------------------------------------------------------------------
// Hook: useOptimizedAI
// -----------------------------------------------------------------------------

export function useOptimizedAI(interactionType: InteractionType) {
  const [config, setConfig] = useState<OptimizedConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const { startInteraction, endInteraction, getOptimizedConfig } = useLearning();

  // Load optimized config on mount
  const loadConfig = useCallback(async () => {
    setLoading(true);
    const optimized = await getOptimizedConfig(interactionType);
    setConfig(optimized);
    setLoading(false);
  }, [interactionType, getOptimizedConfig]);

  // Wrapper for AI calls that auto-tracks
  const callWithTracking = useCallback(async <T>(
    aiFunction: (config: OptimizedConfig) => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    if (!config) {
      await loadConfig();
    }
    
    const activeConfig = config || {
      recommended_model: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      max_tokens: 4096,
      system_prompt_additions: [],
      tools_to_enable: [],
      confidence: 50,
      reasoning: 'Default config'
    };
    
    const interactionId = startInteraction(interactionType, {
      model_used: activeConfig.recommended_model,
      temperature: activeConfig.temperature,
      max_tokens: activeConfig.max_tokens,
      tools_enabled: activeConfig.tools_to_enable
    });
    
    try {
      const result = await aiFunction(activeConfig);
      await endInteraction('success', { task_completed: true });
      onSuccess?.(result);
      return result;
    } catch (error) {
      await endInteraction('failure', { 
        error_occurred: true 
      }, {
        what_failed: error instanceof Error ? error.message : 'Unknown error'
      });
      onError?.(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }, [config, loadConfig, interactionType, startInteraction, endInteraction]);

  return {
    config,
    loading,
    loadConfig,
    callWithTracking
  };
}

// -----------------------------------------------------------------------------
// Hook: useLearningInsights (for dashboards)
// -----------------------------------------------------------------------------

export function useLearningInsights(autoRefresh: boolean = false, intervalMs: number = 60000) {
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getInsights } = useLearning();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInsights();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [getInsights]);

  // Initial load and optional auto-refresh
  useState(() => {
    refresh();
    
    if (autoRefresh) {
      const interval = setInterval(refresh, intervalMs);
      return () => clearInterval(interval);
    }
  });

  const highImpactInsights = insights.filter(i => i.impact === 'high');
  const actionableInsights = insights.filter(i => i.actionable);

  return {
    insights,
    highImpactInsights,
    actionableInsights,
    loading,
    error,
    refresh
  };
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default useLearning;
