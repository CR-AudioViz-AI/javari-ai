// lib/launch/onboarding-checklist.ts
// CR AudioViz AI — User Onboarding Activation Checklist
// 2026-02-21 — STEP 9 Official Launch

import { track } from "@/lib/analytics/track";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChecklistStepId =
  | "choose_plan"
  | "complete_profile"
  | "generate_first_module"
  | "enable_autonomy"
  | "explore_marketplace";

export interface ChecklistStep {
  id:          ChecklistStepId;
  step:        number;
  title:       string;
  description: string;
  href:        string;
  ctaLabel:    string;
  points:      number;       // completion points
}

export interface ChecklistProgress {
  userId:      string;
  completed:   ChecklistStepId[];
  remaining:   ChecklistStep[];
  totalPoints: number;
  earnedPoints: number;
  percentComplete: number;
  nextStep:    ChecklistStep | null;
  recommendation: string;
}

// ── Checklist definition ──────────────────────────────────────────────────────

export const ONBOARDING_STEPS: ChecklistStep[] = [
  {
    id:          "choose_plan",
    step:        1,
    title:       "Choose your plan",
    description: "Select the tier that fits your creative workflow. Start free, upgrade anytime.",
    href:        "/pricing",
    ctaLabel:    "View Plans",
    points:      10,
  },
  {
    id:          "complete_profile",
    step:        2,
    title:       "Complete your profile",
    description: "Tell Javari about your goals so it can personalise its assistance.",
    href:        "/account/onboarding",
    ctaLabel:    "Set Up Profile",
    points:      20,
  },
  {
    id:          "generate_first_module",
    step:        3,
    title:       "Generate your first module",
    description: "Use the Module Factory to create a real, production-ready app component in seconds.",
    href:        "/store",
    ctaLabel:    "Open Module Store",
    points:      30,
  },
  {
    id:          "enable_autonomy",
    step:        4,
    title:       "Enable the Autonomy Engine",
    description: "Let Javari work autonomously on your goals — self-healing, self-building.",
    href:        "/javari?mode=autonomy",
    ctaLabel:    "Activate Javari",
    points:      25,
  },
  {
    id:          "explore_marketplace",
    step:        5,
    title:       "Explore the Marketplace",
    description: "Browse the full module library. Install analytics, auth, dashboards, and more.",
    href:        "/store",
    ctaLabel:    "Browse Modules",
    points:      15,
  },
];

export const TOTAL_POINTS = ONBOARDING_STEPS.reduce((s, step) => s + step.points, 0);

// ── Core function ─────────────────────────────────────────────────────────────

export function getChecklistProgress(
  userId:    string,
  completed: ChecklistStepId[]
): ChecklistProgress {
  const completedSet  = new Set(completed);
  const remaining     = ONBOARDING_STEPS.filter((s) => !completedSet.has(s.id));
  const earnedPoints  = ONBOARDING_STEPS
    .filter((s) => completedSet.has(s.id))
    .reduce((sum, s) => sum + s.points, 0);

  const percentComplete = Math.round((completed.length / ONBOARDING_STEPS.length) * 100);
  const nextStep = remaining[0] ?? null;

  let recommendation = "You're making great progress!";
  if (completed.length === 0) {
    recommendation = "Start by choosing a plan that fits your needs.";
  } else if (completed.length < 2) {
    recommendation = "Complete your profile so Javari can personalise your experience.";
  } else if (!completedSet.has("generate_first_module")) {
    recommendation = "Generate your first module — it takes under 30 seconds!";
  } else if (!completedSet.has("enable_autonomy")) {
    recommendation = "Enable the Autonomy Engine to unlock Javari's full power.";
  } else if (completed.length === ONBOARDING_STEPS.length) {
    recommendation = "🎉 You're fully set up! Explore advanced features in your dashboard.";
  }

  return {
    userId,
    completed,
    remaining,
    totalPoints: TOTAL_POINTS,
    earnedPoints,
    percentComplete,
    nextStep,
    recommendation,
  };
}

export function markStepComplete(
  userId:  string,
  stepId:  ChecklistStepId,
  current: ChecklistStepId[]
): ChecklistStepId[] {
  if (current.includes(stepId)) return current;
  const next = [...current, stepId];
  track({
    event:   "ai_task",
    userId,
    properties: { action: "onboarding_step_complete", stepId, totalCompleted: next.length },
  });
  return next;
}
