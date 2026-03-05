/**
 * Javari Outcome Intelligence Engine
 * Ensures deep understanding of objectives and over-delivers on requirements
 */

import { executeGateway } from "@/lib/execution/gateway";
import { RoadmapItem } from "./roadmap-loader";

export interface OutcomeAnalysis {
  success: boolean;
  trueObjective: string;
  businessContext?: string;
  successCriteria: string[];
  missingCapabilities: string[];
  addedTasks: RoadmapItem[];
  risks: string[];
  recommendations: string[];
  complianceIssues: string[];
  scalabilityConcerns: string[];
  analysis?: string;
  estimatedCost?: number;
  error?: string;
}

/**
 * Deep strategic analysis of outcomes and objectives
 * 
 * Multi-agent workflow:
 * - Architect: Identifies true business objective and hidden requirements
 * - Validator: Identifies risks, compliance, and scalability concerns
 * - Builder: Generates missing architecture, infrastructure, and testing tasks
 * - Documenter: Produces enhanced roadmap with success metrics
 */
export async function analyzeOutcome(
  goal: string,
  roadmap: RoadmapItem[],
  userId: string = "outcome-intelligence"
): Promise<OutcomeAnalysis> {
  console.log("[outcome-intelligence] ====== DEEP STRATEGIC ANALYSIS ======");
  console.log("[outcome-intelligence] Goal:", goal);
  console.log("[outcome-intelligence] Current roadmap tasks:", roadmap.length);

  try {
    // Format roadmap for analysis
    const roadmapSummary = roadmap.map((t, i) => 
      `${i + 1}. [${t.id}] ${t.title}\n   Description: ${t.description}\n   Priority: ${t.priority}`
    ).join('\n\n');

    const analysisPrompt = `
OUTCOME INTELLIGENCE ANALYSIS

PRIMARY GOAL:
${goal}

CURRENT ROADMAP (${roadmap.length} tasks):
${roadmapSummary}

CRITICAL DIRECTIVE: Go beyond surface requirements. Identify the TRUE business objective and ensure over-delivery.

═══════════════════════════════════════════════════════════

ARCHITECT - STRATEGIC ANALYSIS:

1. TRUE OBJECTIVE IDENTIFICATION:
   - What is the REAL business problem being solved?
   - What does success actually look like for the business?
   - What are the unstated requirements?
   - What business outcomes are being sought?

2. SUCCESS CRITERIA DEFINITION:
   - Define measurable success metrics
   - Identify KPIs that matter
   - Set quality benchmarks
   - Define completion criteria

3. HIDDEN REQUIREMENTS MAPPING:
   - Security requirements not explicitly stated
   - Performance requirements implied by use case
   - Scalability needs based on business context
   - User experience expectations
   - Maintainability requirements

═══════════════════════════════════════════════════════════

VALIDATOR - RISK & COMPLIANCE ANALYSIS:

1. RISK IDENTIFICATION:
   - Technical risks in current roadmap
   - Business risks if roadmap is incomplete
   - Integration risks
   - Data loss risks
   - Security vulnerabilities

2. COMPLIANCE REQUIREMENTS:
   - Data privacy (GDPR, CCPA, etc.)
   - Security standards (OWASP, SOC2)
   - Accessibility (WCAG)
   - Industry-specific regulations
   - Best practices not being followed

3. SCALABILITY CONCERNS:
   - Performance bottlenecks
   - Database scaling issues
   - API rate limiting needs
   - Caching requirements
   - Load balancing needs

═══════════════════════════════════════════════════════════

BUILDER - MISSING CAPABILITIES:

Identify and propose additional tasks for:

1. ARCHITECTURE TASKS:
   - System architecture documentation
   - Database schema design
   - API architecture
   - Security architecture
   - Integration architecture

2. INFRASTRUCTURE TASKS:
   - Environment setup (dev/staging/prod)
   - Database provisioning
   - CI/CD pipeline setup
   - Monitoring and logging
   - Backup and disaster recovery

3. TESTING TASKS:
   - Unit test framework setup
   - Integration testing
   - End-to-end testing
   - Performance testing
   - Security testing

4. QUALITY ASSURANCE:
   - Code review process
   - Documentation standards
   - Error handling
   - Logging strategy

═══════════════════════════════════════════════════════════

DOCUMENTER - COMPREHENSIVE REPORT:

Produce a JSON object with this EXACT structure:

{
  "trueObjective": "Clear statement of the real business objective",
  "businessContext": "Why this matters to the business",
  "successCriteria": [
    "Measurable success criterion 1",
    "Measurable success criterion 2"
  ],
  "missingCapabilities": [
    "Missing capability 1",
    "Missing capability 2"
  ],
  "addedTasks": [
    {
      "id": "outcome-1",
      "title": "Task title",
      "description": "Detailed task description",
      "priority": 9
    }
  ],
  "risks": [
    "Risk 1 with severity and mitigation",
    "Risk 2 with severity and mitigation"
  ],
  "recommendations": [
    "Strategic recommendation 1",
    "Strategic recommendation 2"
  ],
  "complianceIssues": [
    "Compliance issue 1",
    "Compliance issue 2"
  ],
  "scalabilityConcerns": [
    "Scalability concern 1",
    "Scalability concern 2"
  ]
}

CRITICAL: Output valid JSON only. Be thorough - this is about over-delivering.
    `.trim();

    console.log("[outcome-intelligence] Sending to strategic analysis team...");

    const analysisResponse = await executeGateway({
      input: analysisPrompt,
      mode: "multi",
      userId,
      roles: {
        architect: "gpt-4o",
        validator: "gpt-4o",
        builder: "claude-sonnet-4-20250514",
        documenter: "gpt-4o",
      },
    });

    console.log("[outcome-intelligence] ✅ Analysis complete");
    console.log("[outcome-intelligence] Cost: $", (analysisResponse.estimatedCost ?? 0).toFixed(4));

    // Parse response
    const output = analysisResponse.output;
    console.log("[outcome-intelligence] Parsing strategic analysis...");

    // Extract JSON from output
    const jsonMatch = output.match(/\{[\s\S]*"trueObjective"[\s\S]*\}/);
    
    let result: OutcomeAnalysis = {
      success: false,
      trueObjective: "",
      successCriteria: [],
      missingCapabilities: [],
      addedTasks: [],
      risks: [],
      recommendations: [],
      complianceIssues: [],
      scalabilityConcerns: [],
    };

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        result = {
          success: true,
          trueObjective: parsed.trueObjective || "Not identified",
          businessContext: parsed.businessContext,
          successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria : [],
          missingCapabilities: Array.isArray(parsed.missingCapabilities) ? parsed.missingCapabilities : [],
          addedTasks: Array.isArray(parsed.addedTasks) 
            ? parsed.addedTasks.map((task: any, i: number) => ({
                id: task.id || `outcome-${i + 1}`,
                title: task.title || "Untitled",
                description: task.description || "",
                priority: task.priority || 7,
              }))
            : [],
          risks: Array.isArray(parsed.risks) ? parsed.risks : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          complianceIssues: Array.isArray(parsed.complianceIssues) ? parsed.complianceIssues : [],
          scalabilityConcerns: Array.isArray(parsed.scalabilityConcerns) ? parsed.scalabilityConcerns : [],
          analysis: output,
          estimatedCost: analysisResponse.estimatedCost,
        };
        
        console.log("[outcome-intelligence] ✅ Parsed outcome analysis:");
        console.log("  True objective identified:", !!result.trueObjective);
        console.log("  Success criteria:", result.successCriteria.length);
        console.log("  Missing capabilities:", result.missingCapabilities.length);
        console.log("  Added tasks:", result.addedTasks.length);
        console.log("  Risks identified:", result.risks.length);
        console.log("  Compliance issues:", result.complianceIssues.length);
        
      } catch (parseError: any) {
        console.error("[outcome-intelligence] JSON parse failed:", parseError.message);
        
        // Fallback extraction
        result.trueObjective = extractSection(output, "true objective", "business context") || "Analysis completed - see full report";
        result.analysis = output;
        result.estimatedCost = analysisResponse.estimatedCost;
        result.success = true;
      }
    } else {
      console.warn("[outcome-intelligence] No JSON found, returning text analysis");
      result.trueObjective = "Strategic analysis completed - see full report";
      result.analysis = output;
      result.estimatedCost = analysisResponse.estimatedCost;
      result.success = true;
    }

    console.log("[outcome-intelligence] ✅ Outcome intelligence analysis complete");

    return result;
  } catch (error: any) {
    console.error("[outcome-intelligence] ❌ Analysis failed:", error.message);
    
    return {
      success: false,
      trueObjective: "",
      successCriteria: [],
      missingCapabilities: [],
      addedTasks: [],
      risks: [],
      recommendations: [],
      complianceIssues: [],
      scalabilityConcerns: [],
      error: error.message,
    };
  }
}

/**
 * Helper: Extract text between sections
 */
function extractSection(text: string, startMarker: string, endMarker: string): string | null {
  const regex = new RegExp(`${startMarker}[:\s]+(.+?)(?=${endMarker}|$)`, 'is');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Quick outcome validation
 */
export function validateOutcome(goal: string, tasks: RoadmapItem[]): {
  hasArchitecture: boolean;
  hasTesting: boolean;
  hasInfrastructure: boolean;
  hasDocumentation: boolean;
  coverage: number;
} {
  const titleText = tasks.map(t => t.title.toLowerCase()).join(' ');
  const descText = tasks.map(t => t.description.toLowerCase()).join(' ');
  const allText = titleText + ' ' + descText;

  return {
    hasArchitecture: /architecture|design|schema|structure/.test(allText),
    hasTesting: /test|testing|qa|quality/.test(allText),
    hasInfrastructure: /infrastructure|deployment|ci\/cd|docker|kubernetes/.test(allText),
    hasDocumentation: /documentation|docs|readme|guide/.test(allText),
    coverage: tasks.length >= 5 ? 
      (tasks.length >= 15 ? 100 : Math.round((tasks.length / 15) * 100)) : 
      Math.round((tasks.length / 5) * 100),
  };
}
