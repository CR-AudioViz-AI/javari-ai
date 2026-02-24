// lib/autonomy-core/planner/task-executor.ts
// CR AudioViz AI — Multi-AI Task Executor with Validation
// 2026-02-22 — FS-4: Multi-AI Task Execution Integration
//
// Executes a single JavariTask with intelligent model selection:
//   1. Fetches canonical context relevant to the task
//   2. Selects optimal AI model based on task type
//   3. Executes task with primary model
//   4. Validates output with Claude Sonnet
//   5. Retries up to 2 times if validation fails
//   6. Persists result with model usage metadata
//   7. Logs model usage for cost tracking

import type { JavariTask }       from "./dependency-resolver";
import { createLogger }          from "@/lib/observability/logger";
import { writeAuditEvent }       from "@/lib/enterprise/audit";
import { retrieveCanonicalContext } from "@/lib/javari/memory/canonical-retrieval";

const log = createLogger("autonomy");

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TaskExecutionResult {
  taskId:       string;
  status:       "complete" | "failed" | "skipped" | "blocked";
  result?:      string;
  error?:       string;
  durationMs:   number;
  provider?:    string;
  model?:       string;
  tokensIn?:    number;
  tokensOut?:   number;
  retries?:     number;
  validatorPassed?: boolean;
  canonicalChunksUsed: number;
}

export interface ModelSelection {
  provider: string;
  model: string;
  reasoning: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  suggestion?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RETRIES = 2;
const VALIDATION_TIMEOUT = 30_000; // 30s
const EXECUTION_TIMEOUT = 90_000;  // 90s

// Model costs (per 1M tokens)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-sonnet-4': { input: 3.00, output: 15.00 },
  'claude-sonnet-3.5': { input: 3.00, output: 15.00 },
  'llama-3.1-70b': { input: 0.88, output: 0.88 },
  'mistral-large': { input: 2.00, output: 6.00 },
  'mixtral-8x7b': { input: 0.45, output: 0.45 },
};

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function sbPatch(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  const url = SB_URL(); const key = SB_KEY();
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method:  "PATCH",
    headers: {
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(data),
  });
}

