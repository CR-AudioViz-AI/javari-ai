import { classifyCapability } from "./capability-classifier";
import { selectBestModel } from "./model-registry";
import { executeWithFailover } from "@/lib/ai/executeWithFailover";
export async function executeWithRouting(prompt: string) {
  const capability = classifyCapability(prompt);
  const selectedModel = selectBestModel({
    requiredCapability: capability,
  });
  console.log("ROUTER DECISION:", {
    capability,
    model: selectedModel.id,
    provider: selectedModel.provider,
  });
  const result = await executeWithFailover(prompt, selectedModel.provider);
  // Normalize response shape
  const output =
    typeof result === "string"
      ? result
      : result?.output ?? JSON.stringify(result);
  const usage = result?.usage ?? { total_tokens: 0 };
  const estimatedCost =
    (usage.total_tokens / 1000) * selectedModel.costPer1k;
  return {
    output,
    model: selectedModel.id,
    provider: selectedModel.provider,
    usage,
    estimatedCost,
  };
}
