// lib/roadmap/ingestRoadmapFromR2.ts
// Purpose: Connect to Cloudflare R2, find roadmap-related markdown/json docs,
//          download them, and extract structured roadmap items for seeding.
//          Uses lib/canonical/r2-client.ts — credentials from Platform Secret Authority vault.
//          Vault keys: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_CANONICAL_PREFIX
//          Defaults: bucket=cold-storage, prefix=consolidation-docs/
// Date: 2026-03-07

import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RoadmapItem {
  title       : string;
  description : string;
  type        : "build_module" | "create_api" | "update_schema" | "deploy_feature" | "ai_task";
  priority    : number;
  source_doc  : string;
  phase?      : string;
}

export interface IngestR2Result {
  ok          : boolean;
  items       : RoadmapItem[];
  filesScanned: number;
  filesUsed   : number;
  error?      : string;
}

// ── Roadmap-relevant file patterns ─────────────────────────────────────────
const ROADMAP_FILE_PATTERNS = [
  /roadmap/i, /platform/i, /scaling/i, /next.steps/i, /master.bible/i,
  /phase/i,   /architecture/i, /blueprint/i, /ecosystem/i, /executive/i,
  /master.summary/i, /complete.guide/i, /strategic/i,
];

// ── Task type classifier ───────────────────────────────────────────────────
function classifyTaskType(title: string, description: string): RoadmapItem["type"] {
  const t = (title + " " + description).toLowerCase();
  if (/(deploy|launch|release|ship|go.?live|production)/i.test(t)) return "deploy_feature";
  if (/(api|endpoint|route|webhook|integration|connect)/i.test(t))  return "create_api";
  if (/(schema|migration|table|database|supabase|column|index)/i.test(t)) return "update_schema";
  if (/(module|component|widget|ui|page|feature|build|create|implement)/i.test(t)) return "build_module";
  return "ai_task";
}

// ── Markdown extractor ─────────────────────────────────────────────────────
function extractItemsFromMarkdown(markdown: string, sourceDoc: string): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  const lines = markdown.split("\n");
  let priority = 1;
  let phase = "";

  const TASK_PATTERNS = [
    /^#{1,3}\s+(?:phase|step|task|roadmap)[:\s]+(.+)/i,
    /^#{2,4}\s+(\d+[\.\)]\s+.{5,})/i,
    /^[-*]\s+\[[ x]\]\s+(.{5,})/i,
    /^[-*]\s+\*\*([^*]{5,})\*\*/,
    /^#{2,4}\s+(?:build|create|implement|deploy|integrate|add|setup|configure)\s+(.+)/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 8) continue;

    const phaseMatch = trimmed.match(/^##\s+(?:phase\s+)?(\w[\w\s-]*)/i);
    if (phaseMatch) phase = phaseMatch[1].trim().toLowerCase().replace(/\s+/g, "_");

    for (const pattern of TASK_PATTERNS) {
      const m = trimmed.match(pattern);
      if (!m) continue;

      const raw = m[1].trim().replace(/\*\*/g, "").replace(/`/g, "").replace(/\[.*?\]/g, "").trim();
      if (raw.length < 8) continue;
      if (/^(overview|introduction|summary|table of contents|toc|notes?|see also)/i.test(raw)) continue;

      items.push({
        title      : raw.slice(0, 120),
        description: `Extracted from ${sourceDoc}${phase ? " — Phase: " + phase : ""} — ${raw}`,
        type       : classifyTaskType(raw, ""),
        priority   : priority++,
        source_doc : sourceDoc,
        phase      : phase || undefined,
      });
      break;
    }
  }

  return items;
}

// ── JSON extractor ─────────────────────────────────────────────────────────
function extractItemsFromJSON(parsed: unknown, sourceDoc: string): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  let priority = 1;

  const processObject = (obj: Record<string, unknown>) => {
    const title = ((obj.title as string) || (obj.name as string) || (obj.task as string) || "").trim();
    if (title.length >= 8) {
      items.push({
        title      : title.slice(0, 120),
        description: (obj.description as string) || `From ${sourceDoc}`,
        type       : classifyTaskType(title, (obj.description as string) || ""),
        priority   : (obj.priority as number) || priority,
        source_doc : sourceDoc,
        phase      : (obj.phase as string) || (obj.phase_id as string) || undefined,
      });
      priority++;
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
 * Lists R2 objects via lib/canonical/r2-client.ts (SigV4, vault-backed credentials).
 * Filters to roadmap-relevant files, downloads and extracts structured items.
 *
 * Credentials sourced from Platform Secret Authority vault:
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_BUCKET (default: cold-storage)
 *   R2_CANONICAL_PREFIX (default: consolidation-docs/)
 */
export async function ingestRoadmapFromR2(): Promise<IngestR2Result> {
  try {
    // Step 1: list all objects — r2-client uses vault credentials + configured bucket/prefix
    let allObjects = await listCanonicalKeys();

    if (!allObjects.length) {
      return {
        ok: false, items: [], filesScanned: 0, filesUsed: 0,
        error: "R2 bucket returned 0 objects. Vault credentials loaded but bucket may be empty.",
      };
    }

    // Step 2: filter to roadmap-relevant markdown/json files
    const roadmapObjects = allObjects.filter(obj => {
      const filename = obj.key.split("/").pop() ?? "";
      return (
        (filename.endsWith(".md") || filename.endsWith(".json")) &&
        ROADMAP_FILE_PATTERNS.some(p => p.test(filename))
      );
    });

    if (!roadmapObjects.length) {
      return {
        ok: false, items: [], filesScanned: allObjects.length, filesUsed: 0,
        error: `Listed ${allObjects.length} R2 objects but none matched roadmap file patterns.`,
      };
    }

    // Step 3: download + extract (cap at 20 docs per run)
    const allItems: RoadmapItem[] = [];
    let filesUsed = 0;

    for (const obj of roadmapObjects.slice(0, 20)) {
      try {
        const content = await fetchCanonicalText(obj.key);
        if (!content.trim()) continue;

        let extracted: RoadmapItem[] = [];

        if (obj.key.endsWith(".json")) {
          try {
            extracted = extractItemsFromJSON(JSON.parse(content), obj.key);
          } catch { /* malformed JSON — skip */ }
        } else {
          extracted = extractItemsFromMarkdown(content, obj.key);
        }

        if (extracted.length) {
          allItems.push(...extracted);
          filesUsed++;
        }
      } catch { /* per-file failure is non-fatal */ }
    }

    // Step 4: deduplicate by title
    const seen = new Set<string>();
    const deduped = allItems.filter(item => {
      const k = item.title.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

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
