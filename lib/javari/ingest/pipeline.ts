// lib/javari/ingest/pipeline.ts
import type { IngestionConfig, IngestionResult, IngestionStats, CanonicalDocument } from './types';
import { DocumentIngester } from './ingest';
import { DocumentChunker } from './chunker';
import { DocumentEmbedder } from './embed';
import { MemoryGraphBuilder } from './memory-graph';
import { CostLimitExceededError } from './errors';
import { formatDuration, formatCost } from './utils';

export class IngestionPipeline {
  private ingester: DocumentIngester;
  private chunker: DocumentChunker;
  private embedder: DocumentEmbedder;
  private graphBuilder: MemoryGraphBuilder;
  private stats: IngestionStats;

  constructor(private config: IngestionConfig) {
    this.ingester = new DocumentIngester();
    this.chunker = new DocumentChunker({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      semanticBoundaries: config.semanticBoundaries,
      preserveCodeBlocks: config.preserveCodeBlocks
    });
    this.embedder = new DocumentEmbedder({
      provider: config.embeddingProvider,
      model: config.embeddingModel,
      dimensions: config.embeddingDimensions,
      batchSize: config.batchSize
    });
    this.graphBuilder = new MemoryGraphBuilder();
    this.stats = {
      totalDocuments: 0,
      successfulDocuments: 0,
      failedDocuments: 0,
      totalChunks: 0,
      totalVectors: 0,
      totalCost: 0,
      totalDurationMs: 0,
      startedAt: new Date().toISOString()
    };
  }

  async ingestDocument(doc: CanonicalDocument): Promise<IngestionResult> {
    const start = Date.now();
    const result: IngestionResult = {
      documentId: doc.id,
      documentTitle: doc.title,
      chunksCreated: 0,
      vectorsStored: 0,
      graphNodesCreated: 0,
      graphEdgesCreated: 0,
      totalTokens: 0,
      estimatedCost: 0,
      actualCost: 0,
      durationMs: 0,
      errors: [],
      success: false
    };

    try {
      const content = await this.ingester.fetchDocument(doc);
      const chunks = this.chunker.chunkDocument(doc.id, content);
      result.chunksCreated = chunks.length;
      result.totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
      result.estimatedCost = this.embedder.estimateCost(chunks);

      if (this.config.estimateOnly || this.config.dryRun) {
        result.success = true;
        result.durationMs = Date.now() - start;
        return result;
      }

      if (this.stats.totalCost + result.estimatedCost > this.config.maxCostUsd) {
        throw new CostLimitExceededError(this.stats.totalCost + result.estimatedCost, this.config.maxCostUsd);
      }

      const vectors = await this.embedder.embedBatch(chunks);
      await this.ingester.storeVectors(vectors, this.config.supabaseUrl, this.config.supabaseKey);
      result.vectorsStored = vectors.length;
      result.actualCost = vectors.reduce((sum, v) => sum + v.cost, 0);

      this.graphBuilder.addDocument(doc);
      result.graphNodesCreated = 1;

      result.success = true;
    } catch (error) {
      result.errors.push({
        code: 'INGESTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        recoverable: false
      });
    }

    result.durationMs = Date.now() - start;
    this.updateStats(result);
    return result;
  }

  private updateStats(result: IngestionResult): void {
    this.stats.totalDocuments++;
    if (result.success) {
      this.stats.successfulDocuments++;
    } else {
      this.stats.failedDocuments++;
    }
    this.stats.totalChunks += result.chunksCreated;
    this.stats.totalVectors += result.vectorsStored;
    this.stats.totalCost += result.actualCost;
    this.stats.totalDurationMs += result.durationMs;
  }

  getStats(): IngestionStats {
    return { ...this.stats, completedAt: new Date().toISOString() };
  }

  getGraph() {
    return this.graphBuilder.getGraph();
  }
}
