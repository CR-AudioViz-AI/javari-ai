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
import { logTelemetry } from "@/lib/telemetry/telemetry";

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
  taskId?: string;
}

export interface StructuredMultiAgentResponse {
  output: string; // Legacy combined text for backwards compatibility
  roles: Record<string, any>; // Structured role outputs
  model: string;
  provider: string;
  estimatedCost: number;
  rolesExecuted: string[];
}

export async function executeGateway(req: ExecutionRequest) {
  // GLOBAL KILL SWITCH
  const executionEnabled = process.env.JAVARI_EXECUTION_ENABLED;
  console.log("[gateway] Kill switch check: JAVARI_EXECUTION_ENABLED =", executionEnabled);
  
  if (executionEnabled !== "true") {
    console.error("[gateway] ❌ EXECUTION BLOCKED: Kill switch is OFF");
    throw new Error("Javari execution is currently disabled.");
  }
  
  console.log("[gateway] ✓ Kill switch: ENABLED");
  console.log("[gateway] ====== REQUEST START ======");
  console.log("[gateway] userId:", req.userId, "| mode:", req.mode);

  let planTier = await getUserPlan(req.userId);
  console.log("[gateway] Plan tier:", planTier);

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

    const executionStart = Date.now();

    try {
      const response = await executeWithRouting(req.input, model.id);
      const latencyMs = Date.now() - executionStart;
      const estimatedCost = response.estimatedCost ?? 0;

      console.log("[gateway] Cost check: $", estimatedCost.toFixed(4), "/ $", MAX_REQUEST_COST);
      
      if (estimatedCost > MAX_REQUEST_COST) {
        throw new Error(`Request blocked: cost limit exceeded ($${estimatedCost.toFixed(2)} > $${MAX_REQUEST_COST})`);
      }

      enforceRequestCost(planTier, estimatedCost);
      await recordUsage(req.userId, estimatedCost);

      try {
        await logTelemetry({
          taskId: req.taskId,
          model: model.id,
          provider: model.provider,
          tokensUsed: response.usage?.total_tokens || 0,
          latencyMs,
          cost: estimatedCost,
          success: true,
        });
      } catch (telemetryError: any) {
        console.warn("[gateway] Telemetry logging failed:", telemetryError.message);
      }

      return response;
    } catch (error: any) {
      const latencyMs = Date.now() - executionStart;

      try {
        await logTelemetry({
          taskId: req.taskId,
          model: model.id,
          provider: model.provider,
          tokensUsed: 0,
          latencyMs,
          cost: 0,
          success: false,
        });
      } catch (telemetryError: any) {
        console.warn("[gateway] Telemetry logging failed:", telemetryError.message);
      }

      throw error;
    }
  }

  if (req.mode === "multi") {
    if (!req.roles) {
      throw new Error("Multi mode requires role models.");
    }

    const executionOrder = ["architect", "builder", "validator", "documenter"];
    const activeRoles = executionOrder.filter(role => (req.roles as any)[role]);
    
    console.log("[gateway] 🚀 MULTI-MODE:", activeRoles.length, "roles:", activeRoles);

    let totalCost = 0;
    const roleOutputs: Record<string, any> = {};
    const legacyTextParts: string[] = []; // For backwards compatibility

    for (const role of activeRoles) {
      const modelId = (req.roles as any)[role];
      console.log(`[gateway] → ${role.toUpperCase()}: ${modelId}`);

      // Build context-aware prompt
      let prompt = "";
      
      if (role === "architect") {
        prompt = `[ARCHITECT ROLE]\nYou are the system architect. Analyze and create a comprehensive plan.\n\nRequest: ${req.input}`;
      } else if (role === "builder") {
        const architectOutput = roleOutputs["architect"];
        const context = architectOutput ? `\nArchitect's Plan:\n${JSON.stringify(architectOutput, null, 2)}\n` : "";
        prompt = `[BUILDER ROLE]\nYou are the implementation builder. Create the solution.\n${context}\nRequest: ${req.input}`;
      } else if (role === "validator") {
        const builderOutput = roleOutputs["builder"];
        const context = builderOutput ? `\nImplementation:\n${JSON.stringify(builderOutput, null, 2)}\n` : "";
        prompt = `[VALIDATOR ROLE]\nYou are the quality validator. Review for correctness and completeness.\n${context}\nRequest: ${req.input}`;
      } else if (role === "documenter") {
        const architectOutput = roleOutputs["architect"];
        const builderOutput = roleOutputs["builder"];
        const validatorOutput = roleOutputs["validator"];
        let context = "";
        if (architectOutput) context += `\nPlan:\n${JSON.stringify(architectOutput, null, 2)}\n`;
        if (builderOutput) context += `\nImplementation:\n${JSON.stringify(builderOutput, null, 2)}\n`;
        if (validatorOutput) context += `\nValidation:\n${JSON.stringify(validatorOutput, null, 2)}\n`;
        prompt = `[DOCUMENTER ROLE]\nYou are the technical documenter. Create clear, comprehensive documentation.\n${context}\nRequest: ${req.input}`;
      } else {
        prompt = `[${role.toUpperCase()} ROLE]\n${req.input}`;
      }

      const roleStart = Date.now();

      try {
        const response = await executeWithRouting(prompt, modelId);
        const roleLatency = Date.now() - roleStart;
        const roleCost = response.estimatedCost ?? 0;
        totalCost += roleCost;
        
        // Store structured output (router now returns parsed JSON when possible)
        roleOutputs[role] = response.output;
        
        // Also build legacy text format for backwards compatibility
        legacyTextParts.push(`=== ${role.toUpperCase()} ===\n${typeof response.output === 'string' ? response.output : JSON.stringify(response.output)}`);
        
        console.log(`[gateway] ${role} cost: $${roleCost.toFixed(4)} | Total: $${totalCost.toFixed(4)}`);
        
        if (totalCost > MAX_REQUEST_COST) {
          console.error("[gateway] ❌ COST LIMIT EXCEEDED");
          throw new Error(`Request blocked: cost limit exceeded ($${totalCost.toFixed(2)} > $${MAX_REQUEST_COST})`);
        }

        try {
          await logTelemetry({
            taskId: req.taskId,
            model: modelId,
            provider: response.provider || "unknown",
            tokensUsed: response.usage?.total_tokens || 0,
            latencyMs: roleLatency,
            cost: roleCost,
            success: true,
          });
        } catch (telemetryError: any) {
          console.warn("[gateway] Telemetry logging failed:", telemetryError.message);
        }
      } catch (error: any) {
        const roleLatency = Date.now() - roleStart;

        try {
          await logTelemetry({
            taskId: req.taskId,
            model: modelId,
            provider: "unknown",
            tokensUsed: 0,
            latencyMs: roleLatency,
            cost: 0,
            success: false,
          });
        } catch (telemetryError: any) {
          console.warn("[gateway] Telemetry logging failed:", telemetryError.message);
        }

        throw error;
      }
    }

    console.log("[gateway] ✅ Multi-mode complete");
    console.log("[gateway] Total cost: $", totalCost.toFixed(4));

    enforceRequestCost(planTier, totalCost);
    await recordUsage(req.userId, totalCost);

    // Return BOTH structured and legacy format
    return {
      output: legacyTextParts.join("\n\n"), // Legacy: combined text
      roles: roleOutputs, // NEW: structured role outputs
      model: "multi",
      provider: "mixed",
      estimatedCost: totalCost,
      rolesExecuted: activeRoles,
    };
  }

  throw new Error("Invalid execution mode.");
}
