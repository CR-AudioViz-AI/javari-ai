// lib/javari/memory/canonical-retrieval.ts
// CR AudioViz AI — Canonical Document Retrieval (Step 12)
// 2026-02-22
//
// Calls match_canonical_chunks() RPC (pgvector HNSW, category='r2_canonical').
// Returns a formatted context block for injection into Javari system prompt.
//
// Separate from retrieveRelevantMemory() so canonical platform docs have
// their own labelled section in the system context — easier to debug + trace.
//
// Never throws — returns "" on any failure to protect the chat pipeline.

// ── Config ────────────────────────────────────────────────────────────────────

const CANONICAL_TOP_K        = 8;
const CANONICAL_THRESHOLD    = 0.60;
const CANONICAL_MAX_CHARS    = 8_000;   // ~2 000 tokens

// ── Types ─────────────────────────────────────────────────────────────────────

interface CanonicalChunk {
  id:          string;
  doc_key:     string;
  chunk_title: string;
  chunk_text:  string;
  similarity:  number;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? "";
  if (!url || !key) return null;
  return { url, key };
}

// ── Core search ───────────────────────────────────────────────────────────────

/**
 * searchCanonicalChunks — pgvector similarity search over platform docs only.
 * Uses match_canonical_chunks() RPC (SECURITY DEFINER, category='r2_canonical').
 * Returns [] on any failure — caller must handle empty result gracefully.
 */
export async function searchCanonicalChunks(
  queryEmbedding: number[],
  topK:           number = CANONICAL_TOP_K,
  threshold:      number = CANONICAL_THRESHOLD,
): Promise<CanonicalChunk[]> {
  const cfg = supabaseConfig();
  if (!cfg) {
    console.warn("[CanonicalRetrieval] Supabase not configured");
    return [];
  }

  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/match_canonical_chunks`, {
      method:  "POST",
      headers: {
        apikey:         cfg.key,
        Authorization:  `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body:   JSON.stringify({
        query_embedding: vectorLiteral,
        match_threshold: threshold,
        match_count:     topK,
      }),
      signal: AbortSignal.timeout(10_000),
      cache:  "no-store",
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn(`[CanonicalRetrieval] RPC ${res.status}: ${err.slice(0, 120)}`);
      return [];
    }

    const rows = await res.json() as unknown[];
    if (!Array.isArray(rows)) return [];

    return rows as CanonicalChunk[];
  } catch (err) {
    console.warn("[CanonicalRetrieval] RPC exception:", (err as Error).message);
    return [];
  }
}

// ── Formatter ─────────────────────────────────────────────────────────────────

/**
 * formatCanonicalContext — converts chunk rows into a labelled context string.
 * Header clearly identifies this as platform architecture documentation so
 * the LLM treats it with appropriate authority.
 */
export function formatCanonicalContext(chunks: CanonicalChunk[]): string {
  if (!chunks.length) return "";

  const seen    = new Set<string>();
  const lines: string[] = [
    "### CR AudioViz AI Platform Documentation (Canonical Architecture Context):",
  ];
  let totalChars = lines[0].length;

  for (const chunk of chunks) {
    const text = chunk.chunk_text?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);

    const rel  = (chunk.similarity * 100).toFixed(0);
    const line = `\n---\n[${chunk.doc_key} | relevance: ${rel}%]\n${text}`;

    if (totalChars + line.length > CANONICAL_MAX_CHARS) break;
    lines.push(line);
    totalChars += line.length;
  }

  return lines.length > 1 ? lines.join("") : "";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * retrieveCanonicalContext — embed query → RPC → format context string.
 * Safe: never throws; returns "" on any failure.
 *
 * Used by:
 *   - retrieval.ts (chat pipeline — appended after general memory)
 *   - canonical-context.ts (autonomy cycle — injected before anomaly detection)
 */
export async function retrieveCanonicalContext(
  queryEmbedding: number[],
  opts?: { topK?: number; threshold?: number },
): Promise<string> {
  try {
    const chunks = await searchCanonicalChunks(
      queryEmbedding,
      opts?.topK      ?? CANONICAL_TOP_K,
      opts?.threshold ?? CANONICAL_THRESHOLD,
    );
    return formatCanonicalContext(chunks);
  } catch (err) {
    console.warn("[CanonicalRetrieval] retrieveCanonicalContext failed:", (err as Error).message);
    return "";
  }
}
