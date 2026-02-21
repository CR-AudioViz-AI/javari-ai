// lib/autonomy-core/crawler/crawl.ts
// CR AudioViz AI — Core Crawler
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// Crawls CRAudioVizAI core via GitHub API (no local filesystem access needed in
// Vercel edge/serverless). Produces a CrawlSnapshot used by the diff engine.
//
// SCOPE: core_only — app/, lib/, components/, supabase/migrations/, middleware.ts, next.config.js
// NEVER crawls: client project repos, partner repos, external services

import type {
  CrawlSnapshot, RouteInventory, ApiInventory,
  ComponentInventory, LibInventory, DbInventory, RepoInventory,
} from "./types";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("autonomy");

// ── GitHub API helper ─────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? "";
const REPO         = process.env.AUTONOMOUS_CORE_REPO ?? "CR-AudioViz-AI/javari-ai";

interface GhItem { name: string; type: "file" | "dir"; path: string; size?: number; }

async function ghList(path: string): Promise<GhItem[]> {
  if (!GITHUB_TOKEN) return [];
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as GhItem[];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function ghRead(path: string): Promise<string> {
  if (!GITHUB_TOKEN) return "";
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return "";
    const data = await res.json() as { content?: string; encoding?: string };
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    }
    return "";
  } catch { return ""; }
}

// ── Analysis helpers ──────────────────────────────────────────────────────────

function detectMethods(content: string): string[] {
  const methods: string[] = [];
  if (/export\s+(async\s+)?function\s+GET|export\s+const\s+GET/.test(content))    methods.push("GET");
  if (/export\s+(async\s+)?function\s+POST|export\s+const\s+POST/.test(content))   methods.push("POST");
  if (/export\s+(async\s+)?function\s+PUT|export\s+const\s+PUT/.test(content))     methods.push("PUT");
  if (/export\s+(async\s+)?function\s+PATCH|export\s+const\s+PATCH/.test(content)) methods.push("PATCH");
  if (/export\s+(async\s+)?function\s+DELETE|export\s+const\s+DELETE/.test(content)) methods.push("DELETE");
  return methods.length ? methods : ["GET"];
}

