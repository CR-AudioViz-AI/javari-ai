// lib/javari/council/engine.ts
import { getProvider, getProviderApiKey } from '../providers';
import { AIProvider } from '../router/types';

export interface CouncilResult {
  provider: AIProvider;
  response: string;
  confidence: number;
  error?: string;
  latency: number;
}

export async function runCouncil(
  message: string,
  providers: AIProvider[] = ['openai', 'groq', 'anthropic'],
  onStream?: (provider: AIProvider, chunk: string) => void
): Promise<CouncilResult[]> {
  const results: CouncilResult[] = [];

  // Run all providers in parallel
  const promises = providers.map(async (providerName) => {
    const startTime = Date.now();
    let fullResponse = '';
    
    try {
      const apiKey = getProviderApiKey(providerName);
      const provider = getProvider(providerName, apiKey);

      for await (const chunk of provider.generateStream(message)) {
        fullResponse += chunk;
        if (onStream) {
          onStream(providerName, chunk);
        }
      }

      const latency = Date.now() - startTime;

      return {
        provider: providerName,
        response: fullResponse,
        confidence: calculateConfidence(fullResponse),
        latency,
      };
    } catch (error: any) {
      return {
        provider: providerName,
        response: '',
        confidence: 0,
        error: error.message,
        latency: Date.now() - startTime,
      };
    }
  });

  return await Promise.all(promises);
}

export function mergeCouncilResults(results: CouncilResult[]): string {
  // Filter successful responses
  const successful = results.filter(r => !r.error && r.response);

  if (successful.length === 0) {
    return 'All providers failed to respond.';
  }

  // If only one succeeded, return it
  if (successful.length === 1) {
    return successful[0].response;
  }

  // Find highest confidence response
  const best = successful.reduce((prev, curr) => 
    curr.confidence > prev.confidence ? curr : prev
  );

  return best.response;
}

function calculateConfidence(response: string): number {
  // Simple heuristic based on response characteristics
  let score = 0.5;

  // Longer, more detailed responses score higher
  if (response.length > 200) score += 0.2;
  if (response.length > 500) score += 0.1;

  // Responses with structure score higher
  if (response.includes('\n\n')) score += 0.1;
  if (response.match(/\d+\./g)) score += 0.1;

  return Math.min(score, 1.0);
}
