// lib/javari/ingest/chunker.ts
import type { DocumentChunk, ChunkMetadata } from './types';
import { hashContent, estimateTokens, extractHeading, detectContentType, sanitizeContent, generateId } from './utils';

export interface ChunkerConfig {
  chunkSize: number;
  chunkOverlap: number;
  semanticBoundaries: boolean;
  preserveCodeBlocks: boolean;
}

export class DocumentChunker {
  constructor(private config: ChunkerConfig) {}

  chunkDocument(documentId: string, content: string): DocumentChunk[] {
    const sanitized = sanitizeContent(content);
    const chunks: DocumentChunk[] = [];
    
    if (this.config.semanticBoundaries) {
      return this.chunkBySemantic(documentId, sanitized);
    }
    
    return this.chunkBySize(documentId, sanitized);
  }

  private chunkBySize(documentId: string, content: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const { chunkSize, chunkOverlap } = this.config;
    
    for (let i = 0, idx = 0; i < content.length; i += chunkSize - chunkOverlap, idx++) {
      const chunkContent = content.slice(i, i + chunkSize);
      chunks.push(this.createChunk(documentId, idx, chunkContent, i, i + chunkContent.length));
    }
    
    return chunks;
  }

  private chunkBySemantic(documentId: string, content: string): DocumentChunk[] {
    const sections = content.split(/\n(?=#{1,3}\s)/);
    return sections.map((section, idx) => 
      this.createChunk(documentId, idx, section, 0, section.length)
    );
  }

  private createChunk(
    documentId: string, 
    idx: number, 
    content: string, 
    start: number, 
    end: number
  ): DocumentChunk {
    const metadata: ChunkMetadata = {
      heading: extractHeading(content),
      semanticType: detectContentType(content),
      hasCode: content.includes('```'),
      hasTable: content.includes('|'),
      hasList: /^[\*\-\+]\s/m.test(content)
    };

    return {
      id: generateId('chunk'),
      documentId,
      chunkIndex: idx,
      content,
      contentHash: hashContent(content),
      startOffset: start,
      endOffset: end,
      tokenCount: estimateTokens(content),
      metadata
    };
  }
}
