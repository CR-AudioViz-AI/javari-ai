// lib/roadmap/ingestRoadmapFromR2.ts
// Purpose: Connect to Cloudflare R2, download canonical docs, extract actionable
//          roadmap tasks using verb-based detection.
//          Credentials: Platform Secret Authority vault via lib/canonical/r2-client.ts
//          Bucket: cold-storage (default), Prefix: consolidation-docs/ (default)
// Date: 2026-03-07
import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";
import crypto from "crypto";
// ── Types ──────────────────────────────────────────────────────────────────
export interface RoadmapItem {
export interface IngestR2Result {
// ── Roadmap-relevant file patterns ─────────────────────────────────────────
// Applied to filename — also includes all non-placeholder docs on second pass
// ── Action verbs that signal an implementable task ─────────────────────────
// Must appear as the first real word of the extracted text fragment
// Pre-compiled: matches ACTION_VERBS at word boundary (case insensitive)
// ── Task type classifier ───────────────────────────────────────────────────
// ── Slug for deterministic IDs ─────────────────────────────────────────────
// ── Stable title hash for deduplication ────────────────────────────────────
// ── Category from source doc path ─────────────────────────────────────────
  // Strip hex prefix (e.g. "33e3cc85a_") and extension
// ── Clean a raw text fragment into a title ─────────────────────────────────
// ── Word count ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// extractRoadmapItems — line-by-line actionable verb parser
// Detection strategy (in priority order):
//  1. ACTION_VERB lines — any line whose cleaned text starts with an action verb
//  2. Numbered workflow steps — "1. Step description" (≥4 words)
//  3. Bold purpose/action statements — **Purpose**: ... or **Action**: ...
//  4. Checklist items — "- [ ] Do something"
// Rules enforced:
//  - Min 4 words after cleaning
//  - Skip placeholder-only docs
//  - Deduplicate within doc by title hash
//  - ID format: rm-{category}-{slug}
// ══════════════════════════════════════════════════════════════════════════
  // Fast reject: placeholder docs have no real content
  // ── Capture current phase from h2 headings ─────────────────────────────
      // Only update phase for real section headings (≥2 words or recognisable keyword)
  // ── Try to extract an actionable title from a line ─────────────────────
    // Pattern 1 — pure action verb at start of sentence (any context)
    //   "- Implement disaster recovery failover"
    //   "Implement disaster recovery failover"
    //   "3. Implement disaster recovery failover"
    // Pattern 2 — numbered workflow step "1. **Draft** → Create application"
    //   Extract the verb-containing part after the arrow if present
          // Construct from step name + action
    // Pattern 3 — "**Purpose**: Restrict access to admin routes"
    // Pattern 4 — checklist "- [ ] Implement X"
    // Enforce minimum 4 words
    // Hard cap title length
  // ── Main pass ──────────────────────────────────────────────────────────
    // Track current section for phase tagging
    // Dedup by title hash
// ── JSON extractor (unchanged) ─────────────────────────────────────────────
// ── Main export ────────────────────────────────────────────────────────────
    // Step 1: list — vault-backed credentials, defaults to cold-storage/consolidation-docs/
    // Step 2: all markdown and json files (no filename pre-filter — we filter by content)
    // Step 3: download + extract (cap at 34 docs — full consolidation-docs set)
    // Step 4: global dedup by title hash across all docs
    // Step 5: re-assign sequential priority
export default {}
