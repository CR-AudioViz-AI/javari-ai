// lib/tools/vercel.ts
// Purpose: Vercel Infrastructure Tool — deployment management with guardrails
// Date: 2026-03-07

import { ToolCallResult, ToolRequest, RollbackRecord, ToolCapability } from "./types";

const VERCEL_API  = "https://api.vercel.com";
const TEAM_ID     = process.env.VERCEL_TEAM_ID    ?? "team_Z0yef7NlFu1coCJWz8UmUdI5";
const PROJECT_ID  = process.env.VERCEL_PROJECT_ID ?? "prj_zxjzE2qvMWFWqV0AspGvago6aPV5";

function getToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not configured");
  return token;
}

function vercelHeaders(): Record<string, string> {
  return {
    "Authorization": `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

async function vercelFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${VERCEL_API}${path}${sep}teamId=${TEAM_ID}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: vercelHeaders(),
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Capabilities ──────────────────────────────────────────────────────────
export const VERCEL_CAPABILITIES: ToolCapability[] = [
  {
    tool: "vercel", action: "list_deployments",
    description: "List recent deployments for the javari-ai project",
    riskLevel: "read",
    params: {
      limit:     { type: "number", required: false, description: "Max deployments (default: 5)" },
      projectId: { type: "string", required: false, description: "Project ID (default: javari-ai)" },
    },
  },
  {
    tool: "vercel", action: "get_deployment",
    description: "Get details of a specific deployment",
    riskLevel: "read",
    params: {
      deploymentId: { type: "string", required: true, description: "Deployment UID (dpl_...)" },
    },
  },
  {
    tool: "vercel", action: "get_project",
    description: "Get project configuration and settings",
    riskLevel: "read",
    params: {
      projectId: { type: "string", required: false, description: "Project ID (default: javari-ai)" },
    },
  },
];

// ─── Implementations ───────────────────────────────────────────────────────

async function listDeployments(params: { limit?: number; projectId?: string }): Promise<ToolCallResult> {
  const start = Date.now();
  const limit = params.limit ?? 5;
  const projectId = params.projectId ?? PROJECT_ID;

  const data = await vercelFetch<{
    deployments: Array<{
      uid: string; url: string; state: string; created: number;
      meta?: { githubCommitSha?: string; githubCommitMessage?: string };
    }>;
  }>(`/v6/deployments?projectId=${projectId}&limit=${limit}`);

  return {
    ok: true, tool: "vercel", action: "list_deployments",
    data: (data.deployments ?? []).map(d => ({
      uid: d.uid,
      url: d.url,
      state: d.state,
      created: new Date(d.created).toISOString(),
      commit: d.meta?.githubCommitSha?.slice(0, 8) ?? "unknown",
      message: d.meta?.githubCommitMessage?.slice(0, 60) ?? "",
    })),
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function getDeployment(params: { deploymentId: string }): Promise<ToolCallResult> {
  const start = Date.now();
  const data = await vercelFetch<{
    uid: string; url: string; state: string; created: number; ready?: number;
    meta?: { githubCommitSha?: string };
  }>(`/v13/deployments/${params.deploymentId}`);

  return {
    ok: true, tool: "vercel", action: "get_deployment",
    data: {
      uid: data.uid, url: data.url, state: data.state,
      created: new Date(data.created).toISOString(),
      ready: data.ready ? new Date(data.ready).toISOString() : null,
      commit: data.meta?.githubCommitSha?.slice(0, 8) ?? "unknown",
    },
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function getProject(params: { projectId?: string }): Promise<ToolCallResult> {
  const start = Date.now();
  const projectId = params.projectId ?? PROJECT_ID;

  const data = await vercelFetch<{
    id: string; name: string; framework: string; productionBranch?: string;
    link?: { type: string; repo?: string };
  }>(`/v9/projects/${projectId}`);

  return {
    ok: true, tool: "vercel", action: "get_project",
    data: {
      id: data.id, name: data.name, framework: data.framework,
      productionBranch: data.productionBranch ?? "main",
      gitRepo: data.link?.repo ?? "unknown",
    },
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

// ─── Main execute ──────────────────────────────────────────────────────────
export async function executeVercel(
  req: ToolRequest,
  _rollbacks: Map<string, RollbackRecord>
): Promise<ToolCallResult> {
  switch (req.action) {
    case "list_deployments": return listDeployments(req.params as { limit?: number; projectId?: string });
    case "get_deployment":   return getDeployment(req.params as { deploymentId: string });
    case "get_project":      return getProject(req.params as { projectId?: string });
    default:
      return { ok: false, tool: "vercel", action: req.action, error: `Unknown action: ${req.action}`, latencyMs: 0, riskLevel: "read" };
  }
}
