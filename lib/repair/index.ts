// lib/repair/index.ts
// Purpose: Repair engine public API — runs the full repair pipeline for one or
//          more CodeIssues: Plan → Patch → PR/Commit → Verify → Artifacts.
//          Called directly by the repair_code executor in taskExecutor.ts.
// Date: 2026-03-07

import { planRepairs, prioritizePlans }  from "./repairPlanner";
import { generatePatch }                 from "./patchGenerator";
import { createRepairPR }                from "./pullRequestCreator";
import { runVerification }               from "./verificationRunner";
import { recordArtifact }                from "@/lib/roadmap/artifactRecorder";
import type { CodeIssue }                from "@/lib/intelligence/codeAnalyzer";

export type { RepairPlan }               from "./repairPlanner";
export type { PatchResult }              from "./patchGenerator";
export type { PRResult }                 from "./pullRequestCreator";
export type { VerificationReport }       from "./verificationRunner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RepairInput {
  issues      : CodeIssue[];
  taskId      : string;
  repo        : string;       // "owner/repo"
  branch?     : string;       // default "main"
  userId?     : string;
  maxRepairs? : number;       // default 5 — cap per run
}

export interface RepairResult {
  ok           : boolean;
  taskId       : string;
  repairsAttempted: number;
  repairsSucceeded: number;
  prsCreated   : number;
  directCommits: number;
  artifactIds  : string[];
  results      : Array<{
    issueId        : string;
    file           : string;
    strategy       : string;
    patchOk        : boolean;
    prMode         : string;
    prUrl?         : string;
    commitSha?     : string;
    verificationOk : boolean;
    error?         : string;
  }>;
  durationMs   : number;
}

// ── Repair artifact recorder ───────────────────────────────────────────────

async function recordRepairArtifacts(
  taskId    : string,
  patchSha  : string | undefined,
  prUrl     : string | undefined,
  summary   : string
): Promise<string[]> {
  const artifactIds: string[] = [];

  // repair_patch artifact
  try {
    const ar = await recordArtifact({
      task_id          : taskId,
      artifact_type    : "repair_patch" as "commit",
      artifact_location: patchSha ?? `patch:${taskId}:${Date.now()}`,
      artifact_data    : { summary, patchSha },
    });
    if (ar.id) artifactIds.push(ar.id);
  } catch { /* best-effort */ }

  // repair_commit artifact
  if (patchSha) {
    try {
      const ar = await recordArtifact({
        task_id          : taskId,
        artifact_type    : "repair_commit" as "commit",
        artifact_location: patchSha,
        artifact_data    : { commitSha: patchSha, prUrl },
      });
      if (ar.id) artifactIds.push(ar.id);
    } catch { /* best-effort */ }
  }

  return artifactIds;
}

// ── Main repair runner ─────────────────────────────────────────────────────

export async function runRepairEngine(input: RepairInput): Promise<RepairResult> {
  const t0     = Date.now();
  const branch = input.branch ?? "main";
  const max    = input.maxRepairs ?? 5;
  const userId = input.userId ?? "system";

  console.log(`[repairEngine] ▶ ${input.issues.length} issues, taskId=${input.taskId}, repo=${input.repo}`);

  // Phase 1: Plan
  const plans     = prioritizePlans(planRepairs(input.issues, input.taskId));
  const toProcess = plans.slice(0, max);

  const results: RepairResult["results"] = [];
  const allArtifactIds: string[] = [];
  let prsCreated    = 0;
  let directCommits = 0;
  let succeeded     = 0;

  // Phase 2: Process each plan sequentially (avoid race conditions on same file)
  for (const plan of toProcess) {
    let issueResult: RepairResult["results"][number] = {
      issueId       : plan.issueId,
      file          : plan.targetFile,
      strategy      : plan.strategy,
      patchOk       : false,
      prMode        : "skipped",
      verificationOk: false,
    };

    try {
      // Phase 2a: Generate patch
      const patch = await generatePatch(plan, input.repo, branch, userId);
      issueResult.patchOk = patch.ok;
      if (!patch.ok) {
        issueResult.error = patch.error;
        results.push(issueResult);
        continue;
      }

      // Phase 2b: Create PR or direct commit
      const prResult = await createRepairPR(patch, input.repo, branch);
      issueResult.prMode    = prResult.mode;
      issueResult.prUrl     = prResult.prUrl;
      issueResult.commitSha = prResult.commitSha;

      if (prResult.mode === "pull_request") prsCreated++;
      if (prResult.mode === "direct_commit") directCommits++;

      // Phase 2c: Record repair artifacts
      const ids = await recordRepairArtifacts(
        input.taskId, prResult.commitSha, prResult.prUrl,
        patch.patchSummary
      );
      allArtifactIds.push(...ids);

      // Phase 2d: Run verification
      const verification = await runVerification(input.taskId, patch, prResult);
      issueResult.verificationOk = verification.ok;
      if (verification.artifactId) allArtifactIds.push(verification.artifactId);

      if (prResult.ok && (prResult.mode === "direct_commit" || prResult.mode === "pull_request")) {
        succeeded++;
      }

    } catch (err) {
      issueResult.error = String(err);
    }

    results.push(issueResult);
  }

  console.log(`[repairEngine] ✅ ${succeeded}/${toProcess.length} repairs | ${prsCreated} PRs | ${directCommits} direct commits`);

  return {
    ok              : succeeded > 0,
    taskId          : input.taskId,
    repairsAttempted: toProcess.length,
    repairsSucceeded: succeeded,
    prsCreated,
    directCommits,
    artifactIds     : allArtifactIds,
    results,
    durationMs      : Date.now() - t0,
  };
}
