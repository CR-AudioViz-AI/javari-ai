// lib/execution/devopsExecutor.ts
// Purpose: DevOps execution layer — GitHub commits, Vercel deploy/verify, Supabase SQL.
//          All credentials resolved vault-first via getSecret(), falling back to process.env.
// Date: 2026-03-07 — updated: vault-first credential resolution, verifyDeployment() added

import { getSecret } from "@/lib/platform-secrets/getSecret";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CommitResult {
  ok       : boolean;
  sha?     : string;
  path?    : string;
  repo?    : string;
  message? : string;
  error?   : string;
}

export interface DeployResult {
  ok           : boolean;
  deploymentId?: string;
  url?         : string;
  state?       : string;
  error?       : string;
}

export interface VerifyResult {
  ok        : boolean;
  url       : string;
  httpStatus: number;
  healthy   : boolean;
  latencyMs : number;
  error?    : string;
}

export interface SQLResult {
  ok      : boolean;
  rows?   : unknown[];
  count?  : number;
  error?  : string;
}

// ── Vault-first credential resolver ───────────────────────────────────────

async function resolveCredential(vaultName: string, envFallback: string): Promise<string> {
  try {
    const val = await getSecret(vaultName);
    if (val && val.length > 4) return val;
  } catch { /* vault miss — fall through */ }
  return process.env[envFallback] ?? "";
}

async function githubToken(): Promise<string> {
  const t = await resolveCredential("GITHUB_TOKEN", "GITHUB_TOKEN")
         || await resolveCredential("GH_PAT", "GH_PAT");
  if (!t) throw new Error("[devops] GITHUB_TOKEN / GH_PAT not found in vault or env");
  return t;
}

async function vercelToken(): Promise<string> {
  const t = await resolveCredential("VERCEL_TOKEN", "VERCEL_TOKEN");
  if (!t) throw new Error("[devops] VERCEL_TOKEN not found in vault or env");
  return t;
}

function vercelTeamId(): string {
  return process.env.VERCEL_TEAM_ID ?? "team_Z0yef7NlFu1coCJWz8UmUdI5";
}

function supabaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!u) throw new Error("[devops] NEXT_PUBLIC_SUPABASE_URL not set");
  return u;
}

function supabaseServiceKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!k) throw new Error("[devops] SUPABASE_SERVICE_ROLE_KEY not set");
  return k;
}

// ── commitFileChange ────────────────────────────────────────────────────────

export async function commitFileChange(
  repo   : string,
  path   : string,
  content: string,
  message: string
): Promise<CommitResult> {
  try {
    const token   = await githubToken();
    const encoded = Buffer.from(content, "utf-8").toString("base64");
    const base    = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "javari-devops/1.0",
    };

    let existingSha: string | undefined;
    const getRes = await fetch(`${base}?ref=main`, { headers });
    if (getRes.ok) {
      const getJson = await getRes.json() as { sha: string };
      existingSha = getJson.sha;
    }

    const body: Record<string, unknown> = { message, content: encoded, branch: "main" };
    if (existingSha) body.sha = existingSha;

    const putRes = await fetch(base, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!putRes.ok) {
      const errText = await putRes.text();
      return { ok: false, repo, path, error: `GitHub API ${putRes.status}: ${errText.slice(0, 200)}` };
    }

    const putJson = await putRes.json() as { commit: { sha: string } };
    return { ok: true, sha: putJson.commit.sha, path, repo, message };
  } catch (err) {
    return { ok: false, repo, path, error: String(err) };
  }
}

// ── triggerVercelDeploy ─────────────────────────────────────────────────────

export async function triggerVercelDeploy(projectIdOrSlug: string): Promise<DeployResult> {
  try {
    const token  = await vercelToken();
    const teamId = vercelTeamId();

    const res = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${teamId}`,
      {
        method : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name     : projectIdOrSlug,
          target   : "preview",
          gitSource: { type: "github", ref: "main", repoId: "1083842623" },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Vercel API ${res.status}: ${errText.slice(0, 300)}` };
    }

    const d = await res.json() as { id: string; url: string; readyState: string };
    return {
      ok          : true,
      deploymentId: d.id,
      url         : `https://${d.url}`,
      state       : d.readyState ?? "BUILDING",
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── verifyDeployment ────────────────────────────────────────────────────────
// Health-check an existing deployment URL without triggering a new deploy.
// Used by deploy_feature handler when task is about verifying existing infra.

export async function verifyDeployment(url: string): Promise<VerifyResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method : "HEAD",
      headers: { "User-Agent": "javari-devops/1.0" },
      signal : AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    const latencyMs = Date.now() - t0;
    const healthy   = res.status < 500;
    return { ok: true, url, httpStatus: res.status, healthy, latencyMs };
  } catch (err) {
    return { ok: false, url, httpStatus: 0, healthy: false, latencyMs: Date.now() - t0, error: String(err) };
  }
}

// ── runSupabaseSQL ──────────────────────────────────────────────────────────

export async function runSupabaseSQL(query: string): Promise<SQLResult> {
  try {
    const upper = query.trim().toUpperCase();
    const BLOCKED = ["DROP TABLE", "TRUNCATE", "DELETE FROM", "DROP DATABASE"];
    for (const stmt of BLOCKED) {
      if (upper.includes(stmt)) {
        return { ok: false, error: `Blocked: "${stmt}" not permitted via runSupabaseSQL` };
      }
    }

    const url = supabaseUrl();
    const key  = supabaseServiceKey();

    // Attempt 1: exec_sql RPC
    const rpcRes = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method : "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json", Prefer: "return=representation",
      },
      body: JSON.stringify({ sql: query }),
      signal: AbortSignal.timeout(15_000),
    });

    if (rpcRes.ok) {
      const rows = await rpcRes.json().catch(() => []);
      return { ok: true, rows: Array.isArray(rows) ? rows : [rows], count: Array.isArray(rows) ? rows.length : 1 };
    }

    // Attempt 2: query RPC
    const queryRes = await fetch(`${url}/rest/v1/rpc/query`, {
      method : "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15_000),
    });

    if (queryRes.ok) {
      const rows = await queryRes.json().catch(() => []);
      return { ok: true, rows: Array.isArray(rows) ? rows : [rows], count: Array.isArray(rows) ? rows.length : 1 };
    }

    const errText = await rpcRes.text().catch(() => "");
    return { ok: false, error: `Supabase SQL failed (${rpcRes.status}): ${errText.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
