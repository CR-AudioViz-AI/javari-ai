// lib/javari/ingest/errors.ts
// Javari OS Memory Ingestion — Error Definitions
// 2026-02-27 — Stage 2 Build

export class IngestionError extends Error {
  constructor(
    public code: string,
    message: string,
    public recoverable: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IngestionError';
  }
}

export class DocumentFetchError extends IngestionError {
  constructor(documentId: string, cause: string) {
    super(
      'DOCUMENT_FETCH_FAILED',
      `Failed to fetch document ${documentId}: ${cause}`,
      true,
      { documentId, cause }
    );
  }
}

export class ChunkingError extends IngestionError {
  constructor(documentId: string, cause: string) {
    super(
      'CHUNKING_FAILED',
      `Failed to chunk document ${documentId}: ${cause}`,
      false,
      { documentId, cause }
    );
  }
}

export class EmbeddingError extends IngestionError {
  constructor(chunkId: string, provider: string, cause: string) {
    super(
      'EMBEDDING_GENERATION_FAILED',
      `Failed to generate embedding for chunk ${chunkId} via ${provider}: ${cause}`,
      true,
      { chunkId, provider, cause }
    );
  }
}

export class VectorStorageError extends IngestionError {
  constructor(chunkId: string, cause: string) {
    super(
      'VECTOR_STORAGE_FAILED',
      `Failed to store vector for chunk ${chunkId}: ${cause}`,
      true,
      { chunkId, cause }
    );
  }
}

export class ConfigurationError extends IngestionError {
  constructor(field: string, message: string) {
    super(
      'INVALID_CONFIGURATION',
      `Configuration error in ${field}: ${message}`,
      false,
      { field }
    );
  }
}

export class CostLimitExceededError extends IngestionError {
  constructor(estimatedCost: number, maxCost: number) {
    super(
      'COST_LIMIT_EXCEEDED',
      `Estimated cost $${estimatedCost.toFixed(2)} exceeds limit $${maxCost.toFixed(2)}`,
      false,
      { estimatedCost, maxCost }
    );
  }
}
