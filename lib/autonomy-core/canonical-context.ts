// lib/autonomy-core/canonical-context.ts
// CR AudioViz AI — Canonical Context for Autonomy Cycle (Step 12)
// 2026-02-22
//
// Provides relevant canonical platform documentation to the autonomy cycle
// so anomaly detection and fix generation are architecture-aware.
//
// Called by cycle.ts at the start of each run.
// Result is passed to detectAnomalies() and ring2 fixer as architectural context.
//
// Uses the same match_canonical_chunks() RPC as the chat pipeline.
// Threshold raised to 0.65 (autonomy needs high-confidence docs only).
// Never throws — returns "" on failure so the cycle is never blocked.

import { generateEmbedding }       from "@/lib/javari/memory/embedding-provider";
import { retrieveCanonicalContext } from "@/lib/javari/memory/canonical-retrieval";

const AUTONOMY_TOP_K     = 10;
const AUTONOMY_THRESHOLD = 0.65;

/**
 * getAutonomyCanonicalContext — fetches canonical platform docs most relevant
 * to the current autonomy cycle focus.
 *
 * Queries used:
 *   - System architecture and API design patterns
 *   - Database schema and security access model
 *   - Business process workflows and deployment plan
 *
 * These three queries capture the core architectural documents the fixer
 * needs to make context-aware decisions (not just syntax fixes).
 *
 * Returns a single formatted string ready to prepend to anomaly prompts.
 */
export async function getAutonomyCanonicalContext(): Promise<string> {
  // Representative queries covering the architecture domains the autonomy
  // cycle needs to understand for Ring 2+ decisions.
  const queries = [
    "system architecture API route patterns security access control",
    "database schema Supabase Row Level Security migrations",
    "business process workflows deployment environment configuration",
  ];

  try {
    const contexts = await Promise.all(
      queries.map(async (query) => {
        try {
          const embedding = await generateEmbedding(query);
          if (!embedding) return "";
          return retrieveCanonicalContext(embedding, {
            topK:      AUTONOMY_TOP_K,
            threshold: AUTONOMY_THRESHOLD,
          });
        } catch {
          return "";
        }
      })
    );

    // Merge contexts, deduplicate by chunk content
    const seen    = new Set<string>();
    const merged: string[] = [];

    for (const ctx of contexts) {
      if (!ctx) continue;
      // Split on the chunk separator and deduplicate
      const sections = ctx.split("\n---\n").slice(1); // skip header
      for (const section of sections) {
        const key = section.slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(section);
      }
    }

    if (!merged.length) return "";

    const header = "### Platform Architecture Context (Canonical Docs — Autonomy Cycle):";
    const body   = merged.map((s) => `\n---\n${s}`).join("");
    const result = header + body;

    console.info(
      `[CanonicalContext:Autonomy] ${merged.length} unique chunks, ${result.length} chars`
    );
    return result;

  } catch (err) {
    console.warn("[CanonicalContext:Autonomy] Failed:", (err as Error).message);
    return "";
  }
}
