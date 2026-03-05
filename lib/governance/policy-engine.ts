/**
 * Javari Policy Engine
 * Enforces security, compliance, and architectural rules before execution
 */

import { RoadmapItem } from "@/lib/roadmap/roadmap-loader";

export type PolicyCategory = "security" | "compliance" | "architecture" | "cost_control";
export type PolicySeverity = "blocker" | "warning" | "info";

export interface PolicyViolation {
  taskId: string;
  taskTitle: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  rule: string;
  description: string;
  recommendation?: string;
}

export interface PolicyEvaluation {
  success: boolean;
  approvedTasks: RoadmapItem[];
  blockedTasks: RoadmapItem[];
  warnings: PolicyViolation[];
  policyViolations: PolicyViolation[];
  summary: {
    totalTasks: number;
    approved: number;
    blocked: number;
    warnings: number;
    violations: number;
  };
}

// Policy configuration
const POLICIES = {
  // Security policies
  security: {
    noPlaintextSecrets: {
      severity: "blocker" as PolicySeverity,
      description: "Tasks must not store secrets in plaintext",
      keywords: ["password", "api key", "secret", "token", "credential"],
      blockedPatterns: ["plaintext", "hardcode", "config file", "environment file"],
    },
    requireEncryption: {
      severity: "blocker" as PolicySeverity,
      description: "User credentials must use encryption",
      keywords: ["password", "credential", "authentication", "user data"],
      requiredPatterns: ["encrypt", "hash", "bcrypt", "argon2", "scrypt"],
    },
    requireRateLimiting: {
      severity: "warning" as PolicySeverity,
      description: "Public APIs must implement rate limiting",
      keywords: ["public api", "endpoint", "rest api", "graphql"],
      requiredPatterns: ["rate limit", "throttle", "quota"],
    },
    requireInputValidation: {
      severity: "warning" as PolicySeverity,
      description: "User inputs must be validated",
      keywords: ["user input", "form", "api endpoint", "parameter"],
      requiredPatterns: ["validat", "sanitiz", "escape"],
    },
  },

  // Compliance policies
  compliance: {
    gdprCompliance: {
      severity: "blocker" as PolicySeverity,
      description: "User data handling must be GDPR compliant",
      keywords: ["user data", "personal information", "email", "profile"],
      requiredPatterns: ["gdpr", "data privacy", "consent", "right to delete"],
    },
    auditLogging: {
      severity: "warning" as PolicySeverity,
      description: "Critical operations should be audit logged",
      keywords: ["authentication", "authorization", "admin", "sensitive"],
      requiredPatterns: ["audit", "log", "track", "record"],
    },
    dataRetention: {
      severity: "warning" as PolicySeverity,
      description: "Data retention policies should be defined",
      keywords: ["database", "user data", "storage"],
      requiredPatterns: ["retention", "cleanup", "archive", "delete"],
    },
  },

  // Architecture policies
  architecture: {
    requireTesting: {
      severity: "warning" as PolicySeverity,
      description: "New features should include tests",
      keywords: ["feature", "endpoint", "function", "component"],
      requiredPatterns: ["test", "unit test", "integration test"],
    },
    requireDocumentation: {
      severity: "info" as PolicySeverity,
      description: "Complex logic should be documented",
      keywords: ["algorithm", "business logic", "complex"],
      requiredPatterns: ["document", "comment", "readme"],
    },
    noHardcodedUrls: {
      severity: "warning" as PolicySeverity,
      description: "URLs should be configurable, not hardcoded",
      keywords: ["api", "endpoint", "url", "connection"],
      blockedPatterns: ["hardcode", "fixed"],
    },
  },

  // Cost control policies
  cost_control: {
    maxCostPerTask: {
      severity: "blocker" as PolicySeverity,
      description: "Task cost must not exceed $5.00",
      threshold: 5.00,
    },
    externalApiApproval: {
      severity: "warning" as PolicySeverity,
      description: "External APIs should use approved providers",
      approvedProviders: ["stripe", "sendgrid", "twilio", "aws", "google", "microsoft"],
      keywords: ["external api", "third party", "integration"],
    },
  },
};

/**
 * Evaluate tasks against governance policies
 */
