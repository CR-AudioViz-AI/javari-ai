import { PlanTier } from "@/lib/billing/plans";
import { enforceRoadmapBudget } from "@/lib/billing/enforcement";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
import {
  selectBestModel,
  RoutingPreferences,
} from "@/lib/router/model-registry";
import { classifyCapability } from "@/lib/router/capability-classifier";
import { enforceRequestCost } from "@/lib/billing/profit-guard";
import { enforceMonthlyLimit, recordUsage } from "@/lib/billing/usage-meter";

export type ExecutionMode = "auto" | "multi";

export interface ExecutionRequest {
  input: string;
  mode: ExecutionMode;
  planTier: PlanTier;
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
  enforceRoadmapBudget(req.planTier, req.requestedBudget ?? 0);
  await enforceMonthlyLimit(req.userId, req.planTier);

  if (req.mode === "auto") {
    const capability = classifyCapability(req.input);

    const model = selectBestModel(capability, {
      allowedModels: req.allowedModels,
      excludedModels: req.excludedModels,
      routingPriority: req.routingPriority,
    } as RoutingPreferences);

    const response = await executeWithRouting(req.input, model.id);

    enforceRequestCost(req.planTier, response.estimatedCost ?? 0);
    await recordUsage(req.userId, response.estimatedCost ?? 0);

    return response;
  }

  if (req.mode === "multi") {
    if (!req.roles) throw new Error("Multi mode requires role models.");

    let combined = "";
    let totalCost = 0;

    for (const role of Object.keys(req.roles)) {
      const modelId = (req.roles as any)[role];

      const response = await executeWithRouting(
        `[${role.toUpperCase()}]\n${req.input}`,
        modelId
      );

      totalCost += response.estimatedCost ?? 0;

      combined += `\n\n=== ${role.toUpperCase()} ===\n`;
      combined += response.output;
    }

    enforceRequestCost(req.planTier, totalCost);
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
