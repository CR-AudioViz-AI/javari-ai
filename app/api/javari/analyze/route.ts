// app/api/javari/analyze/route.ts
// Purpose: Code Intelligence endpoint — analyzes a GitHub repo for security,
//          performance, dead code, and test coverage gaps.
//          Injects repair tasks into roadmap_tasks automatically.
// Date: 2026-03-07
//
// POST /api/javari/analyze
// Body: {
//   "repo"        : "owner/repo",    // required
//   "branch"      : "main",          // optional
//   "maxFiles"    : 150,             // optional
//   "fileFilter"  : "lib/",          // optional — analyze subset
//   "injectTasks" : true,            // optional — default true
//   "userId"      : "system"         // optional
// }

import { NextRequest, NextResponse }   from "next/server";
import { analyzeRepo, AnalyzeInput }   from "@/lib/intelligence/codeAnalyzer";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AnalyzeInput & { repo: string };
  try { body = await req.json() as AnalyzeInput & { repo: string }; }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  if (!body.repo) {
    return NextResponse.json({ ok: false, error: "repo is required (e.g. 'owner/repo')" }, { status: 400 });
  }

  console.log(`[/api/javari/analyze] ▶ ${body.repo} branch=${body.branch ?? "main"} maxFiles=${body.maxFiles ?? 150}`);

  try {
    const report = await analyzeRepo({
      repo        : body.repo,
      branch      : body.branch,
      maxFiles    : body.maxFiles,
      fileFilter  : body.fileFilter,
      injectTasks : body.injectTasks,
      userId      : body.userId,
    });

    return NextResponse.json({
      ok         : true,
      repo       : report.repo,
      analyzedAt : report.analyzedAt,
      analysisMs : report.analysisMs,

      // Canonical issue report
      issues : report.issues,
      summary: report.summary,

      // Call graph metrics
      callGraph: {
        totalFunctions: report.callGraph.functions.length,
        totalCallSites: report.callGraph.callSites.length,
        uncalledExports: report.callGraph.uncalled.length,
        hotspots : report.callGraph.hotspots.slice(0, 10),
        uncalled : report.callGraph.uncalled.slice(0, 10),
      },

      // Task injection result
      tasksCreated: report.tasksCreated,
      taskIds     : report.taskIds,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false, error: String(err),
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok     : true,
    name   : "Javari Code Intelligence Engine",
    version: "1.0.0",
    usage  : {
      method : "POST",
      body   : {
        repo        : '"owner/repo" (required)',
        branch      : '"main" (optional)',
        maxFiles    : "150 (optional)",
        fileFilter  : '"lib/" — analyze a subset (optional)',
        injectTasks : "true (optional)",
        userId      : '"system" (optional)',
      },
      example: {
        analyze_javari: { repo: "CR-AudioViz-AI/javari-ai", branch: "main", maxFiles: 100 },
        analyze_subset: { repo: "CR-AudioViz-AI/javari-ai", fileFilter: "lib/", maxFiles: 50 },
      },
    },
  });
}
