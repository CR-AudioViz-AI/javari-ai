// lib/memory/knowledgeNodeBuilder.ts
// Purpose: Constructs MemoryNode objects from the raw data emitted by each
//          Javari subsystem: repairs, scans, crawls, audits, tech discoveries.
//          This is the "ingestion adapter" — maps every event type to graph nodes.
// Date: 2026-03-07

import { upsertNode, upsertEdge, MemoryNode, NodeType } from "./memoryGraph";
import type { LearningEvent } from "@/lib/learning/learningCollector";

// ── Re-exported helper types ───────────────────────────────────────────────

export interface RepairRecord {
  issue_description : string;
  fix_description   : string;
  technology        : string;
  domain            : string;
  severity          : "low" | "medium" | "high" | "critical";
  file_path?        : string;
  commit_sha?       : string;
  source            : string;
}

export interface ScanFinding {
  title       : string;
  description : string;
  technology  : string;
  domain      : string;
  severity    : "low" | "medium" | "high" | "critical";
  file_path?  : string;
  source      : string;
}

export interface CrawlFinding {
  url         : string;
  title       : string;
  description : string;
  technology  : string;
  severity    : "low" | "medium" | "high" | "critical" | "none";
  source      : string;
}

export interface TechDiscovery {
  technology  : string;
  version?    : string;
  domain      : string;
  context     : string;
  source      : string;
}

// ── Builders ────────────────────────────────────────────────────────────────

/**
 * Ingest a completed repair into the memory graph.
 * Creates two nodes (issue + fix) and a resolved_by edge between them.
 * Also creates a technology node and links both to it.
 */
export async function ingestRepair(repair: RepairRecord): Promise<{
  issueNode: MemoryNode;
  fixNode  : MemoryNode;
}> {
  const issueNode = await upsertNode({
    node_type  : "issue",
    label      : repair.issue_description.slice(0, 120),
    description: repair.issue_description,
    technology : repair.technology,
    domain     : repair.domain,
    severity   : repair.severity,
    confidence : 90,
    occurrences: 1,
    metadata   : { file_path: repair.file_path ?? null, source: repair.source },
    source     : "repair",
  });

  const fixNode = await upsertNode({
    node_type  : "fix",
    label      : repair.fix_description.slice(0, 120),
    description: repair.fix_description,
    technology : repair.technology,
    domain     : repair.domain,
    severity   : "none",
    confidence : 90,
    occurrences: 1,
    metadata   : { commit_sha: repair.commit_sha ?? null, file_path: repair.file_path ?? null },
    source     : "repair",
  });

  // issue --resolved_by--> fix
  await upsertEdge(issueNode.id, "resolved_by", fixNode.id, 90, { source: repair.source });

  // Both nodes --discovered_in--> technology node
  const techNode = await ingestTechDiscovery({
    technology: repair.technology,
    domain    : repair.domain,
    context   : `Repair: ${repair.issue_description.slice(0, 60)}`,
    source    : "repair",
  });
  await upsertEdge(issueNode.id, "discovered_in", techNode.id, 70, {});
  await upsertEdge(fixNode.id, "discovered_in", techNode.id, 70, {});

  return { issueNode, fixNode };
}

/**
 * Ingest a code scan finding.
 * Creates an issue node and links to a scan_result node and technology node.
 */
export async function ingestScanFinding(finding: ScanFinding): Promise<MemoryNode> {
  const issueNode = await upsertNode({
    node_type  : "issue",
    label      : finding.title.slice(0, 120),
    description: finding.description,
    technology : finding.technology,
    domain     : finding.domain,
    severity   : finding.severity,
    confidence : 85,
    occurrences: 1,
    metadata   : { file_path: finding.file_path ?? null },
    source     : "scan",
  });

  const scanNode = await upsertNode({
    node_type  : "scan_result",
    label      : `Scan: ${finding.technology} ${finding.domain}`,
    description: `Code intelligence scan in ${finding.technology}`,
    technology : finding.technology,
    domain     : finding.domain,
    severity   : "none",
    confidence : 80,
    occurrences: 1,
    metadata   : { source: finding.source },
    source     : "scan",
  });

  await upsertEdge(scanNode.id, "produces", issueNode.id, 80, {});

  const techNode = await ingestTechDiscovery({
    technology: finding.technology, domain: finding.domain,
    context: `Scan finding: ${finding.title.slice(0, 60)}`, source: "scan",
  });
  await upsertEdge(issueNode.id, "discovered_in", techNode.id, 60, {});

  return issueNode;
}

/**
 * Ingest a crawl/audit finding.
 * Creates an audit_finding node linked to the URL and technology.
 */
export async function ingestCrawlFinding(finding: CrawlFinding): Promise<MemoryNode> {
  const auditNode = await upsertNode({
    node_type  : "audit_finding",
    label      : finding.title.slice(0, 120),
    description: finding.description,
    technology : finding.technology,
    domain     : "architecture",
    severity   : finding.severity === "none" ? "low" : finding.severity,
    confidence : 75,
    occurrences: 1,
    metadata   : { url: finding.url },
    source     : "crawl",
  });
  return auditNode;
}