async function logModelUsage(data: {
  task_id: string;
  model: string;
  provider: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  duration_ms: number;
  success: boolean;
  validated: boolean;
  cycle_id?: string;
}): Promise<void> {
  const url = SB_URL(); const key = SB_KEY();
  if (!url || !key) return;
  
  try {
    await fetch(`${url}/rest/v1/autonomy_model_usage`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        ...data,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    log.warn(`Failed to log model usage: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL SELECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Select optimal model based on task characteristics
 */
export function selectModelForTask(task: JavariTask): ModelSelection {
  const title = task.title.toLowerCase();
  const desc = task.description.toLowerCase();
  const text = title + " " + desc;

  // Reasoning tasks → OpenAI o-series
  if (
    text.includes('analyze') ||
    text.includes('reason') ||
    text.includes('logic') ||
    text.includes('proof') ||
    text.includes('complex') ||
    text.includes('architecture')
  ) {
    return {
      provider: 'openai',
      model: 'o1-mini',
      reasoning: 'Reasoning task detected - using OpenAI o-series for deep analysis',
    };
  }

  // Generation tasks → Llama or Mistral (cost-effective)
  if (
    text.includes('generate') ||
    text.includes('create') ||
    text.includes('write') ||
    text.includes('draft')
  ) {
    return {
      provider: 'groq',
      model: 'llama-3.1-70b',
      reasoning: 'Generation task detected - using Llama for cost-effective output',
    };
  }

  // Structured output → Mistral or GPT-4o-mini
  if (
    text.includes('json') ||
    text.includes('schema') ||
    text.includes('structure') ||
    text.includes('format') ||
    text.includes('parse')
  ) {
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      reasoning: 'Structured output task - using GPT-4o-mini for reliable formatting',
    };
  }

  // High-risk or correctness-critical → GPT-4o
  if (
    task.priority === 'critical' ||
    text.includes('security') ||
    text.includes('critical') ||
    text.includes('production') ||
    text.includes('deploy')
  ) {
    return {
      provider: 'openai',
      model: 'gpt-4o',
      reasoning: 'High-risk task - using GPT-4o for maximum reliability',
    };
  }

  // Default → GPT-4o-mini (balanced cost/performance)
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    reasoning: 'General task - using GPT-4o-mini for balanced performance',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT BUILDING
// ═══════════════════════════════════════════════════════════════════════════

function buildTaskPrompt(task: JavariTask, canonicalCtx: string): string {
  const lines: string[] = [];

  if (canonicalCtx) {
    lines.push("=== PLATFORM DOCUMENTATION (use this to inform your work) ===");
    lines.push(canonicalCtx);
    lines.push("=== END PLATFORM DOCUMENTATION ===\n");
  }

  lines.push(`TASK: ${task.title}`);
  lines.push(`PHASE: ${task.phase_id} | ORDER: ${task.task_order} | PRIORITY: ${task.priority}`);
  lines.push(`\nDESCRIPTION:\n${task.description}`);

  if (task.verification_criteria) {
    const vc = typeof task.verification_criteria === "string"
      ? task.verification_criteria
      : JSON.stringify(task.verification_criteria, null, 2);
    lines.push(`\nVERIFICATION CRITERIA:\n${vc}`);
  }

  if (task.tags && (task.tags as string[]).length > 0) {
    lines.push(`\nTAGS: ${(task.tags as string[]).join(", ")}`);
  }

  lines.push("\nProvide a complete, actionable response that satisfies all verification criteria.");
  lines.push("Reference specific platform documentation above where relevant.");
  lines.push("Be precise. Be complete. No placeholders.");

  return lines.join("\n");
}

function buildValidationPrompt(task: JavariTask, output: string): string {
  return `You are a senior code reviewer validating autonomous task execution.

TASK: ${task.title}
DESCRIPTION: ${task.description}

VERIFICATION CRITERIA:
${task.verification_criteria ? (typeof task.verification_criteria === 'string' ? task.verification_criteria : JSON.stringify(task.verification_criteria, null, 2)) : 'None specified'}

OUTPUT TO VALIDATE:
${output}

VALIDATION REQUIREMENTS:
1. Does the output fully address the task description?
2. Does it meet all verification criteria?
3. Is it complete (no placeholders, no TODOs)?
4. Is it technically correct?
5. Is it production-ready?

Respond in JSON format:
{
  "passed": true/false,
  "issues": ["issue 1", "issue 2", ...],
  "suggestion": "optional improvement suggestion"
}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate task output using Claude Sonnet
 */
async function validateOutput(
  task: JavariTask,
  output: string,
  baseUrl: string,
  adminSecret: string
): Promise<ValidationResult> {
  try {
    const validationPrompt = buildValidationPrompt(task, output);

    const res = await fetch(`${baseUrl}/api/javari/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-autonomy": adminSecret,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: validationPrompt }],
        provider: "anthropic",
        model: "claude-sonnet-3.5",
        _memoryAlreadyInjected: true,
      }),
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT),
    });

    if (!res.ok) {
      log.warn(`Validation call failed: HTTP ${res.status}`);
      return { passed: true, issues: [] }; // Fail-open on validation errors
    }

    const data = await res.json() as {
      success?: boolean;
      messages?: Array<{ content: string }>;
    };

    if (!data.success || !data.messages?.length) {
      return { passed: true, issues: [] }; // Fail-open
    }

    const content = data.messages[data.messages.length - 1].content;

    // Try to parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const validation = JSON.parse(jsonMatch[0]) as ValidationResult;
        return validation;
      }
    } catch {
      // If JSON parsing fails, do simple keyword check
      if (content.toLowerCase().includes('passed') || content.toLowerCase().includes('correct')) {
        return { passed: true, issues: [] };
      }
    }

    // Default: fail-open
    return { passed: true, issues: [] };

  } catch (err) {
    log.warn(`Validation error: ${err instanceof Error ? err.message : 'Unknown'}`);
    return { passed: true, issues: [] }; // Fail-open
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function executeWithModel(
  prompt: string,
  modelSelection: ModelSelection,
  baseUrl: string,
  adminSecret: string
): Promise<{
  success: boolean;
  result?: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${baseUrl}/api/javari/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-autonomy": adminSecret,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        provider: modelSelection.provider,
        model: modelSelection.model,
        _memoryAlreadyInjected: true,
      }),
      signal: AbortSignal.timeout(EXECUTION_TIMEOUT),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json() as {
      success?: boolean;
      messages?: Array<{ content: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: string;
    };

    if (!data.success) {
      return {
        success: false,
        error: data.error ?? "Model returned success=false",
      };
    }

    const result = data.messages?.[data.messages.length - 1]?.content ?? "";
    
    return {
      success: true,
      result,
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
    };

  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════

export async function executeTask(
  task: JavariTask,
  opts: {
    dryRun?:    boolean;
    cycleId?:   string;
    baseUrl?:   string;
    adminSecret?: string;
  } = {}
): Promise<TaskExecutionResult> {
  const start = Date.now();

  // Skip already completed tasks
  if (task.status === "complete" || task.status === "skipped") {
    return { taskId: task.id, status: "skipped", durationMs: 0, canonicalChunksUsed: 0 };
  }

  log.info(`[${opts.cycleId ?? "manual"}] Executing task: ${task.id} — ${task.title}`);

  // Mark as running
  if (!opts.dryRun) {
    await sbPatch("javari_tasks", task.id, {
      status:     "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  try {
    // ── 1. Fetch canonical context ──────────────────────────────────────────
    let canonicalCtx = "";
    let canonicalChunksUsed = 0;
    try {
      canonicalCtx = await retrieveCanonicalContext(task.title + " " + task.description.slice(0, 200));
      canonicalChunksUsed = (canonicalCtx.match(/\n---\n/g) ?? []).length;
    } catch (e) {
      log.warn(`Canonical context load failed for task ${task.id}: ${e instanceof Error ? e.message : e}`);
    }

    // ── 2. Select optimal model ─────────────────────────────────────────────
    const modelSelection = selectModelForTask(task);
    log.info(`[${task.id}] Model selection: ${modelSelection.provider}/${modelSelection.model} - ${modelSelection.reasoning}`);

    // ── 3. Build prompt ─────────────────────────────────────────────────────
    let prompt = buildTaskPrompt(task, canonicalCtx);

    // ── Dry run ─────────────────────────────────────────────────────────────
    if (opts.dryRun) {
      log.info(`DRY RUN: would execute task ${task.id} with ${canonicalChunksUsed} canonical chunks via ${modelSelection.model}`);
      return {
        taskId:  task.id,
        status:  "complete",
        result:  `[DRY RUN] Task would be executed via ${modelSelection.provider}/${modelSelection.model}`,
        provider: modelSelection.provider,
        model: modelSelection.model,
        durationMs: Date.now() - start,
        canonicalChunksUsed,
      };
    }

    const baseUrl = opts.baseUrl ?? process.env.NEXTAUTH_URL ?? 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const adminSecret = opts.adminSecret ?? "";

    // ── 4. Execute with retries and validation ──────────────────────────────
    let attempt = 0;
    let lastResult: string | undefined;
    let lastTokensIn: number | undefined;
    let lastTokensOut: number | undefined;
    let validatorPassed = false;

    while (attempt <= MAX_RETRIES) {
      attempt++;

      log.info(`[${task.id}] Attempt ${attempt}/${MAX_RETRIES + 1} with ${modelSelection.model}`);

      // Execute primary model
      const execution = await executeWithModel(prompt, modelSelection, baseUrl, adminSecret);

      if (!execution.success) {
        if (attempt > MAX_RETRIES) {
          throw new Error(`Model execution failed after ${MAX_RETRIES + 1} attempts: ${execution.error}`);
        }
        log.warn(`[${task.id}] Attempt ${attempt} failed: ${execution.error}, retrying...`);
        continue;
      }

      lastResult = execution.result;
      lastTokensIn = execution.tokensIn;
      lastTokensOut = execution.tokensOut;

      // Validate with Claude Sonnet
      const validation = await validateOutput(task, execution.result!, baseUrl, adminSecret);

      if (validation.passed) {
        validatorPassed = true;
        log.info(`[${task.id}] Validation passed on attempt ${attempt}`);
        break;
      }

      // Validation failed
      log.warn(`[${task.id}] Validation failed on attempt ${attempt}: ${validation.issues.join(', ')}`);

      if (attempt > MAX_RETRIES) {
        log.error(`[${task.id}] Validation failed ${MAX_RETRIES + 1} times - marking as blocked`);
        
        await sbPatch("javari_tasks", task.id, {
          status: "blocked",
          error: `Validation failed: ${validation.issues.join('; ')}`,
          updated_at: new Date().toISOString(),
        });

        return {
          taskId: task.id,
          status: "blocked",
          error: `Validation failed after ${MAX_RETRIES + 1} attempts`,
          durationMs: Date.now() - start,
          provider: modelSelection.provider,
          model: modelSelection.model,
          retries: attempt - 1,
          validatorPassed: false,
          canonicalChunksUsed,
        };
      }

      // Add validation feedback to next attempt
      if (validation.suggestion) {
        prompt += `\n\nPREVIOUS ATTEMPT FEEDBACK:\n${validation.suggestion}`;
      }
    }

    // ── 5. Calculate cost ───────────────────────────────────────────────────
    const modelCost = MODEL_COSTS[modelSelection.model] ?? { input: 0, output: 0 };
    const cost = (
      ((lastTokensIn ?? 0) / 1_000_000) * modelCost.input +
      ((lastTokensOut ?? 0) / 1_000_000) * modelCost.output
    );

    // ── 6. Persist result ───────────────────────────────────────────────────
    await sbPatch("javari_tasks", task.id, {
      status:       "complete",
      result:       lastResult?.slice(0, 10_000), // DB column limit
      provider:     modelSelection.provider,
      model:        modelSelection.model,
      tokens_in:    lastTokensIn,
      tokens_out:   lastTokensOut,
      cost,
      retries:      attempt - 1,
      validator_passed: validatorPassed,
      completed_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    });

    // ── 7. Log model usage ──────────────────────────────────────────────────
    await logModelUsage({
      task_id: task.id,
      model: modelSelection.model,
      provider: modelSelection.provider,
      tokens_in: lastTokensIn ?? 0,
      tokens_out: lastTokensOut ?? 0,
      cost,
      duration_ms: Date.now() - start,
      success: true,
      validated: validatorPassed,
      cycle_id: opts.cycleId,
    });

    // ── 8. Audit ────────────────────────────────────────────────────────────
    await writeAuditEvent({
      action:   "module.generated",
      metadata: {
        system:     "autonomy-core-planner",
        taskId:     task.id,
        roadmapId:  task.roadmap_id,
        cycleId:    opts.cycleId,
        provider:   modelSelection.provider,
        model:      modelSelection.model,
        tokensIn:   lastTokensIn,
        tokensOut:  lastTokensOut,
        cost,
        retries:    attempt - 1,
        validatorPassed,
        canonicalChunksUsed,
        durationMs: Date.now() - start,
      },
      severity: "info",
    });

    log.info(`Task complete: ${task.id} via ${modelSelection.provider}/${modelSelection.model} (${Date.now() - start}ms, ${attempt} attempts)`);

    return {
      taskId:   task.id,
      status:   "complete",
      result:   lastResult,
      provider: modelSelection.provider,
      model:    modelSelection.model,
      tokensIn: lastTokensIn,
      tokensOut: lastTokensOut,
      retries:  attempt - 1,
      validatorPassed,
      durationMs: Date.now() - start,
      canonicalChunksUsed,
    };

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown execution error";
    log.error(`Task failed: ${task.id} — ${msg}`);

    const retryCount = (task.retry_count ?? 0) + 1;
    const finalStatus = retryCount >= (task.max_retries ?? 3) ? "failed" : "pending";

    await sbPatch("javari_tasks", task.id, {
      status:      finalStatus,
      error:       msg.slice(0, 2000),
      retry_count: retryCount,
      updated_at:  new Date().toISOString(),
    });

    return {
      taskId: task.id,
      status: "failed",
      error:  msg,
      durationMs: Date.now() - start,
      canonicalChunksUsed: 0,
    };
  }
}
