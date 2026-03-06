/**
 * Javari Strategic Planning Engine
 * Cost-tier routing with intelligent premium escalation
 */

import { executeGateway } from "@/lib/execution/gateway";
import { RoadmapItem, loadRoadmap } from "./roadmap-loader";

export interface StrategicPlanResult {
  success: boolean;
  tasks?: RoadmapItem[];
  analysis?: string;
  error?: string;
  estimatedCost?: number;
  plannerTier?: "cheap" | "premium";
  executionId?: string;
}

/**
 * Cost-tier model routing
 */
const PLANNER_MODELS = {
  cheap: {
    architect: "gpt-4o-mini",
    builder: "gpt-4o-mini",
    validator: "gpt-4o-mini",
    documenter: "gpt-4o-mini",
  },
  premium: {
    architect: "gpt-4o",
    builder: "claude-sonnet-4-20250514",
    validator: "gpt-4o",
    documenter: "gpt-4o-mini",
  },
};

/**
 * Assess if premium escalation is needed
 */
function shouldEscalateToPremium(
  validatorFailures: number,
  taskCount: number,
  riskLevel?: string
): boolean {
  // Escalate if validator failed twice
  if (validatorFailures >= 2) {
    console.log("[strategic-planner] 🔼 Escalating: Validator failures =", validatorFailures);
    return true;
  }
  
  // Escalate if dependency graph > 10 tasks
  if (taskCount > 10) {
    console.log("[strategic-planner] 🔼 Escalating: Task count =", taskCount);
    return true;
  }
  
  // Escalate if high risk
  if (riskLevel === "high") {
    console.log("[strategic-planner] 🔼 Escalating: Risk level = high");
    return true;
  }
  
  return false;
}

/**
 * Log planner telemetry
 */
async function logPlannerTelemetry(data: {
  executionId: string;
  plannerTier: "cheap" | "premium";
  modelUsed: string;
  tokensIn?: number;
  tokensOut?: number;
  cost: number;
}) {
  console.log("[strategic-planner] 📊 Telemetry:", {
    execution_id: data.executionId,
    planner_tier: data.plannerTier,
    model_used: data.modelUsed,
    tokens_in: data.tokensIn || 0,
    tokens_out: data.tokensOut || 0,
    cost: data.cost.toFixed(4),
  });
}

/**
 * Generate a comprehensive roadmap from a high-level goal
 */
export async function generateRoadmap(
  goal: string,
  userId: string = "strategic-planner",
  options?: {
    forceTier?: "cheap" | "premium";
    riskLevel?: "low" | "medium" | "high";
  }
): Promise<StrategicPlanResult> {
  const executionId = `exec-${Date.now()}`;
  console.log("[strategic-planner] ====== ROADMAP GENERATION ======");
  console.log("[strategic-planner] Execution ID:", executionId);
  console.log("[strategic-planner] Goal:", goal);

  let plannerTier: "cheap" | "premium" = options?.forceTier || "cheap";
  let validatorFailures = 0;

  console.log("[strategic-planner] Initial tier:", plannerTier);

  try {
    // Attempt with cheap tier first
    const models = PLANNER_MODELS[plannerTier];
    
    console.log("[strategic-planner] Using models:", {
      architect: models.architect,
      builder: models.builder,
      validator: models.validator,
      documenter: models.documenter,
    });

    const planningResponse = await executeGateway({
      input: goal,
      mode: "multi",
      userId,
      roles: {
        architect: models.architect,
        builder: models.builder,
        validator: models.validator,
        documenter: models.documenter,
      },
    }) as any;

    console.log("[strategic-planner] ✅ Planning complete");
    
    const estimatedCost = planningResponse.estimatedCost ?? 0;
    console.log("[strategic-planner] Cost: $", estimatedCost.toFixed(4));

    // Gateway returns validated tasks array directly
    const tasks = planningResponse.tasks;
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      console.error("[strategic-planner] ❌ No tasks returned from gateway");
      validatorFailures++;
      
      // Check if we should escalate
      if (plannerTier === "cheap" && shouldEscalateToPremium(validatorFailures, 0)) {
        console.log("[strategic-planner] 🔄 Retrying with premium tier...");
        return generateRoadmap(goal, userId, { forceTier: "premium", riskLevel: options?.riskLevel });
      }
      
      return {
        success: false,
        error: "Gateway did not return valid tasks array",
        plannerTier,
        executionId,
      };
    }

    console.log(`[strategic-planner] ✅ Received ${tasks.length} validated tasks`);

    // Check if escalation needed based on task count
    if (plannerTier === "cheap" && shouldEscalateToPremium(0, tasks.length, options?.riskLevel)) {
      console.log("[strategic-planner] 🔄 Re-planning with premium tier for complex roadmap...");
      return generateRoadmap(goal, userId, { forceTier: "premium", riskLevel: options?.riskLevel });
    }

    // Convert to RoadmapItem format
    const roadmapTasks: RoadmapItem[] = tasks.map((task: any, i: number) => ({
      id: `task-${Date.now()}-${i}`,
      title: task.title || "Untitled task",
      description: task.description || "",
      priority: task.priority === "high" ? 10 : task.priority === "medium" ? 5 : 3,
    }));

    console.log("[strategic-planner] ✅ Successfully generated", roadmapTasks.length, "tasks");

    // Log telemetry
    await logPlannerTelemetry({
      executionId,
      plannerTier,
      modelUsed: `${models.architect}|${models.builder}|${models.validator}|${models.documenter}`,
      tokensIn: planningResponse.usage?.prompt_tokens,
      tokensOut: planningResponse.usage?.completion_tokens,
      cost: estimatedCost,
    });

    return {
      success: true,
      tasks: roadmapTasks,
      analysis: `Generated ${roadmapTasks.length} tasks using ${plannerTier} tier`,
      estimatedCost,
      plannerTier,
      executionId,
    };
  } catch (error: any) {
    console.error("[strategic-planner] ❌ Planning failed:", error.message);
    
    // Check if we should escalate on error
    if (plannerTier === "cheap" && error.message.includes("failed to return valid")) {
      validatorFailures++;
      
      if (shouldEscalateToPremium(validatorFailures, 0)) {
        console.log("[strategic-planner] 🔄 Retrying with premium tier after failure...");
        return generateRoadmap(goal, userId, { forceTier: "premium", riskLevel: options?.riskLevel });
      }
    }
    
    return {
      success: false,
      error: error.message,
      plannerTier,
      executionId,
    };
  }
}

/**
 * Generate roadmap and optionally load into queue
 */
export async function generateAndQueueRoadmap(
  goal: string,
  autoQueue: boolean = false,
  userId: string = "strategic-planner"
): Promise<StrategicPlanResult & { tasksQueued?: number }> {
  console.log("[strategic-planner] Generate and queue:", { goal, autoQueue });

  const result = await generateRoadmap(goal, userId);

  if (!result.success || !result.tasks) {
    return result;
  }

  if (autoQueue && result.tasks.length > 0) {
    console.log("[strategic-planner] Auto-queueing", result.tasks.length, "tasks...");
    
    const loadResult = loadRoadmap(result.tasks);
    
    console.log("[strategic-planner] ✅ Queued", loadResult.tasksLoaded, "tasks");

    return {
      ...result,
      tasksQueued: loadResult.tasksLoaded,
    };
  }

  return result;
}
