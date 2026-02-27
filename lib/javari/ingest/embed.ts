// lib/javari/ingest/embed.ts
import type { DocumentChunk, EmbeddingVector } from './types';
import { calculateEmbeddingCost, retry } from './utils';
import { EmbeddingError } from './errors';

export interface EmbedderConfig {
  provider: 'openai' | 'mistral' | 'voyage';
  model: string;
  dimensions: number;
  batchSize: number;
  apiKey?: string;
}

export class DocumentEmbedder {
  constructor(private config: EmbedderConfig) {}

  async embedChunk(chunk: DocumentChunk): Promise<EmbeddingVector> {
    return retry(async () => {
      // Stub: In production, call actual embedding API
      const embedding = await this.generateEmbedding(chunk.content);
      
      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        embedding,
        model: this.config.model,
        dimensions: this.config.dimensions,
        createdAt: new Date().toISOString(),
        cost: calculateEmbeddingCost(this.config.provider, chunk.tokenCount)
      };
    }, 3, 1000);
  }

  async embedBatch(chunks: DocumentChunk[]): Promise<EmbeddingVector[]> {
    const results: EmbeddingVector[] = [];
    for (const chunk of chunks) {
      try {
        results.push(await this.embedChunk(chunk));
      } catch (error) {
        throw new EmbeddingError(chunk.id, this.config.provider, String(error));
      }
    }
    return results;
  }

  private async generateEmbedding(content: string): Promise<number[]> {
    // STUB: Replace with actual API call
    // OpenAI: POST https://api.openai.com/v1/embeddings
    // Mistral: POST https://api.mistral.ai/v1/embeddings
    // For now, return mock vector
    return Array(this.config.dimensions).fill(0).map(() => Math.random());
  }

  estimateCost(chunks: DocumentChunk[]): number {
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    return calculateEmbeddingCost(this.config.provider, totalTokens);
  }
}
