// lib/javari/council/engine.ts
import { getProvider, getProviderApiKey, ALL_PROVIDERS } from '../providers';
import { AIProvider } from '../router/types';
import { calculateProviderScore, ReliabilityTracker } from './weights';
import { COUNCIL_ROLES, getProviderRole, getActiveCouncil, addRoleContext, RoleConfig } from './roles';
import { preprocessPrompt } from '../utils/preprocessPrompt'; // FIXED: Added import

export interface CouncilResult {
  provider: AIProvider;
  role: string;
  response: string;
  confidence: number;
  roleWeight: number;
  weightedScore: number;
  reasoning?: string;
  error?: string;
  latency: number;
  tokens?: number;
}

export interface CouncilMetadata {
  totalProviders: number;
  successfulProviders: number;
  failedProviders: number;
  agreementScore: number;
  selectedProvider: AIProvider;
  selectedRole: string;
  selectionReason: string;
  roleDistribution: Record<string, number>;
}

const reliabilityTracker = new ReliabilityTracker();

export async function runCouncil(
  message: string,
  onStream?: (provider: AIProvider, chunk: string, partial: string) => void,
  onProviderComplete?: (result: CouncilResult) => void
): Promise<{ results: CouncilResult[]; metadata: CouncilMetadata }> {
  
  // FIXED: Preprocess prompt BEFORE council execution
  const preprocessed = preprocessPrompt(message);
  const processedMessage = preprocessed.rewrittenPrompt;
  const preferredModel = preprocessed.modelToUse;
  
  console.log('[Council] Preprocessed:', {
    original: message.substring(0, 50),
    rewritten: processedMessage.substring(0, 50),
    model: preferredModel,
    nounTrigger: preprocessed.nounTrigger
  });
  
  // Get available providers (those with configured API keys)
  const availableProviders = ALL_PROVIDERS.filter(provider => {
    try {
      getProviderApiKey(provider);
      return true;
    } catch {
      return false;
    }
  });

  if (availableProviders.length === 0) {
    throw new Error('No providers configured');
  }

  // Get active council with roles
  const activeCouncil = getActiveCouncil(availableProviders);

  if (activeCouncil.length === 0) {
    throw new Error('No council members available');
  }

  const results: CouncilResult[] = [];

  // Run all council members in parallel with role-specific prompts
  const promises = activeCouncil.map(async (roleConfig: RoleConfig) => {
    const startTime = Date.now();
    let fullResponse = '';
    
    try {
      const apiKey = getProviderApiKey(roleConfig.provider);
      const provider = getProvider(roleConfig.provider, apiKey);

      // Add role context to PROCESSED message
      const roleMessage = addRoleContext(processedMessage, roleConfig);

      // FIXED: Pass preferredModel to provider
      for await (const chunk of provider.generateStream(roleMessage, { 
        timeout: 30000,
        rolePrompt: roleConfig.systemPrompt,
        preferredModel: preferredModel // Pass model selection
      })) {
        fullResponse += chunk;
        if (onStream) {
          onStream(roleConfig.provider, chunk, fullResponse);
        }
      }

      const latency = Date.now() - startTime;
      const baseConfidence = calculateProviderScore(roleConfig.provider, latency, fullResponse.length);
      
      // Apply role weight to confidence
      const weightedScore = baseConfidence * roleConfig.weight;

      reliabilityTracker.record(roleConfig.provider, true, latency);

      const result: CouncilResult = {
        provider: roleConfig.provider,
        role: roleConfig.displayName,
        response: fullResponse,
        confidence: baseConfidence,
        roleWeight: roleConfig.weight,
        weightedScore,
        latency,
      };

      if (onProviderComplete) {
        onProviderComplete(result);
      }

      return result;

    } catch (error: any) {
      const latency = Date.now() - startTime;
      reliabilityTracker.record(roleConfig.provider, false, latency);

      return {
        provider: roleConfig.provider,
        role: roleConfig.displayName,
        response: '',
        confidence: 0,
        roleWeight: roleConfig.weight,
        weightedScore: 0,
        error: error.message,
        latency,
      };
    }
  });

  const allResults = await Promise.all(promises);
  
  // Calculate metadata
  const successful = allResults.filter(r => !r.error && r.response);
  const failed = allResults.filter(r => r.error || !r.response);
  
  // Calculate role distribution
  const roleDistribution: Record<string, number> = {};
  for (const result of successful) {
    roleDistribution[result.role] = (roleDistribution[result.role] || 0) + 1;
  }

  // Select best response based on weighted score
  let selectedProvider: AIProvider = 'openai';
  let selectedRole = 'General';
  let selectionReason = 'Default';

  if (successful.length > 0) {
    const best = successful.reduce((prev, curr) => 
      curr.weightedScore > prev.weightedScore ? curr : prev
    );
    selectedProvider = best.provider;
    selectedRole = best.role;
    selectionReason = `Highest weighted score (${best.weightedScore.toFixed(2)}) - Role: ${best.role}`;
  }

  const metadata: CouncilMetadata = {
    totalProviders: allResults.length,
    successfulProviders: successful.length,
    failedProviders: failed.length,
    agreementScore: calculateAgreement(successful),
    selectedProvider,
    selectedRole,
    selectionReason,
    roleDistribution
  };

  return { results: allResults, metadata };
}

function calculateAgreement(results: CouncilResult[]): number {
  if (results.length < 2) return 1.0;

  const responses = results.map(r => r.response.toLowerCase());
  
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const similarity = simpleTextSimilarity(responses[i], responses[j]);
      totalSimilarity += similarity;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}

function simpleTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}
