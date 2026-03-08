// app/api/javari/memory/query/route.ts
// Purpose: Memory Graph REST API.
//          POST  { query?, node_types?, technologies?, ... } → search results
//          POST  { mode: "repair_context", issue, technology } → repair context
//          POST  { mode: "insights" }  → full insight report
//          POST  { mode: "ingest", ... } → ingest a repair/scan/crawl/tech event
//          POST  { mode: "maintenance" } → run relationship mapper + insights
//          GET   → graph stats
// Date: 2026-03-07

import { NextRequest, NextResponse }          from "next/server";
import { searchMemoryGraph, buildRepairContext } from "@/lib/memory/memorySearch";
import { generateMemoryInsights, runMemoryMaintenance } from "@/lib/memory/memoryInsights";
import { getGraphStats, ensureMemoryGraphTable } from "@/lib/memory/memoryGraph";
import {
  ingestRepair, ingestScanFinding, ingestCrawlFinding,
  ingestTechDiscovery, bulkIngestLearningEvents,
} from "@/lib/memory/knowledgeNodeBuilder";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as Record<string, unknown>;
    const mode = (body.mode as string) ?? "search";

    // ── Ensure table exists (auto-migrate) ──────────────────────────────
    await ensureMemoryGraphTable();

    switch (mode) {

      // ── Search mode ────────────────────────────────────────────────────
      case "search":
      default: {
        const result = await searchMemoryGraph({
          query          : body.query as string | undefined,
          node_types     : body.node_types as string[] | undefined,
          technologies   : body.technologies as string[] | undefined,
          domains        : body.domains as string[] | undefined,
          severities     : body.severities as string[] | undefined,
          min_confidence : body.min_confidence as number | undefined,
          min_occurrences: body.min_occurrences as number | undefined,
          limit          : body.limit as number | undefined,
          include_edges  : body.include_edges as boolean | undefined,
        });
        return NextResponse.json({ ok:true, mode:"search", ...result });
      }

      // ── Repair context mode ────────────────────────────────────────────
      case "repair_context": {
        const issue      = body.issue as string;
        const technology = body.technology as string;
        const domain     = body.domain as string | undefined;
        if (!issue || !technology) {
          return NextResponse.json({ ok:false, error:"issue and technology are required" }, { status:400 });
        }
        const ctx = await buildRepairContext(issue, technology, domain);
        return NextResponse.json({ ok:true, mode:"repair_context", ...ctx });
      }

      // ── Insights mode ──────────────────────────────────────────────────
      case "insights": {
        const report = await generateMemoryInsights();
        return NextResponse.json({ ok:true, mode:"insights", ...report });
      }

      // ── Maintenance mode ───────────────────────────────────────────────
      case "maintenance": {
        const result = await runMemoryMaintenance();
        return NextResponse.json({ ok:true, mode:"maintenance",
          patternsFound    : result.patternsFound,
          suggestionsApplied: result.suggestionsApplied,
          graphStats       : result.insights.graphStats,
          knowledgeGaps    : result.insights.knowledgeGaps,
          insightText      : result.insights.insightText,
        });
      }

      // ── Ingest mode ────────────────────────────────────────────────────
      case "ingest": {
        const ingest_type = body.ingest_type as string;
        switch (ingest_type) {
          case "repair": {
            const { issueNode, fixNode } = await ingestRepair({
              issue_description: body.issue_description as string,
              fix_description  : body.fix_description   as string,
              technology       : body.technology         as string ?? "unknown",
              domain           : body.domain             as string ?? "general",
              severity         : body.severity           as "low"|"medium"|"high"|"critical" ?? "medium",
              file_path        : body.file_path          as string | undefined,
              commit_sha       : body.commit_sha         as string | undefined,
              source           : body.source             as string ?? "manual",
            });
            return NextResponse.json({ ok:true, mode:"ingest", ingest_type:"repair",
              issueNodeId: issueNode.id, fixNodeId: fixNode.id });
          }
          case "scan": {
            const node = await ingestScanFinding({
              title      : body.title       as string,
              description: body.description as string,
              technology : body.technology  as string,
              domain     : body.domain      as string,
              severity   : body.severity    as "low"|"medium"|"high"|"critical",
              file_path  : body.file_path   as string | undefined,
              source     : body.source      as string ?? "scan",
            });
            return NextResponse.json({ ok:true, mode:"ingest", ingest_type:"scan", nodeId: node.id });
          }
          case "crawl": {
            const node = await ingestCrawlFinding({
              url        : body.url         as string,
              title      : body.title       as string,
              description: body.description as string,
              technology : body.technology  as string,
              severity   : body.severity    as "low"|"medium"|"high"|"critical"|"none",
              source     : body.source      as string ?? "crawl",
            });
            return NextResponse.json({ ok:true, mode:"ingest", ingest_type:"crawl", nodeId: node.id });
          }
          case "technology": {
            const node = await ingestTechDiscovery({
              technology: body.technology as string,
              version   : body.version    as string | undefined,
              domain    : body.domain     as string ?? "general",
              context   : body.context    as string ?? "",
              source    : body.source     as string ?? "discovery",
            });
            return NextResponse.json({ ok:true, mode:"ingest", ingest_type:"technology", nodeId: node.id });
          }
          case "learning_events": {
            const passedEvents = body.events as Parameters<typeof bulkIngestLearningEvents>[0] | undefined;
            // Auto-pull from javari_learning_events if no events array provided
            if (!passedEvents || !Array.isArray(passedEvents)) {
              try {
                const batchSize = Number(body.batch_size ?? 200);
                const offset    = Number(body.offset ?? 0);
                const { createClient } = await import("@supabase/supabase-js");
                const dbClient = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
                  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
                  { auth: { persistSession: false } }
                );
                const { data: rows, error: fetchErr } = await dbClient
                  .from("javari_learning_events")
                  .select("id, event_type, domain, technology, severity, source, details, created_at")
                  .range(offset, offset + batchSize - 1)
                  .order("created_at", { ascending: true });
                if (fetchErr) return NextResponse.json({ ok:false, error: fetchErr.message }, { status:500 });
                type RawRow = { id: unknown; event_type: unknown; domain: unknown; technology: unknown;
                               severity: unknown; source: unknown; details: unknown; created_at: unknown };
                const autoEvents = (rows ?? []).map((r: RawRow) => ({
                  id        : String(r.id),
                  timestamp : String(r.created_at ?? new Date().toISOString()),
                  event_type: r.event_type as import("@/lib/learning/learningCollector").LearningEventType,
                  domain    : r.domain     as import("@/lib/learning/learningCollector").KnowledgeDomain,
                  technology: String(r.technology ?? "unknown"),
                  severity  : (r.severity ?? "low") as "low"|"medium"|"high"|"critical",
                  source    : String(r.source ?? "auto"),
                  details   : (r.details ?? {}) as Record<string, unknown>,
                }));
                const result = await bulkIngestLearningEvents(autoEvents, 10);
                return NextResponse.json({ ok:true, mode:"ingest", ingest_type:"learning_events",
                  auto_pulled: autoEvents.length, offset, batch_size: batchSize, ...result });
              } catch (autoErr) {
                return NextResponse.json({ ok:false, error: String(autoErr) }, { status:500 });
              }
            }
            const result = await bulkIngestLearningEvents(passedEvents, 10);
            return NextResponse.json({ ok:true, mode:"ingest", ingest_type:"learning_events", ...result });
          }
          default:
            return NextResponse.json({ ok:false, error:`Unknown ingest_type: ${ingest_type}` }, { status:400 });
        }
      }
    }
  } catch (err) {
    console.error("[memory/query] Error:", err);
    return NextResponse.json({ ok:false, error:String(err) }, { status:500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    await ensureMemoryGraphTable();
    const stats = await getGraphStats();
    return NextResponse.json({
      ok     : true,
      endpoint: "POST /api/javari/memory/query",
      version : "1.0.0",
      stats,
      modes   : {
        search        : "{ query?, node_types?, technologies?, domains?, severities?, min_confidence?, limit?, include_edges? }",
        repair_context: "{ mode:'repair_context', issue, technology, domain? }",
        insights      : "{ mode:'insights' }",
        maintenance   : "{ mode:'maintenance' } — run relationship mapper + pattern detection + insights",
        ingest        : "{ mode:'ingest', ingest_type:'repair|scan|crawl|technology|learning_events', ...fields }",
      },
    });
  } catch (err) {
    return NextResponse.json({ ok:false, error:String(err) }, { status:500 });
  }
}
