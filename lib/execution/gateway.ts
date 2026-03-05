import { enforceRoadmapBudget } from "@/lib/billing/enforcement";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
import {
  selectBestModel,
  RoutingPreferences,
} from "@/lib/router/model-registry";
import { classifyCapability } from "@/lib/router/capability-classifier";
import { enforceRequestCost } from "@/lib/billing/profit-guard";
import { enforceMonthlyLimit, recordUsage } from "@/lib/billing/usage-meter";
import { enforceModeEntitlement } from "@/lib/billing/entitlements";
import { getUserPlan } from "@/lib/billing/subscription-service";
import { PlanTier } from "@/lib/billing/plans";

export type ExecutionMode = "auto" | "multi";

export interface ExecutionRequest {
  input: string;
  mode: ExecutionMode;
  userId: string;
  requestedBudget?: number;
  allowedModels?: string[];
  excludedModels?: string[];
  routingPriority?: "cost" | "quality" | "latency";
  roles?: {
    architect?: string;
    builder?: string;
    tester?: string;
  };
}

export async function executeGateway(req: ExecutionRequest) {
  console.log("[gateway] ====== REQUEST START ======");
  console.log("[gateway] userId:", req.userId, "| mode:", req.mode);

  // Fetch plan tier from database
  let planTier = await getUserPlan(req.userId);
  console.log("[gateway] Database returned plan tier:", planTier);
  
  // DEV BYPASS: Force PRO tier for test user (bypasses billing until debugged)
  if (req.userId === "roy_test_user") {
    console.log("[gateway] 🔧🔧🔧 DEV BYPASS ACTIVE — Forcing PRO tier for roy_test_user");
    planTier = "pro" as PlanTier;
  }
  
  console.log("[gateway] Final plan tier (after bypass):", planTier);

  // Entitlement check (will use forced PRO tier for roy_test_user)
  enforceModeEntitlement(planTier, req.mode);
  enforceRoadmapBudget(planTier, req.requestedBudget ?? 0);
  await enforceMonthlyLimit(req.userId, planTier);

  if (req.mode === "auto") {
    const capability = classifyCapability(req.input);

    const model = selectBestModel(capability, {
      allowedModels: req.allowedModels,
      excludedModels: req.excludedModels,
      routingPriority: req.routingPriority,
    } as RoutingPreferences);

    const response = await executeWithRouting(req.input, model.id);

    enforceRequestCost(planTier, response.estimatedCost ?? 0);
    await recordUsage(req.userId, response.estimatedCost ?? 0);

    return response;
  }

  if (req.mode === "multi") {
    if (!req.roles) {
      throw new Error("Multi mode requires role models.");
    }

    console.log("[gateway] 🚀 EXECUTING MULTI-MODE with roles:", Object.keys(req.roles));

    let combined = "";
    let totalCost = 0;

    for (const role of Object.keys(req.roles)) {
      const modelId = (req.roles as any)[role];
      console.log(`[gateway] → Executing ${role} with model:`, modelId);

      const response = await executeWithRouting(
        `[${role.toUpperCase()}]\n${req.input}`,
        modelId
      );

      totalCost += response.estimatedCost ?? 0;

      combined += `\n\n=== ${role.toUpperCase()} ===\n`;
      combined += response.output;
    }

    enforceRequestCost(planTier, totalCost);
    await recordUsage(req.userId, totalCost);

    console.log("[gateway] ✅ Multi-mode complete. Total cost:", totalCost);

    return {
      output: combined.trim(),
      model: "multi",
      provider: "mixed",
      estimatedCost: totalCost,
    };
  }

  throw new Error("Invalid execution mode.");
}
