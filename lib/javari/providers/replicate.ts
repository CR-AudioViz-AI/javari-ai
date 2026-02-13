/**
 * Replicate AI Provider Adapter
 * 
 * Supports free-tier models via Replicate's API
 * Auth: Optional (uses REPLICATE_API_TOKEN env var)
 * Endpoint: https://api.replicate.com/v1/predictions
 */

interface ReplicateConfig {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
}

interface ReplicateError extends Error {
  status?: number;
  type?: 'auth' | 'rate_limit' | 'timeout' | 'model_error' | 'network';
}

/**
 * Call a Replicate model
 * 
 * @param modelId - Full model version (e.g., "meta/llama-2-7b-chat:xxxxx")
 * @param input - Prompt text
 * @param config - Optional configuration
 * @returns Response text
 */
export async function callReplicate(
  modelId: string,
  input: string,
  config?: ReplicateConfig
): Promise<string> {
  const apiKey = config?.apiKey || process.env.REPLICATE_API_TOKEN;
  const timeout = config?.timeout || 60000; // 60s for model cold starts
  const maxRetries = config?.maxRetries || 2;

  if (!apiKey) {
    throw createReplicateError('REPLICATE_API_TOKEN not configured', 401, 'auth');
  }

  let lastError: ReplicateError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Start prediction
      const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: modelId.split(':')[1] || modelId,
          input: {
            prompt: input,
            max_new_tokens: 1000,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!predictionResponse.ok) {
        const errorText = await predictionResponse.text();
        throw createReplicateError(
          errorText || `Replicate API error: ${predictionResponse.status}`,
          predictionResponse.status,
          categorizeError(predictionResponse.status)
        );
      }

      const prediction = await predictionResponse.json();

      // Poll for completion
      const result = await pollPrediction(prediction.id, apiKey, timeout);

      if (result.status === 'succeeded') {
        return extractOutput(result.output);
      } else if (result.status === 'failed') {
        throw createReplicateError(
          result.error || 'Prediction failed',
          500,
          'model_error'
        );
      } else {
        throw createReplicateError('Prediction timeout', 408, 'timeout');
      }

    } catch (error) {
      lastError = error as ReplicateError;

      // Don't retry auth errors
      if (lastError.type === 'auth') {
        throw lastError;
      }

      // Retry with exponential backoff for certain errors
      if (attempt < maxRetries && shouldRetry(lastError)) {
        const backoff = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || createReplicateError('Unknown error', 500, 'network');
}

/**
 * Poll Replicate prediction until complete
 */
async function pollPrediction(
  predictionId: string,
  apiKey: string,
  maxWait: number
): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - startTime < maxWait) {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw createReplicateError(
        `Poll failed: ${response.status}`,
        response.status,
        'network'
      );
    }

    const prediction = await response.json();

    if (prediction.status === 'succeeded' || prediction.status === 'failed') {
      return prediction;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw createReplicateError('Polling timeout', 408, 'timeout');
}

/**
 * Extract output from Replicate response
 */
function extractOutput(output: any): string {
  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output)) {
    return output.join('');
  }

  if (output && typeof output === 'object') {
    // Handle various output formats
    if (output.text) return output.text;
    if (output.output) return extractOutput(output.output);
    if (output.response) return output.response;
  }

  return String(output || '');
}

/**
 * Test Replicate connection
 */
export async function testReplicateConnection(apiKey?: string): Promise<boolean> {
  try {
    const token = apiKey || process.env.REPLICATE_API_TOKEN;
    if (!token) return false;

    const response = await fetch('https://api.replicate.com/v1/models', {
      headers: {
        'Authorization': `Token ${token}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if model is available
 */
export async function checkReplicateModel(
  modelId: string,
  apiKey?: string
): Promise<boolean> {
  try {
    const token = apiKey || process.env.REPLICATE_API_TOKEN;
    if (!token) return false;

    const [owner, name] = modelId.split('/');
    const response = await fetch(
      `https://api.replicate.com/v1/models/${owner}/${name}`,
      {
        headers: {
          'Authorization': `Token ${token}`,
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

// Helper functions

function createReplicateError(
  message: string,
  status?: number,
  type?: ReplicateError['type']
): ReplicateError {
  const error = new Error(message) as ReplicateError;
  error.status = status;
  error.type = type || 'network';
  return error;
}

function categorizeError(status: number): ReplicateError['type'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'model_error';
  return 'network';
}

function shouldRetry(error: ReplicateError): boolean {
  return error.type === 'rate_limit' || 
         error.type === 'timeout' || 
         error.type === 'network';
}
