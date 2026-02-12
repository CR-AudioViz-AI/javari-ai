// lib/javari/council/merge.ts
import { CouncilResult } from './engine';
import { AIProvider } from '../router/types';

export interface MergedResponse {
  finalText: string;
  reasoning: string;
  metadata: {
    providersUsed: AIProvider[];
    roles: Record<string, string>;
    confidenceScores: Record<AIProvider, number>;
    roleWeights: Record<AIProvider, number>;
    weightedScores: Record<AIProvider, number>;
    selectedProvider: AIProvider;
    selectedRole: string;
    agreementLevel: 'high' | 'medium' | 'low';
  };
}

export function mergeCouncilResults(results: CouncilResult[]): MergedResponse {
  // Filter successful responses
  const successful = results.filter(r => !r.error && r.response && r.response.length > 0);

  if (successful.length === 0) {
    return {
      finalText: 'All council members failed to respond. Please try again.',
      reasoning: 'No valid responses received from any council member.',
      metadata: {
        providersUsed: [],
        roles: {},
        confidenceScores: {},
        roleWeights: {},
        weightedScores: {},
        selectedProvider: 'openai',
        selectedRole: 'General',
        agreementLevel: 'low'
      }
    };
  }

  // If only one succeeded, return it
  if (successful.length === 1) {
    const single = successful[0];
    return {
      finalText: single.response,
      reasoning: `Response from ${single.role} (${single.provider}) - only successful council member`,
      metadata: {
        providersUsed: [single.provider],
        roles: { [single.provider]: single.role },
        confidenceScores: { [single.provider]: single.confidence },
        roleWeights: { [single.provider]: single.roleWeight },
        weightedScores: { [single.provider]: single.weightedScore },
        selectedProvider: single.provider,
        selectedRole: single.role,
        agreementLevel: 'medium'
      }
    };
  }

  // Multiple responses - select best by weighted score
  const best = successful.reduce((prev, curr) => 
    curr.weightedScore > prev.weightedScore ? curr : prev
  );

  // Calculate agreement level based on weighted scores
  const avgWeightedScore = successful.reduce((sum, r) => sum + r.weightedScore, 0) / successful.length;
  const agreementLevel: 'high' | 'medium' | 'low' = 
    avgWeightedScore > 0.7 ? 'high' : avgWeightedScore > 0.5 ? 'medium' : 'low';

  // Build metadata maps
  const confidenceScores: Record<AIProvider, number> = {};
  const roleWeights: Record<AIProvider, number> = {};
  const weightedScores: Record<AIProvider, number> = {};
  const roles: Record<string, string> = {};

  successful.forEach(r => {
    confidenceScores[r.provider] = r.confidence;
    roleWeights[r.provider] = r.roleWeight;
    weightedScores[r.provider] = r.weightedScore;
    roles[r.provider] = r.role;
  });

  // Build reasoning with role context
  const roleInfo = successful
    .map(r => `${r.role} (${r.provider}): ${(r.weightedScore * 100).toFixed(0)}%`)
    .join(', ');

  return {
    finalText: best.response,
    reasoning: `Council Decision: Selected ${best.role} (${best.provider}) with weighted score ${(best.weightedScore * 100).toFixed(0)}%. Scores: ${roleInfo}`,
    metadata: {
      providersUsed: successful.map(r => r.provider),
      roles,
      confidenceScores,
      roleWeights,
      weightedScores,
      selectedProvider: best.provider,
      selectedRole: best.role,
      agreementLevel
    }
  };
}
