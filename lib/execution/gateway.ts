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

// Cost Guard: Maximum cost per request (in USD)
const MAX_REQUEST_COST = 0.50;

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
  // GLOBAL KILL SWITCH: Check if execution is enabled
  const executionEnabled = process.env.JAVARI_EXECUTION_ENABLED;
  console.log("[gateway] Kill switch check: JAVARI_EXECUTION_ENABLED =", executionEnabled);
  
  if (executionEnabled !== "true") {
    console.error("[gateway] ❌ EXECUTION BLOCKED: Kill switch is OFF");
    throw new Error("Javari execution is currently disabled.");
  }
  
  console.log("[gateway] ✓ Kill switch: ENABLED - proceeding with execution");
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

    // Cost Guard: Check if cost exceeds limit
    const estimatedCost = response.estimatedCost ?? 0;
    console.log("[gateway] Cost check: $", estimatedCost.toFixed(4), "/ $", MAX_REQUEST_COST);
    
    if (estimatedCost > MAX_REQUEST_COST) {
      throw new Error(`Request blocked: cost limit exceeded ($${estimatedCost.toFixed(2)} > $${MAX_REQUEST_COST})`);
    }

    enforceRequestCost(planTier, estimatedCost);
    await recordUsage(req.userId, estimatedCost);

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

      const roleCost = response.estimatedCost ?? 0;
      totalCost += roleCost;
      
      console.log(`[gateway] ${role} cost: $${roleCost.toFixed(4)} | Running total: $${totalCost.toFixed(4)}`);
      
      // Cost Guard: Check running total after each role
      if (totalCost > MAX_REQUEST_COST) {
        console.error("[gateway] ❌ COST LIMIT EXCEEDED during multi-mode execution");
        throw new Error(`Request blocked: cost limit exceeded ($${totalCost.toFixed(2)} > $${MAX_REQUEST_COST})`);
      }

      combined += `\n\n=== ${role.toUpperCase()} ===\n`;
      combined += response.output;
    }

    console.log("[gateway] ✅ Multi-mode complete. Total cost: $", totalCost.toFixed(4));
    console.log("[gateway] Cost guard check: $", totalCost.toFixed(4), "/ $", MAX_REQUEST_COST, "✓");

    enforceRequestCost(planTier, totalCost);
    await recordUsage(req.userId, totalCost);

    return {
      output: combined.trim(),
      model: "multi",
      provider: "mixed",
      estimatedCost: totalCost,
    };
  }

  throw new Error("Invalid execution mode.");
}
