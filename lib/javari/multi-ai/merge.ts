// lib/javari/multi-ai/merge.ts
// Javari Multi-AI Team Mode — Output Merging Engine
// 2026-02-20 — STEP 3 implementation
//
// Merges outputs from multiple agents into a single canonical result.
// Handles:
//   - Single agent output (pass-through)
//   - Primary + validator (use corrected if validator rewrote)
//   - Primary + support (concatenate with headings)
//   - Architect + engineer disagreement → invoke validator tie-break
//   - JSON outputs (parse + merge arrays/objects)
//
// Returns a NormalizedMergeResult with full traceability.

import type { AgentRole } from "./roles";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentOutput {
  role:         AgentRole;
  provider:     string;
  model:        string;
  content:      string;
  score?:       number;   // validation score if available
  durationMs:   number;
  failed?:      boolean;
  error?:       string;
}

export interface MergeResult {
  finalContent:  string;
  strategy:      MergeStrategy;
  sourcedFrom:   AgentRole[];
  validationUsed: boolean;
  conflictDetected: boolean;
  conflictResolution?: string;
  traceability: Array<{
    role:     AgentRole;
    excerpt:  string;    // first 200 chars of their contribution
    included: boolean;
  }>;
  durationMs: number;
}

export type MergeStrategy =
  | "passthrough"        // single agent, no merging needed
  | "validator_corrected"// validator rewrote primary
  | "primary_wins"       // validator passed, use primary as-is
  | "sequential_concat"  // primary → support chain concatenated
  | "architect_engineer" // architect plan + engineer implementation merged
  | "conflict_resolved"  // disagreement detected, validator chose winner
  | "best_score_wins"    // pick highest-scored output
  | "json_merged";       // JSON outputs deeply merged

// ── Helpers ───────────────────────────────────────────────────────────────────

function isJson(text: string): boolean {
  const t = text.trim();
  return (t.startsWith("{") || t.startsWith("[")) && (t.endsWith("}") || t.endsWith("]"));
}

function tryMergeJson(outputs: AgentOutput[]): string | null {
  try {
    const parsed = outputs.map((o) => JSON.parse(o.content.trim()));
    if (parsed.every((p) => Array.isArray(p))) {
      return JSON.stringify([...new Set(([] as unknown[]).concat(...parsed))], null, 2);
    }
    if (parsed.every((p) => typeof p === "object" && !Array.isArray(p))) {
      return JSON.stringify(Object.assign({}, ...parsed), null, 2);
    }
  } catch { /* not mergeable JSON */ }
  return null;
}

function similarity(a: string, b: string): number {
  // Simple word-overlap similarity
  const setA = new Set(a.toLowerCase().split(/\s+/).slice(0, 100));
  const setB = new Set(b.toLowerCase().split(/\s+/).slice(0, 100));
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap++;
  return overlap / Math.max(setA.size, setB.size, 1);
}

function conflictDetected(a: string, b: string): boolean {
  // Conflict = outputs are substantively different (< 30% word overlap)
  // AND both are non-trivial (> 100 chars)
  return a.length > 100 && b.length > 100 && similarity(a, b) < 0.30;
}

// ── Main merge function ───────────────────────────────────────────────────────

/**
 * mergeAgentOutputs — Combine multi-agent outputs into a single canonical result.
 * Deterministic: same inputs always produce same merge strategy.
 */
