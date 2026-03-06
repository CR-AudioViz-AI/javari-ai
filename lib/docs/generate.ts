/**
 * Javari Documentation Engine
 * Generates customer-facing documentation for completed work
 */

import { executeWithRouting } from "@/lib/router/executeWithRouting";

export interface DocumentationRequest {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  deliverable: any;
  buildCost?: number;
  validationScore?: number;
  executionTime?: number;
  userId?: string;
}

export interface Documentation {
  taskSummary: string;
  whatWasBuilt: string;
  architectureRationale: string;
  costBreakdown: {
    buildCost: number;
    validationCost: number;
    totalCost: number;
    tokensUsed: number;
  };
  nextSteps: string[];
  metadata: {
    taskId: string;
    generatedAt: string;
    executionTime?: number;
    validationScore?: number;
  };
}

export interface DocumentationResult {
  success: boolean;
  documentation?: Documentation;
  markdown?: string;
  error?: string;
  cost?: number;
}

/**
 * Generate comprehensive documentation for completed work
 */
export async function generateDocumentation(
  request: DocumentationRequest,
  model: string = "gpt-4o-mini"
): Promise<DocumentationResult> {
  console.log("[docs] ====== GENERATING DOCUMENTATION ======");
  console.log("[docs] Task:", request.taskTitle);
  console.log("[docs] Model:", model);

  try {
    const documentationPrompt = `
DOCUMENTATION GENERATION - CUSTOMER-FACING

Task ID: ${request.taskId}
Task: ${request.taskTitle}
Description: ${request.taskDescription}

DELIVERABLE COMPLETED:
${JSON.stringify(request.deliverable, null, 2)}

${request.validationScore ? `Validation Score: ${request.validationScore}/100` : ""}
${request.executionTime ? `Execution Time: ${request.executionTime}ms` : ""}
${request.buildCost ? `Build Cost: $${request.buildCost.toFixed(4)}` : ""}

Your job is to generate CUSTOMER-FACING DOCUMENTATION that explains what was accomplished.

The documentation should be clear, professional, and help the customer understand:
1. What was done
2. Why it was done this way
3. What it cost
4. What to do next

OUTPUT FORMAT (MANDATORY):
Return ONLY valid JSON with this structure:

{
  "taskSummary": "Brief 2-3 sentence summary of what was accomplished",
  "whatWasBuilt": "Detailed explanation of the deliverable, including key features and technical details",
  "architectureRationale": "Explanation of why this approach was chosen, including benefits and trade-offs",
  "costBreakdown": {
    "buildCost": ${request.buildCost || 0},
    "validationCost": 0.45,
    "totalCost": ${(request.buildCost || 0) + 0.45},
    "tokensUsed": 1500
  },
  "nextSteps": [
    "First recommended next step",
    "Second recommended next step",
    "Third recommended next step"
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown, no code fences, no explanations outside the JSON.
    `.trim();

    const response = await executeWithRouting(documentationPrompt, model, true);

    // Parse response
    let parsedResult: any;
    
    if (typeof response.output === "object") {
      parsedResult = response.output;
    } else if (typeof response.output === "string") {
      try {
        parsedResult = JSON.parse(response.output);
      } catch (e) {
        // Try to extract JSON
        const jsonMatch = response.output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Documentation engine did not return valid JSON");
        }
      }
    }

    if (!parsedResult || typeof parsedResult !== "object") {
      throw new Error("Documentation response invalid format");
    }

    // Build complete documentation object
    const documentation: Documentation = {
      taskSummary: parsedResult.taskSummary || "Task completed successfully",
      whatWasBuilt: parsedResult.whatWasBuilt || "Deliverable generated",
      architectureRationale: parsedResult.architectureRationale || "Architecture chosen for optimal results",
      costBreakdown: parsedResult.costBreakdown || {
        buildCost: request.buildCost || 0,
        validationCost: 0,
        totalCost: request.buildCost || 0,
        tokensUsed: 0,
      },
      nextSteps: parsedResult.nextSteps || [],
      metadata: {
        taskId: request.taskId,
        generatedAt: new Date().toISOString(),
        executionTime: request.executionTime,
        validationScore: request.validationScore,
      },
    };

    // Generate markdown version
    const markdown = formatDocumentationAsMarkdown(documentation, request.taskTitle);

    console.log("[docs] ✅ Documentation generated");
    console.log("[docs] Cost: $", (response.estimatedCost || 0).toFixed(4));

    return {
      success: true,
      documentation,
      markdown,
      cost: response.estimatedCost,
    };

  } catch (error: any) {
    console.error("[docs] ❌ Documentation generation failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Format documentation as customer-friendly markdown
 */
function formatDocumentationAsMarkdown(doc: Documentation, taskTitle: string): string {
  return `# ${taskTitle}

## Task Summary

${doc.taskSummary}

---

## What Was Built

${doc.whatWasBuilt}

---

## Architecture & Design Decisions

${doc.architectureRationale}

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Build & Development | $${doc.costBreakdown.buildCost.toFixed(4)} |
| Quality Validation | $${doc.costBreakdown.validationCost.toFixed(4)} |
| **Total** | **$${doc.costBreakdown.totalCost.toFixed(4)}** |

**Tokens Used:** ${doc.costBreakdown.tokensUsed.toLocaleString()}

---

## Next Recommended Steps

${doc.nextSteps.map((step, i) => `${i + 1}. ${step}`).join("\n")}

---

## Metadata

- **Task ID:** ${doc.metadata.taskId}
- **Generated:** ${new Date(doc.metadata.generatedAt).toLocaleString()}
${doc.metadata.executionTime ? `- **Execution Time:** ${doc.metadata.executionTime}ms` : ""}
${doc.metadata.validationScore ? `- **Validation Score:** ${doc.metadata.validationScore}/100` : ""}
`;
}

/**
 * Generate documentation for multiple tasks (batch)
 */
export async function generateBatchDocumentation(
  requests: DocumentationRequest[],
  model: string = "gpt-4o-mini"
): Promise<{
  success: boolean;
  results: DocumentationResult[];
  totalCost: number;
}> {
  console.log(`[docs] Generating documentation for ${requests.length} tasks`);

  const results: DocumentationResult[] = [];
  let totalCost = 0;

  for (const request of requests) {
    const result = await generateDocumentation(request, model);
    results.push(result);
    totalCost += result.cost || 0;
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[docs] ✅ Generated ${successCount}/${requests.length} documentation sets`);
  console.log(`[docs] Total cost: $${totalCost.toFixed(4)}`);

  return {
    success: successCount === requests.length,
    results,
    totalCost,
  };
}

/**
 * Generate combined documentation for a completed roadmap
 */
export async function generateRoadmapDocumentation(
  roadmapTitle: string,
  tasks: DocumentationRequest[],
  model: string = "gpt-4o-mini"
): Promise<DocumentationResult> {
  console.log(`[docs] Generating roadmap documentation: ${roadmapTitle}`);

  // Generate individual task docs
  const batchResult = await generateBatchDocumentation(tasks, model);

  if (!batchResult.success) {
    return {
      success: false,
      error: "Failed to generate some task documentation",
    };
  }

  // Combine into roadmap summary
  const roadmapMarkdown = `# ${roadmapTitle} - Complete Documentation

## Overview

This roadmap consisted of ${tasks.length} tasks, all successfully completed.

---

${batchResult.results
  .filter(r => r.success && r.markdown)
  .map(r => r.markdown)
  .join("\n\n---\n\n")}

---

## Roadmap Summary

**Total Tasks Completed:** ${tasks.length}  
**Total Cost:** $${batchResult.totalCost.toFixed(4)}  
**Generated:** ${new Date().toLocaleString()}
`;

  return {
    success: true,
    markdown: roadmapMarkdown,
    cost: batchResult.totalCost,
  };
}
