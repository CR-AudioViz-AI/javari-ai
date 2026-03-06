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

export interface TaskSchema {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "planning" | "engineering" | "validation" | "documentation";
  estimatedHours: number;
}

export interface RoleTaskResponse {
  tasks: TaskSchema[];
}

/**
 * Validate task response follows strict schema
 */
function validateTaskResponse(obj: any): obj is RoleTaskResponse {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    return false;
  }
  
  return obj.tasks.every((t: any) =>
    typeof t.title === "string" &&
    typeof t.description === "string" &&
    t.title.length > 0 &&
    t.description.length > 0
  );
}

/**
 * Strict JSON task schema template
 */
const STRICT_JSON_SCHEMA = `
RETURN FORMAT (MANDATORY):
Return ONLY valid JSON using this exact schema:

{
  "tasks": [
    {
      "title": "Clear task name",
      "description": "Detailed task description",
      "priority": "high|medium|low",
      "category": "planning|engineering|validation|documentation",
      "estimatedHours": 1
    }
  ]
}

CRITICAL RULES:
- Return ONLY the JSON object above
- NO markdown formatting
- NO code fences (\`\`\`json)
- NO explanations before or after
- NO text outside the JSON
- Must include at least one task
- Each task must have all required fields

INVALID EXAMPLES:
❌ Here is the JSON: {...}
❌ \`\`\`json {...} \`\`\`
❌ The roadmap includes: {...}

VALID EXAMPLE:
✅ {"tasks":[{"title":"Market Research","description":"Conduct market analysis","priority":"high","category":"planning","estimatedHours":8}]}
`.trim();

export async function executeGateway(req: ExecutionRequest) {
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
    const roleOutputs: Record<string, RoleTaskResponse> = {};
    const allTasks: TaskSchema[] = [];

    for (const role of activeRoles) {
      const modelId = (req.roles as any)[role];
      console.log(`[gateway] → ${role.toUpperCase()}: ${modelId}`);

      // Build strict JSON prompt for role
      let prompt = `${req.input}\n\n${STRICT_JSON_SCHEMA}`;
      
      const roleStart = Date.now();
      let attempts = 0;
      let validResponse: RoleTaskResponse | null = null;

      // Try up to 2 times to get valid JSON
      while (attempts < 2 && !validResponse) {
        attempts++;
        
        try {
          const response = await executeWithRouting(prompt, modelId, true);
          const roleLatency = Date.now() - roleStart;
          const roleCost = response.estimatedCost ?? 0;
          totalCost += roleCost;
          
          console.log(`[gateway] ${role} attempt ${attempts} - parsing response...`);
          
          // Try to parse the response
          let parsed: any = null;
          
          if (typeof response.output === "object") {
            parsed = response.output;
          } else if (typeof response.output === "string") {
            // Clean up common issues
            let cleaned = response.output
              .replace(/```json\s*/g, "")
              .replace(/```\s*/g, "")
              .trim();
            
            // Extract JSON if wrapped in text
            const jsonMatch = cleaned.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
            if (jsonMatch) {
              cleaned = jsonMatch[0];
            }
            
            try {
              parsed = JSON.parse(cleaned);
            } catch (e) {
              console.error(`[gateway] ${role} JSON parse failed:`, e);
            }
          }
          
          // Validate schema
          if (validateTaskResponse(parsed)) {
            validResponse = parsed;
            console.log(`[gateway] ✅ ${role} returned valid schema with ${parsed.tasks.length} tasks`);
          } else {
            console.warn(`[gateway] ⚠️ ${role} response failed validation`);
            
            if (attempts < 2) {
              console.log(`[gateway] Retrying ${role} with schema enforcement...`);
              prompt = `Your previous response did not follow the required JSON schema.\n\n${STRICT_JSON_SCHEMA}\n\nReturn ONLY the required JSON. No other text.`;
            }
          }
          
          try {
            await logTelemetry({
              taskId: req.taskId,
              model: modelId,
              provider: response.provider || "unknown",
              tokensUsed: response.usage?.total_tokens || 0,
              latencyMs: roleLatency,
              cost: roleCost,
              success: validResponse !== null,
            });
          } catch (telemetryError: any) {
            console.warn("[gateway] Telemetry logging failed:", telemetryError.message);
          }
          
        } catch (error: any) {
          console.error(`[gateway] ${role} execution failed:`, error.message);
          
          if (attempts >= 2) {
            throw error;
          }
        }
      }
      
      if (!validResponse) {
        throw new Error(`${role} failed to return valid task schema after ${attempts} attempts`);
      }
      
      roleOutputs[role] = validResponse;
      allTasks.push(...validResponse.tasks);
      
      console.log(`[gateway] ${role} cost: $${(totalCost - (roleOutputs[role] ? 0 : totalCost)).toFixed(4)} | Total: $${totalCost.toFixed(4)}`);
      
      if (totalCost > MAX_REQUEST_COST) {
        console.error("[gateway] ❌ COST LIMIT EXCEEDED");
        throw new Error(`Request blocked: cost limit exceeded ($${totalCost.toFixed(2)} > $${MAX_REQUEST_COST})`);
      }
    }

    console.log("[gateway] ✅ Multi-mode complete");
    console.log("[gateway] Total tasks collected:", allTasks.length);
    console.log("[gateway] Total cost: $", totalCost.toFixed(4));

    enforceRequestCost(planTier, totalCost);
    await recordUsage(req.userId, totalCost);

    return {
      roles: roleOutputs,
      tasks: allTasks,
      model: "multi",
      provider: "mixed",
      estimatedCost: totalCost,
      rolesExecuted: activeRoles,
    };
  }

  throw new Error("Invalid execution mode.");
}
