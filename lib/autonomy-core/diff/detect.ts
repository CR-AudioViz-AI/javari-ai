// lib/autonomy-core/diff/detect.ts
// CR AudioViz AI — Anomaly Detector (Diff Engine)
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// Analyses a CrawlSnapshot and emits typed Anomaly[] with fixable flags.
// Ring 2 fixable = safe, deterministic, no logic change — only boilerplate adds.
// Ring 3 = structural changes (never auto-applied in STEP 11).

import type { CrawlSnapshot, Anomaly, AnomalyType, FixType } from "../crawler/types";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("autonomy");

// ── Danger patterns — secrets etc — only flag, never auto-fix ────────────────

const SECRET_PATTERNS = [
  /(['"])sk-[A-Za-z0-9]{20,}['"]/, // OpenAI key
  /(['"])AKIA[A-Z0-9]{16}['"]/,    // AWS key
  /(['"])ghp_[A-Za-z0-9]{36}['"]/,  // GitHub token
  /(['"])Bearer [A-Za-z0-9+/]{40,}['"]/,
];

function hasSecretPattern(content: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(content));
}

// ── Anomaly ID generator ──────────────────────────────────────────────────────

function anomalyId(): string {
  return `anom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Per-file checks ───────────────────────────────────────────────────────────

function checkApiRoute(
  path:    string,
  content: string,
  snapshotId: string
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date().toISOString();

  // No runtime declaration on API routes
  if (!/export\s+const\s+runtime/.test(content)) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "no_runtime_declaration",
      severity: "warn", filePath: path,
      message: "API route missing `export const runtime` declaration",
      detail:  "Add `export const runtime = 'nodejs'` to ensure correct execution environment",
      fixable: true, fixType: "add_runtime_declaration", detectedAt: now,
    });
  }

  // No `export const dynamic` on routes that use cookies/headers
  if (/cookies\(\)|headers\(\)/.test(content) && !/export\s+const\s+dynamic/.test(content)) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "missing_dynamic_export",
      severity: "warn", filePath: path,
      message: "Route uses dynamic APIs but lacks `export const dynamic = 'force-dynamic'`",
      fixable: true, fixType: "add_dynamic_export", detectedAt: now,
    });
  }

  // console.log in production API route
  if (/console\.log\(/.test(content) && !/\/\/ DEBUG/.test(content)) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "console_log_in_prod",
      severity: "info", filePath: path,
      message: "console.log() found in API route — use structured logger instead",
      fixable: true, fixType: "remove_console_log", detectedAt: now,
    });
  }

  // Hardcoded secret pattern
  if (hasSecretPattern(content)) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "hardcoded_secret_pattern",
      severity: "critical", filePath: path,
      message: "Possible hardcoded API key or secret detected — must be moved to env vars",
      fixable: false, detectedAt: now,
    });
  }

  // Unhandled promise — await inside non-try-catch
  if (/await fetch\(/.test(content) && !/try\s*{/.test(content)) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "unhandled_promise",
      severity: "warn", filePath: path,
      message: "fetch() call without try/catch — unhandled rejections will crash route",
      detail:  "Wrap in try/catch or use safeHandler()",
      fixable: false, detectedAt: now,   // structural change — Ring 3
    });
  }

  // Large file
  const lines = content.split("\n").length;
  if (lines > 500) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "large_file",
      severity: "info", filePath: path,
      message: `File is ${lines} lines — consider splitting into smaller modules`,
      fixable: false, detectedAt: now,
    });
  }

  return anomalies;
}

function checkComponent(
  path:    string,
  content: string,
  snapshotId: string
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date().toISOString();

  // Client component without any aria attributes in interactive elements
  const hasInteractive = /<button|<input|<select|<textarea/.test(content);
  if (hasInteractive && !hasSecretPattern(content) && !/aria-|role=/.test(content)) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "missing_a11y",
      severity: "warn", filePath: path,
      message: "Interactive elements found without ARIA attributes",
      detail:  "Add aria-label, aria-describedby or role to improve WCAG 2.2 AA compliance",
      fixable: false, detectedAt: now,
    });
  }

  // console.log in component
  if (/console\.log\(/.test(content)) {
    anomalies.push({
      id: anomalyId(), snapshotId, type: "console_log_in_prod",
      severity: "info", filePath: path,
      message: "console.log() in component — remove before production",
      fixable: true, fixType: "remove_console_log", detectedAt: now,
    });
  }

  return anomalies;
}

function checkMigration(
  file:    string,
  content: string,
  snapshotId: string
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date().toISOString();

  // CREATE TABLE without RLS enabled
  const tables = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)].map((m) => m[1]);
  for (const table of tables) {
    const rlsPattern = new RegExp(`ALTER TABLE ${table}\\s+ENABLE ROW LEVEL SECURITY`, "i");
    if (!rlsPattern.test(content)) {
      anomalies.push({
        id: anomalyId(), snapshotId, type: "missing_migration_rls",
        severity: "warn", filePath: `supabase/migrations/${file}`,
        message: `Table "${table}" created without RLS enabled`,
        detail:  "Run: ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;",
        fixable: false, detectedAt: now,
      });
    }
  }

  return anomalies;
}

// ── Main detector ─────────────────────────────────────────────────────────────

export async function detectAnomalies(snapshot: CrawlSnapshot): Promise<Anomaly[]> {
  const all: Anomaly[] = [];
  const contentCache = new Map<string, string>();

  log.info(`Detecting anomalies in snapshot ${snapshot.id}`, {
    meta: { routes: snapshot.apiRoutes.length, components: snapshot.components.length }
  });

  // Fetch full file content for API routes
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? "";
  const REPO = process.env.AUTONOMOUS_CORE_REPO ?? "CR-AudioViz-AI/javari-ai";

  async function getContent(path: string): Promise<string> {
    if (contentCache.has(path)) return contentCache.get(path)!;
    if (!GITHUB_TOKEN) return "";
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}` }, signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json() as { content?: string; encoding?: string };
      const content = data.encoding === "base64" && data.content
        ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8")
        : "";
      contentCache.set(path, content);
      return content;
    } catch { return ""; }
  }

  // Check API routes (batched, max 20 concurrent)
  const apiChunks = chunk(snapshot.apiRoutes, 20);
  for (const chunk_ of apiChunks) {
    await Promise.all(chunk_.map(async (route) => {
      const content = await getContent(route.path);
      if (content) all.push(...checkApiRoute(route.path, content, snapshot.id));
    }));
  }

  // Check components (batched)
  const compChunks = chunk(snapshot.components, 15);
  for (const chunk_ of compChunks) {
    await Promise.all(chunk_.map(async (comp) => {
      const content = await getContent(comp.path);
      if (content) all.push(...checkComponent(comp.path, content, snapshot.id));
    }));
  }

  // Check migrations
  for (const mig of snapshot.migrations) {
    const content = await getContent(`supabase/migrations/${mig.migrationFile}`);
    if (content) all.push(...checkMigration(mig.migrationFile, content, snapshot.id));
  }

  log.info(`Detected ${all.length} anomalies`, {
    meta: {
      critical: all.filter((a) => a.severity === "critical").length,
      fixable:  all.filter((a) => a.fixable).length,
    }
  });

  return all;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
