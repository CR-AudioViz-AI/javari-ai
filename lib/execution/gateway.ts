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
    validator?: string;
    documenter?: string;
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

    // Define execution order for 4-role multi-agent system
    const executionOrder = ["architect", "builder", "validator", "documenter"];
    const activeRoles = executionOrder.filter(role => (req.roles as any)[role]);
    
    console.log("[gateway] 🚀 EXECUTING MULTI-MODE with", activeRoles.length, "roles:", activeRoles);

    let combined = "";
    let totalCost = 0;
    const roleOutputs: Record<string, string> = {};

    // Execute roles sequentially in defined order
    for (const role of activeRoles) {
      const modelId = (req.roles as any)[role];
      console.log(`[gateway] → Executing ${role.toUpperCase()} with model:`, modelId);

      // Build context-aware prompt based on previous role outputs
      let prompt = "";
      
      if (role === "architect") {
        // Architect: Plan and design
        prompt = `[ARCHITECT ROLE]\nYou are the system architect. Analyze the request and create a comprehensive plan.\n\nRequest: ${req.input}`;
      } else if (role === "builder") {
        // Builder: Implementation based on architect's plan
        const architectOutput = roleOutputs["architect"] || "";
        prompt = `[BUILDER ROLE]\nYou are the implementation builder. Create the solution based on the architect's plan.\n\n${architectOutput ? `Architect's Plan:\n${architectOutput}\n\n` : ""}Request: ${req.input}`;
      } else if (role === "validator") {
        // Validator: Verify builder's work
        const builderOutput = roleOutputs["builder"] || "";
        prompt = `[VALIDATOR ROLE]\nYou are the quality validator. Review the implementation for correctness, completeness, and best practices.\n\n${builderOutput ? `Implementation:\n${builderOutput}\n\n` : ""}Request: ${req.input}`;
      } else if (role === "documenter") {
        // Documenter: Synthesize and document
        const architectOutput = roleOutputs["architect"] || "";
        const builderOutput = roleOutputs["builder"] || "";
        const validatorOutput = roleOutputs["validator"] || "";
        prompt = `[DOCUMENTER ROLE]\nYou are the technical documenter. Create clear, comprehensive documentation of the complete solution.\n\n${architectOutput ? `Plan:\n${architectOutput}\n\n` : ""}${builderOutput ? `Implementation:\n${builderOutput}\n\n` : ""}${validatorOutput ? `Validation:\n${validatorOutput}\n\n` : ""}Request: ${req.input}`;
      } else {
        // Generic prompt for any other roles
        prompt = `[${role.toUpperCase()} ROLE]\n${req.input}`;
      }

      const response = await executeWithRouting(prompt, modelId);

      const roleCost = response.estimatedCost ?? 0;
      totalCost += roleCost;
      
      // Store output for subsequent roles
      roleOutputs[role] = response.output;
      
      console.log(`[gateway] ${role} cost: $${roleCost.toFixed(4)} | Running total: $${totalCost.toFixed(4)}`);
      
      // Cost Guard: Check running total after each role
      if (totalCost > MAX_REQUEST_COST) {
        console.error("[gateway] ❌ COST LIMIT EXCEEDED during multi-mode execution");
        throw new Error(`Request blocked: cost limit exceeded ($${totalCost.toFixed(2)} > $${MAX_REQUEST_COST})`);
      }

      combined += `\n\n=== ${role.toUpperCase()} ===\n`;
      combined += response.output;
    }

    console.log("[gateway] ✅ Multi-mode complete with", activeRoles.length, "roles");
    console.log("[gateway] Total cost: $", totalCost.toFixed(4));
    console.log("[gateway] Cost guard check: $", totalCost.toFixed(4), "/ $", MAX_REQUEST_COST, "✓");

    enforceRequestCost(planTier, totalCost);
    await recordUsage(req.userId, totalCost);

    return {
      output: combined.trim(),
      model: "multi",
      provider: "mixed",
      estimatedCost: totalCost,
      rolesExecuted: activeRoles,
    };
  }

  throw new Error("Invalid execution mode.");
}
