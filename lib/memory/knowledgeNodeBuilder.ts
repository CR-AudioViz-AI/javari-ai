// lib/memory/knowledgeNodeBuilder.ts
// Purpose: Ingestion adapter — maps every Javari event type to memory graph nodes/edges.
//          Sources: repairs, scans, crawls, audits, tech discoveries, learning events.
//          Pattern detection: automatically identifies recurring issues/fixes.
// Date: 2026-03-08

import { upsertNode, upsertEdge, MemoryNode, NodeType } from "./memoryGraph";
import type { LearningEvent } from "@/lib/learning/learningCollector";

// ── Re-exported helper types ───────────────────────────────────────────────

export interface RepairRecord {
  issue_description : string;
  fix_description   : string;
  file_path         : string;
  technology        : string;
  severity          : "low" | "medium" | "high" | "critical";
  strategy          : string;
  success           : boolean;
  task_id?          : string;
}

export interface ScanRecord {
  scan_id    : string;
  target_id  : string;
  target_name: string;
  issues     : Array<{ type: string; severity: string; description: string; file?: string }>;
  summary    : string;
  scanned_at : string;
}

export interface CrawlRecord {
  url         : string;
  domain      : string;
  pages_found : number;
  api_endpoints: string[];
  technologies : string[];
  security_findings: string[];
  performance_issues: string[];
  crawled_at  : string;
}

export interface TechDiscovery {
  technology  : string;
  version?    : string;
  context     : string;
  file_path?  : string;
  confidence  : number;
  discovered_at: string;
}

// ── Repair event ingestion ─────────────────────────────────────────────────

export async function ingestRepairEvent(repair: RepairRecord): Promise<{
  issueNodeId: string;
  fixNodeId  : string;
  techNodeId : string;
}> {
  const ts = Date.now();

  // Issue node
  const issueNode: MemoryNode = {
    id         : `issue-${repair.task_id ?? ts}-${Math.random().toString(36).slice(2,6)}`,
    type       : "issue",
    label      : repair.issue_description.slice(0, 80),
    description: repair.issue_description,
    metadata   : {
      severity: repair.severity,
      file_path: repair.file_path,
      strategy : repair.strategy,
      task_id  : repair.task_id,
    },
    confidence : 0.9,
    source     : "repair_engine",
    created_at : ts,
    updated_at : ts,
  };
  await upsertNode(issueNode);

  // Fix node
  const fixNode: MemoryNode = {
    id         : `fix-${repair.task_id ?? ts}-${Math.random().toString(36).slice(2,6)}`,
    type       : "fix",
    label      : repair.fix_description.slice(0, 80),
    description: repair.fix_description,
    metadata   : { strategy: repair.strategy, success: repair.success, task_id: repair.task_id },
    confidence : repair.success ? 0.95 : 0.6,
    source     : "repair_engine",
    created_at : ts,
    updated_at : ts,
  };
  await upsertNode(fixNode);

  // Technology node
  const techNode: MemoryNode = {
    id         : `tech-${repair.technology.toLowerCase().replace(/\s+/g, "-")}`,
    type       : "technology",
    label      : repair.technology,
    description: `Technology: ${repair.technology}`,
    metadata   : { technology: repair.technology, first_seen: new Date().toISOString() },
    confidence : 1.0,
    source     : "repair_engine",
    created_at : ts,
    updated_at : ts,
  };
  await upsertNode(techNode);

  // Edges: issue → resolved_by → fix, issue → affects → technology
  await upsertEdge({
    id: `${issueNode.id}-resolved_by-${fixNode.id}`,
    from_id: issueNode.id, to_id: fixNode.id, relationship: "resolved_by",
    weight: repair.success ? 0.9 : 0.5,
    metadata: { strategy: repair.strategy, success: repair.success },
  });
  await upsertEdge({
    id: `${issueNode.id}-affects-${techNode.id}`,
    from_id: issueNode.id, to_id: techNode.id, relationship: "affects",
    weight: 0.8, metadata: { file_path: repair.file_path },
  });
  await upsertEdge({
    id: `${fixNode.id}-applies_to-${techNode.id}`,
    from_id: fixNode.id, to_id: techNode.id, relationship: "applies_to",
    weight: 0.85, metadata: { strategy: repair.strategy },
  });

  return { issueNodeId: issueNode.id, fixNodeId: fixNode.id, techNodeId: techNode.id };
}

