// lib/learning/learningTimeline.ts
// Purpose: Tracks knowledge growth over time. Groups learning events by week,
//          detects improvements in domain scores, and generates a structured
//          timeline showing Javari's intellectual development.
// Date: 2026-03-07

import type { LearningEvent } from "./learningCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WeeklyLearning {
  week            : string;       // ISO week: "2026-W09"
  weekLabel       : string;       // "Mar 01 – Mar 07"
  eventsCount     : number;
  issuesDetected  : number;
  issuesRepaired  : number;
  newTechnologies : string[];
  topDomain       : string;
  improvements    : string[];
  regressions     : string[];
  repairRate      : number;
}

export interface LearningTimelineReport {
  weeks          : WeeklyLearning[];
  totalWeeks     : number;
  activeWeeks    : number;
  bestWeek       : string;
  mostProductiveStreak: number;   // consecutive weeks with >0 repairs
  overallTrajectory: "accelerating" | "steady" | "slowing";
}

// ── ISO week helper ────────────────────────────────────────────────────────

function isoWeek(date: Date): string {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum   = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekLabel(weekKey: string): string {
  const [year, wStr] = weekKey.split("-W");
  const week  = parseInt(wStr, 10);
  // Approximate start of week
  const jan1  = new Date(parseInt(year, 10), 0, 1);
  const start = new Date(jan1.getTime() + (week - 1) * 7 * 86400000);
  const end   = new Date(start.getTime() + 6 * 86400000);
  const fmt   = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildLearningTimeline(events: LearningEvent[]): LearningTimelineReport {
  if (events.length === 0) {
    return {
      weeks: [], totalWeeks: 0, activeWeeks: 0,
      bestWeek: "", mostProductiveStreak: 0,
      overallTrajectory: "steady",
    };
  }

  // Group by week
  const byWeek = new Map<string, LearningEvent[]>();
  for (const e of events) {
    const wk = isoWeek(new Date(e.timestamp));
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk)!.push(e);
  }

  // Sort weeks chronologically
  const sortedWeeks = [...byWeek.keys()].sort();

  const weeks: WeeklyLearning[] = sortedWeeks.map(wk => {
    const wEvents   = byWeek.get(wk) ?? [];
    const detected  = wEvents.filter(e => e.event_type === "issue_detected").length;
    const repaired  = wEvents.filter(e => e.event_type === "issue_repaired").length;
    const repairRate = detected > 0 ? Math.round(repaired / detected * 100) : repaired > 0 ? 50 : 0;

    // New technologies this week
    const seenBefore = new Set(
      sortedWeeks
        .slice(0, sortedWeeks.indexOf(wk))
        .flatMap(w => (byWeek.get(w) ?? []).map(e => e.technology))
    );
    const newTechs = [...new Set(wEvents.map(e => e.technology).filter(t => t && !seenBefore.has(t)))];

    // Top domain
    const domainCounts: Record<string, number> = {};
    for (const e of wEvents) domainCounts[e.domain] = (domainCounts[e.domain] ?? 0) + 1;
    const topDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";

    // Improvements: high-severity repairs
    const improvements = wEvents
      .filter(e => e.event_type === "issue_repaired" && (e.severity === "high" || e.severity === "critical"))
      .map(e => `Fixed ${e.severity} ${e.domain} issue (${e.technology})`)
      .slice(0, 3);

    if (newTechs.length > 0) {
      improvements.push(`Encountered ${newTechs.slice(0, 2).join(", ")}`);
    }
    if (repairRate > 70) {
      improvements.push(`${repairRate}% repair rate — strong performance`);
    }

    // Regressions: failures
    const regressions = wEvents
      .filter(e => e.event_type === "failure_observed" && e.severity === "critical")
      .map(e => `Critical failure in ${e.domain} (${e.technology})`)
      .slice(0, 2);

    return {
      week: wk, weekLabel: weekLabel(wk), eventsCount: wEvents.length,
      issuesDetected: detected, issuesRepaired: repaired,
      newTechnologies: newTechs, topDomain, improvements, regressions, repairRate,
    };
  });

  // Best week: most repairs
  const bestWeek = [...weeks].sort((a, b) => b.issuesRepaired - a.issuesRepaired)[0]?.week ?? "";

  // Streak: consecutive weeks with >0 repairs
  let streak = 0, maxStreak = 0;
  for (const w of weeks) {
    if (w.issuesRepaired > 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  }

  // Trajectory: compare last 4 weeks vs prior 4
  const last4  = weeks.slice(-4).reduce((s, w) => s + w.eventsCount, 0);
  const prev4  = weeks.slice(-8, -4).reduce((s, w) => s + w.eventsCount, 0);
  const trajectory: LearningTimelineReport["overallTrajectory"] =
    weeks.length < 4 ? "steady"
    : last4 > prev4 * 1.2 ? "accelerating"
    : last4 < prev4 * 0.8 ? "slowing"
    : "steady";

  return {
    weeks,
    totalWeeks  : weeks.length,
    activeWeeks : weeks.filter(w => w.eventsCount > 0).length,
    bestWeek, mostProductiveStreak: maxStreak, overallTrajectory: trajectory,
  };
}
