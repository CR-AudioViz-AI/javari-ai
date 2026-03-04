export type PlanTier = "free" | "pro" | "enterprise";
export interface PlanDefinition {
  tier: PlanTier;
  maxBudgetPerRoadmap: number;
  monthlyExecutionLimit: number;
  priorityRouting: boolean;
}
export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    maxBudgetPerRoadmap: 5,        // $5 cap
    monthlyExecutionLimit: 10,
    priorityRouting: false,
  },
  pro: {
    tier: "pro",
    maxBudgetPerRoadmap: 50,
    monthlyExecutionLimit: 200,
    priorityRouting: true,
  },
  enterprise: {
    tier: "enterprise",
    maxBudgetPerRoadmap: 500,
    monthlyExecutionLimit: 999999,
    priorityRouting: true,
  },
};