// ── Scan event ingestion ───────────────────────────────────────────────────

export async function ingestScanEvent(scan: ScanRecord): Promise<{ scanNodeId: string; issueNodeIds: string[] }> {
  const ts = Date.now();

  const scanNode: MemoryNode = {
    id         : `scan-${scan.scan_id}`,
    type       : "scan_result",
    label      : `Scan: ${scan.target_name}`,
    description: scan.summary,
    metadata   : {
      target_id: scan.target_id,
      target_name: scan.target_name,
      issue_count: scan.issues.length,
      scanned_at: scan.scanned_at,
    },
    confidence : 0.95,
    source     : "scan_engine",
    created_at : ts,
    updated_at : ts,
  };
  await upsertNode(scanNode);

  const issueNodeIds: string[] = [];
  for (const issue of scan.issues.slice(0, 10)) {
    const issueNode: MemoryNode = {
      id         : `issue-scan-${scan.scan_id}-${Math.random().toString(36).slice(2,6)}`,
      type       : "issue",
      label      : issue.description.slice(0, 80),
      description: issue.description,
      metadata   : { type: issue.type, severity: issue.severity, file: issue.file, source: "scan" },
      confidence : 0.85,
      source     : "scan_engine",
      created_at : ts,
      updated_at : ts,
    };
    await upsertNode(issueNode);
    issueNodeIds.push(issueNode.id);
    await upsertEdge({
      id: `${scanNode.id}-discovered-${issueNode.id}`,
      from_id: scanNode.id, to_id: issueNode.id, relationship: "discovered_in",
      weight: 0.8, metadata: { severity: issue.severity },
    });
  }

  return { scanNodeId: scanNode.id, issueNodeIds };
}

// ── Crawl event ingestion ──────────────────────────────────────────────────

export async function ingestCrawlEvent(crawl: CrawlRecord): Promise<{ crawlNodeId: string; techNodeIds: string[] }> {
  const ts = Date.now();

  const crawlNode: MemoryNode = {
    id         : `crawl-${crawl.domain}-${ts}`,
    type       : "audit_finding",
    label      : `Crawl: ${crawl.domain}`,
    description: `Web crawl of ${crawl.url}: ${crawl.pages_found} pages, ${crawl.api_endpoints.length} endpoints`,
    metadata   : {
      domain: crawl.domain,
      pages_found: crawl.pages_found,
      api_endpoints: crawl.api_endpoints.length,
      security_findings: crawl.security_findings.length,
      performance_issues: crawl.performance_issues.length,
      crawled_at: crawl.crawled_at,
    },
    confidence : 0.9,
    source     : "crawler",
    created_at : ts,
    updated_at : ts,
  };
  await upsertNode(crawlNode);

  const techNodeIds: string[] = [];
  for (const tech of crawl.technologies.slice(0, 10)) {
    const techNode: MemoryNode = {
      id         : `tech-${tech.toLowerCase().replace(/\s+/g, "-")}`,
      type       : "technology",
      label      : tech,
      description: `Technology detected: ${tech}`,
      metadata   : { technology: tech, detected_by: "crawler", domain: crawl.domain },
      confidence : 0.8,
      source     : "crawler",
      created_at : ts,
      updated_at : ts,
    };
    await upsertNode(techNode);
    techNodeIds.push(techNode.id);
    await upsertEdge({
      id: `${crawlNode.id}-found-${techNode.id}`,
      from_id: crawlNode.id, to_id: techNode.id, relationship: "discovered_in",
      weight: 0.7, metadata: { domain: crawl.domain },
    });
  }

  return { crawlNodeId: crawlNode.id, techNodeIds };
}

// ── Technology discovery ingestion ─────────────────────────────────────────

