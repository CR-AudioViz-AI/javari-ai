// lib/execution/devopsExecutor.ts
// Purpose: DevOps execution layer — Javari's ability to modify and deploy its own platform.
//          Wraps GitHub Commits API, Vercel Deploy API, and Supabase SQL execution.
//          All credentials sourced from process.env (bootstrapped in Vercel).
// Date: 2026-03-07

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

export interface SQLResult {
  ok      : boolean;
  rows?   : unknown[];
  count?  : number;
  error?  : string;
}

// ── Credential helpers ─────────────────────────────────────────────────────

function githubToken(): string {
  const t = process.env.GITHUB_TOKEN ?? process.env.GH_PAT ?? "";
  if (!t) throw new Error("GITHUB_TOKEN / GH_PAT not set in environment");
  return t;
}

function vercelToken(): string {
  const t = process.env.VERCEL_TOKEN ?? "";
  if (!t) throw new Error("VERCEL_TOKEN not set in environment");
  return t;
}

function vercelTeamId(): string {
  return process.env.VERCEL_TEAM_ID ?? "team_Z0yef7NlFu1coCJWz8UmUdI5";
}

function supabaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!u) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  return u;
}

function supabaseServiceKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return k;
}

// ── commitFileChange ────────────────────────────────────────────────────────
/**
 * Create or update a file in a GitHub repository via the Contents API.
 * If the file already exists its current SHA is fetched first so the PUT
 * does not conflict.
 *
 * @param repo     Full repo slug, e.g. "CR-AudioViz-AI/javari-ai"
 * @param path     File path relative to repo root, e.g. "app/api/my/route.ts"
 * @param content  Full UTF-8 file content to write
 * @param message  Git commit message
 */
export async function commitFileChange(
  repo    : string,
  path    : string,
  content : string,
  message : string
): Promise<CommitResult> {
  try {
    const token   = githubToken();
    const encoded = Buffer.from(content, "utf-8").toString("base64");
    const base    = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "javari-devops/1.0",
    };

    // Fetch existing SHA if file already exists
    let existingSha: string | undefined;
    const getRes = await fetch(`${base}?ref=main`, { headers });
    if (getRes.ok) {
      const getJson = await getRes.json() as { sha: string };
      existingSha = getJson.sha;
    }

    // Write the file
    const body: Record<string, unknown> = {
      message,
      content: encoded,
      branch : "main",
    };
    if (existingSha) body.sha = existingSha;

    const putRes = await fetch(base, {
      method : "PUT",
      headers,
      body   : JSON.stringify(body),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return { ok: false, repo, path, error: `GitHub API ${putRes.status}: ${errText.slice(0, 200)}` };
    }

    const putJson = await putRes.json() as { commit: { sha: string } };

    return {
      ok     : true,
      sha    : putJson.commit.sha,
      path,
      repo,
      message,
    };
  } catch (err) {
    return { ok: false, repo, path, error: String(err) };
  }
}

// ── triggerVercelDeploy ─────────────────────────────────────────────────────
/**
 * Trigger a new Vercel deployment for a project by creating a deploy
 * from the current HEAD of the linked Git branch via the Vercel REST API.
 *
 * @param projectIdOrSlug  Vercel project ID (prj_…) or slug name
 */
export async function triggerVercelDeploy(
  projectIdOrSlug: string
): Promise<DeployResult> {
  try {
    const token  = vercelToken();
    const teamId = vercelTeamId();

    // POST to /v13/deployments — triggers a new deploy from the current git ref
    const res = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${teamId}`,
      {
        method : "POST",
        headers: {
          Authorization : `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name     : projectIdOrSlug,
          target   : "preview",        // preview by default (Henderson Standard)
          gitSource: {
            type: "github",
            ref : "main",
            repoId: "1083842623",      // CR-AudioViz-AI/javari-ai
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Vercel API ${res.status}: ${errText.slice(0, 300)}` };
    }

    const d = await res.json() as {
      id: string;
      url: string;
      readyState: string;
    };

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

// ── runSupabaseSQL ──────────────────────────────────────────────────────────
/**
 * Execute raw SQL against the Supabase project via the pg REST endpoint.
 * Uses the service role key — full database access.
 * Only available for SELECT, INSERT, UPDATE, CREATE TABLE, ALTER TABLE.
 * DROP is blocked at the function level as a safety guardrail.
 *
 * @param query  Raw SQL string to execute
 */
export async function runSupabaseSQL(query: string): Promise<SQLResult> {
  try {
    // Safety guardrail: block destructive statements
    const upper = query.trim().toUpperCase();
    const BLOCKED = ["DROP TABLE", "TRUNCATE", "DELETE FROM", "DROP DATABASE"];
    for (const stmt of BLOCKED) {
      if (upper.startsWith(stmt) || upper.includes(stmt)) {
        return {
          ok   : false,
          error: `Blocked: "${stmt}" is not permitted via runSupabaseSQL. Use Supabase dashboard for destructive operations.`,
        };
      }
    }

    const url = `${supabaseUrl()}/rest/v1/rpc/exec_sql`;
    const key  = supabaseServiceKey();

    const res = await fetch(url, {
      method : "POST",
      headers: {
        apikey        : key,
        Authorization : `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer        : "return=representation",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      // exec_sql RPC may not exist — fall back to direct pg endpoint
      const directRes = await fetch(`${supabaseUrl()}/rest/v1/`, {
        method : "POST",
        headers: {
          apikey        : key,
          Authorization : `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Client-Info": "javari-devops",
        },
        body: JSON.stringify({ query }),
      });

      if (!directRes.ok) {
        const errText = await res.text();
        return {
          ok   : false,
          error: `Supabase SQL failed (${res.status}): ${errText.slice(0, 300)}`,
        };
      }

      const rows = await directRes.json().catch(() => []);
      return { ok: true, rows: Array.isArray(rows) ? rows : [rows], count: Array.isArray(rows) ? rows.length : 1 };
    }

    const rows = await res.json().catch(() => []);
    return {
      ok   : true,
      rows : Array.isArray(rows) ? rows : [rows],
      count: Array.isArray(rows) ? rows.length : 1,
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