/**
 * Ingest a technology discovery.
 * Creates or updates a technology node. Safe to call frequently — upsertNode
 * deduplicates by label + technology + node_type.
 */
export async function ingestTechDiscovery(discovery: TechDiscovery): Promise<MemoryNode> {
  const node = await upsertNode({
    node_type  : "technology",
    label      : discovery.technology,
    description: discovery.context,
    technology : discovery.technology,
    domain     : discovery.domain,
    severity   : "none",
    confidence : 80,
    occurrences: 1,
    metadata   : { version: discovery.version ?? null },
    source     : discovery.source,
  });
  return node;
}

/**
 * Ingest a LearningEvent (from learningCollector).
 * Maps event types to the appropriate graph nodes and edges.
 */
export async function ingestLearningEvent(event: LearningEvent): Promise<void> {
  try {
    switch (event.event_type) {
      case "issue_detected": {
        await upsertNode({
          node_type  : "issue",
          label      : (event.details.title as string | undefined) ?? `${event.domain} issue`,
          description: (event.details.description as string | undefined) ?? "",
          technology : event.technology,
          domain     : event.domain,
          severity   : event.severity,
          confidence : 80,
          occurrences: 1,
          metadata   : event.details,
          source     : event.source,
        });
        break;
      }
      case "issue_repaired": {
        await ingestRepair({
          issue_description: (event.details.issue as string | undefined) ?? `${event.domain} issue`,
          fix_description  : (event.details.fix as string | undefined) ?? `${event.domain} fix applied`,
          technology       : event.technology,
          domain           : event.domain,
          severity         : event.severity,
          commit_sha       : event.details.commit_sha as string | undefined,
          source           : event.source,
        });
        break;
      }
      case "tech_encountered": {
        await ingestTechDiscovery({
          technology: event.technology,
          domain    : event.domain,
          context   : (event.details.context as string | undefined) ?? "",
          source    : event.source,
        });
        break;
      }
      case "scan_completed": {
        await upsertNode({
          node_type  : "scan_result",
          label      : `${event.technology} scan`,
          description: JSON.stringify(event.details).slice(0, 200),
          technology : event.technology,
          domain     : event.domain,
          severity   : "none",
          confidence : 75,
          occurrences: 1,
          metadata   : event.details,
          source     : event.source,
        });
        break;
      }
      case "audit_completed": {
        await upsertNode({
          node_type  : "audit_finding",
          label      : `${event.technology} audit`,
          description: JSON.stringify(event.details).slice(0, 200),
          technology : event.technology,
          domain     : event.domain,
          severity   : event.severity,
          confidence : 75,
          occurrences: 1,
          metadata   : event.details,
          source     : event.source,
        });
        break;
      }
      case "pattern_learned": {
        const patternNode = await upsertNode({
          node_type  : "pattern",
          label      : (event.details.pattern as string | undefined) ?? `${event.domain} pattern`,
          description: (event.details.description as string | undefined) ?? "",
          technology : event.technology,
          domain     : event.domain,
          severity   : "none",
          confidence : 85,
          occurrences: 1,
          metadata   : event.details,
          source     : event.source,
        });
        // Link pattern to domain node
        const domainNode = await upsertNode({
          node_type: "domain", label: event.domain,
          description: `Knowledge domain: ${event.domain}`,
          technology: "platform", domain: event.domain,
          severity: "none", confidence: 100, occurrences: 1,
          metadata: {}, source: "system",
        });
        await upsertEdge(patternNode.id, "related_to", domainNode.id, 60, {});
        break;
      }
      default: {
        // For other event types, create a generic node
        await upsertNode({
          node_type  : "scan_result",
          label      : `${event.event_type}: ${event.technology}`,
          description: JSON.stringify(event.details).slice(0, 200),
          technology : event.technology,
          domain     : event.domain,
          severity   : event.severity,
          confidence : 70,
          occurrences: 1,
          metadata   : event.details,
          source     : event.source,
        });
      }
    }
  } catch (err) {
    console.warn(`[knowledgeNodeBuilder] ingestLearningEvent: ${err}`);
  }
}

// ── Bulk ingestion from learning events ───────────────────────────────────

export async function bulkIngestLearningEvents(
  events  : LearningEvent[],
  parallel: number = 5
): Promise<{ ingested: number; errors: number }> {
  let ingested = 0, errors = 0;
  for (let i = 0; i < events.length; i += parallel) {
    const batch = events.slice(i, i + parallel);
    const results = await Promise.allSettled(batch.map(e => ingestLearningEvent(e)));
    for (const r of results) {
      if (r.status === "fulfilled") ingested++;
      else { errors++; console.warn(`[bulkIngest] ${r.reason}`); }
    }
  }
  return { ingested, errors };
}
