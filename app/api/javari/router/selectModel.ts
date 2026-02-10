import { IntentClassification, ModelSelection } from "./types";

export function selectModel(signal: IntentClassification): ModelSelection {
  if (signal.highRisk || signal.requiresValidation) {
    return {
      model: "anthropic:claude-3.5-sonnet",
      confidence: 0.98,
      reason: "High risk / validation required"
    };
  }

  if (signal.requiresReasoning) {
    return {
      model: "openai:o3",
      confidence: 0.91,
      reason: "Deep reasoning required"
    };
  }

  if (signal.jsonRequired) {
    return {
      model: "mistral:large",
      confidence: 0.85,
      reason: "JSON fidelity required"
    };
  }

  if (signal.lowCostPreferred) {
    return {
      model: "meta:llama-3-8b",
      confidence: 0.74,
      reason: "Low cost request"
    };
  }

  return {
    model: "openai:gpt-4o",
    confidence: 0.80,
    reason: "Default balanced model"
  };
}
