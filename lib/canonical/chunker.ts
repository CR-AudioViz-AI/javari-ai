// lib/canonical/chunker.ts
// CR AudioViz AI — Canonical Markdown Chunker
// 2026-02-22 PART 2
//
// Deterministic: same input always produces the same output.
// No external dependencies.

export interface Chunk {
  chunkIndex:   number;
  chunkText:    string;
  approxTokens: number;   // Math.ceil(chunkText.length / 4)
}

export interface ChunkOptions {
  maxChars?: number;   // default 3500
}

const DEFAULT_MAX_CHARS = 3500;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Split text on lines that begin a new H2 or H3 heading (## or ###).
 * The heading line stays attached to the section that follows it.
 * H1 (#) is treated as the document title and kept with the first section.
 */
function splitOnHeadings(text: string): string[] {
  const lines    = text.split("\n");
  const sections: string[] = [];
  let   current  = "";

  for (const line of lines) {
    // New section starts on any ## or ### heading
    if (/^#{2,3}\s/.test(line) && current.trim().length > 0) {
      sections.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim().length > 0) {
    sections.push(current);
  }

  return sections.length > 0 ? sections : [text];
}

/**
 * Split a single section on blank-line paragraph boundaries.
 */
function splitOnParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Hard-split a string at maxChars boundaries (no overlap).
 * Used only when a single paragraph already exceeds maxChars.
 */
function hardSplit(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    parts.push(text.slice(start, start + maxChars));
    start += maxChars;
  }
  return parts.filter((p) => p.trim().length > 0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * chunkMarkdown — splits markdown text into overlapping, size-bounded chunks.
 *
 * Strategy (in priority order):
 *   1. Split on H2 / H3 headings — respect document structure.
 *   2. Within each heading section, accumulate paragraphs until maxChars is hit.
 *   3. If a single paragraph exceeds maxChars, hard-split it.
 *
 * Guarantees:
 *   - Never returns empty chunks.
 *   - chunkIndex is 0-based and sequential.
 *   - Deterministic: identical input → identical output.
 *   - approxTokens = Math.ceil(chunkText.length / 4)
 */
export function chunkMarkdown(text: string, opts?: ChunkOptions): Chunk[] {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;

  // Normalise line endings
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalised) return [];

  const chunks:    string[] = [];
  const sections = splitOnHeadings(normalised);

  for (const section of sections) {
    const paragraphs = splitOnParagraphs(section);
    let   buffer     = "";

    for (const para of paragraphs) {
      // If one paragraph alone exceeds maxChars — hard-split it first
      if (para.length > maxChars) {
        // Flush buffer first
        if (buffer.trim()) {
          chunks.push(buffer.trim());
          buffer = "";
        }
        for (const part of hardSplit(para, maxChars)) {
          chunks.push(part.trim());
        }
        continue;
      }

      const candidate = buffer ? `${buffer}\n\n${para}` : para;

      if (candidate.length <= maxChars) {
        buffer = candidate;
      } else {
        // Flush current buffer and start fresh with this paragraph
        if (buffer.trim()) {
          chunks.push(buffer.trim());
        }
        buffer = para;
      }
    }

    // Flush remaining buffer for this section
    if (buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = "";
    }
  }

  // Build output — filter empty, assign indices
  return chunks
    .filter((c) => c.trim().length > 0)
    .map((chunkText, i) => ({
      chunkIndex:   i,
      chunkText,
      approxTokens: Math.ceil(chunkText.length / 4),
    }));
}
