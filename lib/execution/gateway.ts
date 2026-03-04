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
  roles?: {
    architect?: string;
    builder?: string;
    tester?: string;
  };
}
export interface ExecutionResponse {
  output: string;
  model: string;
  provider: string;
  estimatedCost: number;
  usage?: any;
}
export async function executeGateway(
  req: ExecutionRequest
): Promise<ExecutionResponse> {
  // 1️⃣ Plan-based budget enforcement
  const allowedBudget = enforceRoadmapBudget(
    req.planTier,
    req.requestedBudget ?? 0
  );
  // 2️⃣ AUTO MODE
  if (req.mode === "auto") {
    const response = await executeWithRouting(req.input);
    return {
      output: response.output,
      model: response.model,
      provider: response.provider,
      estimatedCost: response.estimatedCost,
      usage: response.usage,
    };
  }
  // 3️⃣ MULTI MODE (explicit role selection)
  if (req.mode === "multi") {
    if (!req.roles || Object.keys(req.roles).length === 0) {
      throw new Error("Multi mode requires explicit role models.");
    }
    // For Phase 1: sequential execution
    let combinedOutput = "";
    let lastMeta: any = {};
    for (const role of Object.keys(req.roles)) {
      const modelId = (req.roles as any)[role];
      const response = await executeWithRouting(
        `[${role.toUpperCase()}]\n${req.input}`,
        modelId
      );
      combinedOutput += `\n\n=== ${role.toUpperCase()} ===\n`;
      combinedOutput += response.output;
      lastMeta = response;
    }
    return {
      output: combinedOutput.trim(),
      model: lastMeta.model,
      provider: lastMeta.provider,
      estimatedCost: lastMeta.estimatedCost,
      usage: lastMeta.usage,
    };
  }
  throw new Error("Invalid execution mode.");
}
