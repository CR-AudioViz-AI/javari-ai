import { PlanTier } from "./plans";
export function enforceModeEntitlement(
  tier: PlanTier,
  mode: "auto" | "multi"
) {
  if (mode === "multi") {
    if (tier === "free") {
      throw new Error("Multi-agent mode requires Pro plan or higher.");
    }
  }
}
