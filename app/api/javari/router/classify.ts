import { IntentClassification, RouterInput } from "./types";

export async function classifyIntent(
  input: RouterInput
): Promise<IntentClassification> {
  const text = input.message.toLowerCase();

  return {
    requiresReasoning: text.includes("explain") || text.includes("why"),
    requiresValidation: text.includes("legal") || text.includes("contract"),
    jsonRequired: text.includes("json") || text.includes("schema"),
    highRisk: text.includes("finance") || text.includes("health"),
    lowCostPreferred: text.length < 80
  };
}
