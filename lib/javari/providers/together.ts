/**
 * TogetherAI Provider Adapter
 * 
 * Supports 100+ open-source models via TogetherAI's API
 * Auth: Optional (uses TOGETHER_API_KEY env var)
 * Endpoint: https://api.together.xyz/v1/chat/completions
 * Format: OpenAI-compatible
 */

interface TogetherConfig {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}

interface TogetherError extends Error {
  status?: number;
  type?: 'auth' | 'rate_limit' | 'timeout' | 'model_error' | 'network';
}

/**
 * Call a TogetherAI model
 * 
 * @param modelId - Model identifier (e.g., "meta-llama/Llama-3-8b-chat-hf")
 * @param input - Prompt text
 * @param config - Optional configuration
 * @returns Response text
 */
export async function callTogether(
  modelId: string,
  input: string,
  config?: TogetherConfig
): Promise<string> {
  const apiKey = config?.apiKey || process.env.TOGETHER_API_KEY;
  const timeout = config?.timeout || 30000;
  const maxRetries = config?.maxRetries || 2;

  if (!apiKey) {
    throw createTogetherError('TOGETHER_API_KEY not configured', 401, 'auth');
  }

  let lastError: TogetherError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'user', content: input }
          ],
          temperature: config?.temperature || 0.7,
          max_tokens: config?.maxTokens || 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw createTogetherError(
          errorData.error?.message || `TogetherAI API error: ${response.status}`,
          response.status,
          categorizeError(response.status)
        );
      }

      const data = await response.json();

      // Extract response from OpenAI-compatible format
      if (data.choices && data.choices.length > 0) {
        const message = data.choices[0].message;
        return message?.content || '';
      }

      throw createTogetherError('Invalid response format', 500, 'model_error');

    } catch (error) {
      lastError = error as TogetherError;

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

  throw lastError || createTogetherError('Unknown error', 500, 'network');
}

/**
 * Test TogetherAI connection
 */
export async function testTogetherConnection(apiKey?: string): Promise<boolean> {
  try {
    const token = apiKey || process.env.TOGETHER_API_KEY;
    if (!token) return false;

    const response = await fetch('https://api.together.xyz/v1/models', {
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
 * List available TogetherAI models
 */
export async function listTogetherModels(apiKey?: string): Promise<string[]> {
  try {
    const token = apiKey || process.env.TOGETHER_API_KEY;
    if (!token) return [];

    const response = await fetch('https://api.together.xyz/v1/models', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((model: any) => model.id || model.name).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if specific model is available
 */
export async function checkTogetherModel(
  modelId: string,
  apiKey?: string
): Promise<boolean> {
  const models = await listTogetherModels(apiKey);
  return models.includes(modelId);
}

/**
 * Get model info
 */
export async function getTogetherModelInfo(
  modelId: string,
  apiKey?: string
): Promise<any> {
  try {
    const token = apiKey || process.env.TOGETHER_API_KEY;
    if (!token) return null;

    const response = await fetch(`https://api.together.xyz/v1/models/${modelId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Helper functions

function createTogetherError(
  message: string,
  status?: number,
  type?: TogetherError['type']
): TogetherError {
  const error = new Error(message) as TogetherError;
  error.status = status;
  error.type = type || 'network';
  return error;
}

function categorizeError(status: number): TogetherError['type'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'model_error';
  return 'network';
}

function shouldRetry(error: TogetherError): boolean {
  return error.type === 'rate_limit' || 
         error.type === 'timeout' || 
         error.type === 'network';
}
