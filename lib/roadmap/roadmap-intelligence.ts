/**
 * Javari Roadmap Intelligence Layer
 * Analyzes and enhances customer-provided roadmaps before execution
 */

import { executeGateway } from "@/lib/execution/gateway";
import { RoadmapItem } from "./roadmap-loader";

export interface EnhancedRoadmapResult {
  success: boolean;
  originalTasks: RoadmapItem[];
  addedTasks: RoadmapItem[];
  risks: string[];
  recommendations: string[];
  analysis?: string;
  estimatedCost?: number;
  error?: string;
}

/**
 * Enhance roadmap with AI intelligence
 * 
 * Multi-agent analysis:
 * - Architect: Analyzes roadmap completeness and depth
 * - Validator: Detects risks, gaps, and missing components
 * - Builder: Proposes additional tasks to fill gaps
 * - Documenter: Produces enhanced roadmap with recommendations
 */
export async function enhanceRoadmap(
  tasks: RoadmapItem[],
  userId: string = "roadmap-intelligence"
): Promise<EnhancedRoadmapResult> {
  console.log("[roadmap-intelligence] ====== ROADMAP ENHANCEMENT ======");
  console.log("[roadmap-intelligence] Analyzing", tasks.length, "tasks");

  if (tasks.length === 0) {
    return {
      success: false,
      originalTasks: [],
      addedTasks: [],
      risks: [],
      recommendations: [],
      error: "No tasks provided for analysis",
    };
  }

  try {
    // Format tasks for analysis
    const taskSummary = tasks.map((t, i) => 
      `${i + 1}. [${t.id}] ${t.title} (Priority: ${t.priority})\n   ${t.description}`
    ).join('\n\n');

    const analysisPrompt = `
ROADMAP INTELLIGENCE ANALYSIS

CUSTOMER-PROVIDED ROADMAP:
${taskSummary}

Total Tasks: ${tasks.length}

MULTI-AGENT ANALYSIS INSTRUCTIONS:

ARCHITECT:
- Analyze the roadmap for completeness and strategic depth
- Identify if the roadmap follows logical phases
- Check for proper dependency ordering
- Assess if scope is well-defined
- Rate overall roadmap quality (1-10)

VALIDATOR:
- Detect potential risks and blockers
- Identify missing critical components
- Check for security, testing, and deployment gaps
- Flag tasks that may be underspecified
- List specific risks with severity (high/medium/low)

BUILDER:
- Propose additional tasks to fill identified gaps
- Suggest missing infrastructure setup tasks
- Recommend testing and validation tasks
- Add deployment and monitoring tasks if missing
- Format new tasks as: {"id": "added-N", "title": "...", "description": "...", "priority": N}

DOCUMENTER:
- Produce comprehensive analysis report
- Summarize risks and recommendations
- Output enhanced roadmap with both original and added tasks
- Provide clear action items

OUTPUT FORMAT (REQUIRED):
Return a JSON object with this structure:
{
  "risks": ["Risk 1", "Risk 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "addedTasks": [
    {"id": "added-1", "title": "...", "description": "...", "priority": 8}
  ],
  "analysis": "Comprehensive analysis summary"
}

CRITICAL: Include the JSON object in your response.
    `.trim();

    console.log("[roadmap-intelligence] Sending to analysis team...");

    const analysisResponse = await executeGateway({
      input: analysisPrompt,
      mode: "multi",
      userId,
      roles: {
        architect: "gpt-4o",
        validator: "gpt-4o",
        builder: "claude-sonnet-4-20250514",
        documenter: "gpt-4o-mini",
      },
    });

    console.log("[roadmap-intelligence] ✅ Analysis complete");
    console.log("[roadmap-intelligence] Cost: $", (analysisResponse.estimatedCost ?? 0).toFixed(4));

    // Parse response
    const output = analysisResponse.output;
    console.log("[roadmap-intelligence] Parsing analysis results...");

    // Extract JSON from output
    const jsonMatch = output.match(/\{[\s\S]*"risks"[\s\S]*"recommendations"[\s\S]*\}/);
    
    let risks: string[] = [];
    let recommendations: string[] = [];
    let addedTasks: RoadmapItem[] = [];

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        risks = Array.isArray(parsed.risks) ? parsed.risks : [];
        recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
        
        if (Array.isArray(parsed.addedTasks)) {
          addedTasks = parsed.addedTasks.map((task: any, i: number) => ({
            id: task.id || `added-${i + 1}`,
            title: task.title || "Untitled task",
            description: task.description || "",
            priority: task.priority || 5,
          }));
        }
        
        console.log("[roadmap-intelligence] Parsed results:");
        console.log("  Risks:", risks.length);
        console.log("  Recommendations:", recommendations.length);
        console.log("  Added tasks:", addedTasks.length);
      } catch (parseError: any) {
        console.warn("[roadmap-intelligence] JSON parse failed, extracting manually:", parseError.message);
        
        // Fallback: Extract information from text
        const riskMatches = output.match(/risks?[:\s]+(.+?)(?=recommendations?|added|$)/is);
        const recMatches = output.match(/recommendations?[:\s]+(.+?)(?=added|risks?|$)/is);
        
        if (riskMatches) {
          risks = riskMatches[1]
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => line.replace(/^[-*•]\s*/, '').trim())
            .slice(0, 10);
        }
        
        if (recMatches) {
          recommendations = recMatches[1]
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => line.replace(/^[-*•]\s*/, '').trim())
            .slice(0, 10);
        }
      }
    }

    console.log("[roadmap-intelligence] ✅ Enhancement complete");

    return {
      success: true,
      originalTasks: tasks,
      addedTasks,
      risks,
      recommendations,
      analysis: output,
      estimatedCost: analysisResponse.estimatedCost,
    };
  } catch (error: any) {
    console.error("[roadmap-intelligence] ❌ Enhancement failed:", error.message);
    
    return {
      success: false,
      originalTasks: tasks,
      addedTasks: [],
      risks: [],
      recommendations: [],
      error: error.message,
    };
  }
}

/**
 * Quick validation check without full enhancement
 */
export async function validateRoadmap(tasks: RoadmapItem[]): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Basic validation checks
  if (tasks.length === 0) {
    issues.push("Roadmap is empty");
  }

  tasks.forEach((task, i) => {
    if (!task.id || task.id.trim().length === 0) {
      issues.push(`Task ${i + 1} missing ID`);
    }
    if (!task.title || task.title.trim().length === 0) {
      issues.push(`Task ${i + 1} missing title`);
    }
    if (!task.description || task.description.trim().length < 10) {
      issues.push(`Task ${i + 1} has insufficient description`);
    }
    if (task.priority < 1 || task.priority > 10) {
      issues.push(`Task ${i + 1} has invalid priority (${task.priority})`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}
