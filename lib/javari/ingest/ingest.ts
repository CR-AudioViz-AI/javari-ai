// lib/javari/ingest/ingest.ts
import type { CanonicalDocument, DocumentChunk, EmbeddingVector, SupabaseVectorRow } from './types';
import { DocumentFetchError, VectorStorageError } from './errors';
import { hashContent, generateId, retry } from './utils';

export class DocumentIngester {
  async fetchDocument(doc: CanonicalDocument): Promise<string> {
    // STUB: In production, fetch from R2
    // const r2Client = new S3Client({ endpoint: R2_ENDPOINT });
    // const response = await r2Client.send(new GetObjectCommand({ Bucket: doc.bucket, Key: doc.path }));
    // return await response.Body.transformToString();
    
    // Mock for now
    return `# ${doc.title}\n\nContent of ${doc.title} goes here...`;
  }

  async storeVectors(vectors: EmbeddingVector[], supabaseUrl: string, supabaseKey: string): Promise<void> {
    // STUB: In production, use Supabase client
    // const supabase = createClient(supabaseUrl, supabaseKey);
    // const rows = vectors.map(v => this.toSupabaseRow(v));
    // await supabase.from('canonical_vectors').insert(rows);
    
    // For now, no-op
    console.log(`[STUB] Would store ${vectors.length} vectors`);
  }

  private toSupabaseRow(vector: EmbeddingVector): SupabaseVectorRow {
    return {
      id: generateId('vec'),
      chunk_id: vector.chunkId,
      document_id: vector.documentId,
      content: '',
      embedding: vector.embedding,
      metadata: {},
      created_at: vector.createdAt
    };
  }
}
