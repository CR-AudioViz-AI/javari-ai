// agents/javari.ts
// Javari AI Agent with knowledge-grounded responses

import { askJavari, searchKnowledge } from '../services/knowledge';

export interface JavariMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface JavariResponse {
  message: string;
  sources?: Array<{
    source: string;
    similarity: number;
  }>;
  model?: string;
}

/**
 * Main Javari chat interface
 * Routes messages through the knowledge system for grounded responses
 */
export async function chat(
  messages: JavariMessage[],
  options?: {
    useKnowledge?: boolean;
    topK?: number;
  }
): Promise<JavariResponse> {
  const useKnowledge = options?.useKnowledge !== false; // Default true
  const lastMessage = messages[messages.length - 1];

  if (lastMessage.role !== 'user') {
    throw new Error('Last message must be from user');
  }

  // Use knowledge-grounded response by default
  if (useKnowledge) {
    try {
      const result = await askJavari(lastMessage.content, {
        topK: options?.topK || 5,
      });

      return {
        message: result.answer,
        sources: result.matches.map((m) => ({
          source: m.source,
          similarity: m.similarity,
        })),
        model: 'gpt-4o-knowledge',
      };
    } catch (error) {
      console.error('Knowledge query failed, falling back to direct chat:', error);
      // Fall through to direct chat if knowledge system fails
    }
  }

  // Fallback: direct chat without knowledge grounding
  // This should only happen if useKnowledge=false or knowledge system fails
  return fallbackChat(messages);
}

/**
 * Search Javari's knowledge base without generating an answer
 * Useful for displaying relevant documentation
 */
export async function searchDocumentation(
  query: string,
  options?: {
    topK?: number;
  }
) {
  return searchKnowledge(query, { topK: options?.topK || 5 });
}

/**
 * Fallback chat handler when knowledge system is unavailable
 * Uses direct API call without knowledge grounding
 */
async function fallbackChat(messages: JavariMessage[]): Promise<JavariResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error('Chat API failed');
  }

  const data = await response.json();
  return {
    message: data.message || data.response || 'No response',
    model: 'fallback',
  };
}
