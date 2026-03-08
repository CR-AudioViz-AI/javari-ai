// app/api/javari/ecosystem/analyze/route.ts
// Purpose: Ecosystem Governance Layer API endpoint — runs full ecosystem analysis
//          including architecture registry, brand consistency, deduplication,
//          and UX flow analysis. Generates roadmap tasks for all findings.
// Date: 2026-03-07
//
// POST /api/javari/ecosystem/analyze
// { "target": "craudiovizai", "seedTasks": true, "skipDedup": false }
//
// GET  /api/javari/ecosystem/analyze → usage info

import { NextRequest, NextResponse }   from "next/server";
import { runEcosystemAnalysis }        from "@/lib/ecosystem/ecosystemOrchestrator";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

interface AnalyzeBody {
  target?    : string;
  repos?     : string[];
  urls?      : string[];
  seedTasks? : boolean;
  skipBrand? : boolean;
  skipDedup? : boolean;
  skipUx?    : boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AnalyzeBody;
  try { body = await req.json() as AnalyzeBody; }
  catch { body = {}; }

  const {
    target     = "craudiovizai",
    repos,
    urls,
    seedTasks  = true,
    skipBrand  = false,
    skipDedup  = false,
    skipUx     = false,
  } = body;

  console.log(`[ecosystem/analyze] ▶ target=${target} seed=${seedTasks}`);

  try {
    const result = await runEcosystemAnalysis({
      target, repos, urls, seedTasks,
      skipBrand, skipDedup, skipUx,
    });

    return NextResponse.json({ ok: true, ...result });

  } catch (err) {
    console.error(`[ecosystem/analyze] Error: ${err}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok     : true,
    name   : "Javari Ecosystem Governance Layer",
    version: "1.0.0",
    engines: [
      "architectureRegistry  — canonical system map + dependency graph",
      "brandConsistencyEngine — brand/language violations across all repos",
      "deduplicationEngine   — cross-repo duplicate code detection",
      "uxFlowAnalyzer        — user journey simulation + broken flow detection",
    ],
    usage: {
      method: "POST",
      body  : {
        target    : '"craudiovizai" | "javari" (default: "craudiovizai")',
        repos     : "string[] (override repo list)",
        urls      : "string[] (override URL list)",
        seedTasks : "boolean (default: true)",
        skipBrand : "boolean (default: false)",
        skipDedup : "boolean (default: false)",
        skipUx    : "boolean (default: false)",
      },
      output: {
        architectureMap : "systems[], dependencyGraph, systemCount",
        brandingIssues  : "violations[], filesScanned, tasksCreated",
        duplicateModules: "duplicates[], filesAnalyzed, tasksCreated",
        uxIssues        : "flows[], brokenFlows[], recommendations[]",
        totalTasksCreated: "number",
      },
    },
  });
}
