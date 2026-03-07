// lib/roadmap/ingestRoadmapFromR2.ts
// Purpose: Connect to Cloudflare R2, find roadmap-related markdown/json docs,
//          download them, extract structured roadmap items for seeding into Supabase.
//          Uses @aws-sdk/client-s3 (already in project deps via canonical/ingest route).
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export interface RoadmapItem {
  title       : string;
  description : string;
  type        : "build_module" | "create_api" | "update_schema" | "deploy_feature" | "ai_task";
  priority    : number;
  source_doc  : string;   // R2 path the item was extracted from
  phase?      : string;
}

export interface IngestR2Result {
  ok          : boolean;
  items       : RoadmapItem[];
  filesScanned: number;
  filesUsed   : number;
  error?      : string;
}

// ── R2 config ──────────────────────────────────────────────────────────────

const BUCKET  = "cold-storage";
// All canonical docs live under the consolidation-docs/ prefix in cold-storage bucket
const PREFIXES = [
  "consolidation-docs/owner-docs/",
  "consolidation-docs/blueprints/",
  "consolidation-docs/technical/",
  "consolidation-docs/technical-docs/",
  "consolidation-docs/admin-docs/",
  "consolidation-docs/business/",
  "consolidation-docs/ai-learning/",
  "consolidation-docs/",   // also catch root-level files like README.md and COMPLETE_INDEX.md
];

// Roadmap-related filename patterns — these are the docs most likely to contain
// Phase / Task / Step / Roadmap items
const ROADMAP_FILE_PATTERNS = [
  /roadmap/i, /platform/i, /scaling/i, /next.steps/i, /master.bible/i,
  /phase/i, /architecture/i, /blueprint/i, /ecosystem/i, /executive/i,
  /master.summary/i, /complete.guide/i, /complete.index/i, /strategic/i,
];

// ── Task type classifier ───────────────────────────────────────────────────
// Maps extracted task titles to the closest DevOps task type.
function classifyTaskType(
  title: string,
  description: string
): RoadmapItem["type"] {
  const t = (title + " " + description).toLowerCase();

  if (/(deploy|launch|release|ship|go.?live|production)/i.test(t))
    return "deploy_feature";
  if (/(api|endpoint|route|webhook|integration|connect)/i.test(t))
    return "create_api";
  if (/(schema|migration|table|database|supabase|column|index)/i.test(t))
    return "update_schema";
  if (/(module|component|widget|ui|page|feature|build|create|implement)/i.test(t))
    return "build_module";

  return "ai_task";
}

