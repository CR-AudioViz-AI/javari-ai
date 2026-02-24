// services/knowledge.ts
// Knowledge retrieval service for Javari AI
// Calls the semantic search API deployed in crav-docs

export interface KnowledgeMatch {
  id: string;
  source: string;
  topic: string;
  content: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface KnowledgeQueryResponse {
  answer: string;
  matches: KnowledgeMatch[];
}

export interface KnowledgeSearchResponse {
  matches: KnowledgeMatch[];
  usedEmbedding: 'small' | 'large';
}

/**
 * Search knowledge base using vector similarity
 */
export async function searchKnowledge(
  query: string,
  options?: {
    topK?: number;
    useLarge?: boolean;
  }
): Promise<KnowledgeSearchResponse> {
  const response = await fetch('/api/knowledge/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      topK: options?.topK || 5,
      useLarge: options?.useLarge || false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Knowledge search failed');
  }

  return response.json();
}

/**
 * Ask Javari a question using RAG (Retrieval-Augmented Generation)
 * This is the primary interface for knowledge-grounded Q&A
 */
export async function askJavari(
  question: string,
  options?: {
    topK?: number;
  }
): Promise<KnowledgeQueryResponse> {
  const response = await fetch('/api/knowledge/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      topK: options?.topK || 5,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Knowledge query failed');
  }

  return response.json();
}

/**
 * Health check for knowledge system
 */
export async function checkKnowledgeHealth(): Promise<{ status: string; time: string }> {
  const response = await fetch('/api/knowledge/health');
  
  if (!response.ok) {
    throw new Error('Knowledge health check failed');
  }

  return response.json();
}