export async function evaluateTasks(
  tasks: RoadmapItem[]
): Promise<PolicyEvaluation> {
  console.log("[policy-engine] ====== POLICY EVALUATION ======");
  console.log("[policy-engine] Evaluating", tasks.length, "tasks");

  const approvedTasks: RoadmapItem[] = [];
  const blockedTasks: RoadmapItem[] = [];
  const warnings: PolicyViolation[] = [];
  const violations: PolicyViolation[] = [];

  for (const task of tasks) {
    const taskViolations = await evaluateTask(task);
    
    // Determine if task is blocked
    const hasBlocker = taskViolations.some(v => v.severity === "blocker");
    
    if (hasBlocker) {
      blockedTasks.push(task);
      violations.push(...taskViolations.filter(v => v.severity === "blocker"));
      warnings.push(...taskViolations.filter(v => v.severity === "warning"));
      
      console.log(`[policy-engine] ❌ BLOCKED: ${task.id} - ${taskViolations.filter(v => v.severity === "blocker").length} blocker(s)`);
    } else {
      approvedTasks.push(task);
      warnings.push(...taskViolations.filter(v => v.severity === "warning"));
      
      if (taskViolations.length > 0) {
        console.log(`[policy-engine] ⚠️  APPROVED with warnings: ${task.id} - ${taskViolations.length} warning(s)`);
      } else {
        console.log(`[policy-engine] ✅ APPROVED: ${task.id}`);
      }
    }
  }

  console.log("[policy-engine] ====== EVALUATION COMPLETE ======");
  console.log("[policy-engine] Approved:", approvedTasks.length);
  console.log("[policy-engine] Blocked:", blockedTasks.length);
  console.log("[policy-engine] Warnings:", warnings.length);

  return {
    success: blockedTasks.length === 0,
    approvedTasks,
    blockedTasks,
    warnings,
    policyViolations: violations,
    summary: {
      totalTasks: tasks.length,
      approved: approvedTasks.length,
      blocked: blockedTasks.length,
      warnings: warnings.length,
      violations: violations.length,
    },
  };
}

/**
 * Evaluate a single task against all policies
 */
async function evaluateTask(task: RoadmapItem): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];
  const taskText = `${task.title} ${task.description}`.toLowerCase();

  // Security policies
  for (const [ruleName, rule] of Object.entries(POLICIES.security)) {
    const violation = checkTextPolicy(
      task,
      "security",
      ruleName,
      rule,
      taskText
    );
    if (violation) violations.push(violation);
  }

  // Compliance policies
  for (const [ruleName, rule] of Object.entries(POLICIES.compliance)) {
    const violation = checkTextPolicy(
      task,
      "compliance",
      ruleName,
      rule,
      taskText
    );
    if (violation) violations.push(violation);
  }

  // Architecture policies
  for (const [ruleName, rule] of Object.entries(POLICIES.architecture)) {
    const violation = checkTextPolicy(
      task,
      "architecture",
      ruleName,
      rule,
      taskText
    );
    if (violation) violations.push(violation);
  }

  // Cost control policies
  const costViolation = checkCostPolicy(task);
  if (costViolation) violations.push(costViolation);

  return violations;
}

/**
 * Check text-based policy rules
 */
function checkTextPolicy(
  task: RoadmapItem,
  category: PolicyCategory,
  ruleName: string,
  rule: any,
  taskText: string
): PolicyViolation | null {
  // Check if keywords match
  if (rule.keywords) {
    const hasKeyword = rule.keywords.some((kw: string) => 
      taskText.includes(kw.toLowerCase())
    );
    
    if (!hasKeyword) return null; // Rule doesn't apply
  }

  // Check for blocked patterns
  if (rule.blockedPatterns) {
    const hasBlockedPattern = rule.blockedPatterns.some((pattern: string) =>
      taskText.includes(pattern.toLowerCase())
    );
    
    if (hasBlockedPattern) {
      return {
        taskId: task.id,
        taskTitle: task.title,
        category,
        severity: rule.severity,
        rule: ruleName,
        description: rule.description,
        recommendation: "Remove blocked pattern or restructure task",
      };
    }
  }

  // Check for required patterns
  if (rule.requiredPatterns) {
    const hasRequiredPattern = rule.requiredPatterns.some((pattern: string) =>
      taskText.includes(pattern.toLowerCase())
    );
    
    if (!hasRequiredPattern && rule.keywords) {
      return {
        taskId: task.id,
        taskTitle: task.title,
        category,
        severity: rule.severity,
        rule: ruleName,
        description: rule.description,
        recommendation: `Add one of: ${rule.requiredPatterns.join(", ")}`,
      };
    }
  }

  return null;
}

/**
 * Check cost control policies
 */
function checkCostPolicy(task: RoadmapItem): PolicyViolation | null {
  // Estimate task complexity (simplified - in production would be more sophisticated)
  const descriptionLength = task.description.length;
  const estimatedCost = descriptionLength > 500 ? 0.15 : 
                       descriptionLength > 200 ? 0.08 : 0.03;

  if (estimatedCost > POLICIES.cost_control.maxCostPerTask.threshold) {
    return {
      taskId: task.id,
      taskTitle: task.title,
      category: "cost_control",
      severity: POLICIES.cost_control.maxCostPerTask.severity,
      rule: "maxCostPerTask",
      description: POLICIES.cost_control.maxCostPerTask.description,
      recommendation: `Estimated cost $${estimatedCost.toFixed(2)} exceeds limit. Break into smaller tasks.`,
    };
  }

  return null;
}

/**
 * Get policy summary
 */
export function getPolicySummary() {
  return {
    totalPolicies: 
      Object.keys(POLICIES.security).length +
      Object.keys(POLICIES.compliance).length +
      Object.keys(POLICIES.architecture).length +
      Object.keys(POLICIES.cost_control).length,
    categories: {
      security: Object.keys(POLICIES.security).length,
      compliance: Object.keys(POLICIES.compliance).length,
      architecture: Object.keys(POLICIES.architecture).length,
      cost_control: Object.keys(POLICIES.cost_control).length,
    },
    policies: POLICIES,
  };
}
