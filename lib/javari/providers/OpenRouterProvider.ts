// lib/javari/providers/OpenRouterProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';
// OpenRouter Model Metadata
export interface OpenRouterModel {
// Featured models for different use cases
    // Return cached if still valid
    // Use preferredModel if provided, otherwise use default
    // Build messages array
        // Create error with status code for 5xx detection
                // Log but continue - don't break stream
        // Check for timeout
        // Check for 5xx errors - mark for fallback
        // Re-throw other errors
      // Default fallback pricing (DeepSeek free model)
export default {}
