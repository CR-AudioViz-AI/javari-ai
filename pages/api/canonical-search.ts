import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/canonical/embed";

interface SearchResult {
  doc_key: string;
  chunk_text: string;
  similarity: number;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function searchChunks(query: string, topK: number): Promise<SearchResult[]> {
  const embedding = await embedText(query);
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("search_canonical_chunks", {
    query_embedding: embedding,
    match_count: topK,
  });

  if (error) {
    if (error.message?.includes("does not exist")) {
      return await searchDirect(embedding, topK);
    }
    throw new Error(`Search failed: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    doc_key: row.doc_key || "",
    chunk_text: row.chunk_text || "",
    similarity: row.similarity || 0,
  }));
}

async function searchDirect(embedding: number[], topK: number): Promise<SearchResult[]> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from("canonical_doc_chunks")
    .select("id, doc_id, chunk_text, embedding")
    .limit(1000);

  if (error) throw new Error(`Direct query failed: ${error.message}`);
  if (!data) return [];

  const results = data
    .map((row: any) => {
      if (!row.embedding || !Array.isArray(row.embedding)) return null;
      
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < embedding.length; i++) {
        dot += embedding[i] * row.embedding[i];
        normA += embedding[i] * embedding[i];
        normB += row.embedding[i] * row.embedding[i];
      }
      
      return {
        id: row.id,
        doc_id: row.doc_id,
        chunk_text: row.chunk_text,
        similarity: dot / (Math.sqrt(normA) * Math.sqrt(normB)),
        doc_key: "",
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, topK);

  if (results.length > 0) {
    const docIds = [...new Set(results.map((r: any) => r.doc_id))];
    const { data: docs } = await supabase
      .from("canonical_docs")
      .select("id, r2_key")
      .in("id", docIds);

    if (docs) {
      const map = new Map(docs.map(d => [d.id, d.r2_key]));
      results.forEach((r: any) => { r.doc_key = map.get(r.doc_id) || ""; });
    }
  }

  return results.map((r: any) => ({
    doc_key: r.doc_key,
    chunk_text: r.chunk_text,
    similarity: r.similarity,
  }));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const start = Date.now();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body;

    if (!body?.query || typeof body.query !== "string") {
      return res.status(400).json({ ok: false, error: "query required" });
    }

    const query = body.query.trim();
    if (!query || query.length > 1000) {
      return res.status(400).json({ ok: false, error: "query 1-1000 chars" });
    }

    let topK = 8;
    if (body.topK !== undefined) {
      if (!Number.isInteger(body.topK) || body.topK < 1 || body.topK > 25) {
        return res.status(400).json({ ok: false, error: "topK 1-25" });
      }
      topK = body.topK;
    }

    const results = await searchChunks(query, topK);

    return res.status(200).json({
      ok: true,
      query,
      count: results.length,
      durationMs: Date.now() - start,
      results,
    });

  } catch (err: any) {
    console.error("[canonical-search]", err);
    return res.status(500).json({
      ok: false,
      error: "Search failed",
      message: err.message,
      durationMs: Date.now() - start,
    });
  }
}
