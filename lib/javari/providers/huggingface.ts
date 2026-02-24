// lib/javari/providers/huggingface.ts
// HuggingFace Inference API Provider Adapter

export interface HuggingFaceConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface HuggingFaceRequest {
  modelId: string;
  inputs: string;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    return_full_text?: boolean;
  };
}

export interface HuggingFaceResponse {
  generated_text?: string;
  error?: string;
  warnings?: string[];
}

export class HuggingFaceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public modelId?: string
  ) {
    super(message);
    this.name = 'HuggingFaceError';
  }
}

/**
 * Call HuggingFace Inference API
 * Uses the new router endpoint: https://router.huggingface.co/v1
 */
export async function callHuggingFace(
  modelId: string,
  input: string,
  config?: Partial<HuggingFaceConfig>
): Promise<string> {
  const apiKey = config?.apiKey || process.env.HUGGINGFACE_TOKEN || process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    throw new HuggingFaceError('HuggingFace API key not configured', 401);
  }

  const timeout = config?.timeout || 30000; // 30 second default
  const maxRetries = config?.maxRetries || 2;

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        `https://router.huggingface.co/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              {
                role: 'user',
                content: input
              }
            ],
            max_tokens: 500,
            temperature: 0.7,
            stream: false
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        const errorBody = await response.text();
        
        // Model loading (503) - retry
        if (response.status === 503) {
          if (attempt < maxRetries) {
            await sleep(2000 * (attempt + 1)); // Exponential backoff
            continue;
          }
          throw new HuggingFaceError(
            `Model ${modelId} is loading. Please try again in a few moments.`,
            503,
            modelId
          );
        }

        // Rate limit (429) - retry
        if (response.status === 429) {
          if (attempt < maxRetries) {
            await sleep(3000 * (attempt + 1));
            continue;
          }
          throw new HuggingFaceError(
            'Rate limit exceeded. Please try again later.',
            429,
            modelId
          );
        }

        // Authentication error
        if (response.status === 401 || response.status === 403) {
          throw new HuggingFaceError(
            'Invalid or expired HuggingFace API key',
            response.status,
            modelId
          );
        }

        // Other errors
        throw new HuggingFaceError(
          `HuggingFace API error: ${errorBody}`,
          response.status,
          modelId
        );
      }

      // Parse response
      const data = await response.json();

      // Extract generated text
      if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
      }

      // Fallback for different response formats
      if (data.generated_text) {
        return data.generated_text;
      }

      if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text;
      }

      throw new HuggingFaceError(
        'Unexpected response format from HuggingFace',
        500,
        modelId
      );

    } catch (error: any) {
      lastError = error;

      // Don't retry on auth errors or client errors
      if (error instanceof HuggingFaceError && 
          (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 400)) {
        throw error;
      }

      // Timeout error
      if (error.name === 'AbortError') {
        if (attempt < maxRetries) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw new HuggingFaceError(
          `Request timeout after ${timeout}ms`,
          408,
          modelId
        );
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
    }
  }

  // All retries exhausted
  throw lastError || new HuggingFaceError('Unknown error', 500, modelId);
}

/**
 * Test HuggingFace connection
 */
export async function testHuggingFaceConnection(apiKey?: string): Promise<boolean> {
  try {
    await callHuggingFace(
      'meta-llama/Meta-Llama-3-8B-Instruct',
      'Hello, respond with OK',
      { apiKey, timeout: 10000, maxRetries: 0 }
    );
    return true;
  } catch (error) {
    console.error('HuggingFace connection test failed:', error);
    return false;
  }
}

/**
 * Get model availability status
 */
export async function checkModelAvailability(
  modelId: string,
  apiKey?: string
): Promise<{ available: boolean; error?: string }> {
  try {
    await callHuggingFace(
      modelId,
      'test',
      { apiKey, timeout: 5000, maxRetries: 0 }
    );
    return { available: true };
  } catch (error: any) {
    if (error instanceof HuggingFaceError) {
      return {
        available: false,
        error: error.message
      };
    }
    return {
      available: false,
      error: 'Unknown error'
    };
  }
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export types
export type { HuggingFaceRequest, HuggingFaceResponse };
