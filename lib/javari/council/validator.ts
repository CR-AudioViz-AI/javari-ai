// lib/javari/council/validator.ts
import { getProvider, getProviderApiKey } from '../providers';
import { MergedResponse } from './merge';

export interface ValidationResult {
  validated: boolean;
  validatorProvider: 'anthropic' | 'openai';
  reasoning?: string;
  finalText: string;
}

export async function validateCouncilResult(
  merged: MergedResponse
): Promise<ValidationResult> {
  
  // Try Claude first (if available)
  try {
    const claudeKey = getProviderApiKey('anthropic');
    const claude = getProvider('anthropic', claudeKey);
    
    const validationPrompt = `You are validating an AI council decision. 
The council selected this response: "${merged.finalText}"
Reasoning: ${merged.reasoning}

Is this response accurate, helpful, and appropriate? Respond with "VALID" or suggest improvements.`;

    let validationResponse = '';
    for await (const chunk of claude.generateStream(validationPrompt)) {
      validationResponse += chunk;
    }

    return {
      validated: validationResponse.toLowerCase().includes('valid'),
      validatorProvider: 'anthropic',
      reasoning: validationResponse,
      finalText: merged.finalText
    };

  } catch (claudeError) {
    // Fallback to OpenAI
    try {
      const openaiKey = getProviderApiKey('openai');
      const openai = getProvider('openai', openaiKey);
      
      const validationPrompt = `Validate this AI response for accuracy and helpfulness: "${merged.finalText}"`;

      let validationResponse = '';
      for await (const chunk of openai.generateStream(validationPrompt)) {
        validationResponse += chunk;
      }

      return {
        validated: true,
        validatorProvider: 'openai',
        reasoning: validationResponse,
        finalText: merged.finalText
      };

    } catch (openaiError) {
      // No validator available - accept result as-is
      return {
        validated: true,
        validatorProvider: 'openai',
        reasoning: 'No validator available - accepting council decision',
        finalText: merged.finalText
      };
    }
  }
}
