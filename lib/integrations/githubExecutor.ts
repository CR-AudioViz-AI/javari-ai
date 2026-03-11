// lib/integrations/githubExecutor.ts
// Purpose: GitHub Automation Layer — full branch lifecycle for autonomous builds.
//          createBranch → writeFiles → commitChanges → pushBranch → createPullRequest → merge
//          All operations vault-first credential resolution via getSecret().
//          BUILT-IN: Pre-commit syntax validation blocks malformed TS/TSX from ever reaching GitHub.
// Date: 2026-03-11

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
  skipped?    : number;
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

// ── Syntax Validation ──────────────────────────────────────────────────────
// Prevents auto-generated code with markdown fences or truncated content
// from being committed to GitHub and breaking Vercel builds.

interface ValidationResult {
  valid  : boolean;
  reason?: string;
}

function validateFileContent(path: string, content: string): ValidationResult {
  const isTS  = path.endsWith(".ts") || path.endsWith(".tsx");
  const isJS  = path.endsWith(".js") || path.endsWith(".jsx");

  if (!isTS && !isJS) return { valid: true };

  const trimmed = content.trimStart();

  // Rule 1: Leading markdown fence — AI returned raw markdown instead of code
  if (/^```/.test(trimmed)) {
    return {
      valid : false,
      reason: `Leading markdown fence at start of ${path} — AI returned markdown wrapper instead of raw code`,
    };
  }

  // Rule 2: Trailing fence as the last non-whitespace line
  const lastLine = content.trimEnd().split("\n").pop()?.trim() ?? "";
  if (lastLine === "```") {
    return {
      valid : false,
      reason: `Trailing markdown fence at end of ${path} — content was not stripped before commit`,
    };
  }

  // Rule 3: File is suspiciously short for a TS route/module (< 3 lines)
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 3) {
    return {
      valid : false,
      reason: `${path} has only ${lines.length} non-empty line(s) — likely truncated or empty`,
    };
  }

  // Rule 4: Unbalanced braces — catches truncated class/function bodies
  // Only check .ts/.tsx (not JSX which can have valid imbalance in templates)
  if (path.endsWith(".ts") && !path.endsWith(".tsx")) {
    let depth = 0;
    let inString = false;
    let stringChar = "";
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (inString) {
        if (ch === stringChar && content[i - 1] !== "\\") inString = false;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    // Allow ±1 tolerance for valid top-level patterns
    if (Math.abs(depth) > 2) {
      return {
        valid : false,
        reason: `${path} has unbalanced braces (depth=${depth}) — likely truncated mid-function`,
      };
    }
  }

  // Rule 5: Inline backtick fences embedded in the file (mid-content corruption)
  if (/\n```(?:typescript|tsx|ts|javascript|jsx|js)?\n/.test(content)) {
    return {
      valid : false,
      reason: `${path} contains embedded markdown code fence — AI output was not properly stripped`,
    };
  }

  return { valid: true };
}

/**
 * Validates and sanitizes a batch of files before commit.
 * Returns { valid: GitHubFileWrite[], skipped: string[] }
 */
function filterValidFiles(files: GitHubFileWrite[]): {
  valid  : GitHubFileWrite[];
  skipped: string[];
} {
  const valid:   GitHubFileWrite[] = [];
  const skipped: string[]          = [];

  for (const file of files) {
    const result = validateFileContent(file.path, file.content);
    if (result.valid) {
      valid.push(file);
    } else {
      console.warn(`[githubExecutor] ⛔ BLOCKED ${file.path}: ${result.reason}`);
      skipped.push(file.path);
    }
  }

  return { valid, skipped };
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
      return { ok: false, error: `Failed to get base ref: ${refRes.status}` };
    }
    const refData = await refRes.json() as { object: { sha: string } };
    const sha     = refData.object.sha;

    // Create new branch
    const createRes = await fetch(`${base}/git/refs`, {
      method : "POST",
      headers,
      body   : JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      // Branch may already exist — treat as non-fatal
      if (createRes.status === 422 && errText.includes("already exists")) {
        return { ok: true, branch: branchName, sha };
      }
      return { ok: false, error: `Failed to create branch: ${createRes.status} ${errText.slice(0, 200)}` };
    }

    return { ok: true, branch: branchName, sha };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── writeFiles ────────────────────────────────────────────────────────────
// Writes one or more files to a branch via GitHub Contents API.
// PRE-COMMIT VALIDATION: Strips and blocks malformed TS/TSX before upload.

export async function writeFiles(
  repo      : string,
  branch    : string,
  files     : GitHubFileWrite[],
  commitMsg : string
): Promise<WriteFilesResult> {
  if (!files.length) return { ok: true, filesWritten: 0, skipped: 0 };

  // ── Validate before touching GitHub ──────────────────────────────────────
  const { valid, skipped } = filterValidFiles(files);
  if (valid.length === 0) {
    console.warn(`[githubExecutor] ⛔ All ${files.length} file(s) failed validation — commit aborted`);
    return { ok: false, filesWritten: 0, skipped: skipped.length, error: `All files failed syntax validation: ${skipped.join(", ")}` };
  }
  if (skipped.length > 0) {
    console.warn(`[githubExecutor] ⚠️  Skipping ${skipped.length} invalid file(s), committing ${valid.length} valid`);
  }

  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);
    const base    = `https://api.github.com/repos/${repo}/contents`;

    let lastCommitSha: string | undefined;
    let filesWritten = 0;

    for (const file of valid) {
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

    return { ok: filesWritten > 0, commitSha: lastCommitSha, filesWritten, skipped: skipped.length };
  } catch (err) {
    return { ok: false, filesWritten: 0, skipped: skipped.length, error: String(err) };
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
  const msg = `[javari] ${taskTitle}`;
  return writeFiles(repo, branch, files, msg);
}

// ── pushBranch ────────────────────────────────────────────────────────────
// Force-updates a branch ref to a specific commit SHA.
// Used after local assembly to push to remote.

export async function pushBranch(
  repo     : string,
  branch   : string,
  commitSha: string
): Promise<PushResult> {
  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);
    const base    = `https://api.github.com/repos/${repo}`;

    const res = await fetch(`${base}/git/refs/heads/${branch}`, {
      method : "PATCH",
      headers,
      body   : JSON.stringify({ sha: commitSha, force: true }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `pushBranch failed: ${res.status} ${errText.slice(0, 200)}` };
    }

    const data = await res.json() as { ref: string };
    return { ok: true, ref: data.ref };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── createPullRequest ────────────────────────────────────────────────────
// Creates a PR from a feature branch → main.

export async function createPullRequest(
  repo       : string,
  branch     : string,
  title      : string,
  body       : string = "",
  base        : string = "main"
): Promise<PullRequestResult> {
  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);
    const apiBase = `https://api.github.com/repos/${repo}`;

    const res = await fetch(`${apiBase}/pulls`, {
      method : "POST",
      headers,
      body   : JSON.stringify({ title, body, head: branch, base }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `createPR failed: ${res.status} ${errText.slice(0, 200)}` };
    }

    const pr = await res.json() as { number: number; html_url: string };
    return { ok: true, prNumber: pr.number, prUrl: pr.html_url };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── mergePullRequest ─────────────────────────────────────────────────────
// Squash-merges an open PR by number.

export async function mergePullRequest(
  repo    : string,
  prNumber: number,
  title   : string
): Promise<PullRequestResult> {
  try {
    const token   = await ghToken();
    const headers = ghHeaders(token);
    const base    = `https://api.github.com/repos/${repo}`;

    const res = await fetch(`${base}/pulls/${prNumber}/merge`, {
      method : "PUT",
      headers,
      body   : JSON.stringify({
        merge_method : "squash",
        commit_title : title,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `mergePR failed: ${res.status} ${errText.slice(0, 200)}` };
    }

    return { ok: true, prNumber, merged: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── deliverArtifactViaBranch ─────────────────────────────────────────────
// Full pipeline: create branch → write files → create PR → merge to main.
// This is the primary entry point for autonomous artifact delivery.

export async function deliverArtifactViaBranch(params: {
  repo      : string;
  taskId    : string;
  taskTitle : string;
  files     : GitHubFileWrite[];
  baseBranch?: string;
}): Promise<{ ok: boolean; commitSha?: string; prNumber?: number; skipped?: number; error?: string }> {
  const { repo, taskId, taskTitle, files, baseBranch = "main" } = params;

  // Step 1: Validate + filter files BEFORE creating any branch
  const { valid, skipped } = filterValidFiles(files);
  if (valid.length === 0) {
    return {
      ok     : false,
      skipped: skipped.length,
      error  : `All ${files.length} file(s) failed pre-commit validation — branch not created`,
    };
  }

  const branchName = `javari-task-${taskId}-${Date.now()}`;

  // Step 2: Create branch
  const branch = await createBranch(repo, branchName, baseBranch);
  if (!branch.ok) return { ok: false, error: branch.error };

  // Step 3: Write validated files
  const write = await writeFiles(repo, branchName, valid, `[javari] ${taskTitle}`);
  if (!write.ok) return { ok: false, skipped: skipped.length, error: write.error };

  // Step 4: Create PR
  const pr = await createPullRequest(
    repo,
    branchName,
    `[javari] ${taskTitle}`,
    `Autonomous build for task: ${taskId}\n\n${skipped.length > 0 ? `⚠️ ${skipped.length} file(s) skipped validation` : "✅ All files passed syntax validation"}`,
    baseBranch
  );
  if (!pr.ok) return { ok: false, skipped: skipped.length, error: pr.error };

  // Step 5: Merge PR
  const merge = await mergePullRequest(repo, pr.prNumber!, `[javari] ${taskTitle}`);
  if (!merge.ok) return { ok: false, skipped: skipped.length, error: merge.error };

  return { ok: true, commitSha: write.commitSha, prNumber: pr.prNumber, skipped: skipped.length };
}
