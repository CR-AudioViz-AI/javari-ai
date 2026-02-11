// lib/javari/council/merge.ts
import { CouncilResult } from './engine';
import { AIProvider } from '../router/types';

export interface MergedResponse {
  finalText: string;
  reasoning: string;
  metadata: {
    providersUsed: AIProvider[];
    confidenceScores: Record<AIProvider, number>;
    selectedProvider: AIProvider;
    agreementLevel: 'high' | 'medium' | 'low';
  };
}

export function mergeCouncilResults(results: CouncilResult[]): MergedResponse {
  // Filter successful responses
  const successful = results.filter(r => !r.error && r.response && r.response.length > 0);

  if (successful.length === 0) {
    return {
      finalText: 'All providers failed to respond. Please try again.',
      reasoning: 'No valid responses received from any provider.',
      metadata: {
        providersUsed: [],
        confidenceScores: {},
        selectedProvider: 'openai',
        agreementLevel: 'low'
      }
    };
  }

  // If only one succeeded, return it
  if (successful.length === 1) {
    const single = successful[0];
    return {
      finalText: single.response,
      reasoning: `Response from ${single.provider} (only successful provider)`,
      metadata: {
        providersUsed: [single.provider],
        confidenceScores: { [single.provider]: single.confidence },
        selectedProvider: single.provider,
        agreementLevel: 'medium'
      }
    };
  }

  // Multiple responses - select best by confidence
  const best = successful.reduce((prev, curr) => 
    curr.confidence > prev.confidence ? curr : prev
  );

  // Calculate agreement level
  const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
  const agreementLevel: 'high' | 'medium' | 'low' = 
    avgConfidence > 0.8 ? 'high' : avgConfidence > 0.6 ? 'medium' : 'low';

  // Build confidence scores map
  const confidenceScores: Record<AIProvider, number> = {};
  successful.forEach(r => {
    confidenceScores[r.provider] = r.confidence;
  });

  return {
    finalText: best.response,
    reasoning: `Selected ${best.provider} with confidence ${(best.confidence * 100).toFixed(0)}%. ${successful.length} providers responded successfully.`,
    metadata: {
      providersUsed: successful.map(r => r.provider),
      confidenceScores,
      selectedProvider: best.provider,
      agreementLevel
    }
  };
}
