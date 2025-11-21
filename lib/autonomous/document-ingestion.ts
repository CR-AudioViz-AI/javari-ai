/**
 * Javari AI - Document Ingestion System
 * Feed Javari with complete documentation and knowledge base
 * 
 * Created: November 21, 2025 - 2:00 PM EST
 * Purpose: Complete autonomous knowledge feeding
 */

import { createClient } from '@supabase/supabase-js';

interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding?: number[];
  metadata: {
    source: string;
    type: 'bible' | 'documentation' | 'credentials' | 'guide';
    section?: string;
    page?: number;
    created_at: string;
  };
}

interface Document {
  id: string;
  title: string;
  content: string;
  type: 'bible' | 'documentation' | 'credentials' | 'guide';
  source: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class DocumentIngestionSystem {
  private supabase: ReturnType<typeof createClient>;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Ingest a complete document into Javari's knowledge base
   */
  async ingestDocument(document: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; documentId?: string; error?: string }> {
    try {
      // 1. Insert main document
      const { data: docData, error: docError } = await this.supabase
        .from('javari_documents')
        .insert({
          title: document.title,
          content: document.content,
          type: document.type,
          source: document.source,
          metadata: document.metadata,
        })
        .select()
        .single();

      if (docError) {
        return { success: false, error: `Failed to insert document: ${docError.message}` };
      }

      const documentId = docData.id;

      // 2. Chunk the document (for better retrieval)
      const chunks = this.chunkDocument(document.content, 1000); // 1000 char chunks

      // 3. Insert chunks
      const chunkData: any[] = chunks.map((chunk, index) => ({
        document_id: documentId,
        content: chunk,
        metadata: {
          source: document.source,
          type: document.type,
          section: document.metadata.section,
          chunk_index: index,
          created_at: new Date().toISOString(),
        },
      }));

      const { error: chunkError } = await this.supabase
        .from('javari_document_chunks')
        .insert(chunkData);

      if (chunkError) {
        console.error('Error inserting chunks:', chunkError);
        // Don't fail the whole operation if chunks fail
      }

      // 4. Generate embeddings (if OpenAI is available)
      // This will be done asynchronously via a separate endpoint

      return { success: true, documentId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Chunk document into smaller pieces for better retrieval
   */
  private chunkDocument(content: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split('\n\n');
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Generate embeddings for all chunks (uses OpenAI)
   */
  async generateEmbeddings(documentId: string, openaiApiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all chunks for this document
      const { data: chunks, error: fetchError } = await this.supabase
        .from('javari_document_chunks')
        .select('*')
        .eq('document_id', documentId);

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      if (!chunks || chunks.length === 0) {
        return { success: false, error: 'No chunks found for document' };
      }

      // Generate embeddings using OpenAI
      for (const chunk of chunks) {
        try {
          const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: chunk.content,
            }),
          });

          if (!response.ok) {
            console.error(`Failed to generate embedding for chunk ${chunk.id}`);
            continue;
          }

          const data = await response.json();
          const embedding = data.data[0].embedding;

          // Update chunk with embedding
          await this.supabase
            .from('javari_document_chunks')
            .update({ embedding })
            .eq('id', chunk.id);

        } catch (error) {
          console.error(`Error processing chunk ${chunk.id}:`, error);
          // Continue with other chunks
        }
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Search documents using semantic search
   */
  async searchDocuments(query: string, limit: number = 5): Promise<DocumentChunk[]> {
    try {
      // This would use vector similarity search
      // For now, simple text search
      const { data, error } = await this.supabase
        .from('javari_document_chunks')
        .select('*')
        .textSearch('content', query)
        .limit(limit);

      if (error) {
        console.error('Search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Feed Complete Bible into Javari
   */
  async feedBible(bibleContent: string): Promise<{ success: boolean; error?: string }> {
    return this.ingestDocument({
      title: 'CR AudioViz AI - Complete Bible V5.0',
      content: bibleContent,
      type: 'bible',
      source: 'COMPLETE_BIBLE_V5.md',
      metadata: {
        version: '5.0',
        updated: new Date().toISOString(),
        comprehensive: true,
      },
    });
  }

  /**
   * Feed documentation into Javari
   */
  async feedDocumentation(docs: Array<{ title: string; content: string; source: string }>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const doc of docs) {
      const result = await this.ingestDocument({
        title: doc.title,
        content: doc.content,
        type: 'documentation',
        source: doc.source,
        metadata: {
          ingested: new Date().toISOString(),
        },
      });

      if (result.success) {
        success++;
      } else {
        failed++;
        console.error(`Failed to ingest ${doc.title}:`, result.error);
      }
    }

    return { success, failed };
  }
}

// Export for API use
export default DocumentIngestionSystem;
