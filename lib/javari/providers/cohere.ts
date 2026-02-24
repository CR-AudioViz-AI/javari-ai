/**
 * Cohere AI Provider Adapter
 * 
 * Supports Cohere's chat and embedding models
 * Auth: Optional (uses COHERE_API_KEY env var)
 * Endpoint: https://api.cohere.ai/v1/chat
 */

interface CohereConfig {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}

interface CohereError extends Error {
  status?: number;
  type?: 'auth' | 'rate_limit' | 'timeout' | 'model_error' | 'network';
}

/**
 * Call a Cohere chat model
 * 
 * @param modelId - Model identifier (e.g., "command-r", "command-light")
 * @param input - Prompt text
 * @param config - Optional configuration
 * @returns Response text
 */
export async function callCohere(
  modelId: string,
  input: string,
  config?: CohereConfig
): Promise<string> {
  const apiKey = config?.apiKey || process.env.COHERE_API_KEY;
  const timeout = config?.timeout || 30000;
  const maxRetries = config?.maxRetries || 2;

  if (!apiKey) {
    throw createCohereError('COHERE_API_KEY not configured', 401, 'auth');
  }

  let lastError: CohereError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          message: input,
          temperature: config?.temperature || 0.7,
          max_tokens: config?.maxTokens || 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw createCohereError(
          errorData.message || `Cohere API error: ${response.status}`,
          response.status,
          categorizeError(response.status)
        );
      }

      const data = await response.json();

      // Extract response text
      if (data.text) {
        return data.text;
      }

      throw createCohereError('Invalid response format', 500, 'model_error');

    } catch (error) {
      lastError = error as CohereError;

      // Don't retry auth errors
      if (lastError.type === 'auth') {
        throw lastError;
      }

      // Retry with exponential backoff
      if (attempt < maxRetries && shouldRetry(lastError)) {
        const backoff = lastError.type === 'rate_limit' 
          ? Math.pow(2, attempt + 1) * 1000 
          : Math.pow(2, attempt) * 500;
        
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || createCohereError('Unknown error', 500, 'network');
}

/**
 * Generate embeddings with Cohere
 */
export async function callCohereEmbed(
  texts: string[],
  config?: CohereConfig
): Promise<number[][]> {
  const apiKey = config?.apiKey || process.env.COHERE_API_KEY;
  const timeout = config?.timeout || 30000;

  if (!apiKey) {
    throw createCohereError('COHERE_API_KEY not configured', 401, 'auth');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: texts,
        model: 'embed-english-v3.0',
        input_type: 'search_query',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw createCohereError(
        errorData.message || `Cohere API error: ${response.status}`,
        response.status,
        categorizeError(response.status)
      );
    }

    const data = await response.json();
    return data.embeddings || [];

  } catch (error) {
    throw error as CohereError;
  }
}

/**
 * Test Cohere connection
 */
export async function testCohereConnection(apiKey?: string): Promise<boolean> {
  try {
    const token = apiKey || process.env.COHERE_API_KEY;
    if (!token) return false;

    const response = await fetch('https://api.cohere.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${token}`,
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
export async function checkCohereModel(
  modelId: string,
  apiKey?: string
): Promise<boolean> {
  try {
    const token = apiKey || process.env.COHERE_API_KEY;
    if (!token) return false;

    const response = await fetch('https://api.cohere.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    const models = data.models || [];
    
    return models.some((m: any) => m.name === modelId || m.id === modelId);
  } catch {
    return false;
  }
}

// Helper functions

function createCohereError(
  message: string,
  status?: number,
  type?: CohereError['type']
): CohereError {
  const error = new Error(message) as CohereError;
  error.status = status;
  error.type = type || 'network';
  return error;
}

function categorizeError(status: number): CohereError['type'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'model_error';
  return 'network';
}

function shouldRetry(error: CohereError): boolean {
  return error.type === 'rate_limit' || 
         error.type === 'timeout' || 
         error.type === 'network';
}
