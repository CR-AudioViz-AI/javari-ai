// lib/discovery/repoScanner.ts
// Purpose: Repo scanner — fetches complete file tree from a GitHub repo or
//          local filesystem (via Node fs). Returns path list + key file contents.
// Date: 2026-03-07

import { getSecret } from "@/lib/platform-secrets/getSecret";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScanTarget {
  type      : "local" | "github";
  repo?     : string;   // "owner/repo" for GitHub
  branch?   : string;   // default "main"
  localRoot?: string;   // absolute path for local scan
}

export interface ScanResult {
  target    : ScanTarget;
  filePaths : string[];
  keyFiles  : Record<string, string>;  // path → content (for package.json, etc.)
  fileCount : number;
  scanMs    : number;
  error?    : string;
}

// Key files to fetch full content for (stack detection uses these)
const KEY_FILE_PATTERNS = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "requirements.txt",
  "Pipfile",
  "pyproject.toml",
  "go.mod",
  "pom.xml",
  "Cargo.toml",
  "composer.json",
  "Gemfile",
  "vercel.json",
  "next.config.js",
  "next.config.ts",
  "next.config.mjs",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".env.example",
  "tsconfig.json",
];

// Directories to skip (reduce noise)
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", "dist", "build",
  "out", "coverage", ".nyc_output", "__pycache__", ".pytest_cache",
  "vendor", "target", ".cargo", ".mvn", "venv", ".venv", "env",
  ".cache", ".turbo", ".swc",
]);

// ── GitHub scanner ─────────────────────────────────────────────────────────

async function scanGitHub(target: ScanTarget): Promise<ScanResult> {
  const t0     = Date.now();
  const repo   = target.repo ?? "";
  const branch = target.branch ?? "main";

  if (!repo) return { target, filePaths: [], keyFiles: {}, fileCount: 0, scanMs: 0, error: "repo required for github scan" };

  // Resolve GitHub token
  let token = "";
  try { token = await getSecret("GITHUB_TOKEN"); } catch {}
  if (!token) token = process.env.GITHUB_TOKEN ?? process.env.GH_PAT ?? "";

  const headers: Record<string, string> = {
    Accept       : "application/vnd.github.v3+json",
    "User-Agent" : "javari-discovery/1.0",
  };
  if (token) headers.Authorization = `token ${token}`;

  // Fetch complete recursive tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );

  if (!treeRes.ok) {
    return { target, filePaths: [], keyFiles: {}, fileCount: 0, scanMs: Date.now() - t0,
             error: `GitHub tree API ${treeRes.status}: ${repo}` };
  }

  const treeData = await treeRes.json() as { tree: Array<{ path: string; type: string }> };
  const allFiles = (treeData.tree ?? [])
    .filter(f => f.type === "blob")
    .map(f => f.path)
    .filter(p => !SKIP_DIRS.has(p.split("/")[0]));

  // Fetch content of key files in parallel (max 8 concurrent)
  const keyFilePaths = allFiles.filter(p =>
    KEY_FILE_PATTERNS.some(kf => p.endsWith(kf) || p === kf)
  ).slice(0, 20); // cap at 20 to avoid rate limits

  const keyFiles: Record<string, string> = {};
  const chunks = [];
  for (let i = 0; i < keyFilePaths.length; i += 8) chunks.push(keyFilePaths.slice(i, i + 8));

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (path) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
          { headers }
        );
        if (res.ok) {
          const d = await res.json() as { content?: string };
          if (d.content) {
            keyFiles[path] = Buffer.from(d.content.replace(/\n/g, ""), "base64").toString("utf-8");
          }
        }
      } catch { /* best-effort */ }
    }));
  }

  return {
    target,
    filePaths: allFiles,
    keyFiles,
    fileCount: allFiles.length,
    scanMs   : Date.now() - t0,
  };
}

// ── Local filesystem scanner ───────────────────────────────────────────────

async function scanLocal(target: ScanTarget): Promise<ScanResult> {
  const t0   = Date.now();
  const root = target.localRoot ?? process.cwd();

  // Dynamic import of fs/path — safe in Node.js serverless
  const { promises: fs } = await import("fs");
  const path             = await import("path");

  const filePaths: string[] = [];
  const keyFiles: Record<string, string> = {};

  async function walk(dir: string): Promise<void> {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const full    = path.join(dir, entry.name);
      const relative = path.relative(root, full).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full);
      } else if (entry.isFile()) {
        filePaths.push(relative);

        if (KEY_FILE_PATTERNS.some(kf => relative.endsWith(kf) || relative === kf)) {
          try {
            const content = await fs.readFile(full, "utf-8");
            keyFiles[relative] = content;
          } catch { /* skip unreadable */ }
        }
      }
    }
  }

  await walk(root);

  return {
    target,
    filePaths,
    keyFiles,
    fileCount: filePaths.length,
    scanMs   : Date.now() - t0,
  };
}

// ── URL scanner (public website / SaaS — header sniffing) ─────────────────

async function scanURL(url: string): Promise<ScanResult> {
  const t0     = Date.now();
  const target: ScanTarget = { type: "github" }; // treated as external probe
  const keyFiles: Record<string, string> = {};
  const filePaths: string[] = [];

  // Common files to probe on the URL
  const probes = [
    "/package.json", "/robots.txt", "/sitemap.xml",
    "/api/health", "/health", "/.well-known/security.txt",
    "/openapi.json", "/swagger.json", "/api-docs",
  ];

  await Promise.all(probes.map(async (probe) => {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}${probe}`, {
        method: "GET",
        headers: { "User-Agent": "javari-discovery/1.0" },
        signal: AbortSignal.timeout(5_000),
        redirect: "follow",
      });
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("json") || ct.includes("text")) {
          const text = await res.text();
          keyFiles[probe] = text.slice(0, 10_000);
          filePaths.push(probe);
        }
      }
    } catch { /* probe failed — normal */ }
  }));

  return {
    target: { type: "local", localRoot: url },
    filePaths,
    keyFiles,
    fileCount: filePaths.length,
    scanMs   : Date.now() - t0,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function scanRepo(target: ScanTarget): Promise<ScanResult> {
  switch (target.type) {
    case "github": return scanGitHub(target);
    case "local":  return scanLocal(target);
    default:       return scanLocal(target);
  }
}

export async function scanURL_target(url: string): Promise<ScanResult> {
  return scanURL(url);
}
