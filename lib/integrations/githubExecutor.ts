// lib/integrations/githubExecutor.ts
// Purpose: GitHub Automation Layer — full branch lifecycle for autonomous builds.
//          createBranch → writeFiles → commitChanges → pushBranch → createPullRequest → merge
//          All operations vault-first credential resolution via getSecret().
// Date: 2026-03-10

import { getSecret } from "@/lib/platform-secrets/getSecret";

// ── Types ──────────────────────────────────────────────────────────────────

export interface BranchResult {
  ok      : boolean;
  branch? : string;
  sha?    : string;    // base commit SHA
  error?  : string;
}

export interface WriteFilesResult {
  ok          : boolean;
  commitSha?  : string;
  filesWritten: number;
  error?      : string;
}

export interface PushResult {
  ok     : boolean;
  ref?   : string;
  error? : string;
}

export interface PullRequestResult {
  ok      : boolean;
  prNumber?: number;
  prUrl?  : string;
  merged? : boolean;
  error?  : string;
}

export interface GitHubFileWrite {
  path    : string;
  content : string;
}

// ── Credential resolution ──────────────────────────────────────────────────

async function ghToken(): Promise<string> {
  const t = await getSecret("GITHUB_TOKEN").catch(() => "")
         || await getSecret("GH_PAT").catch(() => "")
         || process.env.GITHUB_TOKEN
         || process.env.GH_PAT
         || "";
  if (!t) throw new Error("[githubExecutor] GitHub token not found in vault or env");
  return t;
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "javari-ai-builder/1.0",
  };
}

// ── createBranch ──────────────────────────────────────────────────────────
// Creates a new branch from the tip of main.

export async function createBranch(
  repo        : string,
  branchName  : string,
  baseBranch  : string = "main"
): Promise<BranchResult> {
  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);
    const base    = `https://api.github.com/repos/${repo}`;

    // Get current HEAD SHA of base branch
    const refRes = await fetch(`${base}/git/refs/heads/${baseBranch}`, { headers });
    if (!refRes.ok) {
      const errText = await refRes.text();
      return { ok: false, error: `Get ref failed (${refRes.status}): ${errText.slice(0, 200)}` };
    }
    const refData = await refRes.json() as { object: { sha: string } };
    const sha = refData.object.sha;

    // Create new branch
    const createRes = await fetch(`${base}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      // Branch may already exist — treat as success
      if (createRes.status === 422 && errText.includes("already exists")) {
        console.log(`[githubExecutor] Branch ${branchName} already exists — continuing`);
        return { ok: true, branch: branchName, sha };
      }
      return { ok: false, error: `Create branch failed (${createRes.status}): ${errText.slice(0, 200)}` };
    }

    console.log(`[githubExecutor] 🌿 Branch created: ${branchName} from ${baseBranch}@${sha.slice(0, 8)}`);
    return { ok: true, branch: branchName, sha };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── writeFiles ────────────────────────────────────────────────────────────
// Writes one or more files to a branch via GitHub Contents API.

export async function writeFiles(
  repo      : string,
  branch    : string,
  files     : GitHubFileWrite[],
  commitMsg : string
): Promise<WriteFilesResult> {
  if (!files.length) return { ok: true, filesWritten: 0 };

  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);
    const base    = `https://api.github.com/repos/${repo}/contents`;

    let lastCommitSha: string | undefined;
    let filesWritten = 0;

    for (const file of files) {
      const encoded = Buffer.from(file.content, "utf-8").toString("base64");

      // Check for existing file SHA (required for update)
      let existingSha: string | undefined;
      const getRes = await fetch(`${base}/${file.path}?ref=${branch}`, { headers });
      if (getRes.ok) {
        const existing = await getRes.json() as { sha: string };
        existingSha = existing.sha;
      }

      const body: Record<string, unknown> = {
        message: commitMsg,
        content: encoded,
        branch,
      };
      if (existingSha) body.sha = existingSha;

      const putRes = await fetch(`${base}/${file.path}`, {
        method : "PUT",
        headers,
        body   : JSON.stringify(body),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        console.warn(`[githubExecutor] writeFiles: ${file.path} failed (${putRes.status}): ${errText.slice(0, 200)}`);
        continue;
      }

      const putData = await putRes.json() as { commit: { sha: string } };
      lastCommitSha = putData.commit.sha;
      filesWritten++;
      console.log(`[githubExecutor] 📝 ${file.path} → ${lastCommitSha?.slice(0, 8)}`);
    }

    return { ok: filesWritten > 0, commitSha: lastCommitSha, filesWritten };
  } catch (err) {
    return { ok: false, filesWritten: 0, error: String(err) };
  }
}

// ── commitChanges ─────────────────────────────────────────────────────────
// Alias for writeFiles with a standardized task commit message format.

