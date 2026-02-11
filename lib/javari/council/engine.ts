// lib/javari/council/engine.ts
import { getProvider, getProviderApiKey, ALL_PROVIDERS } from '../providers';
import { AIProvider } from '../router/types';
import { calculateProviderScore, ReliabilityTracker } from './weights';

export interface CouncilResult {
  provider: AIProvider;
  response: string;
  confidence: number;
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
  selectionReason: string;
}

const reliabilityTracker = new ReliabilityTracker();

export async function runCouncil(
  message: string,
  onStream?: (provider: AIProvider, chunk: string, partial: string) => void,
  onProviderComplete?: (result: CouncilResult) => void
): Promise<{ results: CouncilResult[]; metadata: CouncilMetadata }> {
  
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

  const results: CouncilResult[] = [];

  // Run all providers in parallel
  const promises = availableProviders.map(async (providerName) => {
    const startTime = Date.now();
    let fullResponse = '';
    
    try {
      const apiKey = getProviderApiKey(providerName);
      const provider = getProvider(providerName, apiKey);

      // Stream tokens
      for await (const chunk of provider.generateStream(message, { timeout: 30000 })) {
        fullResponse += chunk;
        if (onStream) {
          onStream(providerName, chunk, fullResponse);
        }
      }

      const latency = Date.now() - startTime;
      const confidence = calculateProviderScore(providerName, latency, fullResponse.length);

      reliabilityTracker.record(providerName, true, latency);

      const result: CouncilResult = {
        provider: providerName,
        response: fullResponse,
        confidence,
        latency,
      };

      if (onProviderComplete) {
        onProviderComplete(result);
      }

      return result;

    } catch (error: any) {
      const latency = Date.now() - startTime;
      reliabilityTracker.record(providerName, false, latency);

      return {
        provider: providerName,
        response: '',
        confidence: 0,
        error: error.message,
        latency,
      };
    }
  });

  const allResults = await Promise.all(promises);
  
  // Calculate metadata
  const successful = allResults.filter(r => !r.error && r.response);
  const failed = allResults.filter(r => r.error || !r.response);
  
  const metadata: CouncilMetadata = {
    totalProviders: allResults.length,
    successfulProviders: successful.length,
    failedProviders: failed.length,
    agreementScore: calculateAgreement(successful),
    selectedProvider: successful[0]?.provider || 'openai',
    selectionReason: 'Highest confidence score'
  };

  // Select best response
  if (successful.length > 0) {
    const best = successful.reduce((prev, curr) => 
      curr.confidence > prev.confidence ? curr : prev
    );
    metadata.selectedProvider = best.provider;
  }

  return { results: allResults, metadata };
}

function calculateAgreement(results: CouncilResult[]): number {
  if (results.length < 2) return 1.0;

  // Simple agreement: compare response similarity
  // More sophisticated: use semantic similarity
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
