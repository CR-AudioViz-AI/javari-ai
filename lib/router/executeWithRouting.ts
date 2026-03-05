import { classifyCapability } from "./capability-classifier";
import { selectBestModel, MODEL_REGISTRY } from "./model-registry";
import { executeWithFailover } from "@/lib/ai/executeWithFailover";

export async function executeWithRouting(prompt: string, modelId?: string) {
  console.log("[executeWithRouting] Prompt length:", prompt.length, "| Requested modelId:", modelId);
  
  let selectedModel;
  
  if (modelId) {
    // Use specified model
    selectedModel = MODEL_REGISTRY.find(m => m.id === modelId);
    
    if (!selectedModel) {
      console.warn("[executeWithRouting] Model not found:", modelId, "- using fallback");
      // Fallback to gpt-4o-mini
      selectedModel = MODEL_REGISTRY.find(m => m.id === "gpt-4o-mini") || MODEL_REGISTRY[0];
    }
    
    console.log("[executeWithRouting] Using specified model:", selectedModel.id);
  } else {
    // Auto-select based on capability
    const capability = classifyCapability(prompt);
    selectedModel = selectBestModel({
      requiredCapability: capability,
    });
    
    console.log("[executeWithRouting] Auto-selected model:", selectedModel.id, "for capability:", capability);
  }
  
  console.log("ROUTER DECISION:", {
    requestedModel: modelId || "auto",
    selectedModel: selectedModel.id,
    provider: selectedModel.provider,
  });
  
  try {
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
  } catch (error: any) {
    console.error("[executeWithRouting] Execution failed:", error.message);
    
    // Return error as output
    return {
      output: `Error executing with ${selectedModel.id}: ${error.message}`,
      model: selectedModel.id,
      provider: selectedModel.provider,
      usage: { total_tokens: 0 },
      estimatedCost: 0,
    };
  }
}
