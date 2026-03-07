// lib/execution/gateway.ts
// Purpose: Execution gateway with tiered cost limits for system vs user execution
// Date: 2026-03-06

import { enforceRoadmapBudget } from "@/lib/billing/enforcement";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
import {
  selectBestModel,
  RoutingPreferences,
  BUILDER_MODEL_ID,
  VALIDATOR_MODEL_ID,
} from "@/lib/router/model-registry";
import { classifyCapability } from "@/lib/router/capability-classifier";
import { enforceRequestCost } from "@/lib/billing/profit-guard";
import { enforceMonthlyLimit, recordUsage } from "@/lib/billing/usage-meter";
import { enforceModeEntitlement } from "@/lib/billing/entitlements";
import { getUserPlan } from "@/lib/billing/subscription-service";
import { PlanTier } from "@/lib/billing/plans";
import { logTelemetry } from "@/lib/telemetry/telemetry";

export type ExecutionMode = "auto" | "multi";

// Tier system: system tier for autonomous roadmap execution, user tiers for human requests
export type ExecutionTier = "system" | "pro" | "free";

const COST_LIMITS: Record<ExecutionTier, number> = {
  system: 10.00, // autonomous roadmap execution — elevated limit
  pro: 5.00,
  free: 1.00,
};

/**
 * Validate whether an estimated cost is within the allowed limit for a tier.
 * Used by autonomous queue workers before dispatching tasks.
 */
export function validateCost(
  estimatedCost: number,
  tier: ExecutionTier = "system"
): { allowed: boolean; reason?: string } {
  const limit = COST_LIMITS[tier];
  if (estimatedCost > limit) {
    return {
      allowed: false,
      reason: `Cost limit exceeded ($${estimatedCost.toFixed(4)} > $${limit.toFixed(2)}) for tier "${tier}"`,
    };
  }
  return { allowed: true };
}

/**
 * Resolve the execution tier for a request.
 * userId "system" (autonomous roadmap worker) always gets system tier.
 */
function resolveExecutionTier(userId: string, planTier: PlanTier): ExecutionTier {
  if (userId === "system") return "system";
  if (planTier === "pro" || planTier === "enterprise") return "pro";
  return "free";
}

