// lib/canonical/chunker.ts
// CR AudioViz AI — Deterministic Markdown Chunker
// 2026-02-22 — Canonical Document Ingestion System
//
// Splits markdown into semantically meaningful chunks using heading boundaries.
// Deterministic: same input → same output always.
// No external dependencies — pure string processing.
// No createLogger import (avoids LogSubsystem type constraint).

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextChunk {
  index:      number;   // 0-based position in document
  text:       string;   // chunk content
  tokenCount: number;   // estimated token count (≈ chars/4)
  heading?:   string;   // nearest H1/H2/H3 heading context
}

// ── Token estimation ──────────────────────────────────────────────────────────
// 1 token ≈ 4 chars for English — close enough for chunk budgeting
// without requiring a heavy tokenizer dependency.

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Heading extractor ─────────────────────────────────────────────────────────

function extractHeading(text: string): string | undefined {
  const m = text.match(/^#{1,3}\s+(.+)$/m);
  return m ? m[1].trim() : undefined;
}

// ── Core chunker ──────────────────────────────────────────────────────────────

/**
 * chunkMarkdown — splits markdown into chunks respecting heading boundaries.
 *
 * Strategy (priority order):
 * 1. Split on H1/H2 heading lines
 * 2. If section > maxTokens → split on H3
 * 3. If still > maxTokens → split on paragraph boundaries (double newline)
 * 4. If still > maxTokens → hard-split at maxTokens chars with overlap
 *
 * @param text       Raw markdown text
 * @param maxTokens  Max tokens per chunk (default 800 ≈ 3200 chars)
 * @param overlap    Token overlap on hard-splits (default 80 ≈ 320 chars)
 */
export function chunkMarkdown(
  text:      string,
  maxTokens  = 800,
  overlap    = 80,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalised) return [];

  const h1h2Sections = splitOnHeading(normalised, /^#{1,2}\s+/m);

  for (const section of h1h2Sections) {
    if (estimateTokens(section) <= maxTokens) {
      addChunk(section, chunks, maxTokens, overlap);
      continue;
    }
    const h3Sections = splitOnHeading(section, /^#{3}\s+/m);
    for (const sub of h3Sections) {
      if (estimateTokens(sub) <= maxTokens) {
        addChunk(sub, chunks, maxTokens, overlap);
        continue;
      }
      // Paragraph split
      const paras = sub.split(/\n{2,}/);
      let acc = "";
      for (const para of paras) {
        const candidate = acc ? `${acc}\n\n${para}` : para;
        if (estimateTokens(candidate) <= maxTokens) {
          acc = candidate;
        } else {
          if (acc) addChunk(acc, chunks, maxTokens, overlap);
          acc = para;
        }
      }
      if (acc) addChunk(acc, chunks, maxTokens, overlap);
    }
  }

  return chunks.map((c, i) => ({ ...c, index: i }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitOnHeading(text: string, pattern: RegExp): string[] {
  const lines    = text.split("\n");
  const sections: string[] = [];
  let current    = "";

  for (const line of lines) {
    if (pattern.test(line) && current.trim()) {
      sections.push(current.trim());
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim()) sections.push(current.trim());
  return sections.length ? sections : [text];
}

function addChunk(
  text:      string,
  chunks:    TextChunk[],
  maxTokens: number,
  overlap:   number,
): void {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 20) return;

  if (estimateTokens(trimmed) <= maxTokens) {
    chunks.push({
      index:      chunks.length,
      text:       trimmed,
      tokenCount: estimateTokens(trimmed),
      heading:    extractHeading(trimmed),
    });
    return;
  }

  // Hard split with character-based overlap
  const maxChars     = maxTokens * 4;
  const overlapChars = overlap   * 4;
  let start = 0;

  while (start < trimmed.length) {
    const end   = Math.min(start + maxChars, trimmed.length);
    const slice = trimmed.slice(start, end);
    if (slice.trim().length >= 20) {
      chunks.push({
        index:      chunks.length,
        text:       slice.trim(),
        tokenCount: estimateTokens(slice),
        heading:    extractHeading(slice) ?? extractHeading(trimmed),
      });
    }
    if (end === trimmed.length) break;
    start = end - overlapChars;
  }
}
