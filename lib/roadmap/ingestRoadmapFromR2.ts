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
  id         : string;
  title      : string;
  description: string;
  type       : "build_module" | "create_api" | "update_schema" | "deploy_feature" | "ai_task";
  priority   : number;
  source_doc : string;
  phase?     : string;
}

export interface IngestR2Result {
  ok          : boolean;
  items       : RoadmapItem[];
  filesScanned: number;
  filesUsed   : number;
  error?      : string;
}

// ── Roadmap-relevant file patterns ─────────────────────────────────────────
// Applied to filename — also includes all non-placeholder docs on second pass
const ROADMAP_FILE_PATTERNS = [
  /roadmap/i, /platform/i, /scaling/i, /next.steps/i, /master/i,
  /phase/i,   /architecture/i, /blueprint/i, /ecosystem/i, /executive/i,
  /strategic/i, /deployment/i, /implementation/i, /workflow/i,
  /component/i, /integration/i, /api/i, /security/i, /business/i,
];

// ── Action verbs that signal an implementable task ─────────────────────────
// Must appear as the first real word of the extracted text fragment
const ACTION_VERBS = [
  "implement", "build", "deploy", "create", "design", "integrate",
  "complete", "develop", "establish", "configure", "set up", "setup",
  "add", "enable", "migrate", "refactor", "update", "upgrade",
  "connect", "install", "generate", "launch", "optimize", "extend",
  "automate", "register", "validate", "test", "document", "publish",
];

// Pre-compiled: matches ACTION_VERBS at word boundary (case insensitive)
const ACTION_VERB_RE = new RegExp(
  `^(?:${ACTION_VERBS.map(v => v.replace(/\s+/, "\\\\s+")).join("|")})\\b`,
  "i"
);

// ── Task type classifier ───────────────────────────────────────────────────
function classifyType(title: string): RoadmapItem["type"] {
  const t = title.toLowerCase();
  if (/(deploy|launch|release|ship|go.?live|production|publish)/i.test(t)) return "deploy_feature";
  if (/(api|endpoint|route|webhook|integration|connect|register)/i.test(t))  return "create_api";
  if (/(schema|migration|table|database|supabase|column|index|migrate)/i.test(t)) return "update_schema";
  if (/(module|component|widget|ui|page|feature|build|create|implement|design|develop)/i.test(t)) return "build_module";
  return "ai_task";
}

// ── Slug for deterministic IDs ─────────────────────────────────────────────
function slugify(text: string, maxLen = 40): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, maxLen);
}

// ── Stable title hash for deduplication ────────────────────────────────────
function titleHash(title: string): string {
  return crypto.createHash("md5")
    .update(title.toLowerCase().trim())
    .digest("hex")
    .slice(0, 12);
}

// ── Category from source doc path ─────────────────────────────────────────
function categoryFromPath(path: string): string {
  const name = path.split("/").pop() ?? path;
  // Strip hex prefix (e.g. "33e3cc85a_") and extension
  return name
    .replace(/^[0-9a-f]+_/, "")
    .replace(/\.(md|json)$/i, "")
    .replace(/_v\d+.*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30);
}

