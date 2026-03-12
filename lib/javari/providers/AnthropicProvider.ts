// lib/javari/providers/AnthropicProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';
    // Apply timeout from options or use provider default (20s)
    // Build messages array for Anthropic API
    // Anthropic doesn't support system messages in messages array
    // We include rolePrompt as part of the user message
    // Use preferredModel if provided, otherwise use default (claude-3-5-sonnet-20241022)
        // Create error with status code for 5xx detection
            // Parse SSE format: "event: content_block_delta\ndata: {...}"
              // Extract text from content_block_delta events
                  // Log but continue - don't break stream for parse errors
        // Check for timeout
        // Check for 5xx errors - mark for fallback
        // Re-throw other errors as-is
export default {}