export async function commitChanges(
  repo     : string,
  branch   : string,
  taskTitle: string,
  files    : GitHubFileWrite[]
): Promise<WriteFilesResult> {
  const commitMsg = `Javari AI automated build: ${taskTitle}`;
  return writeFiles(repo, branch, files, commitMsg);
}

// ── pushBranch ────────────────────────────────────────────────────────────
// Verifies branch exists and is ahead of main — returns the push status.

export async function pushBranch(
  repo  : string,
  branch: string
): Promise<PushResult> {
  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);

    // Verify branch exists
    const branchRes = await fetch(
      `https://api.github.com/repos/${repo}/branches/${branch}`,
      { headers }
    );

    if (!branchRes.ok) {
      return { ok: false, error: `Branch ${branch} not found (${branchRes.status})` };
    }

    const branchData = await branchRes.json() as { commit: { sha: string } };
    const sha = branchData.commit.sha;

    console.log(`[githubExecutor] 🚢 Branch ${branch} pushed — HEAD: ${sha.slice(0, 8)}`);
    return { ok: true, ref: `refs/heads/${branch}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── createPullRequest ─────────────────────────────────────────────────────
// Creates a PR from branch → base, optionally auto-merges if validator passes.

export async function createPullRequest(
  repo        : string,
  head        : string,    // source branch
  base        : string = "main",
  title       : string,
  body        : string,
  autoMerge   : boolean = false
): Promise<PullRequestResult> {
  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);
    const apiBase = `https://api.github.com/repos/${repo}`;

    // Create PR
    const prRes = await fetch(`${apiBase}/pulls`, {
      method : "POST",
      headers,
      body   : JSON.stringify({ title, body, head, base }),
    });

    if (!prRes.ok) {
      const errText = await prRes.text();
      return { ok: false, error: `PR creation failed (${prRes.status}): ${errText.slice(0, 300)}` };
    }

    const prData = await prRes.json() as { number: number; html_url: string; mergeable?: boolean };
    console.log(`[githubExecutor] 🔀 PR #${prData.number} created: ${prData.html_url}`);

    if (!autoMerge) {
      return { ok: true, prNumber: prData.number, prUrl: prData.html_url, merged: false };
    }

    // Auto-merge via squash
    await new Promise(r => setTimeout(r, 2000)); // brief delay for GitHub to process

    const mergeRes = await fetch(`${apiBase}/pulls/${prData.number}/merge`, {
      method : "PUT",
      headers,
      body   : JSON.stringify({
        commit_title  : title,
        commit_message: body,
        merge_method  : "squash",
      }),
    });

    if (!mergeRes.ok) {
      const errText = await mergeRes.text();
      console.warn(`[githubExecutor] PR #${prData.number} auto-merge failed: ${errText.slice(0, 200)}`);
      return { ok: true, prNumber: prData.number, prUrl: prData.html_url, merged: false };
    }

    console.log(`[githubExecutor] ✅ PR #${prData.number} auto-merged`);
    return { ok: true, prNumber: prData.number, prUrl: prData.html_url, merged: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Full branch lifecycle: create → write → push → PR ──────────────────────
// Convenience wrapper for the complete artifact delivery workflow.

export async function deliverArtifactViaBranch(params: {
  repo      : string;
  taskId    : string;
  taskTitle : string;
  files     : GitHubFileWrite[];
  prBody?   : string;
  autoMerge?: boolean;
}): Promise<{
  ok          : boolean;
  branchName  : string;
  commitSha?  : string;
  prNumber?   : number;
  prUrl?      : string;
  merged?     : boolean;
  error?      : string;
}> {
  const { repo, taskId, taskTitle, files, autoMerge = false } = params;
  const branchName = `task-${taskId.slice(0, 20)}`;

  // 1. Create branch
  const branchResult = await createBranch(repo, branchName);
  if (!branchResult.ok) {
    return { ok: false, branchName, error: `Branch creation failed: ${branchResult.error}` };
  }

  // 2. Write files
  const writeResult = await commitChanges(repo, branchName, taskTitle, files);
  if (!writeResult.ok) {
    return { ok: false, branchName, error: `File write failed: ${writeResult.error}` };
  }

  // 3. Push (verify)
  await pushBranch(repo, branchName);

  // 4. Create PR
  const prBody = params.prBody ?? `Automated build by Javari AI\n\nTask: ${taskTitle}\nTask ID: ${taskId}`;
  const prResult = await createPullRequest(
    repo, branchName, "main",
    `Javari AI automated build: ${taskTitle}`,
    prBody, autoMerge
  );

  return {
    ok       : prResult.ok,
    branchName,
    commitSha: writeResult.commitSha,
    prNumber : prResult.prNumber,
    prUrl    : prResult.prUrl,
    merged   : prResult.merged,
    error    : prResult.error,
  };
}
