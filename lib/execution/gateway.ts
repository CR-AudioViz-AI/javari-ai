import { PlanTier } from "@/lib/billing/plans";
import { enforceRoadmapBudget } from "@/lib/billing/enforcement";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
import { selectBestModel } from "@/lib/router/model-registry";

export type ExecutionMode = "auto" | "multi";

export interface ExecutionRequest {
  input: string;
  mode: ExecutionMode;
  planTier: PlanTier;
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

  if (req.mode === "auto") {
    const model = selectBestModel("standard", {
      allowedModels: req.allowedModels,
      excludedModels: req.excludedModels,
      routingPriority: req.routingPriority,
    });

    const response = await executeWithRouting(req.input, model.id);

    return response;
  }

  if (req.mode === "multi") {
    if (!req.roles) throw new Error("Multi mode requires role models.");

    let combined = "";

    for (const role of Object.keys(req.roles)) {
      const modelId = (req.roles as any)[role];

      const response = await executeWithRouting(
        `[${role.toUpperCase()}]\n${req.input}`,
        modelId
      );

      combined += `\n\n=== ${role.toUpperCase()} ===\n`;
      combined += response.output;
    }

    return {
      output: combined.trim(),
      model: "multi",
      provider: "mixed",
      estimatedCost: 0,
    };
  }

  throw new Error("Invalid execution mode.");
}
