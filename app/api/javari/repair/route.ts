// app/api/javari/repair/route.ts
// Purpose: Autonomous Repair Engine endpoint — accepts CodeIssue[] and runs the
//          full repair pipeline: Plan → Patch → PR/Commit → Verify → Artifacts.
//          Also supports task-based invocation (pass taskId to pull issues from
//          intelligence findings stored in roadmap_tasks description).
// Date: 2026-03-07
//
// POST /api/javari/repair
// Body: {
//   "issues"     : CodeIssue[],          // from /api/javari/analyze output
//   "taskId"     : "intel-security-...", // roadmap task ID (used for artifacts)
//   "repo"       : "owner/repo",         // default: CR-AudioViz-AI/javari-ai
//   "branch"     : "main",
//   "maxRepairs" : 3,                    // default 3 — cap per call
//   "userId"     : "system"
// }

import { NextRequest, NextResponse } from "next/server";
import { runRepairEngine, RepairInput } from "@/lib/repair/index";
import type { CodeIssue } from "@/lib/intelligence/codeAnalyzer";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 300;

interface RepairBody {
  issues?     : CodeIssue[];
  taskId?     : string;
  repo?       : string;
  branch?     : string;
  maxRepairs? : number;
  userId?     : string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RepairBody;
  try { body = await req.json() as RepairBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const issues = body.issues ?? [];
  if (!Array.isArray(issues) || issues.length === 0) {
    return NextResponse.json({ ok: false, error: "issues[] is required and must be non-empty" }, { status: 400 });
  }

  const input: RepairInput = {
    issues,
    taskId     : body.taskId     ?? `repair-direct-${Date.now()}`,
    repo       : body.repo       ?? "CR-AudioViz-AI/javari-ai",
    branch     : body.branch     ?? "main",
    maxRepairs : body.maxRepairs ?? 3,
    userId     : body.userId     ?? "system",
  };

  console.log(`[/api/javari/repair] ▶ ${issues.length} issues | taskId=${input.taskId} | repo=${input.repo}`);

  try {
    const result = await runRepairEngine(input);
    return NextResponse.json({
      ok              : result.ok,
      taskId          : result.taskId,
      repairsAttempted: result.repairsAttempted,
      repairsSucceeded: result.repairsSucceeded,
      prsCreated      : result.prsCreated,
      directCommits   : result.directCommits,
      artifactIds     : result.artifactIds,
      durationMs      : result.durationMs,
      results         : result.results,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok     : true,
    name   : "Javari Autonomous Repair Engine",
    version: "1.0.0",
    usage  : {
      method: "POST",
      body  : {
        issues    : "CodeIssue[] from /api/javari/analyze (required)",
        taskId    : "string — roadmap task ID for artifact tracking",
        repo      : '"CR-AudioViz-AI/javari-ai" (default)',
        branch    : '"main" (default)',
        maxRepairs: "3 (default) — limit repairs per call",
        userId    : '"system" (default)',
      },
      pipeline: [
        "1. repairPlanner   — classify issue → strategy → RepairPlan",
        "2. patchGenerator  — fetch file from GitHub → apply fix",
        "3. pullRequestCreator — commit direct (safe) or create PR (risky)",
        "4. verificationRunner — heuristic checks + lint + build status",
        "5. artifactRecorder — repair_patch + repair_commit + verification_report",
      ],
      strategies: [
        "replace_pattern", "insert_guard", "refactor_query",
        "remove_dead_code", "add_timeout", "add_test_file",
        "parameterize_sql", "ai_rewrite", "add_comment_only",
      ],
    },
  });
}
