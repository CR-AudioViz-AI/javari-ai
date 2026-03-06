import { classifyCapability } from "./capability-classifier";
import { selectBestModel, MODEL_REGISTRY } from "./model-registry";
import { executeWithFailover } from "@/lib/ai/executeWithFailover";

function normalizeResponseContent(content: any): any {
  if (typeof content !== "string") {
    return content;
  }

  try {
    let cleaned = content
      .replace(/\\n/g, "")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();

    if (cleaned.startsWith("[") || cleaned.startsWith("{")) {
      console.log("[executeWithRouting] Attempting to parse JSON response...");
      const parsed = JSON.parse(cleaned);
      console.log("[executeWithRouting] ✅ Successfully parsed JSON response");
      return parsed;
    }

    return cleaned;
  } catch (error) {
    console.log("[executeWithRouting] Could not parse as JSON, returning as string");
    return content;
  }
}

export async function executeWithRouting(
  prompt: string, 
  modelId?: string,
  enforceJSON: boolean = false
) {
  console.log("[executeWithRouting] Prompt length:", prompt.length, "| Model:", modelId, "| JSON mode:", enforceJSON);
  
  let selectedModel;
  
  if (modelId) {
    selectedModel = MODEL_REGISTRY.find(m => m.id === modelId);
    
    if (!selectedModel) {
      console.warn("[executeWithRouting] Model not found:", modelId, "- using fallback");
      selectedModel = MODEL_REGISTRY.find(m => m.id === "gpt-4o-mini") || MODEL_REGISTRY[0];
    }
    
    console.log("[executeWithRouting] Using specified model:", selectedModel.id);
  } else {
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
    jsonMode: enforceJSON,
  });
  
  try {
    const result = await executeWithFailover(prompt, selectedModel.provider, enforceJSON);
    
    const rawOutput =
      typeof result === "string"
        ? result
        : result?.output ?? JSON.stringify(result);
    
    console.log("[executeWithRouting] Raw output type:", typeof rawOutput);
    
    const normalizedOutput = normalizeResponseContent(rawOutput);
    
    console.log("[executeWithRouting] Normalized output type:", typeof normalizedOutput);
    
    const usage = result?.usage ?? { total_tokens: 0 };
    const estimatedCost =
      (usage.total_tokens / 1000) * selectedModel.costPer1k;
    
    return {
      output: normalizedOutput,
      model: selectedModel.id,
      provider: selectedModel.provider,
      usage,
      estimatedCost,
    };
  } catch (error: any) {
    console.error("[executeWithRouting] Execution failed:", error.message);
    
    return {
      output: `Error executing with ${selectedModel.id}: ${error.message}`,
      model: selectedModel.id,
      provider: selectedModel.provider,
      usage: { total_tokens: 0 },
      estimatedCost: 0,
    };
  }
}
