// lib/javari/council/engine.ts
import { getProvider, getProviderApiKey, ALL_PROVIDERS } from '../providers';
import { AIProvider } from '../router/types';
import { preprocessPrompt } from '../utils/preprocessPrompt';

export interface CouncilResult {
  provider: AIProvider;
  response: string;
  confidence: number;
  latency: number;
  error?: string;
}

export interface CouncilMetadata {
  totalProviders: number;
  successfulProviders: number;
  failedProviders: number;
  selectedProvider: AIProvider;
  totalTime: number;
}

// SPEED OPTIMIZATION: Parallel execution, fail fast
export async function runCouncilFast(
  message: string,
  onStream?: (provider: AIProvider, chunk: string) => void
): Promise<{ results: CouncilResult[]; metadata: CouncilMetadata }> {
  
  const startTime = Date.now();
  
  // Preprocess once for all providers
  const preprocessed = preprocessPrompt(message);
  const processedMessage = preprocessed.rewrittenPrompt;
  const preferredModel = preprocessed.modelToUse;
  
  console.log('[Council-Fast] Starting parallel execution');
  
  // Get available providers
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

  // SPEED: Execute ALL providers in parallel, don't wait for slowest
  const promises = availableProviders.map(async (providerName) => {
    const providerStart = Date.now();
    let fullResponse = '';
    
    try {
      const apiKey = getProviderApiKey(providerName);
      const provider = getProvider(providerName, apiKey);

      // Stream with preferred model
      for await (const chunk of provider.generateStream(processedMessage, { 
        timeout: 15000, // 15s max per provider
        preferredModel: preferredModel
      })) {
        fullResponse += chunk;
        if (onStream) {
          onStream(providerName, chunk);
        }
      }

      const latency = Date.now() - providerStart;

      return {
        provider: providerName,
        response: fullResponse,
        confidence: 1.0,
        latency
      };

    } catch (error: any) {
      const latency = Date.now() - providerStart;
      console.error(`[Council-Fast] ${providerName} failed:`, error.message);

      return {
        provider: providerName,
        response: '',
        confidence: 0,
        latency,
        error: error.message
      };
    }
  });

  // Wait for all with timeout
  const results = await Promise.all(promises);
  
  const successful = results.filter(r => !r.error && r.response);
  const failed = results.filter(r => r.error || !r.response);
  
  // Select fastest successful response
  const best = successful.length > 0 
    ? successful.reduce((prev, curr) => curr.latency < prev.latency ? curr : prev)
    : results[0];

  const totalTime = Date.now() - startTime;
  
  console.log(`[Council-Fast] Complete in ${totalTime}ms - ${successful.length}/${results.length} succeeded`);

  const metadata: CouncilMetadata = {
    totalProviders: results.length,
    successfulProviders: successful.length,
    failedProviders: failed.length,
    selectedProvider: best.provider,
    totalTime
  };

  return { results, metadata };
}
