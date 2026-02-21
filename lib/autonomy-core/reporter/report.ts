// lib/autonomy-core/reporter/report.ts
// CR AudioViz AI — Cycle Reporter
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode

import type { CycleReport, CorePatch } from "../crawler/types";

interface ReportInput {
  id:             string;
  startedAt:      string;
  status:         CycleReport["status"];
  haltReason?:    string;
  snapshotId:     string;
  patches:        CorePatch[];
  anomaliesFound: number;
  ring:           number;
  mode:           string;
}

export function generateCycleReport(input: ReportInput): CycleReport {
  const completedAt = new Date().toISOString();
  const durationMs  = new Date(completedAt).getTime() - new Date(input.startedAt).getTime();

  const patchesApplied  = input.patches.filter((p) => p.status === "applied").length;
  const patchesRejected = input.patches.filter((p) => p.status === "rejected").length;
  const patchesFailed   = input.patches.filter((p) => p.status === "failed").length;

  const anomaliesByType: Record<string, number> = {};
  for (const patch of input.patches) {
    anomaliesByType[patch.fixType] = (anomaliesByType[patch.fixType] ?? 0) + 1;
  }

  return {
    id:               input.id,
    startedAt:        input.startedAt,
    completedAt,
    durationMs,
    snapshotId:       input.snapshotId,
    anomaliesFound:   input.anomaliesFound,
    anomaliesByType,
    patchesAttempted: input.patches.length,
    patchesApplied,
    patchesRejected,
    patchesFailed,
    ring:             input.ring,
    mode:             input.mode,
    status:           input.status,
    haltReason:       input.haltReason,
    patches:          input.patches,
  };
}

export function formatReportMarkdown(report: CycleReport): string {
  const lines: string[] = [
    `# Autonomy Core Cycle Report`,
    ``,
    `**Cycle ID:** \`${report.id}\``,
    `**Status:** ${report.status.toUpperCase()}`,
    `**Started:** ${report.startedAt}`,
    `**Duration:** ${report.durationMs}ms`,
    `**Ring:** ${report.ring} | **Mode:** ${report.mode}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Anomalies Detected | ${report.anomaliesFound} |`,
    `| Patches Attempted  | ${report.patchesAttempted} |`,
    `| Patches Applied    | ${report.patchesApplied} |`,
    `| Patches Rejected   | ${report.patchesRejected} |`,
    `| Patches Failed     | ${report.patchesFailed} |`,
    ``,
  ];

  if (report.haltReason) {
    lines.push(`## Halt Reason`, ``, `> ${report.haltReason}`, ``);
  }

  if (report.patches.length > 0) {
    lines.push(`## Patches`, ``);
    for (const patch of report.patches) {
      const icon = patch.status === "applied" ? "✅" : patch.status === "rejected" ? "❌" : "⚠️";
      lines.push(
        `### ${icon} ${patch.fixType}`,
        `- **File:** \`${patch.filePath}\``,
        `- **Status:** ${patch.status}`,
        `- **Score:** ${patch.validatorScore ?? "N/A"}`,
        patch.rolledBackReason ? `- **Note:** ${patch.rolledBackReason}` : "",
        ``
      );
    }
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

export function formatReportSlack(report: CycleReport): string {
  const statusEmoji = {
    completed: "✅", halted: "⏸️", degraded: "⚠️", error: "🚨"
  }[report.status] ?? "❓";

  return [
    `${statusEmoji} *Autonomy Core Cycle ${report.id}*`,
    `Status: ${report.status} | Ring: ${report.ring} | Duration: ${report.durationMs}ms`,
    `Anomalies: ${report.anomaliesFound} | Applied: ${report.patchesApplied} | Rejected: ${report.patchesRejected}`,
    report.haltReason ? `Halt: ${report.haltReason}` : "",
  ].filter(Boolean).join("\n");
}