// ── Markdown extractor ─────────────────────────────────────────────────────
// Finds lines that look like roadmap items:
//   ## Phase 1: ...
//   ### Step 3: Build X
//   - [ ] Task: Create Y
//   **Roadmap Item:** Deploy Z
//   | Task | ... |
function extractItemsFromMarkdown(
  markdown : string,
  sourceDoc: string
): RoadmapItem[] {
  const items  : RoadmapItem[] = [];
  const lines   = markdown.split("\n");
  let priority  = 1;
  let phase     = "";

  const TASK_PATTERNS = [
    /^#{1,3}\s+(?:phase|step|task|roadmap)[:\s]+(.+)/i,      // ## Phase 1: title
    /^#{2,4}\s+(\d+[\.\)]\s+.{5,})/i,                        // ## 1. Build something
    /^[-*]\s+\[[ x]\]\s+(.{5,})/i,                           // - [ ] checklist item
    /^\|\s*([A-Z][^|]{4,}?)\s*\|/,                            // | Table cell |
    /^[-*]\s+\*\*([^*]{5,})\*\*/,                             // - **Bold item**
    /^#{2,4}\s+(?:build|create|implement|deploy|integrate|add|setup|configure)\s+(.+)/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 8) continue;

    // Track current phase from h2 headings
    const phaseMatch = trimmed.match(/^##\s+(?:phase\s+)?(\w[\w\s-]*)/i);
    if (phaseMatch) {
      phase = phaseMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
    }

    for (const pattern of TASK_PATTERNS) {
      const m = trimmed.match(pattern);
      if (!m) continue;

      const raw = m[1].trim()
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .replace(/\[.*?\]/g, "")
        .trim();

      // Skip headings that are too short, navigational, or non-actionable
      if (raw.length < 8) continue;
      if (/^(overview|introduction|summary|table of contents|toc|notes?|see also)/i.test(raw)) continue;
      if (/^\d+$/.test(raw)) continue;

      const type = classifyTaskType(raw, "");

      items.push({
        title      : raw.slice(0, 120),
        description: `Extracted from ${sourceDoc} — ${phase ? "Phase: " + phase + " — " : ""}${raw}`,
        type,
        priority   : priority++,
        source_doc : sourceDoc,
        phase      : phase || undefined,
      });
      break; // only match first pattern per line
    }
  }

  return items;
}

// ── JSON extractor ─────────────────────────────────────────────────────────
function extractItemsFromJSON(
  parsed   : unknown,
  sourceDoc: string
): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  let priority = 1;

  const processObject = (obj: Record<string, unknown>) => {
    const title = (
      (obj.title as string) ||
      (obj.name  as string) ||
      (obj.task  as string) ||
      ""
    ).trim();

    if (title.length >= 8) {
      items.push({
        title      : title.slice(0, 120),
        description: (obj.description as string) || (obj.desc as string) || `From ${sourceDoc}`,
        type       : classifyTaskType(title, (obj.description as string) || ""),
        priority   : (obj.priority as number) || priority,
        source_doc : sourceDoc,
        phase      : (obj.phase as string) || (obj.phase_id as string) || undefined,
      });
      priority++;
    }

    // Recurse into arrays of tasks
    for (const key of ["tasks", "items", "phases", "steps", "roadmap"]) {
      if (Array.isArray(obj[key])) {
        for (const child of obj[key] as unknown[]) {
          if (child && typeof child === "object") {
            processObject(child as Record<string, unknown>);
          }
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
 * Lists files in the R2 cold-storage bucket across roadmap-related prefixes,
 * downloads roadmap documents, extracts structured items, and returns them
 * ready for seedTasksFromRoadmap().
 *
 * Never throws — returns { ok: false, error } on failure so callers don't crash.
 */
export async function ingestRoadmapFromR2(): Promise<IngestR2Result> {
  try {
    // Lazy-import so the module isn't bundled unless needed
    const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import("@aws-sdk/client-s3");

    const accountId       = process.env.R2_ACCOUNT_ID        ?? "";
    const accessKeyId     = process.env.R2_ACCESS_KEY_ID      ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY  ?? "";

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return {
        ok: false, items: [], filesScanned: 0, filesUsed: 0,
        error: "Missing R2 credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
      };
    }

    const s3 = new S3Client({
      region  : "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    // ── Step 1: list files across all roadmap prefixes ───────────────────
    const allKeys: string[] = [];

    for (const prefix of PREFIXES) {
      try {
        const list = await s3.send(
          new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
        );
        for (const obj of list.Contents ?? []) {
          if (obj.Key) allKeys.push(obj.Key);
        }
      } catch {
        // prefix may not exist — skip silently
      }
    }

    // ── Step 2: filter to roadmap-relevant files ─────────────────────────
    const roadmapKeys = allKeys.filter(key => {
      const filename = key.split("/").pop() ?? "";
      return (
        (filename.endsWith(".md") || filename.endsWith(".json")) &&
        ROADMAP_FILE_PATTERNS.some(p => p.test(filename))
      );
    });

    if (!roadmapKeys.length) {
      return {
        ok: false, items: [], filesScanned: allKeys.length, filesUsed: 0,
        error: `No roadmap-related files found across prefixes: ${PREFIXES.join(", ")}. Total files listed: ${allKeys.length}`,
      };
    }

    // ── Step 3: download + extract ───────────────────────────────────────
    const allItems  : RoadmapItem[] = [];
    let   filesUsed  = 0;

    for (const key of roadmapKeys.slice(0, 20)) { // cap at 20 docs per run
      try {
        const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
        const resp   = await s3.send(getCmd);

        if (!resp.Body) continue;

        // Stream body to string
        const chunks: Uint8Array[] = [];
        for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks).toString("utf-8");

        if (!content.trim()) continue;

        let extracted: RoadmapItem[] = [];

        if (key.endsWith(".json")) {
          try {
            extracted = extractItemsFromJSON(JSON.parse(content), key);
          } catch {
            // Malformed JSON — skip
          }
        } else {
          extracted = extractItemsFromMarkdown(content, key);
        }

        if (extracted.length) {
          allItems.push(...extracted);
          filesUsed++;
        }
      } catch {
        // Individual file failures don't abort the run
      }
    }

    // Deduplicate by title (case-insensitive)
    const seen  = new Set<string>();
    const deduped = allItems.filter(item => {
      const key = item.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Re-assign sequential priority after dedup
    deduped.forEach((item, i) => { item.priority = i + 1; });

    return {
      ok          : true,
      items       : deduped,
      filesScanned: allKeys.length,
      filesUsed,
    };

  } catch (err) {
    return {
      ok: false, items: [], filesScanned: 0, filesUsed: 0,
      error: String(err),
    };
  }
}