function detectRuntime(content: string): "nodejs" | "edge" | "unknown" {
  if (/export\s+const\s+runtime\s*=\s*["']edge["']/.test(content))   return "edge";
  if (/export\s+const\s+runtime\s*=\s*["']nodejs["']/.test(content)) return "nodejs";
  return "unknown";
}

function detectExports(content: string): string[] {
  const matches = content.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g);
  return [...matches].map((m) => m[1]);
}

function hasA11y(content: string): boolean {
  return /aria-|role=|tabIndex/.test(content);
}

function extractTables(sql: string): string[] {
  const matches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
  return [...matches].map((m) => m[1]);
}

function extractPolicies(sql: string): string[] {
  const matches = sql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"/gi);
  return [...matches].map((m) => m[1]);
}

// ── Crawl functions ───────────────────────────────────────────────────────────

async function crawlApiRoutes(baseDir = "app/api"): Promise<ApiInventory[]> {
  const routes: ApiInventory[] = [];
  const now = new Date().toISOString();

  async function recurse(dir: string, routePrefix: string): Promise<void> {
    const items = await ghList(dir);
    await Promise.all(items.map(async (item) => {
      if (item.type === "dir") {
        await recurse(item.path, `${routePrefix}/${item.name}`);
      } else if (item.name === "route.ts" || item.name === "route.tsx") {
        const content = await ghRead(item.path);
        const methods = detectMethods(content);
        const exports = detectExports(content);
        routes.push({
          path:     item.path,
          route:    routePrefix,
          methods,
          exports,
          hasAuth:      /getServerSession|supabase\.auth|ApiError\.unauthorized|authorization/.test(content),
          hasRateLimit: /rlCheck|checkRateLimit|applyRateLimit|RateLimit/.test(content),
          sizeBytes: item.size ?? content.length,
          lastSeen:  now,
        });
      }
    }));
  }

  await recurse(baseDir, "/api");
  return routes;
}

async function crawlPageRoutes(): Promise<RouteInventory[]> {
  const routes: RouteInventory[] = [];
  const now = new Date().toISOString();

  async function recurse(dir: string, routePrefix: string): Promise<void> {
    const items = await ghList(dir);
    await Promise.all(items.map(async (item) => {
      if (item.type === "dir" && item.name !== "api" && item.name !== "(admin)") {
        await recurse(item.path, `${routePrefix}/${item.name}`);
      } else if (item.name === "page.tsx" || item.name === "page.ts") {
        const content = await ghRead(item.path);
        routes.push({
          path:     item.path,
          route:    routePrefix || "/",
          methods:  ["GET"],
          runtime:  detectRuntime(content),
          sizeBytes: item.size ?? content.length,
          lastSeen:  now,
        });
      }
    }));
  }

  await recurse("app", "");
  return routes;
}

async function crawlComponents(): Promise<ComponentInventory[]> {
  const comps: ComponentInventory[] = [];
  const now = new Date().toISOString();

  const items = await ghList("components");
  await Promise.all(items.map(async (item) => {
    if (item.type === "file" && (item.name.endsWith(".tsx") || item.name.endsWith(".ts"))) {
      const content = await ghRead(item.path);
      const importMatches = content.matchAll(/from\s+["']([^"']+)["']/g);
      comps.push({
        path:     item.path,
        name:     item.name.replace(/\.(tsx?|jsx?)$/, ""),
        isClient: /^["']use client["']/m.test(content),
        imports:  [...importMatches].map((m) => m[1]),
        hasA11y:  hasA11y(content),
        sizeBytes: item.size ?? content.length,
        lastSeen:  now,
      });
    }
  }));
  return comps;
}

async function crawlLibs(): Promise<LibInventory[]> {
  const libs: LibInventory[] = [];
  const now = new Date().toISOString();

  // Only crawl STEP-built lib subdirs to avoid noise from legacy files
  const coreDirs = [
    "lib/javari/engine", "lib/javari/multi-ai", "lib/javari/revenue",
    "lib/javari/autonomy", "lib/javari/factory", "lib/javari/store",
    "lib/javari/memory", "lib/observability", "lib/errors", "lib/analytics",
    "lib/canary", "lib/launch", "lib/enterprise", "lib/security",
    "lib/perf", "lib/release", "lib/alerts", "lib/domain", "lib/beta",
    "lib/autonomy-core",
  ];

  await Promise.all(coreDirs.map(async (dir) => {
    const items = await ghList(dir);
    await Promise.all(items.map(async (item) => {
      if (item.type === "file" && item.name.endsWith(".ts")) {
        const content = await ghRead(item.path);
        libs.push({
          path:    item.path,
          module:  item.path.replace(/\.ts$/, ""),
          exports: detectExports(content),
          sizeBytes: item.size ?? content.length,
          lastSeen:  now,
        });
      }
    }));
  }));
  return libs;
}

async function crawlMigrations(): Promise<DbInventory[]> {
  const dbs: DbInventory[] = [];
  const now = new Date().toISOString();

  const items = await ghList("supabase/migrations");
  await Promise.all(items.map(async (item) => {
    if (item.type === "file" && item.name.endsWith(".sql")) {
      const content = await ghRead(item.path);
      dbs.push({
        migrationFile: item.name,
        tables:    extractTables(content),
        policies:  extractPolicies(content),
        hasTrigger: /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER/.test(content),
        sizeBytes:  item.size ?? content.length,
        lastSeen:   now,
      });
    }
  }));
  return dbs;
}

async function crawlRepo(): Promise<RepoInventory> {
  const now = new Date().toISOString();
  const items = await ghList("");
  return {
    rootFiles: items.filter((i) => i.type === "file").map((i) => i.name),
    dirs:      items.filter((i) => i.type === "dir").map((i) => i.name),
    totalFiles: items.length,
    lastSeen:  now,
  };
}

// ── Main crawl entry point ────────────────────────────────────────────────────

export async function crawlCore(): Promise<CrawlSnapshot> {
  const id    = `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const start = Date.now();

  log.info("Starting core crawl", { meta: { snapshotId: id, repo: REPO } });

  const [apiRoutes, routes, components, libs, migrations, repo] = await Promise.all([
    crawlApiRoutes().catch((e) => { log.warn(`API crawl failed: ${e instanceof Error ? e.message : e}`); return []; }),
    crawlPageRoutes().catch(() => []),
    crawlComponents().catch(() => []),
    crawlLibs().catch(() => []),
    crawlMigrations().catch(() => []),
    crawlRepo().catch(() => ({ rootFiles: [], dirs: [], totalFiles: 0, lastSeen: new Date().toISOString() })),
  ]);

  const durationMs = Date.now() - start;
  log.info(`Crawl complete in ${durationMs}ms`, {
    meta: { apiRoutes: apiRoutes.length, routes: routes.length, components: components.length, libs: libs.length }
  });

  return { id, takenAt: new Date().toISOString(), routes, apiRoutes, components, libs, migrations, repo, durationMs, ring: 2, scope: "core_only" };
}