export function mergeAgentOutputs(
  outputs: AgentOutput[],
  options: {
    requireJson?:    boolean;
    taskDescription?: string;
  } = {}
): MergeResult {
  const t0 = Date.now();
  const successful = outputs.filter((o) => !o.failed && o.content?.trim());

  // ── Edge cases ────────────────────────────────────────────────────────────

  if (!successful.length) {
    return {
      finalContent: "",
      strategy: "passthrough",
      sourcedFrom: [],
      validationUsed: false,
      conflictDetected: false,
      traceability: outputs.map((o) => ({
        role: o.role, excerpt: o.error ?? "failed", included: false,
      })),
      durationMs: Date.now() - t0,
    };
  }

  if (successful.length === 1) {
    const single = successful[0];
    return {
      finalContent: single.content,
      strategy: "passthrough",
      sourcedFrom: [single.role],
      validationUsed: false,
      conflictDetected: false,
      traceability: [{ role: single.role, excerpt: single.content.slice(0, 200), included: true }],
      durationMs: Date.now() - t0,
    };
  }

  // ── JSON merge ────────────────────────────────────────────────────────────

  if (options.requireJson || successful.every((o) => isJson(o.content))) {
    const merged = tryMergeJson(successful);
    if (merged) {
      return {
        finalContent: merged,
        strategy: "json_merged",
        sourcedFrom: successful.map((o) => o.role),
        validationUsed: false,
        conflictDetected: false,
        traceability: successful.map((o) => ({
          role: o.role, excerpt: o.content.slice(0, 200), included: true,
        })),
        durationMs: Date.now() - t0,
      };
    }
  }

  // ── Separate by role ──────────────────────────────────────────────────────

  const primary   = successful.find((o) => o.role !== "validator") ?? successful[0];
  const validator = successful.find((o) => o.role === "validator");
  const architect = successful.find((o) => o.role === "architect");
  const engineer  = successful.find((o) => o.role === "engineer");
  const others    = successful.filter(
    (o) => o.role !== "validator" && o !== primary
  );

  // ── Validator flow ─────────────────────────────────────────────────────────

  if (validator) {
    // Try to parse validator output as a score JSON
    let vScore: number | undefined;
    let vPassed: boolean | undefined;
    let vCorrected: string | undefined;

    try {
      const vJson = JSON.parse(
        validator.content.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
      ) as { score?: number; passed?: boolean; corrected?: string };
      vScore    = vJson.score;
      vPassed   = vJson.passed;
      vCorrected = vJson.corrected ?? undefined;
    } catch { /* validator output is prose, not JSON */ }

    // If validator provided corrected output, use it
    if (vCorrected) {
      return {
        finalContent: vCorrected,
        strategy:    "validator_corrected",
        sourcedFrom: [primary.role, "validator"],
        validationUsed: true,
        conflictDetected: false,
        traceability: [
          { role: primary.role,  excerpt: primary.content.slice(0, 200), included: false },
          { role: "validator",   excerpt: vCorrected.slice(0, 200),      included: true  },
        ],
        durationMs: Date.now() - t0,
      };
    }

    // Validator passed — use primary output
    if (vPassed !== false || (vScore !== undefined && vScore >= 70)) {
      return {
        finalContent: primary.content,
        strategy:    "primary_wins",
        sourcedFrom: [primary.role],
        validationUsed: true,
        conflictDetected: false,
        traceability: [
          { role: primary.role, excerpt: primary.content.slice(0, 200), included: true  },
          { role: "validator",  excerpt: `score=${vScore}, passed=${vPassed}`,  included: false },
        ],
        durationMs: Date.now() - t0,
      };
    }
  }

  // ── Architect + Engineer merge ────────────────────────────────────────────

  if (architect && engineer) {
    const isConflict = conflictDetected(architect.content, engineer.content);
    let finalContent: string;
    let resolution: string | undefined;

    if (isConflict) {
      // Pick higher-scored; if tied, use engineer (implementation wins)
      const archScore = architect.score ?? 75;
      const engScore  = engineer.score  ?? 75;
      const winner    = archScore >= engScore + 10 ? architect : engineer;
      finalContent   = winner.content;
      resolution     = `Conflict: architect score=${archScore}, engineer score=${engScore} → ${winner.role} wins`;
    } else {
      // Merge: architect plan as context, engineer implementation as body
      finalContent = [
        "## Architecture Plan",
        architect.content,
        "",
        "## Implementation",
        engineer.content,
      ].join("\n\n");
    }

    return {
      finalContent,
      strategy:    isConflict ? "conflict_resolved" : "architect_engineer",
      sourcedFrom: [architect.role, engineer.role],
      validationUsed: !!validator,
      conflictDetected: isConflict,
      conflictResolution: resolution,
      traceability: [
        { role: "architect", excerpt: architect.content.slice(0, 200), included: !isConflict || architect === (successful.find(o => o.role === "architect") ?? architect) },
        { role: "engineer",  excerpt: engineer.content.slice(0, 200),  included: !isConflict || engineer  === (successful.find(o => o.role === "engineer")  ?? engineer) },
      ],
      durationMs: Date.now() - t0,
    };
  }

  // ── Primary + support sequential concat ──────────────────────────────────

  if (others.length > 0) {
    const sections = [primary, ...others].map((o) => {
      const heading = o.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      return `### ${heading}\n${o.content}`;
    });
    return {
      finalContent:  sections.join("\n\n"),
      strategy:      "sequential_concat",
      sourcedFrom:   [primary, ...others].map((o) => o.role),
      validationUsed: !!validator,
      conflictDetected: false,
      traceability:  [primary, ...others].map((o) => ({
        role: o.role, excerpt: o.content.slice(0, 200), included: true,
      })),
      durationMs: Date.now() - t0,
    };
  }

  // ── Best score wins (fallback) ────────────────────────────────────────────
  const best = successful.reduce((a, b) =>
    (b.score ?? 70) > (a.score ?? 70) ? b : a
  );
  return {
    finalContent:  best.content,
    strategy:      "best_score_wins",
    sourcedFrom:   [best.role],
    validationUsed: !!validator,
    conflictDetected: false,
    traceability:  successful.map((o) => ({
      role: o.role, excerpt: o.content.slice(0, 200), included: o === best,
    })),
    durationMs: Date.now() - t0,
  };
}
