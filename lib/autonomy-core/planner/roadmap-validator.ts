/**
 * lib/autonomy-core/planner/roadmap-validator.ts
 * Roadmap Validation Layer
 * Created: 2026-02-22 03:45 ET
 * 
 * Critical safety system that validates roadmaps BEFORE execution.
 * Detects and blocks unsafe, incomplete, or impossible task executions.
 * 
 * Safety Levels:
 * - CRITICAL: Execution must halt immediately
 * - HIGH: Warn + require manual override
 * - MEDIUM: Safe but suboptimal
 * - LOW: Informational only
 */

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ValidationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SafetyRisk = 'low' | 'medium' | 'high' | 'critical';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  taskId?: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  blockers: ValidationIssue[];  // CRITICAL + HIGH issues
  warnings: ValidationIssue[];  // MEDIUM issues
  info: ValidationIssue[];      // LOW issues
}

export interface RoadmapTask {
  id: string;
  title: string;
  status: string;
  priority?: number;
  requiredSecrets?: string[];
  prerequisites?: string[];
  estimatedCost?: number;
  safetyRisk?: SafetyRisk;
  [key: string]: any;
}

export interface Roadmap {
  id: string;
  name: string;
  tasks: RoadmapTask[];
  [key: string]: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════

const SAFETY_RISK_BLOCKING: SafetyRisk[] = ['critical'];
const MAX_COST_PER_TASK = 100; // dollars
const MAX_TOTAL_COST = 500;    // dollars

// ═══════════════════════════════════════════════════════════════════════════
// CORE VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate complete roadmap structure
 */
export function validateRoadmapStructure(roadmap: Roadmap): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check roadmap exists
  if (!roadmap) {
    issues.push({
      code: 'ROADMAP_NULL',
      severity: 'CRITICAL',
      message: 'Roadmap is null or undefined',
    });
    return issues;
  }

  // Check required fields
  if (!roadmap.id) {
    issues.push({
      code: 'ROADMAP_NO_ID',
      severity: 'CRITICAL',
      message: 'Roadmap missing required field: id',
    });
  }

  if (!roadmap.name) {
    issues.push({
      code: 'ROADMAP_NO_NAME',
      severity: 'HIGH',
      message: 'Roadmap missing required field: name',
    });
  }

  // Check tasks array
  if (!roadmap.tasks) {
    issues.push({
      code: 'ROADMAP_NO_TASKS',
      severity: 'CRITICAL',
      message: 'Roadmap missing tasks array',
    });
    return issues;
  }

  if (!Array.isArray(roadmap.tasks)) {
    issues.push({
      code: 'ROADMAP_TASKS_NOT_ARRAY',
      severity: 'CRITICAL',
      message: 'Roadmap tasks is not an array',
    });
    return issues;
  }

  if (roadmap.tasks.length === 0) {
    issues.push({
      code: 'ROADMAP_EMPTY',
      severity: 'MEDIUM',
      message: 'Roadmap contains no tasks',
    });
  }

  // Validate task IDs are unique
  const taskIds = new Set<string>();
  const duplicates: string[] = [];

  roadmap.tasks.forEach(task => {
    if (!task.id) {
      issues.push({
        code: 'TASK_NO_ID',
        severity: 'CRITICAL',
        taskId: task.title || 'unknown',
        message: `Task missing required field: id`,
      });
    } else if (taskIds.has(task.id)) {
      duplicates.push(task.id);
    } else {
      taskIds.add(task.id);
    }
  });

  if (duplicates.length > 0) {
    issues.push({
      code: 'TASK_DUPLICATE_IDS',
      severity: 'CRITICAL',
      message: `Duplicate task IDs found: ${duplicates.join(', ')}`,
      details: { duplicates },
    });
  }

  return issues;
}

/**
 * Validate task dependencies are resolvable
 */
