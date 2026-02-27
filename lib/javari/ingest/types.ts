// lib/javari/ingest/types.ts
// Javari OS Memory Ingestion — Type Definitions
// 2026-02-27 — Stage 2 Build
//
// Core types for document ingestion, chunking, embedding, and vector storage.
// Future-proof design supporting multi-modal content and advanced retrieval.

export interface CanonicalDocument {
  id: string;
  title: string;
  path: string;
  bucket: string;
  category: 'architecture' | 'governance' | 'security' | 'roadmap' | 'operations' | 'technical';
  version: string;
  lastModified: string;
  sizeBytes: number;
  hash: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  author?: string;
  created?: string;
  tags?: string[];
  dependencies?: string[];
  relatedDocs?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
  confidentiality?: 'public' | 'internal' | 'restricted' | 'confidential';
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  heading?: string;
  section?: string;
  subsection?: string;
  hasCode?: boolean;
  hasTable?: boolean;
  hasList?: boolean;
  semanticType?: 'prose' | 'code' | 'data' | 'diagram' | 'metadata';
  keywords?: string[];
}

export interface EmbeddingVector {
  chunkId: string;
  documentId: string;
  embedding: number[];
  model: string;
  dimensions: number;
  createdAt: string;
  cost: number;
}

export interface MemoryNode {
  id: string;
  type: 'document' | 'concept' | 'skill' | 'task' | 'entity';
  name: string;
  content?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: 'references' | 'depends_on' | 'implements' | 'extends' | 'contradicts' | 'supports';
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryGraph {
  nodes: Map<string, MemoryNode>;
  edges: Map<string, MemoryEdge>;
  adjacency: Map<string, Set<string>>;
}

export interface IngestionConfig {
  // Source configuration
  r2Bucket: string;
  r2Path: string;
  documentPattern?: RegExp;
  
  // Chunking configuration
  chunkSize: number;
  chunkOverlap: number;
  semanticBoundaries: boolean;
  preserveCodeBlocks: boolean;
  
  // Embedding configuration
  embeddingProvider: 'openai' | 'mistral' | 'voyage';
  embeddingModel: string;
  embeddingDimensions: number;
  batchSize: number;
  
  // Storage configuration
  supabaseUrl: string;
  supabaseKey: string;
  vectorTable: string;
  metadataTable: string;
  graphTable?: string;
  
  // Processing configuration
  maxConcurrency: number;
  retryAttempts: number;
  retryDelayMs: number;
  
  // Cost controls
  maxCostUsd: number;
  estimateOnly: boolean;
  dryRun: boolean;
}

export interface IngestionResult {
  documentId: string;
  documentTitle: string;
  chunksCreated: number;
  vectorsStored: number;
  graphNodesCreated: number;
  graphEdgesCreated: number;
  totalTokens: number;
  estimatedCost: number;
  actualCost: number;
  durationMs: number;
  errors: IngestionError[];
  success: boolean;
}

export interface IngestionError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  recoverable: boolean;
}

export interface IngestionStats {
  totalDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  totalVectors: number;
  totalCost: number;
  totalDurationMs: number;
  startedAt: string;
  completedAt?: string;
}

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: ChunkMetadata & DocumentMetadata;
}

export interface SupabaseVectorRow {
  id: string;
  chunk_id: string;
  document_id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}
