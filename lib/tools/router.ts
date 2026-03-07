// lib/tools/router.ts
// Purpose: Infrastructure Tool Router — central dispatch for GitHub, Vercel, Supabase
//          with guardrail pre-validation, execution logging, and rollback registry
// Date: 2026-03-07

import {
  ToolRequest, ToolCallResult, RollbackRecord, ToolCapability,
  ToolGuardrailResult, TOOL_LAYER_VERSION,
} from "./types";
import { executeGitHub, GITHUB_CAPABILITIES } from "./github";
import { executeVercel, VERCEL_CAPABILITIES } from "./vercel";
import { executeSupabase, SUPABASE_CAPABILITIES } from "./supabase";
import { checkKillSwitch } from "@/lib/execution/guardrails";
import { createClient } from "@supabase/supabase-js";

export { TOOL_LAYER_VERSION };

// ─── In-memory rollback registry ──────────────────────────────────────────
// Per-instance store. For multi-instance rollbacks, persist to Supabase instead.
const ROLLBACKS = new Map<string, RollbackRecord>();

// ─── All capabilities (exposed to AI models) ──────────────────────────────
export const ALL_CAPABILITIES: ToolCapability[] = [
  ...GITHUB_CAPABILITIES,
  ...VERCEL_CAPABILITIES,
  ...SUPABASE_CAPABILITIES,
];

// ─── Guardrail pre-check ───────────────────────────────────────────────────
function checkToolGuardrails(req: ToolRequest): ToolGuardrailResult {
  // 1. Global kill switch
  const ks = checkKillSwitch();
  if (ks.outcome !== "pass") {
    return { allowed: false, reason: `Kill switch active: ${ks.reason}`, riskLevel: "read" };
  }

  // 2. Find capability definition
  const cap = ALL_CAPABILITIES.find(c => c.tool === req.tool && c.action === req.action);
  if (!cap) {
    return { allowed: false, reason: `Unknown tool/action: ${req.tool}/${req.action}`, riskLevel: "read" };
  }

  // 3. Validate required params
  const missing: string[] = [];
  for (const [param, def] of Object.entries(cap.params)) {
    if (def.required && !(param in req.params)) missing.push(param);
  }
  if (missing.length > 0) {
    return {
      allowed: false,
      reason: `Missing required params: ${missing.join(", ")}`,
      riskLevel: cap.riskLevel,
    };
  }

  // 4. Destructive ops require explicit caller acknowledgment
  if (cap.riskLevel === "destructive" && req.calledBy !== "user") {
    return {
      allowed: false,
      reason: "Destructive operations require calledBy='user' acknowledgment",
      riskLevel: cap.riskLevel,
    };
  }

  return { allowed: true, reason: "All guardrails passed", riskLevel: cap.riskLevel };
}

// ─── Log to execution_logs ─────────────────────────────────────────────────
async function logToolExecution(
  req: ToolRequest,
  result: ToolCallResult
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from("execution_logs").insert([{
      execution_id: req.executionId ?? `tool-${Date.now()}`,
      task_id: `tool:${req.tool}:${req.action}`,
      model_used: `tool/${req.tool}`,
      cost: 0,
      tokens_in: 0,
      tokens_out: 0,
      execution_time: result.latencyMs,
      status: result.ok ? "success" : "failed",
      error_message: result.error ?? null,
      timestamp: new Date().toISOString(),
    }]);
  } catch {
    // Non-fatal — never let logging failure block tool execution
  }
}

// ─── Main dispatch ─────────────────────────────────────────────────────────
export async function dispatchTool(req: ToolRequest): Promise<ToolCallResult> {
  // Guardrail pre-check
  const guard = checkToolGuardrails(req);
  if (!guard.allowed) {
    const blocked: ToolCallResult = {
      ok: false,
      tool: req.tool,
      action: req.action,
      error: `BLOCKED: ${guard.reason}`,
      latencyMs: 0,
      riskLevel: guard.riskLevel,
    };
    return blocked;
  }

  // Dispatch to correct tool handler
  let result: ToolCallResult;
  try {
    switch (req.tool) {
      case "github":   result = await executeGitHub(req, ROLLBACKS);   break;
      case "vercel":   result = await executeVercel(req, ROLLBACKS);   break;
      case "supabase": result = await executeSupabase(req, ROLLBACKS); break;
      default:
        result = {
          ok: false, tool: req.tool, action: req.action,
          error: `Unknown tool: ${req.tool}. Available: github, vercel, supabase`,
          latencyMs: 0, riskLevel: "read",
        };
    }
  } catch (err: unknown) {
    result = {
      ok: false, tool: req.tool, action: req.action,
      error: (err as Error).message,
      latencyMs: 0, riskLevel: guard.riskLevel,
    };
  }

  // Log (non-blocking)
  logToolExecution(req, result).catch(() => {});

  return result;
}

// ─── Rollback ──────────────────────────────────────────────────────────────
export async function rollbackTool(rollbackId: string): Promise<{
  ok: boolean; message: string;
}> {
  const record = ROLLBACKS.get(rollbackId);
  if (!record) return { ok: false, message: `Rollback ID not found: ${rollbackId}` };
  if (record.used) return { ok: false, message: "Rollback already used" };
  if (Date.now() - new Date(record.createdAt).getTime() > record.ttlMs) {
    return { ok: false, message: "Rollback TTL expired" };
  }

  record.used = true;
  // For now: log the rollback intent — actual execution depends on tool
  console.log(`[tool-router] Rollback ${rollbackId} for ${record.tool}/${record.action}:`, record.reversalPayload);

  return { ok: true, message: `Rollback ${rollbackId} recorded — reversal queued` };
}

// ─── Capabilities manifest (for AI models) ────────────────────────────────
export function getCapabilities(toolFilter?: string): ToolCapability[] {
  if (toolFilter) return ALL_CAPABILITIES.filter(c => c.tool === toolFilter);
  return ALL_CAPABILITIES;
}
