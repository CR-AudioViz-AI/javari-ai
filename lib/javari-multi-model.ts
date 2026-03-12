import Anthropic from '@anthropic-ai/sdk';
import { JAVARI_SYSTEM_PROMPT } from './javari-system-prompt';
import { FUNCTION_SCHEMAS, FUNCTION_HANDLERS } from './javari-functions';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';
export type AIModel = 
export interface ModelConfig {
export interface ChatMessage {
export interface ChatCompletionOptions {
    // Handle function calls if present
      // Execute the function
        // Send result back to model
    // Convert messages to Anthropic format
    // Handle tool calls if present
          // Send result back to model
    // Extract text response
            // Skip invalid JSON
export default {}
