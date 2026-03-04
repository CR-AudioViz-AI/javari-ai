import { PlanTier } from "./plans";
const REQUEST_LIMITS: Record<PlanTier, number> = {
  free: 1,        // $1 max per execution
  pro: 10,        // $10 per execution
  enterprise: 100 // $100 per execution
};
export function getRequestLimit(tier: PlanTier): number {
  return REQUEST_LIMITS[tier];
}
export function enforceRequestCost(
  tier: PlanTier,
  estimatedCost: number
) {
  const limit = getRequestLimit(tier);
  if (estimatedCost > limit) {
    throw new Error(
      `Execution exceeds per-request limit of $${limit} for ${tier} plan.`
    );
  }
}
