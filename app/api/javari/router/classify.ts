import { IntentClassification, RouterInput } from "./types";

export async function classifyIntent(input: RouterInput): Promise<IntentClassification> {
  const msg = input.message.toLowerCase();
  
  const requiresReasoning = 
    msg.includes("why") || 
    msg.includes("explain") || 
    msg.includes("how") ||
    msg.includes("compare") ||
    msg.includes("analyze");
  
  const requiresValidation = 
    requiresReasoning || 
    msg.includes("important") || 
    msg.includes("critical") ||
    msg.includes("verify");
  
  const jsonRequired = 
    msg.includes("json") || 
    msg.includes("structured") ||
    msg.includes("format") ||
    msg.includes("table");
  
  const highRisk = 
    msg.includes("legal") || 
    msg.includes("medical") ||
    msg.includes("financial") ||
    msg.includes("security");
  
  const lowCostPreferred = 
    msg.length < 50 && 
    !requiresReasoning && 
    !highRisk;

  return {
    requiresReasoning,
    requiresValidation,
    jsonRequired,
    highRisk,
    lowCostPreferred
  };
}
