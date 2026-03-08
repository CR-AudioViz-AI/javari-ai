// lib/learning/learningReportBuilder.ts
// Purpose: Combines all learning subsystems into a single structured report.
//          Entry point for the learning API endpoint and dashboard.
// Date: 2026-03-07

import {
  ensureLearningTables, fetchLearningEvents, ingestFromPlatformData,
} from "./learningCollector";
import { buildKnowledgeDomainReport }   from "./knowledgeDomainTracker";
import { buildExperienceLedger, persistExperience } from "./experienceLedger";
import { buildLearningTimeline }        from "./learningTimeline";
import { buildCapabilityProfile }       from "./capabilityProfiler";
import { recordArtifact }               from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LearningReport {
  reportId        : string;
  generatedAt     : string;
  durationMs      : number;
  summary         : {
    totalEvents       : number;
    totalTechnologies : number;
    overallMaturity   : number;
    overallConfidence : number;
    topDomain         : string;
    topTechnology     : string;
    topCapability     : string;
    readyForAutonomy  : boolean;
    eventsIngested    : number;
    trajectory        : string;
  };
  domains         : ReturnType<typeof buildKnowledgeDomainReport>;
  technologies    : ReturnType<typeof buildExperienceLedger>;
  capabilities    : ReturnType<typeof buildCapabilityProfile>;
  timeline        : ReturnType<typeof buildLearningTimeline>;
}

// ── Main builder ───────────────────────────────────────────────────────────

export async function buildLearningReport(
  opts: { ingest?: boolean; persist?: boolean; record?: boolean } = {}
): Promise<LearningReport> {
  const t0       = Date.now();
  const reportId = `learning-${Date.now()}`;

  const { ingest = true, persist = true, record = false } = opts;

  await ensureLearningTables();

  // Ingest fresh data from platform tables
  let eventsIngested = 0;
  if (ingest) {
    const result = await ingestFromPlatformData();
    eventsIngested = result.eventsCreated;
  }

  // Load all learning events
  const events = await fetchLearningEvents({ limit: 2000 });

  // Build all sub-reports
  const domains      = buildKnowledgeDomainReport(events);
  const technologies = buildExperienceLedger(events);
  const capabilities = buildCapabilityProfile(events);
  const timeline     = buildLearningTimeline(events);

  // Persist experience ledger to DB
  if (persist) await persistExperience(technologies);

  const summary = {
    totalEvents      : events.length,
    totalTechnologies: technologies.totalTechnologies,
    overallMaturity  : domains.overallMaturity,
    overallConfidence: capabilities.overallConfidence,
    topDomain        : domains.topDomain,
    topTechnology    : technologies.topTechnology,
    topCapability    : capabilities.topCapability,
    readyForAutonomy : capabilities.readyForAutonomy,
    eventsIngested,
    trajectory       : timeline.overallTrajectory,
  };

  const durationMs = Date.now() - t0;

  if (record) {
    await recordArtifact({
      task_id         : reportId,
      artifact_type   : "learning_report" as never,
      artifact_location: "supabase/roadmap_task_artifacts",
      artifact_data   : {
        summary, durationMs,
        domainCount     : domains.domainScores.length,
        capabilityCount : capabilities.capabilities.filter(c => c.status === "active").length,
      },
    });
  }

  return { reportId, generatedAt: new Date().toISOString(), durationMs, summary, domains, technologies, capabilities, timeline };
}
