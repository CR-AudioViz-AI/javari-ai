// lib/javari/memory/semantic-store.ts
// KV-based semantic memory store for Javari AI
// Primary backend: Supabase javari_knowledge (existing, with search_knowledge RPC)
// Secondary backend: javari_embeddings table (spec-required)
// Safe: returns empty array on any error — never breaks the chat pipeline

import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role key for server-side writes; fall back to anon for reads
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }
  return createClient(url, key);
}

export interface MemoryChunk {
  id: string;
  doc_id: string;
  chunk_id: string;
  text: string;
  similarity?: number;
}

// ── Save an embedding to javari_embeddings table ─────────────────────────────
export async function saveEmbedding(
  docId: string,
  chunkId: string,
  text: string,
  embedding: number[]
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("javari_embeddings").upsert(
      {
        doc_id: docId,
        chunk_id: chunkId,
        text,
        embedding_vector: JSON.stringify(embedding),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doc_id,chunk_id" }
    );

    if (error) {
      // Table may not exist yet — non-fatal
      console.warn("[SemanticStore] saveEmbedding error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[SemanticStore] saveEmbedding failed:", err);
    return false;
  }
}

// ── Search similar chunks by embedding vector ─────────────────────────────────
// Strategy 1: search_knowledge RPC (existing production function)
// Strategy 2: javari_embeddings table (spec-required table, if available)
// Strategy 3: keyword fallback via javari_knowledge full-text
export async function searchSimilar(
  queryEmbedding: number[],
  topK: number = 15,
  queryText: string = ""
): Promise<MemoryChunk[]> {
  try {
    const supabase = getSupabaseClient();

    // ── Strategy 1: Use existing search_knowledge RPC ──────────────────────
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "search_knowledge",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: topK,
        }
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        return (rpcData as Array<Record<string, unknown>>).map((row, i) => ({
          id: String(row.id ?? i),
          doc_id: String(row.category ?? "knowledge"),
          chunk_id: String(row.id ?? i),
          text: String(row.content ?? row.text ?? ""),
          similarity: typeof row.similarity === "number" ? row.similarity : undefined,
        }));
      }
    } catch {
      // RPC not available — try next strategy
    }

    // ── Strategy 2: javari_embeddings table (spec-required) ───────────────
    try {
      const { data: embData, error: embError } = await supabase
        .from("javari_embeddings")
        .select("id, doc_id, chunk_id, text")
        .limit(topK);

      if (!embError && embData && embData.length > 0) {
        return (embData as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id ?? ""),
          doc_id: String(row.doc_id ?? ""),
          chunk_id: String(row.chunk_id ?? ""),
          text: String(row.text ?? ""),
        }));
      }
    } catch {
      // Table doesn't exist yet — try keyword fallback
    }

    // ── Strategy 3: Keyword fallback via javari_knowledge ─────────────────
    if (queryText) {
      const keywords = queryText.split(/\s+/).slice(0, 5).join(" | ");
      const { data: kwData } = await supabase
        .from("javari_knowledge")
        .select("id, category, title, content")
        .textSearch("content", keywords, { type: "websearch" })
        .limit(topK);

      if (kwData && kwData.length > 0) {
        return (kwData as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id ?? ""),
          doc_id: String(row.category ?? ""),
          chunk_id: String(row.id ?? ""),
          text: `[${String(row.title ?? "")}] ${String(row.content ?? "")}`,
        }));
      }
    }

    return [];
  } catch (err) {
    // Complete failure — return empty, never crash the chat pipeline
    console.warn("[SemanticStore] searchSimilar failed:", err);
    return [];
  }
}
