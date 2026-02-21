// lib/canonical/chunker.ts
// CR AudioViz AI — Deterministic Markdown Chunker
// 2026-02-22 — Canonical Document Ingestion System
//
// Splits markdown into semantically meaningful chunks using heading boundaries.
// Deterministic: same input → same output always.
// No external dependencies — pure string processing.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextChunk {
  index:      number;   // 0-based position in document
  text:       string;   // chunk content
  tokenCount: number;   // estimated token count (≈ chars/4)
  heading?:   string;   // nearest H1/H2/H3 heading context
}

// ── Token estimation ──────────────────────────────────────────────────────────
// Conservative estimate: 1 token ≈ 4 chars for English text.
// OpenAI's actual tokenizer is more nuanced but this is close enough for
// chunk-size budgeting without requiring a heavy tokenizer dependency.

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
 * chunkMarkdown — splits markdown text into chunks.
 *
 * Strategy (in priority order):
 * 1. Split on H1/H2 headings first (natural doc sections)
 * 2. If a section is still > maxTokens, split on H3
 * 3. If still > maxTokens, split on paragraph boundaries (double newline)
 * 4. If still > maxTokens, hard-split at maxTokens with overlap
 *
 * @param text       Raw markdown text
 * @param maxTokens  Target max tokens per chunk (default 800)
 * @param overlap    Token overlap between consecutive hard-splits (default 80)
 */
export function chunkMarkdown(
  text:      string,
  maxTokens  = 800,
  overlap    = 80
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Normalise line endings
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalised) return [];

  // Step 1: Split on H1 / H2 heading lines (lines starting with # or ##)
  const h1h2Sections = splitOnPattern(normalised, /^#{1,2}\s+/m);

  for (const section of h1h2Sections) {
    if (estimateTokens(section) <= maxTokens) {
      addChunk(section, chunks, maxTokens, overlap);
      continue;
    }

    // Step 2: Split large sections on H3
    const h3Sections = splitOnPattern(section, /^#{3}\s+/m);
    for (const sub of h3Sections) {
      if (estimateTokens(sub) <= maxTokens) {
        addChunk(sub, chunks, maxTokens, overlap);
        continue;
      }

      // Step 3: Split on paragraph boundaries
      const paragraphs = sub.split(/\n{2,}/);
      let accumulator  = "";

      for (const para of paragraphs) {
        const candidate = accumulator ? `${accumulator}\n\n${para}` : para;
        if (estimateTokens(candidate) <= maxTokens) {
          accumulator = candidate;
        } else {
          if (accumulator) addChunk(accumulator, chunks, maxTokens, overlap);
          accumulator = para;
        }
      }
      if (accumulator) addChunk(accumulator, chunks, maxTokens, overlap);
    }
  }

  // Assign sequential indices
  return chunks.map((c, i) => ({ ...c, index: i }));
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Split text on a heading pattern, keeping the heading with its content.
 * Works on multiline strings.
 */
function splitOnPattern(text: string, pattern: RegExp): string[] {
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

/**
 * Add text to chunks list. If too large, hard-split with overlap.
 * Skips chunks that are too short (< 20 chars) to be useful.
 */
function addChunk(
  text:      string,
  chunks:    TextChunk[],
  maxTokens: number,
  overlap:   number
): void {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 20) return;

  if (estimateTokens(trimmed) <= maxTokens) {
    chunks.push({
      index:      chunks.length, // will be reassigned after
      text:       trimmed,
      tokenCount: estimateTokens(trimmed),
      heading:    extractHeading(trimmed),
    });
    return;
  }

  // Hard split with overlap (character-based)
  const maxChars     = maxTokens * 4;
  const overlapChars = overlap   * 4;
  let start = 0;

  while (start < trimmed.length) {
    const end  = Math.min(start + maxChars, trimmed.length);
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
