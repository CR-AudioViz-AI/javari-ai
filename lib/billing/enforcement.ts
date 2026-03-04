import { PLAN_DEFINITIONS, PlanTier } from "./plans";
export function getPlan(tier: PlanTier) {
  return PLAN_DEFINITIONS[tier];
}
export function enforceRoadmapBudget(
  tier: PlanTier,
  requestedBudget: number
): number {
  const plan = getPlan(tier);
  if (requestedBudget > plan.maxBudgetPerRoadmap) {
    return plan.maxBudgetPerRoadmap;
  }
  return requestedBudget;
}
