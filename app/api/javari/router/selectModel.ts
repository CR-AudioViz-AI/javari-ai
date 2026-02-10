import { IntentClassification, ModelSelection } from "./types";

export function selectModel(intent: IntentClassification): ModelSelection {
  // High-risk tasks always use best model
  if (intent.highRisk) {
    return {
      model: "anthropic:claude-3.5-sonnet",
      confidence: 0.95,
      reason: "High-risk query requires premium validation"
    };
  }

  // Complex reasoning tasks
  if (intent.requiresReasoning) {
    return {
      model: "openai:gpt-4o",
      confidence: 0.9,
      reason: "Complex reasoning task"
    };
  }

  // JSON formatting
  if (intent.jsonRequired) {
    return {
      model: "mistral:large",
      confidence: 0.85,
      reason: "Structured output required"
    };
  }

  // Low-cost preferred
  if (intent.lowCostPreferred) {
    return {
      model: "groq:llama-3-70b",
      confidence: 0.75,
      reason: "Simple query - cost optimization"
    };
  }

  // Default to balanced model
  return {
    model: "openai:gpt-4o",
    confidence: 0.8,
    reason: "Standard routing"
  };
}
