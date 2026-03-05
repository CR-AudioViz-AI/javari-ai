import { classifyCapability } from "./capability-classifier";
import { selectBestModel, MODEL_REGISTRY } from "./model-registry";
import { executeWithFailover } from "@/lib/ai/executeWithFailover";

/**
 * Normalize AI response content to clean JSON when possible
 * Handles escaped JSON strings that break downstream parsers
 */
function normalizeResponseContent(content: any): any {
  // If not a string, return as-is
  if (typeof content !== "string") {
    return content;
  }

  try {
    // Remove common escape patterns
    let cleaned = content
      .replace(/\\n/g, "")           // Remove \n escapes
      .replace(/\\"/g, '"')          // Replace \" with "
      .replace(/\\\\/g, "\\")        // Replace \\ with \
      .trim();

    // If it looks like JSON, try to parse it
    if (cleaned.startsWith("[") || cleaned.startsWith("{")) {
      console.log("[executeWithRouting] Attempting to parse JSON response...");
      const parsed = JSON.parse(cleaned);
      console.log("[executeWithRouting] ✅ Successfully parsed JSON response");
      return parsed;
    }

    // Return cleaned string
    return cleaned;
  } catch (error) {
    // If parsing fails, return original content
    console.log("[executeWithRouting] Could not parse as JSON, returning as string");
    return content;
  }
}

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
    
    // Extract raw output
    const rawOutput =
      typeof result === "string"
        ? result
        : result?.output ?? JSON.stringify(result);
    
    console.log("[executeWithRouting] Raw output type:", typeof rawOutput);
    console.log("[executeWithRouting] Raw output preview:", String(rawOutput).substring(0, 200));
    
    // Normalize the output (will parse JSON if possible)
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
