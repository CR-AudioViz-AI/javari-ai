/**
 * Javari Adaptive Model Routing Intelligence
 * Automatically selects optimal models based on telemetry data
 */

import { getTelemetryStats } from "@/lib/telemetry/telemetry";
import { MODEL_REGISTRY, ModelDefinition } from "@/lib/router/model-registry";

export interface ModelScore {
  model: string;
  provider: string;
  score: number;
  successRate: number;
  avgLatency: number;
  avgCost: number;
  executions: number;
}

export type TaskType = "planning" | "implementation" | "validation" | "documentation" | "general";
export type RoleType = "architect" | "builder" | "validator" | "documenter";

// Scoring weights
const WEIGHTS = {
  successRate: 0.5,
  latency: 0.3,
  cost: 0.2,
};

// Minimum executions required for statistical significance
const MIN_EXECUTIONS = 10;

/**
 * Calculate performance score for a model
 * 
 * Score formula:
 * score = (successRate * 0.5) + (1 / latency * 0.3) + (1 / cost * 0.2)
 * 
 * Higher is better
 */
function calculateScore(
  successRate: number,
  avgLatency: number,
  avgCost: number
): number {
  // Normalize latency (lower is better, typical range 1000-5000ms)
  const normalizedLatency = avgLatency > 0 
    ? Math.min(1, 3000 / avgLatency) 
    : 0;

  // Normalize cost (lower is better, typical range $0.001-$0.05)
  const normalizedCost = avgCost > 0 
    ? Math.min(1, 0.01 / avgCost) 
    : 0;

  // Normalize success rate (already 0-100)
  const normalizedSuccess = successRate / 100;

  const score = 
    (normalizedSuccess * WEIGHTS.successRate) +
    (normalizedLatency * WEIGHTS.latency) +
    (normalizedCost * WEIGHTS.cost);

  return score;
}

/**
 * Get model performance rankings
 */
export async function getModelRankings(): Promise<ModelScore[]> {
  console.log("[model-intelligence] Calculating model rankings...");

  const stats = await getTelemetryStats();

  if (!stats || stats.totalExecutions === 0) {
    console.log("[model-intelligence] No telemetry data available");
    return [];
  }

  const rankings: ModelScore[] = [];

  for (const modelData of stats.modelBreakdown) {
    // Skip models with insufficient data
    if (modelData.executions < MIN_EXECUTIONS) {
      console.log(`[model-intelligence] Skipping ${modelData.model} - insufficient data (${modelData.executions} < ${MIN_EXECUTIONS})`);
      continue;
    }

    const avgCost = modelData.totalCost / modelData.executions;
    
    // Get average latency from full telemetry (simplified - in production would query database)
    const avgLatency = 2500; // Placeholder - would come from telemetry

    const score = calculateScore(
      modelData.successRate,
      avgLatency,
      avgCost
    );

    // Find provider from registry
    const registryEntry = MODEL_REGISTRY.find(m => m.id === modelData.model);
    const provider = registryEntry?.provider || "unknown";

    rankings.push({
      model: modelData.model,
      provider,
      score,
      successRate: modelData.successRate,
      avgLatency,
      avgCost,
      executions: modelData.executions,
    });
  }

  // Sort by score (highest first)
  rankings.sort((a, b) => b.score - a.score);

  console.log("[model-intelligence] Rankings calculated for", rankings.length, "models");
  
  return rankings;
}

/**
 * Select optimal model for a specific role/task
 * 
 * Falls back to default models if insufficient telemetry data
 */
export async function selectOptimalModel(
  role: RoleType,
  taskType: TaskType = "general"
): Promise<string> {
  console.log(`[model-intelligence] Selecting optimal model for role=${role}, taskType=${taskType}`);

  const rankings = await getModelRankings();

  // If we have sufficient data, use top-ranked model
  if (rankings.length > 0) {
    const optimal = rankings[0];
    console.log(`[model-intelligence] Selected ${optimal.model} (score: ${optimal.score.toFixed(3)})`);
    return optimal.model;
  }

  // Fallback to default models based on role
  const defaultModels: Record<RoleType, string> = {
    architect: "gpt-4o",
    builder: "claude-sonnet-4-20250514",
    validator: "gpt-4o",
    documenter: "gpt-4o-mini",
  };

  const fallback = defaultModels[role];
  console.log(`[model-intelligence] No telemetry data - using fallback: ${fallback}`);
  
  return fallback;
}

/**
 * Get recommended model for a capability level
 */
export async function selectOptimalModelByCapability(
  capability: "light" | "standard" | "high"
): Promise<string> {
  console.log(`[model-intelligence] Selecting optimal model for capability=${capability}`);

  const rankings = await getModelRankings();

  if (rankings.length === 0) {
    // Fallback defaults
    const defaults = {
      light: "gpt-4o-mini",
      standard: "gpt-4o-mini",
      high: "gpt-4o",
    };
    return defaults[capability];
  }

  // Filter models by capability from registry
  const capableModels = rankings.filter(r => {
    const registryEntry = MODEL_REGISTRY.find(m => m.id === r.model);
    if (!registryEntry) return false;
    
    // Match or exceed required capability
    const capabilityRank = { light: 1, standard: 2, high: 3 };
    const requiredRank = capabilityRank[capability];
    const modelRank = capabilityRank[registryEntry.capability];
    
    return modelRank >= requiredRank;
  });

  if (capableModels.length > 0) {
    const optimal = capableModels[0];
    console.log(`[model-intelligence] Selected ${optimal.model} for ${capability} capability`);
    return optimal.model;
  }

  // Final fallback
  return rankings[0].model;
}
