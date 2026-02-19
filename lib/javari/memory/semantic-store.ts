// lib/javari/memory/semantic-store.ts
// Semantic store backed by Supabase javari_knowledge table
// Actual schema: id, category, subcategory, title, content, keywords, embedding (TEXT JSON)
// Cosine similarity computed in JS (existing search_knowledge RPC has type bug)
// saveEmbedding writes R2 docs to javari_knowledge with correct schema

export interface MemoryChunk {
  id: string;
  doc_id: string;
  chunk_id: string;
  text: string;
  similarity?: number;
}

function supabaseHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return { url, headers: {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  }};
}

// Cosine similarity between two equal-length vectors
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Save an R2 doc chunk into javari_knowledge
export async function saveEmbedding(
  docId: string,
  chunkId: string,
  text: string,
  embedding: number[]
): Promise<boolean> {
  try {
    const { url, headers } = supabaseHeaders();
    const body = JSON.stringify({
      category: "r2_canonical",
      subcategory: docId,
      title: `${docId}: ${chunkId}`,
      content: text,
      keywords: [docId, "r2", "canonical"],
      source_type: "r2_document",
      source_id: chunkId,
      confidence_score: 1.0,
      embedding: JSON.stringify(embedding),
    });
    const res = await fetch(`${url}/rest/v1/javari_knowledge`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("[SemanticStore] saveEmbedding error:", err.slice(0, 120));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[SemanticStore] saveEmbedding exception:", err);
    return false;
  }
}

// Search for similar chunks by cosine similarity
// Fetches all rows with embeddings, ranks in JS — pragmatic for 44-500 row dataset
export async function searchSimilar(
  queryEmbedding: number[],
  topK: number = 15,
  _queryText: string = ""
): Promise<MemoryChunk[]> {
  try {
    const { url, headers } = supabaseHeaders();

    // Fetch all knowledge rows that have embeddings
    const res = await fetch(
      `${url}/rest/v1/javari_knowledge?select=id,category,subcategory,title,content,embedding&order=created_at.desc&limit=500`,
      { headers }
    );

    if (!res.ok) {
      console.warn("[SemanticStore] Fetch failed:", res.status);
      return [];
    }

    const rows = await res.json() as Array<{
      id: string;
      category: string;
      subcategory: string;
      title: string;
      content: string;
      embedding: string | null;
    }>;

    // Score each row with a valid embedding
    const scored: Array<{ chunk: MemoryChunk; score: number }> = [];

    for (const row of rows) {
      if (!row.embedding) continue;
      try {
        const vec: number[] = JSON.parse(row.embedding);
        if (!Array.isArray(vec) || vec.length !== queryEmbedding.length) continue;
        const score = cosine(queryEmbedding, vec);
        if (score < 0.4) continue; // minimum relevance threshold
        scored.push({
          chunk: {
            id: row.id,
            doc_id: row.subcategory || row.category,
            chunk_id: row.id,
            text: `[${row.title}]\n${row.content}`,
            similarity: score,
          },
          score,
        });
      } catch {
        // malformed embedding — skip
      }
    }

    // Sort by similarity descending, return top K
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.chunk);
  } catch (err) {
    console.error("[SemanticStore] searchSimilar exception:", err);
    return [];
  }
}
