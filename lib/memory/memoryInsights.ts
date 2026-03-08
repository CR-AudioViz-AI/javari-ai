// lib/memory/memoryInsights.ts
// Purpose: Generates actionable insights from the memory graph — what
//          Javari knows, what it has fixed most, where it is weak, and
//          trend analysis over time. Used by operations and learning dashboards.
// Date: 2026-03-07

import { createClient }        from "@supabase/supabase-js";
import { getGraphStats }       from "./memoryGraph";
import { detectPatterns }      from "./relationshipMapper";
import { runRelationshipMapper } from "./relationshipMapper";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MemoryInsightReport {
  graphStats     : Awaited<ReturnType<typeof getGraphStats>>;
  topIssues      : Array<{ label: string; technology: string; occurrences: number; severity: string }>;
  topFixes       : Array<{ label: string; technology: string; occurrences: number }>;
  topPatterns    : Array<{ label: string; domain: string; frequency: number }>;
  topTechnologies: Array<{ technology: string; totalNodes: number; issueCount: number; fixCount: number }>;
  knowledgeGaps  : Array<{ domain: string; issueCount: number; fixCount: number; gapScore: number }>;
  recentActivity : Array<{ label: string; node_type: string; technology: string; updated_at: string }>;
  totalRepairs   : number;
  repairSuccessRate: number;
  insightText    : string;
  generatedAt    : string;
}

// ── Supabase client ────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Main insight generator ─────────────────────────────────────────────────

export async function generateMemoryInsights(): Promise<MemoryInsightReport> {
  const client = db();
  const generatedAt = new Date().toISOString();

  // Graph-level stats
  const graphStats = await getGraphStats();

  // Top issues by occurrences
  const { data: topIssueRows } = await client
    .from("javari_memory_graph")
    .select("label,technology,occurrences,severity")
    .eq("record_type","node").eq("node_type","issue")
    .order("occurrences",{ascending:false}).limit(10);

  // Top fixes by occurrences
  const { data: topFixRows } = await client
    .from("javari_memory_graph")
    .select("label,technology,occurrences")
    .eq("record_type","node").eq("node_type","fix")
    .order("occurrences",{ascending:false}).limit(10);

  // Top patterns (skipped in fast insights — use maintenance mode for full pattern scan)
  const patterns: import("./relationshipMapper").PatternResult[] = [];

  // Technology profile: count issues + fixes per technology
  const { data: allNodes } = await client
    .from("javari_memory_graph")
    .select("technology,node_type,domain")
    .eq("record_type","node")
    .not("node_type","eq","technology")
    .limit(500);  // cap for perf — 500 nodes covers insights adequately

  const techMap = new Map<string, { totalNodes:number; issueCount:number; fixCount:number }>();
  for (const n of (allNodes ?? [])) {
    const t = n.technology ?? "unknown";
    if (!techMap.has(t)) techMap.set(t, { totalNodes:0, issueCount:0, fixCount:0 });
    const entry = techMap.get(t)!;
    entry.totalNodes++;
    if (n.node_type === "issue") entry.issueCount++;
    if (n.node_type === "fix")   entry.fixCount++;
  }
  const topTechnologies = Array.from(techMap.entries())
    .map(([technology, stats]) => ({ technology, ...stats }))
    .sort((a,b) => b.totalNodes - a.totalNodes)
    .slice(0, 10);

  // Knowledge gaps: domains with more issues than fixes
  const domainMap = new Map<string, { issueCount:number; fixCount:number }>();
  for (const n of (allNodes ?? [])) {
    const d = n.domain ?? "general";
    if (!domainMap.has(d)) domainMap.set(d, { issueCount:0, fixCount:0 });
    const entry = domainMap.get(d)!;
    if (n.node_type === "issue") entry.issueCount++;
    if (n.node_type === "fix")   entry.fixCount++;
  }
  const knowledgeGaps = Array.from(domainMap.entries())
    .map(([domain, stats]) => ({
      domain,
      ...stats,
      gapScore: stats.issueCount > 0
        ? Math.round((1 - stats.fixCount / stats.issueCount) * 100)
        : 0,
    }))
    .filter(g => g.gapScore > 0)
    .sort((a,b) => b.gapScore - a.gapScore)
    .slice(0, 8);

  // Recent activity
  const { data: recentRows } = await client
    .from("javari_memory_graph")
    .select("label,node_type,technology,updated_at")
    .eq("record_type","node")
    .order("updated_at",{ascending:false}).limit(10);

  // Repair count and success rate from resolved_by edges
  const { count: resolvedCount } = await client
    .from("javari_memory_graph")
    .select("*", { count:"exact", head:true })
    .eq("record_type","edge")
    .eq("edge_type","resolved_by");

  const { count: issueCount } = await client
    .from("javari_memory_graph")
    .select("*", { count:"exact", head:true })
    .eq("record_type","node")
    .eq("node_type","issue");

  const totalRepairs = resolvedCount ?? 0;
  const repairSuccessRate = (issueCount ?? 0) > 0
    ? Math.round(totalRepairs / (issueCount ?? 1) * 100)
    : 0;

  const insightText = buildInsightText(
    graphStats, topTechnologies, knowledgeGaps, totalRepairs, repairSuccessRate
  );

  return {
    graphStats,
    topIssues   : (topIssueRows ?? []) as MemoryInsightReport["topIssues"],
    topFixes    : (topFixRows ?? []) as MemoryInsightReport["topFixes"],
    topPatterns : patterns.slice(0, 10).map(p => ({
      label: p.patternLabel, domain: p.domain, frequency: p.frequency,
    })),
    topTechnologies,
    knowledgeGaps,
    recentActivity: (recentRows ?? []) as MemoryInsightReport["recentActivity"],
    totalRepairs,
    repairSuccessRate,
    insightText,
    generatedAt,
  };
}

// ── Run full memory graph maintenance ─────────────────────────────────────

export async function runMemoryMaintenance(): Promise<{
  insights         : MemoryInsightReport;
  patternsFound    : number;
  suggestionsApplied: number;
}> {
  const mapResult = await runRelationshipMapper();
  const insights  = await generateMemoryInsights();
  return {
    insights,
    patternsFound    : mapResult.patternsFound,
    suggestionsApplied: mapResult.suggestionsApplied,
  };
}

// ── Insight text builder ───────────────────────────────────────────────────

function buildInsightText(
  stats       : Awaited<ReturnType<typeof getGraphStats>>,
  topTech     : MemoryInsightReport["topTechnologies"],
  gaps        : MemoryInsightReport["knowledgeGaps"],
  repairs     : number,
  repairRate  : number
): string {
  const lines: string[] = [
    `JAVARI MEMORY GRAPH INSIGHTS`,
    `Graph: ${stats.totalNodes} nodes, ${stats.totalEdges} edges across ${stats.topTechnologies.length} technologies`,
    `Repairs recorded: ${repairs} (${repairRate}% of issues have documented fixes)`,
  ];

  if (topTech.length) {
    lines.push(`\nTop Technologies:`);
    for (const t of topTech.slice(0, 5)) {
      lines.push(`  ${t.technology}: ${t.issueCount} issues, ${t.fixCount} fixes`);
    }
  }

  if (gaps.length) {
    lines.push(`\nKnowledge Gaps (domains needing more fixes):`);
    for (const g of gaps.slice(0, 5)) {
      lines.push(`  ${g.domain}: ${g.issueCount} issues, ${g.fixCount} fixes (gap=${g.gapScore}%)`);
    }
  }

  return lines.join("\n");
}
