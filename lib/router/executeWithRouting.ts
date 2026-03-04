import { classifyCapability } from "./capability-classifier";
import { selectBestModel } from "./model-registry";
import { executeWithFailover } from "@/lib/ai/executeWithFailover";
export async function executeWithRouting(prompt: string) {
  // 1. Determine required capability
  const capability = classifyCapability(prompt);
  // 2. Select best model based on scoring
  const selectedModel = selectBestModel({
    requiredCapability: capability,
  });
  console.log("ROUTER DECISION:", {
    capability,
    model: selectedModel.id,
    provider: selectedModel.provider,
  });
  // 3. Execute using existing failover system
  // Pass provider hint via role param for now
  return executeWithFailover(prompt, selectedModel.provider);
}
