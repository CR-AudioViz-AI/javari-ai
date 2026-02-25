/**
 * app/api/canonical/search/route.ts
 * Canonical Documentation Vector Search Endpoint
 * 
 * POST /api/canonical/search
 * Searches canonical documentation using pgvector cosine similarity
 * 
 * Input:
 *   { "query": string, "topK"?: number }
 * 
 * Output:
 *   { ok: true, query, count, durationMs, results: [...] }
 * 
 * @version 1.0.0
 * @timestamp Wednesday, February 25, 2026 at 2:30 AM EST
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/canonical/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SearchRequest {
  query: string;
  topK?: number;
}

interface SearchResult {
  doc_key: string;
  chunk_text: string;
  similarity: number;
}

interface SearchResponse {
  ok: boolean;
  query: string;
  count: number;
  durationMs: number;
  results: SearchResult[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function validateSearchRequest(body: unknown): { valid: true; data: SearchRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const req = body as Record<string, unknown>;

  // Validate query
  if (!req.query || typeof req.query !== "string") {
    return { valid: false, error: "Field 'query' is required and must be a string" };
  }

  const query = req.query.trim();
  if (query.length === 0) {
    return { valid: false, error: "Field 'query' cannot be empty" };
  }

  if (query.length > 1000) {
    return { valid: false, error: "Field 'query' cannot exceed 1000 characters" };
  }

  // Validate topK
  let topK = 8; // default
  if (req.topK !== undefined) {
    if (typeof req.topK !== "number" || !Number.isInteger(req.topK)) {
      return { valid: false, error: "Field 'topK' must be an integer" };
    }
    if (req.topK < 1) {
      return { valid: false, error: "Field 'topK' must be at least 1" };
    }
    if (req.topK > 25) {
      return { valid: false, error: "Field 'topK' cannot exceed 25" };
    }
    topK = req.topK;
  }

  return {
    valid: true,
    data: { query, topK }
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPABASE CLIENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables not configured");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VECTOR SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function searchCanonicalChunks(
  query: string,
  topK: number
): Promise<SearchResult[]> {
  const startEmbed = Date.now();

  // Generate query embedding
  const queryEmbedding = await embedText(query);
  const embedDurationMs = Date.now() - startEmbed;

  console.log(`[canonical:search] Generated query embedding in ${embedDurationMs}ms`);

  // Search with pgvector
  const startSearch = Date.now();
  const supabase = getSupabaseClient();

  // SQL query using pgvector cosine distance operator (<=>)
  // similarity = 1 - (embedding <=> query_embedding)
  // Results ordered by distance (lower distance = higher similarity)
  const { data, error } = await supabase.rpc("search_canonical_chunks", {
    query_embedding: queryEmbedding,
    match_count: topK,
  });

  const searchDurationMs = Date.now() - startSearch;

  if (error) {
    // If RPC function doesn't exist, fall back to direct query
    if (error.message?.includes("function") && error.message?.includes("does not exist")) {
      console.log("[canonical:search] RPC function not found, using direct query");
      return await searchCanonicalChunksDirect(queryEmbedding, topK);
    }
    throw new Error(`Supabase search failed: ${error.message}`);
  }

  console.log(`[canonical:search] Found ${data?.length || 0} results in ${searchDurationMs}ms`);

  if (!data || data.length === 0) {
    return [];
  }

  // Map results to SearchResult format
  return data.map((row: any) => ({
    doc_key: row.doc_key || "",
    chunk_text: row.chunk_text || "",
    similarity: row.similarity || 0,
  }));
}

// Direct query fallback if RPC function doesn't exist
async function searchCanonicalChunksDirect(
  queryEmbedding: number[],
  topK: number
): Promise<SearchResult[]> {
  const supabase = getSupabaseClient();

  // Direct SQL with embedding comparison
  const { data, error } = await supabase
    .from("canonical_doc_chunks")
    .select(`
      id,
      doc_id,
      chunk_text,
      embedding
    `)
    .limit(1000); // Get a reasonable subset first

  if (error) {
    throw new Error(`Direct query failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Calculate cosine similarity manually
  const results = data.map((row: any) => {
    const embedding = row.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      return null;
    }

    // Cosine similarity calculation
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < queryEmbedding.length; i++) {
      dotProduct += queryEmbedding[i] * embedding[i];
      normA += queryEmbedding[i] * queryEmbedding[i];
      normB += embedding[i] * embedding[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    return {
      id: row.id,
      doc_id: row.doc_id,
      chunk_text: row.chunk_text,
      similarity: similarity,
      doc_key: "", // Will need to join with canonical_docs table
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  // Take topK
  const topResults = results.slice(0, topK);

  // Get doc_keys for the top results
  if (topResults.length > 0) {
    const docIds = [...new Set(topResults.map(r => r.doc_id))];
    const { data: docs } = await supabase
      .from("canonical_docs")
      .select("id, r2_key")
      .in("id", docIds);

    if (docs) {
      const docMap = new Map(docs.map(d => [d.id, d.r2_key]));
      topResults.forEach(r => {
        r.doc_key = docMap.get(r.doc_id) || "";
      });
    }
  }

  return topResults.map(r => ({
    doc_key: r.doc_key,
    chunk_text: r.chunk_text,
    similarity: r.similarity,
  }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON",
          message: "Request body must be valid JSON",
        },
        { status: 400 }
      );
    }

    // Validate request
    const validation = validateSearchRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: "Validation failed",
          message: validation.error,
        },
        { status: 400 }
      );
    }

    const { query, topK } = validation.data;

    console.log(`[canonical:search] Query: "${query}" (topK=${topK})`);

    // Perform search
    const results = await searchCanonicalChunks(query, topK);

    const durationMs = Date.now() - startTime;

    // Return results
    const response: SearchResponse = {
      ok: true,
      query,
      count: results.length,
      durationMs,
      results,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = err as Error;

    console.error("[canonical:search] Error:", error.message);
    console.error(error.stack);

    return NextResponse.json(
      {
        ok: false,
        error: "Search failed",
        message: error.message,
        durationMs,
      },
      { status: 500 }
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// METHOD NOT ALLOWED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: "Method not allowed",
      message: "Use POST with JSON body: { query: string, topK?: number }",
    },
    { status: 405 }
  );
}