const MAX_TOTAL_RETRIES = 4; // Global retry ceiling across all roles

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
function validateTaskResponse(obj: unknown): obj is RoleTaskResponse {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.tasks) || o.tasks.length === 0) {
    return false;
  }
  return (o.tasks as unknown[]).every((t: unknown) => {
    if (!t || typeof t !== "object") return false;
    const task = t as Record<string, unknown>;
    return (
      typeof task.title === "string" &&
      typeof task.description === "string" &&
      task.title.length > 0 &&
      task.description.length > 0
    );
  });
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

  const planTier = await getUserPlan(req.userId);
  const executionTier = resolveExecutionTier(req.userId, planTier);
  const MAX_REQUEST_COST = COST_LIMITS[executionTier];

  console.log("[gateway] Plan tier:", planTier, "| Execution tier:", executionTier, "| Cost limit: $" + MAX_REQUEST_COST.toFixed(2));

  // System-tier autonomous tasks skip user entitlement and monthly limit checks
  if (executionTier !== "system") {
    enforceModeEntitlement(planTier, req.mode);
    enforceRoadmapBudget(planTier, req.requestedBudget ?? 0);
    await enforceMonthlyLimit(req.userId, planTier);
  } else {
    console.log("[gateway] System tier: skipping user entitlement/monthly limit checks");
  }

  if (req.mode === "auto") {
    // Henderson Standard routing:
    // System-tier autonomous tasks → builder model (cheapest capable)
    // User requests with explicit quality requirement → validator model
    // Default user requests → auto-classify
    let builderModelId: string;
    if (req.userId === "system") {
      // Autonomous roadmap execution — cost-optimize with builder model
      builderModelId = BUILDER_MODEL_ID;
    } else {
      // Human-initiated request — auto-classify for quality
      builderModelId = VALIDATOR_MODEL_ID;
    }

    const capability = classifyCapability(req.input, "builder");
    const model = selectBestModel(capability, {
      allowedModels: req.allowedModels ?? [builderModelId],
      excludedModels: req.excludedModels,
      routingPriority: req.routingPriority ?? "cost",
    } as RoutingPreferences);

    const executionStart = Date.now();

    // 40s timeout: leaves 20s buffer before Vercel's 60s serverless hard limit.
    // Tasks that exceed this are retried — they won't be killed mid-write by Vercel.
    const AI_TIMEOUT_MS = 40_000;

    try {
      const responsePromise = executeWithRouting(req.input, model.id);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`AI_TIMEOUT: Model did not respond within ${AI_TIMEOUT_MS / 1000}s. Task will retry.`)), AI_TIMEOUT_MS)
      );
      const response = await Promise.race([responsePromise, timeoutPromise]);
      const latencyMs = Date.now() - executionStart;
      const estimatedCost = response.estimatedCost ?? 0;

      console.log("[gateway] Cost check: $", estimatedCost.toFixed(4), "/ $", MAX_REQUEST_COST.toFixed(2), "(tier:", executionTier + ")");

      const costCheck = validateCost(estimatedCost, executionTier);
      if (!costCheck.allowed) {
        throw new Error(`Request blocked: ${costCheck.reason}`);
      }

      if (executionTier !== "system") {
        enforceRequestCost(planTier, estimatedCost);
      }
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
      } catch (telemetryError: unknown) {
        console.warn("[gateway] Telemetry logging failed:", (telemetryError as Error).message);
      }

      return response;
    } catch (error: unknown) {
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
      } catch (telemetryError: unknown) {
        console.warn("[gateway] Telemetry logging failed:", (telemetryError as Error).message);
      }

      throw error;
    }
  }

  if (req.mode === "multi") {
    if (!req.roles) {
      throw new Error("Multi mode requires role models.");
    }

    const executionOrder = ["architect", "builder", "validator", "documenter"];
    const activeRoles = executionOrder.filter(role => (req.roles as Record<string, string | undefined>)[role]);

    console.log("[gateway] 🚀 MULTI-MODE:", activeRoles.length, "roles:", activeRoles);

    let totalCost = 0;
    let totalRetries = 0;
    const roleOutputs: Record<string, RoleTaskResponse> = {};
    const allTasks: TaskSchema[] = [];

    for (const role of activeRoles) {
      const modelId = (req.roles as Record<string, string>)[role];
      console.log(`[gateway] → ${role.toUpperCase()}: ${modelId}`);

      let prompt = `${req.input}\n\n${STRICT_JSON_SCHEMA}`;

      const roleStart = Date.now();
      let attempts = 0;
      let validResponse: RoleTaskResponse | null = null;

      while (attempts < 2 && !validResponse) {
        attempts++;

        if (totalRetries >= MAX_TOTAL_RETRIES) {
          console.error(`[gateway] ❌ RETRY CEILING EXCEEDED: ${totalRetries} total retries`);
          throw new Error(`Execution aborted: retry ceiling exceeded (${totalRetries}/${MAX_TOTAL_RETRIES})`);
        }

        if (attempts > 1) {
          totalRetries++;
          console.log(`[gateway] 🔄 Global retry count: ${totalRetries}/${MAX_TOTAL_RETRIES}`);
        }

        try {
          const response = await executeWithRouting(prompt, modelId, true);
          const roleLatency = Date.now() - roleStart;
          const roleCost = response.estimatedCost ?? 0;
          totalCost += roleCost;

          console.log(`[gateway] ${role} attempt ${attempts} - parsing response...`);

          let parsed: unknown = null;

          if (typeof response.output === "object") {
            parsed = response.output;
          } else if (typeof response.output === "string") {
            let cleaned = (response.output as string)
              .replace(/```json\s*/g, "")
              .replace(/```\s*/g, "")
              .trim();

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
          } catch (telemetryError: unknown) {
            console.warn("[gateway] Telemetry logging failed:", (telemetryError as Error).message);
          }
        } catch (error: unknown) {
          console.error(`[gateway] ${role} execution failed:`, (error as Error).message);

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

      console.log(`[gateway] ${role} complete | Cost: $${totalCost.toFixed(4)} | Retries: ${totalRetries}/${MAX_TOTAL_RETRIES}`);

      const costCheck = validateCost(totalCost, executionTier);
      if (!costCheck.allowed) {
        console.error("[gateway] ❌ COST LIMIT EXCEEDED");
        throw new Error(`Request blocked: ${costCheck.reason}`);
      }
    }

    console.log("[gateway] ✅ Multi-mode complete");
    console.log("[gateway] Total tasks collected:", allTasks.length);
    console.log("[gateway] Total cost: $", totalCost.toFixed(4));
    console.log("[gateway] Total retries used:", totalRetries, "/", MAX_TOTAL_RETRIES);

    if (executionTier !== "system") {
      enforceRequestCost(planTier, totalCost);
    }
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
