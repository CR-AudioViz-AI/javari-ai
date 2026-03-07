// lib/tools/github.ts
// Purpose: GitHub Infrastructure Tool — authenticated API execution with
//          guardrail integration, execution logging, and rollback support
// Date: 2026-03-07

import { ToolCallResult, ToolRequest, RollbackRecord, ToolCapability, RiskLevel } from "./types";

const GITHUB_API = "https://api.github.com";
const DEFAULT_OWNER = "CR-AudioViz-AI";
const DEFAULT_REPO  = "javari-ai";

function getToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_PAT;
  if (!token) throw new Error("GITHUB_TOKEN / GH_PAT not configured");
  return token;
}

function githubHeaders(): Record<string, string> {
  return {
    "Authorization": `token ${getToken()}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
}

async function githubFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: opts.method ?? "GET",
    headers: githubHeaders(),
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Capabilities manifest ─────────────────────────────────────────────────
export const GITHUB_CAPABILITIES: ToolCapability[] = [
  {
    tool: "github",
    action: "list_branches",
    description: "List all branches in a repository",
    riskLevel: "read",
    params: {
      owner: { type: "string", required: false, description: "GitHub org/user (default: CR-AudioViz-AI)" },
      repo:  { type: "string", required: false, description: "Repository name (default: javari-ai)" },
    },
  },
  {
    tool: "github",
    action: "get_branch",
    description: "Get details about a specific branch",
    riskLevel: "read",
    params: {
      branch: { type: "string", required: true,  description: "Branch name" },
      owner:  { type: "string", required: false, description: "GitHub org/user" },
      repo:   { type: "string", required: false, description: "Repository name" },
    },
  },
  {
    tool: "github",
    action: "list_commits",
    description: "List recent commits on a branch",
    riskLevel: "read",
    params: {
      branch: { type: "string", required: false, description: "Branch name (default: main)" },
      limit:  { type: "number", required: false, description: "Max commits to return (default: 10)" },
      owner:  { type: "string", required: false, description: "GitHub org/user" },
      repo:   { type: "string", required: false, description: "Repository name" },
    },
  },
  {
    tool: "github",
    action: "get_file",
    description: "Read a file from a repository",
    riskLevel: "read",
    params: {
      path:   { type: "string", required: true,  description: "File path in repo" },
      branch: { type: "string", required: false, description: "Branch name (default: main)" },
      owner:  { type: "string", required: false, description: "GitHub org/user" },
      repo:   { type: "string", required: false, description: "Repository name" },
    },
  },
  {
    tool: "github",
    action: "commit_file",
    description: "Write or update a file via direct commit (main branch only for Javari automation)",
    riskLevel: "write",
    params: {
      path:    { type: "string", required: true,  description: "File path in repo" },
      content: { type: "string", required: true,  description: "File content (UTF-8)" },
      message: { type: "string", required: true,  description: "Commit message" },
      branch:  { type: "string", required: false, description: "Target branch (default: main)" },
      owner:   { type: "string", required: false, description: "GitHub org/user" },
      repo:    { type: "string", required: false, description: "Repository name" },
    },
  },
];

// ─── Action implementations ────────────────────────────────────────────────

async function listBranches(params: {
  owner?: string; repo?: string;
}): Promise<ToolCallResult> {
  const start = Date.now();
  const owner = params.owner ?? DEFAULT_OWNER;
  const repo  = params.repo  ?? DEFAULT_REPO;

  const data = await githubFetch<Array<{ name: string; commit: { sha: string } }>>(
    `/repos/${owner}/${repo}/branches?per_page=50`
  );

  return {
    ok: true, tool: "github", action: "list_branches",
    data: data.map(b => ({ name: b.name, sha: b.commit.sha.slice(0, 8) })),
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function getBranch(params: {
  branch: string; owner?: string; repo?: string;
}): Promise<ToolCallResult> {
  const start = Date.now();
  const owner = params.owner ?? DEFAULT_OWNER;
  const repo  = params.repo  ?? DEFAULT_REPO;

  const data = await githubFetch<{ name: string; commit: { sha: string; commit: { message: string } } }>(
    `/repos/${owner}/${repo}/branches/${params.branch}`
  );

  return {
    ok: true, tool: "github", action: "get_branch",
    data: { name: data.name, sha: data.commit.sha.slice(0, 8), lastCommit: data.commit.commit.message.slice(0, 80) },
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function listCommits(params: {
  branch?: string; limit?: number; owner?: string; repo?: string;
}): Promise<ToolCallResult> {
  const start = Date.now();
  const owner  = params.owner  ?? DEFAULT_OWNER;
  const repo   = params.repo   ?? DEFAULT_REPO;
  const branch = params.branch ?? "main";
  const limit  = params.limit  ?? 10;

  const data = await githubFetch<Array<{
    sha: string; commit: { message: string; author: { date: string } };
  }>>(`/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`);

  return {
    ok: true, tool: "github", action: "list_commits",
    data: data.map(c => ({
      sha: c.sha.slice(0, 8),
      message: c.commit.message.split("\n")[0].slice(0, 80),
      date: c.commit.author.date,
    })),
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function getFile(params: {
  path: string; branch?: string; owner?: string; repo?: string;
}): Promise<ToolCallResult> {
  const start = Date.now();
  const owner  = params.owner  ?? DEFAULT_OWNER;
  const repo   = params.repo   ?? DEFAULT_REPO;
  const branch = params.branch ?? "main";

  const data = await githubFetch<{ content: string; sha: string; size: number }>(
    `/repos/${owner}/${repo}/contents/${params.path}?ref=${branch}`
  );

  const content = Buffer.from(data.content, "base64").toString("utf-8");

  return {
    ok: true, tool: "github", action: "get_file",
    data: { path: params.path, sha: data.sha.slice(0, 8), size: data.size, content },
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function commitFile(params: {
  path: string; content: string; message: string;
  branch?: string; owner?: string; repo?: string;
}, rollbacks: Map<string, RollbackRecord>): Promise<ToolCallResult> {
  const start = Date.now();
  const owner  = params.owner  ?? DEFAULT_OWNER;
  const repo   = params.repo   ?? DEFAULT_REPO;
  const branch = params.branch ?? "main";

  // Get current file SHA for rollback (if file exists)
  let existingSha: string | null = null;
  let existingContent: string | null = null;
  try {
    const existing = await githubFetch<{ sha: string; content: string }>(
      `/repos/${owner}/${repo}/contents/${params.path}?ref=${branch}`
    );
    existingSha = existing.sha;
    existingContent = Buffer.from(existing.content, "base64").toString("utf-8");
  } catch {
    // File doesn't exist yet — rollback will delete it
  }

  const body: Record<string, unknown> = {
    message: params.message,
    content: Buffer.from(params.content).toString("base64"),
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const result = await githubFetch<{ commit: { sha: string } }>(
    `/repos/${owner}/${repo}/contents/${params.path}`,
    { method: "PUT", body }
  );

  // Store rollback record
  const rollbackId = `rb-gh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const rollbackRecord: RollbackRecord = {
    id: rollbackId,
    tool: "github",
    action: "commit_file",
    reversalPayload: existingContent !== null
      ? { path: params.path, content: existingContent, message: `Rollback: ${params.message}`, branch, owner, repo, sha: result.commit.sha }
      : { path: params.path, delete: true, branch, owner, repo, sha: result.commit.sha },
    createdAt: new Date().toISOString(),
    ttlMs: 3600_000, // 1 hour rollback window
    used: false,
  };
  rollbacks.set(rollbackId, rollbackRecord);

  return {
    ok: true, tool: "github", action: "commit_file",
    data: { path: params.path, sha: result.commit.sha.slice(0, 8), branch },
    latencyMs: Date.now() - start, riskLevel: "write",
    rollbackId,
  };
}

// ─── Main execute function ─────────────────────────────────────────────────
export async function executeGitHub(
  req: ToolRequest,
  rollbacks: Map<string, RollbackRecord>
): Promise<ToolCallResult> {
  switch (req.action) {
    case "list_branches": return listBranches(req.params as { owner?: string; repo?: string });
    case "get_branch":    return getBranch(req.params as { branch: string; owner?: string; repo?: string });
    case "list_commits":  return listCommits(req.params as { branch?: string; limit?: number; owner?: string; repo?: string });
    case "get_file":      return getFile(req.params as { path: string; branch?: string; owner?: string; repo?: string });
    case "commit_file":   return commitFile(req.params as { path: string; content: string; message: string; branch?: string; owner?: string; repo?: string }, rollbacks);
    default:
      return { ok: false, tool: "github", action: req.action, error: `Unknown action: ${req.action}`, latencyMs: 0, riskLevel: "read" };
  }
}