export async function ingestTechDiscovery(discovery: TechDiscovery): Promise<string> {
  const ts = Date.now();
  const techNode: MemoryNode = {
    id         : `tech-${discovery.technology.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    type       : "technology",
    label      : discovery.technology,
    description: `${discovery.technology}${discovery.version ? " v" + discovery.version : ""}: ${discovery.context}`,
    metadata   : {
      technology : discovery.technology,
      version    : discovery.version,
      file_path  : discovery.file_path,
      confidence : discovery.confidence,
      discovered_at: discovery.discovered_at,
    },
    confidence : discovery.confidence,
    source     : "tech_discovery",
    created_at : ts,
    updated_at : ts,
  };
  await upsertNode(techNode);
  return techNode.id;
}

// ── Learning event ingestion ───────────────────────────────────────────────

export async function ingestLearningEvent(event: LearningEvent): Promise<string | null> {
  const ts = Date.now();

  // Map learning event types to node types
  const nodeTypeMap: Record<string, NodeType> = {
    issue_detected : "issue",
    issue_repaired : "fix",
    scan_completed : "scan_result",
    audit_completed: "audit_finding",
    tech_encountered: "technology",
    pattern_learned: "pattern",
    capability_improved: "pattern",
  };

  const nodeType = nodeTypeMap[event.event_type] ?? "pattern";

  const node: MemoryNode = {
    id         : `learn-${event.event_type}-${ts}-${Math.random().toString(36).slice(2,5)}`,
    type       : nodeType,
    label      : event.description?.slice(0, 80) ?? event.event_type,
    description: event.description ?? `Learning event: ${event.event_type}`,
    metadata   : {
      event_type  : event.event_type,
      technology  : event.technology,
      domain      : event.domain,
      severity    : event.severity,
      outcome     : event.outcome,
      learning_id : event.id,
    },
    confidence : 0.75,
    source     : "learning_system",
    created_at : ts,
    updated_at : ts,
  };
  await upsertNode(node);

  // If this is a repair event, create edges to technology node
  if (event.technology && (event.event_type === "issue_detected" || event.event_type === "issue_repaired")) {
    const techId = `tech-${event.technology.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const techNode: MemoryNode = {
      id: techId, type: "technology", label: event.technology,
      description: `Technology: ${event.technology}`,
      metadata: { technology: event.technology },
      confidence: 0.8, source: "learning_system", created_at: ts, updated_at: ts,
    };
    await upsertNode(techNode);
    await upsertEdge({
      id: `${node.id}-related_to-${techId}`,
      from_id: node.id, to_id: techId, relationship: "related_to",
      weight: 0.7, metadata: { domain: event.domain },
    });
  }

  return node.id;
}

// ── Pattern detection ──────────────────────────────────────────────────────
// Call after bulk ingestion to detect recurring issues/fixes automatically.

export async function detectAndIngestPatterns(
  recentIssues: Array<{ description: string; technology: string; strategy: string }>
): Promise<string[]> {
  const ts = Date.now();
  const patternNodeIds: string[] = [];

  // Group by strategy to detect recurring patterns
  const byStrategy = new Map<string, typeof recentIssues>();
  for (const issue of recentIssues) {
    const existing = byStrategy.get(issue.strategy) ?? [];
    existing.push(issue);
    byStrategy.set(issue.strategy, existing);
  }

  for (const [strategy, issues] of byStrategy.entries()) {
    if (issues.length < 2) continue; // Need at least 2 occurrences to be a pattern

    const techSet = [...new Set(issues.map(i => i.technology))];
    const patternNode: MemoryNode = {
      id         : `pattern-${strategy.replace(/\s+/g, "-")}-${ts}`,
      type       : "pattern",
      label      : `Pattern: ${strategy} (${issues.length}x)`,
      description: `Recurring pattern: ${strategy} applied ${issues.length} times across ${techSet.join(", ")}`,
      metadata   : {
        strategy,
        occurrences: issues.length,
        technologies: techSet,
        detected_at: new Date().toISOString(),
      },
      confidence : Math.min(0.95, 0.6 + issues.length * 0.05),
      source     : "pattern_detector",
      created_at : ts,
      updated_at : ts,
    };
    await upsertNode(patternNode);
    patternNodeIds.push(patternNode.id);

    // Link pattern to each affected technology
    for (const tech of techSet) {
      const techId = `tech-${tech.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      await upsertEdge({
        id: `${patternNode.id}-applies_to-${techId}`,
        from_id: patternNode.id, to_id: techId, relationship: "applies_to",
        weight: 0.8, metadata: { strategy, occurrences: issues.length },
      });
    }
  }

  return patternNodeIds;
}