export function validateTaskDependencies(tasks: RoadmapTask[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const taskIds = new Set(tasks.map(t => t.id));

  tasks.forEach(task => {
    if (!task.prerequisites || task.prerequisites.length === 0) {
      return;
    }

    // Check each prerequisite exists
    task.prerequisites.forEach(prereqId => {
      if (!taskIds.has(prereqId)) {
        issues.push({
          code: 'TASK_MISSING_PREREQUISITE',
          severity: 'HIGH',
          taskId: task.id,
          message: `Task "${task.title}" requires prerequisite "${prereqId}" which does not exist`,
          details: { taskId: task.id, prerequisiteId: prereqId },
        });
      }
    });

    // Detect circular dependencies (basic check)
    const visited = new Set<string>();
    const stack = new Set<string>();

    function hasCircularDep(taskId: string): boolean {
      if (stack.has(taskId)) return true;
      if (visited.has(taskId)) return false;

      visited.add(taskId);
      stack.add(taskId);

      const currentTask = tasks.find(t => t.id === taskId);
      if (currentTask?.prerequisites) {
        for (const prereq of currentTask.prerequisites) {
          if (hasCircularDep(prereq)) {
            return true;
          }
        }
      }

      stack.delete(taskId);
      return false;
    }

    if (hasCircularDep(task.id)) {
      issues.push({
        code: 'TASK_CIRCULAR_DEPENDENCY',
        severity: 'CRITICAL',
        taskId: task.id,
        message: `Task "${task.title}" has circular dependency`,
      });
    }
  });

  return issues;
}

/**
 * Validate missing prerequisites (dependencies not yet completed)
 */
export function validateMissingPrerequisites(tasks: RoadmapTask[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const completedTasks = new Set(
    tasks.filter(t => t.status === 'completed' || t.status === 'done').map(t => t.id)
  );

  tasks.forEach(task => {
    // Only check pending tasks
    if (task.status === 'completed' || task.status === 'done' || task.status === 'blocked') {
      return;
    }

    if (!task.prerequisites || task.prerequisites.length === 0) {
      return;
    }

    const missingPrereqs = task.prerequisites.filter(prereqId => !completedTasks.has(prereqId));

    if (missingPrereqs.length > 0) {
      const prereqTitles = missingPrereqs.map(id => {
        const prereqTask = tasks.find(t => t.id === id);
        return prereqTask?.title || id;
      });

      issues.push({
        code: 'TASK_PREREQUISITES_INCOMPLETE',
        severity: 'HIGH',
        taskId: task.id,
        message: `Task "${task.title}" requires incomplete prerequisites: ${prereqTitles.join(', ')}`,
        details: { missingPrereqs },
      });
    }
  });

  return issues;
}

/**
 * Validate required secrets exist
 */
export async function validateRequiredSecrets(
  tasks: RoadmapTask[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Collect all required secrets
  const requiredSecrets = new Set<string>();
  tasks.forEach(task => {
    if (task.requiredSecrets && Array.isArray(task.requiredSecrets)) {
      task.requiredSecrets.forEach(secret => requiredSecrets.add(secret));
    }
  });

  if (requiredSecrets.size === 0) {
    return issues;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check each secret via Secret Authority
    for (const secretName of requiredSecrets) {
      try {
        const { data, error } = await supabase.rpc('get_platform_secret', {
          p_secret_name: secretName,
        });

        if (error || !data) {
          // Find which tasks require this secret
          const affectedTasks = tasks
            .filter(t => t.requiredSecrets?.includes(secretName))
            .map(t => t.title);

          issues.push({
            code: 'MISSING_SECRET',
            severity: 'CRITICAL',
            message: `Required secret "${secretName}" is not configured (affects: ${affectedTasks.join(', ')})`,
            details: { secretName, affectedTasks },
          });
        }
      } catch (err) {
        issues.push({
          code: 'SECRET_CHECK_FAILED',
          severity: 'HIGH',
          message: `Failed to verify secret "${secretName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
          details: { secretName },
        });
      }
    }
  } catch (err) {
    issues.push({
      code: 'SECRET_AUTHORITY_UNAVAILABLE',
      severity: 'HIGH',
      message: `Cannot validate secrets: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }

  return issues;
}

/**
 * Validate cost estimates
 */
export function validateCostEstimates(tasks: RoadmapTask[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  let totalCost = 0;

  tasks.forEach(task => {
    // Skip completed tasks
    if (task.status === 'completed' || task.status === 'done') {
      return;
    }

    if (task.estimatedCost !== undefined && task.estimatedCost !== null) {
      // Check per-task limit
      if (task.estimatedCost > MAX_COST_PER_TASK) {
        issues.push({
          code: 'TASK_COST_EXCEEDED',
          severity: 'HIGH',
          taskId: task.id,
          message: `Task "${task.title}" estimated cost ($${task.estimatedCost}) exceeds limit ($${MAX_COST_PER_TASK})`,
          details: { estimatedCost: task.estimatedCost, limit: MAX_COST_PER_TASK },
        });
      }

      totalCost += task.estimatedCost;
    }
  });

  // Check total cost
  if (totalCost > MAX_TOTAL_COST) {
    issues.push({
      code: 'TOTAL_COST_EXCEEDED',
      severity: 'HIGH',
      message: `Total estimated cost ($${totalCost}) exceeds budget ($${MAX_TOTAL_COST})`,
      details: { totalCost, limit: MAX_TOTAL_COST },
    });
  }

  return issues;
}

/**
 * Validate safety flags
 */
export function validateSafetyFlags(tasks: RoadmapTask[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  tasks.forEach(task => {
    // Skip completed tasks
    if (task.status === 'completed' || task.status === 'done') {
      return;
    }

    if (!task.safetyRisk) {
      issues.push({
        code: 'TASK_NO_SAFETY_FLAG',
        severity: 'MEDIUM',
        taskId: task.id,
        message: `Task "${task.title}" missing safety risk assessment`,
      });
      return;
    }

    // Block critical safety risks
    if (SAFETY_RISK_BLOCKING.includes(task.safetyRisk)) {
      issues.push({
        code: 'TASK_SAFETY_CRITICAL',
        severity: 'CRITICAL',
        taskId: task.id,
        message: `Task "${task.title}" has CRITICAL safety risk and cannot be auto-executed`,
        details: { safetyRisk: task.safetyRisk },
      });
    }

    // Warn on high safety risks
    if (task.safetyRisk === 'high') {
      issues.push({
        code: 'TASK_SAFETY_HIGH',
        severity: 'HIGH',
        taskId: task.id,
        message: `Task "${task.title}" has HIGH safety risk - manual review recommended`,
        details: { safetyRisk: task.safetyRisk },
      });
    }
  });

  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run full validation suite on roadmap
 */
export async function validateRoadmap(
  roadmap: Roadmap,
  supabaseUrl: string,
  supabaseKey: string
): Promise<ValidationResult> {
  const allIssues: ValidationIssue[] = [];

  // 1. Structure validation
  const structureIssues = validateRoadmapStructure(roadmap);
  allIssues.push(...structureIssues);

  // If structure is broken, abort further validation
  const criticalStructureIssues = structureIssues.filter(i => i.severity === 'CRITICAL');
  if (criticalStructureIssues.length > 0) {
    return {
      valid: false,
      issues: allIssues,
      blockers: allIssues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH'),
      warnings: allIssues.filter(i => i.severity === 'MEDIUM'),
      info: allIssues.filter(i => i.severity === 'LOW'),
    };
  }

  // 2. Dependency validation
  const dependencyIssues = validateTaskDependencies(roadmap.tasks);
  allIssues.push(...dependencyIssues);

  // 3. Prerequisites validation
  const prereqIssues = validateMissingPrerequisites(roadmap.tasks);
  allIssues.push(...prereqIssues);

  // 4. Secret validation
  const secretIssues = await validateRequiredSecrets(roadmap.tasks, supabaseUrl, supabaseKey);
  allIssues.push(...secretIssues);

  // 5. Cost validation
  const costIssues = validateCostEstimates(roadmap.tasks);
  allIssues.push(...costIssues);

  // 6. Safety validation
  const safetyIssues = validateSafetyFlags(roadmap.tasks);
  allIssues.push(...safetyIssues);

  // Categorize issues
  const blockers = allIssues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH');
  const warnings = allIssues.filter(i => i.severity === 'MEDIUM');
  const info = allIssues.filter(i => i.severity === 'LOW');

  return {
    valid: blockers.length === 0,
    issues: allIssues,
    blockers,
    warnings,
    info,
  };
}

/**
 * Format validation result for logging
 */
export function formatValidationResult(result: ValidationResult): Record<string, any> {
  return {
    valid: result.valid,
    summary: {
      total: result.issues.length,
      critical: result.issues.filter(i => i.severity === 'CRITICAL').length,
      high: result.issues.filter(i => i.severity === 'HIGH').length,
      medium: result.issues.filter(i => i.severity === 'MEDIUM').length,
      low: result.issues.filter(i => i.severity === 'LOW').length,
    },
    blockers: result.blockers.map(i => ({
      code: i.code,
      severity: i.severity,
      taskId: i.taskId,
      message: i.message,
    })),
    warnings: result.warnings.map(i => ({
      code: i.code,
      message: i.message,
    })),
  };
}
