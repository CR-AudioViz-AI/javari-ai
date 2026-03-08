// app/api/javari/discover/route.ts
// Purpose: Universal System Discovery endpoint — crawls any software platform
//          and returns a complete architecture report with auto-generated tasks.
// Date: 2026-03-07
//
// POST /api/javari/discover
// Body: {
//   "target"      : "local" | "repo" | "url",
//   "repo"        : "owner/repo",          // for target=repo
//   "url"         : "https://example.com", // for target=url
//   "branch"      : "main",                // optional, default main
//   "injectTasks" : true,                  // optional, default true
//   "userId"      : "system"               // optional
// }

import { NextRequest, NextResponse } from "next/server";
import { crawlSystem, CrawlerInput }  from "@/lib/discovery/systemCrawler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — GitHub crawls can be slow

interface DiscoverBody {
  target      : "local" | "repo" | "url";
  repo?       : string;
  url?        : string;
  branch?     : string;
  injectTasks?: boolean;
  userId?     : string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: DiscoverBody;
  try {
    body = await req.json() as DiscoverBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { target, repo, url, branch, injectTasks = true, userId = "system" } = body;

  if (!target || !["local", "repo", "url"].includes(target)) {
    return NextResponse.json({
      ok   : false,
      error: 'target must be "local", "repo", or "url"',
    }, { status: 400 });
  }

  if (target === "repo" && !repo) {
    return NextResponse.json({
      ok: false, error: 'repo is required when target="repo" (e.g. "owner/repo")',
    }, { status: 400 });
  }

  if (target === "url" && !url) {
    return NextResponse.json({
      ok: false, error: 'url is required when target="url"',
    }, { status: 400 });
  }

  console.log(`[/api/javari/discover] ▶ target=${target} repo=${repo ?? url ?? "local"} userId=${userId}`);

  const input: CrawlerInput = { target, repo, url, branch, injectTasks, userId };
  const result = await crawlSystem(input);

  if (!result.ok) {
    return NextResponse.json({
      ok   : false,
      error: result.error ?? "Discovery failed",
      durationMs: result.durationMs,
    }, { status: 500 });
  }

  const report = result.report!;

  return NextResponse.json({
    ok          : true,
    target      : body.target,
    scannedAt   : report.scannedAt,
    durationMs  : result.durationMs,

    // Canonical architecture report
    architecture: {
      frameworks  : report.frameworks,
      languages   : report.languages,
      databases   : report.databases,
      services    : report.services,
      deployments : report.deployments,
      dependencies: report.dependencies.slice(0, 100), // cap for response size
    },

    // Extended analysis
    infra        : report.infra,
    runtimes     : report.runtimes,
    fileCount    : report.fileCount,
    apiRouteCount: report.apiRoutes.length,

    // Risk + security
    securityFindings : report.securityFindings,
    riskSummary      : report.riskSummary,

    // Auto-generated roadmap tasks
    tasksCreated    : result.tasksCreated,
    taskIds         : result.taskIds,
    suggestedTasks  : report.suggestedTasks,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok     : true,
    name   : "Javari Universal System Discovery Engine",
    version: "1.0.0",
    usage  : {
      method : "POST",
      body   : {
        target      : '"local" | "repo" | "url"',
        repo        : '"owner/repo" (for target=repo)',
        url         : '"https://..." (for target=url)',
        branch      : '"main" (optional)',
        injectTasks : "boolean (default: true)",
        userId      : '"system" (optional)',
      },
      example: {
        scan_this_repo: { target: "repo", repo: "CR-AudioViz-AI/javari-ai", branch: "main" },
        scan_local    : { target: "local" },
        scan_url      : { target: "url", url: "https://craudiovizai.com" },
      },
    },
  });
}