// ── Clean a raw text fragment into a title ─────────────────────────────────
function cleanTitle(raw: string): string {
  return raw
    .replace(/\*\*/g, "")          // remove bold markers
    .replace(/`/g, "")             // remove code ticks
    .replace(/\[.*?\]/g, "")       // remove markdown links [text]
    .replace(/\(.*?\)/g, "")       // remove parenthetical refs
    .replace(/^\d+\.\s*/, "")      // strip leading "1. "
    .replace(/^[-*•]\s*/, "")      // strip bullet markers
    .replace(/^#+\s*/, "")         // strip heading markers
    .replace(/:$/, "")             // strip trailing colons
    .replace(/\s+/g, " ")
    .trim();
}

// ── Word count ────────────────────────────────────────────────────────────
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ══════════════════════════════════════════════════════════════════════════
// extractRoadmapItems — line-by-line actionable verb parser
//
// Detection strategy (in priority order):
//  1. ACTION_VERB lines — any line whose cleaned text starts with an action verb
//  2. Numbered workflow steps — "1. Step description" (≥4 words)
//  3. Bold purpose/action statements — **Purpose**: ... or **Action**: ...
//  4. Checklist items — "- [ ] Do something"
//
// Rules enforced:
//  - Min 4 words after cleaning
//  - Skip placeholder-only docs
//  - Deduplicate within doc by title hash
//  - ID format: rm-{category}-{slug}
// ══════════════════════════════════════════════════════════════════════════
export function extractRoadmapItems(
  markdown  : string,
  sourceDoc : string
): RoadmapItem[] {
  // Fast reject: placeholder docs have no real content
  if (
    markdown.includes("This document is a placeholder") ||
    markdown.trim().split("\n").filter(l => l.trim()).length < 5
  ) {
    return [];
  }

  const items   : RoadmapItem[] = [];
  const seenHash = new Set<string>();
  const category = categoryFromPath(sourceDoc);
  const lines    = markdown.split("\n");

  let phase = "";

  // ── Capture current phase from h2 headings ─────────────────────────────
  function updatePhase(line: string): void {
    const m = line.trim().match(/^#{1,3}\s+(.+)/);
    if (m) {
      const heading = cleanTitle(m[1]);
      // Only update phase for real section headings (≥2 words or recognisable keyword)
      if (wordCount(heading) >= 1) phase = heading.toLowerCase().replace(/\s+/g, "_");
    }
  }

  // ── Try to extract an actionable title from a line ─────────────────────
  function extractActionTitle(line: string): string | null {
    const t = line.trim();
    if (!t || t.length < 12) return null;

    let candidate = "";

    // Pattern 1 — pure action verb at start of sentence (any context)
    //   "- Implement disaster recovery failover"
    //   "Implement disaster recovery failover"
    //   "3. Implement disaster recovery failover"
    const p1 = t
      .replace(/^[-*•]\s*\[[ x]\]\s*/, "")   // strip checklist prefix
      .replace(/^[-*•]\s*/, "")               // strip bullet
      .replace(/^\d+\.\s*/, "")              // strip "1. "
      .replace(/^\*\*([^*]+)\*\*:?\s*/, "$1 "); // unwrap **bold**:

    const cleaned1 = cleanTitle(p1);
    if (ACTION_VERB_RE.test(cleaned1)) {
      candidate = cleaned1;
    }

    // Pattern 2 — numbered workflow step "1. **Draft** → Create application"
    //   Extract the verb-containing part after the arrow if present
    if (!candidate) {
      const p2 = t.match(/^\d+\.\s+\*?\*?(\w[\w\s,\-]+)\*?\*?\s*[→:]\s*(.+)/);
      if (p2) {
        const action = cleanTitle(p2[2]);
        if (ACTION_VERB_RE.test(action)) {
          candidate = action;
        } else {
          // Construct from step name + action
          candidate = `${cleanTitle(p2[1])} — ${action}`;
        }
      }
    }

    // Pattern 3 — "**Purpose**: Restrict access to admin routes"
    if (!candidate) {
      const p3 = t.match(/^\*\*(?:Purpose|Action|Task|Goal|Objective|Requirement|Outcome)\*\*:?\s+(.+)/i);
      if (p3) {
        const action = cleanTitle(p3[1]);
        if (ACTION_VERB_RE.test(action)) {
          candidate = action;
        }
      }
    }

    // Pattern 4 — checklist "- [ ] Implement X"
    if (!candidate) {
      const p4 = t.match(/^[-*]\s+\[[ x]\]\s+(.{10,})/);
      if (p4) {
        const action = cleanTitle(p4[1]);
        if (ACTION_VERB_RE.test(action)) {
          candidate = action;
        }
      }
    }

    if (!candidate) return null;

    // Enforce minimum 4 words
    if (wordCount(candidate) < 4) return null;

    // Hard cap title length
    return candidate.slice(0, 120);
  }

  // ── Main pass ──────────────────────────────────────────────────────────
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Track current section for phase tagging
    if (/^#{1,3}\s/.test(trimmed)) {
      updatePhase(trimmed);
      continue; // don't try to extract task from heading itself
    }

    const title = extractActionTitle(trimmed);
    if (!title) continue;

    // Dedup by title hash
    const hash = titleHash(title);
    if (seenHash.has(hash)) continue;
    seenHash.add(hash);

    const slug = slugify(title);
    const id   = `rm-${category}-${slug}`;

    items.push({
      id,
      title,
      description: `[${sourceDoc}]${phase ? " Phase: " + phase + "." : ""} ${title}`,
      type       : classifyType(title),
      priority   : items.length + 1,
      source_doc : sourceDoc,
      phase      : phase || undefined,
    });
  }

  return items;
}

// ── JSON extractor (unchanged) ─────────────────────────────────────────────
function extractItemsFromJSON(parsed: unknown, sourceDoc: string): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  const category = categoryFromPath(sourceDoc);
  const seenHash = new Set<string>();
  let priority = 1;

  const processObject = (obj: Record<string, unknown>) => {
    const title = cleanTitle(
      ((obj.title as string) || (obj.name as string) || (obj.task as string) || "").trim()
    );
    if (title.length >= 12 && wordCount(title) >= 4) {
      const hash = titleHash(title);
      if (!seenHash.has(hash)) {
        seenHash.add(hash);
        const slug = slugify(title);
        items.push({
          id         : `rm-${category}-${slug}`,
          title,
          description: (obj.description as string) || `From ${sourceDoc}`,
          type       : classifyType(title),
          priority   : (obj.priority as number) || priority,
          source_doc : sourceDoc,
          phase      : (obj.phase as string) || (obj.phase_id as string) || undefined,
        });
        priority++;
      }
    }
    for (const key of ["tasks", "items", "phases", "steps", "roadmap"]) {
      if (Array.isArray(obj[key])) {
        for (const child of obj[key] as unknown[]) {
          if (child && typeof child === "object") processObject(child as Record<string, unknown>);
        }
      }
    }
  };

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === "object") processObject(item as Record<string, unknown>);
    }
  } else if (parsed && typeof parsed === "object") {
    processObject(parsed as Record<string, unknown>);
  }

  return items;
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * ingestRoadmapFromR2
 *
 * Lists all objects in R2 cold-storage/consolidation-docs/, downloads each
 * markdown/json file, runs extractRoadmapItems() on it, and returns
 * deduplicated actionable task items ready for seedTasksFromRoadmap().
 *
 * Files with fewer than 5 non-empty lines or the word "placeholder" are skipped.
 * Items with fewer than 4 words are discarded.
 * Deduplication uses MD5(title.toLowerCase()) across all docs.
 */
export async function ingestRoadmapFromR2(): Promise<IngestR2Result> {
  try {
    // Step 1: list — vault-backed credentials, defaults to cold-storage/consolidation-docs/
    const allObjects = await listCanonicalKeys();

    if (!allObjects.length) {
      return {
        ok: false, items: [], filesScanned: 0, filesUsed: 0,
        error: "R2 returned 0 objects. Vault credentials resolved but bucket may be empty.",
      };
    }

    // Step 2: all markdown and json files (no filename pre-filter — we filter by content)
    const docObjects = allObjects.filter(obj =>
      obj.key.endsWith(".md") || obj.key.endsWith(".json")
    );

    // Step 3: download + extract (cap at 34 docs — full consolidation-docs set)
    const allItems : RoadmapItem[] = [];
    const globalSeen = new Set<string>();
    let filesUsed = 0;

    for (const obj of docObjects.slice(0, 34)) {
      try {
        const content = await fetchCanonicalText(obj.key);
        if (!content.trim()) continue;

        let extracted: RoadmapItem[] = [];

        if (obj.key.endsWith(".json")) {
          try {
            extracted = extractItemsFromJSON(JSON.parse(content), obj.key);
          } catch { /* malformed JSON */ }
        } else {
          extracted = extractRoadmapItems(content, obj.key);
        }

        if (extracted.length) {
          allItems.push(...extracted);
          filesUsed++;
        }
      } catch { /* per-file failure is non-fatal */ }
    }

    // Step 4: global dedup by title hash across all docs
    const deduped: RoadmapItem[] = [];
    for (const item of allItems) {
      const h = titleHash(item.title);
      if (globalSeen.has(h)) continue;
      globalSeen.add(h);
      deduped.push(item);
    }

    // Step 5: re-assign sequential priority
    deduped.forEach((item, i) => { item.priority = i + 1; });

    return {
      ok          : true,
      items       : deduped,
      filesScanned: allObjects.length,
      filesUsed,
    };

  } catch (err) {
    return {
      ok: false, items: [], filesScanned: 0, filesUsed: 0,
      error: String(err),
    };
  }
}
