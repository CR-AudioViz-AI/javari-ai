// lib/javari/tools/tool-runner.ts
// Javari — Secure Tool Execution Layer
// Typed tool registry with risk-gated execution and sanitized Supabase logging.
// Tools represent external system integrations: DB queries, payments, deploys, commits.
// High-risk tools require explicit caller approval — never auto-execute.
// Logs every invocation to ai_generations (tool_type, parameters, result, status).
// Created: April 24, 2026
// Updated: April 24, 2026 — runTool returns ApprovalRequired object for high-risk tools instead of throwing

import { createAdminClient } from '@/lib/supabase/server'

const supabaseAdmin = createAdminClient()

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToolRisk = 'low' | 'medium' | 'high'

export interface Tool<TInput = unknown, TOutput = unknown> {
  name:        string
  description: string
  risk:        ToolRisk
  run:         (input: TInput) => Promise<TOutput>
}

export interface ToolContext {
  /** User ID making the request — required for logging and approval scope */
  userId:      string
  /** Execution ID from the TEAM engine, if this tool is called from a plan */
  executionId?: string
  /** Explicitly approved by the user for this invocation (required for high-risk tools) */
  approved:    boolean
}

export interface ToolRunResult<T = unknown> {
  success:    boolean
  output?:    T
  error?:     string
  tool:       string
  risk:       ToolRisk
  durationMs: number
  logId?:     string
}

// Returned by runTool when tool.risk === 'high' && !context.approved
// The caller must present this to the user and re-call runTool with approved=true
export interface ApprovalRequired {
  requiresApproval: true
  tool:             string
  risk:             ToolRisk
  description:      string
  input:            unknown   // sanitized — secrets already stripped
}

export type ToolResult<T = unknown> = ToolRunResult<T> | ApprovalRequired

/** Type guard: narrows ToolResult to ApprovalRequired */
export function isApprovalRequired(r: ToolResult): r is ApprovalRequired {
  return (r as ApprovalRequired).requiresApproval === true
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitize — removes secrets from logged input/output
// Strips any field whose key contains: key, token, secret, password, auth, bearer
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_KEY_PATTERN = /key|token|secret|password|auth|bearer|credential|api_key/i

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]'
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(v => sanitize(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY_PATTERN.test(k) ? '[redacted]' : sanitize(v, depth + 1)
  }
  return out
}

// Truncate large outputs to avoid inflating Supabase rows
function truncateForLog(value: unknown, maxChars = 2000): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return str.length > maxChars ? str.slice(0, maxChars) + '…[truncated]' : str
}

// ─────────────────────────────────────────────────────────────────────────────
// Log to Supabase (ai_generations table)
// Non-fatal — logs silently on error rather than blocking tool output.
// ─────────────────────────────────────────────────────────────────────────────

async function logToolExecution(
  ctx:     ToolContext,
  tool:    Tool,
  input:   unknown,
  result:  ToolRunResult,
): Promise<string | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_generations')
      .insert({
        user_id:    ctx.userId,
        tool_type:  `javari.tool.${tool.name}`,
        prompt:     truncateForLog(sanitize(input)),
        parameters: {
          tool:        tool.name,
          risk:        tool.risk,
          approved:    ctx.approved,
          executionId: ctx.executionId ?? null,
          durationMs:  result.durationMs,
        },
        result_url: null,
        status:     result.success ? 'completed' : 'failed',
        // Store sanitized output in parameters.result (not a dedicated column)
      })
      .update({
        parameters: {
          tool:        tool.name,
          risk:        tool.risk,
          approved:    ctx.approved,
          executionId: ctx.executionId ?? null,
          durationMs:  result.durationMs,
          result:      result.success
            ? truncateForLog(sanitize(result.output))
            : undefined,
          error:       result.error ?? undefined,
        },
      })
      .select('id')
      .single()

    if (error) {
      console.error(`[tool-runner] log failed for ${tool.name}: ${error.message}`)
      return undefined
    }
    return (data as { id?: string } | null)?.id
  } catch (err) {
    console.error(`[tool-runner] log threw for ${tool.name}:`, err)
    return undefined
  }
}

// Simpler single-insert version (avoids the insert+update pattern above)
async function logExecution(
  ctx:       ToolContext,
  toolName:  string,
  risk:      ToolRisk,
  input:     unknown,
  result:    ToolRunResult,
): Promise<string | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_generations')
      .insert({
        user_id:   ctx.userId,
        tool_type: `javari.tool.${toolName}`,
        prompt:    truncateForLog(sanitize(input)),
        parameters: {
          tool:        toolName,
          risk,
          approved:    ctx.approved,
          executionId: ctx.executionId ?? null,
          durationMs:  result.durationMs,
          success:     result.success,
          error:       result.error ?? null,
          output:      result.success
            ? truncateForLog(sanitize(result.output))
            : null,
        },
        status: result.success ? 'completed' : 'failed',
      })
      .select('id')
      .single()

    if (error) {
      console.error(`[tool-runner] log failed for ${toolName}: ${error.message}`)
      return undefined
    }
    return (data as { id?: string } | null)?.id
  } catch (err) {
    console.error(`[tool-runner] log threw for ${toolName}:`, err)
    return undefined
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// Each tool reads credentials from process.env — never from caller input.
// Callers pass semantic input only (query text, plan_slug, message, etc.).
// ─────────────────────────────────────────────────────────────────────────────

// ── supabase.query ────────────────────────────────────────────────────────────
// Risk: medium — reads live DB data, no mutations
interface SupabaseQueryInput {
  table:   string
  select?: string
  filter?: Record<string, unknown>
  limit?:  number
}

const supabaseQueryTool: Tool<SupabaseQueryInput> = {
  name:        'supabase.query',
  description: 'Read rows from a Supabase table. No mutations.',
  risk:        'medium',
  async run(input) {
    const { table, select = '*', filter = {}, limit = 50 } = input
    let query = supabaseAdmin.from(table).select(select).limit(limit)
    for (const [col, val] of Object.entries(filter)) {
      query = query.eq(col, val as string)
    }
    const { data, error } = await query
    if (error) throw new Error(`supabase.query failed: ${error.message}`)
    return data
  },
}

// ── stripe.create_checkout ────────────────────────────────────────────────────
// Risk: medium — creates a payment session (no charge until user completes)
interface StripeCheckoutInput {
  priceId:    string
  email:      string
  successUrl?: string
  cancelUrl?:  string
}

const stripeCheckoutTool: Tool<StripeCheckoutInput> = {
  name:        'stripe.create_checkout',
  description: 'Create a Stripe hosted checkout session for a subscription price.',
  risk:        'medium',
  async run(input) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
    // Dynamic import avoids bundling Stripe in every Lambda
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
    const session = await stripe.checkout.sessions.create({
      mode:             'subscription',
      line_items:       [{ price: input.priceId, quantity: 1 }],
      customer_email:   input.email,
      success_url:      input.successUrl ?? 'https://craudiovizai.com/javari?success=true',
      cancel_url:       input.cancelUrl  ?? 'https://craudiovizai.com/javari?canceled=true',
    })
    return { url: session.url, sessionId: session.id }
  },
}

// ── vercel.deploy ─────────────────────────────────────────────────────────────
// Risk: HIGH — triggers a production deployment
interface VercelDeployInput {
  projectId: string
  ref?:      string   // git ref to deploy (default: main)
  target?:   'production' | 'preview'
}

const vercelDeployTool: Tool<VercelDeployInput> = {
  name:        'vercel.deploy',
  description: 'Trigger a Vercel deployment for a project. Requires approval.',
  risk:        'high',
  async run(input) {
    const token  = process.env.VERCEL_TOKEN
    const teamId = process.env.VERCEL_TEAM_ID ?? 'team_Z0yef7NlFu1coCJWz8UmUdI5'
    if (!token) throw new Error('VERCEL_TOKEN not configured')
    const res = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${teamId}`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name:   input.projectId,
          gitSource: {
            type: 'github',
            ref:  input.ref ?? 'main',
          },
          target: input.target ?? 'preview',
        }),
      }
    )
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`vercel.deploy failed (${res.status}): ${body.slice(0, 200)}`)
    }
    const data = await res.json() as Record<string, unknown>
    return { deploymentId: data['id'], url: data['url'], state: data['readyState'] }
  },
}

// ── github.commit ─────────────────────────────────────────────────────────────
// Risk: HIGH — writes to a repository
interface GithubCommitInput {
  repo:    string   // 'CR-AudioViz-AI/craudiovizai'
  path:    string   // file path in repo
  content: string   // file content (will be base64 encoded)
  message: string   // commit message
  branch?: string   // target branch (default: main)
  sha?:    string   // current file SHA (required for updates)
}

const githubCommitTool: Tool<GithubCommitInput> = {
  name:        'github.commit',
  description: 'Write a file to a GitHub repository via the Contents API. Requires approval.',
  risk:        'high',
  async run(input) {
    const token = process.env.GH_PAT ?? process.env.GITHUB_TOKEN
    if (!token) throw new Error('GH_PAT / GITHUB_TOKEN not configured')
    const branch  = input.branch ?? 'main'
    const encoded = Buffer.from(input.content).toString('base64')
    const body: Record<string, unknown> = {
      message: input.message,
      content: encoded,
      branch,
    }
    if (input.sha) body['sha'] = input.sha
    const res = await fetch(
      `https://api.github.com/repos/${input.repo}/contents/${input.path}`,
      {
        method:  'PUT',
        headers: {
          Authorization:  `token ${token}`,
          'Content-Type': 'application/json',
          Accept:         'application/vnd.github.v3+json',
        },
        body: JSON.stringify(body),
      }
    )
    if (!res.ok) {
      const err = await res.json() as Record<string, unknown>
      throw new Error(`github.commit failed (${res.status}): ${err['message'] ?? 'unknown'}`)
    }
    const data = await res.json() as Record<string, unknown>
    const content = data['content'] as Record<string, unknown> | undefined
    return {
      sha:  content?.['sha'],
      path: content?.['path'],
      url:  content?.['html_url'],
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY: Record<string, Tool> = {
  [supabaseQueryTool.name]:   supabaseQueryTool   as Tool,
  [stripeCheckoutTool.name]:  stripeCheckoutTool  as Tool,
  [vercelDeployTool.name]:    vercelDeployTool     as Tool,
  [githubCommitTool.name]:    githubCommitTool     as Tool,
}

// ─────────────────────────────────────────────────────────────────────────────
// runTool
// Main entry point. Validates, gates, executes, logs.
//
// Safety guarantees:
//   1. Unknown tool names throw immediately.
//   2. High-risk tools require ctx.approved === true — no implicit approval.
//   3. All inputs are sanitized before logging (secrets never reach Supabase).
//   4. All executions are logged regardless of success/failure.
//   5. Credentials are read from process.env inside each tool — never from input.
// ─────────────────────────────────────────────────────────────────────────────

export async function runTool<TOutput = unknown>(
  name:    string,
  input:   unknown,
  context: ToolContext,
): Promise<ToolResult<TOutput>> {
  // ── 1. Registry lookup ─────────────────────────────────────────────────────
  const tool = REGISTRY[name]
  if (!tool) {
    throw new Error(
      `runTool: unknown tool "${name}". Available: ${Object.keys(REGISTRY).join(', ')}`
    )
  }

  // ── 2. Risk gate — return ApprovalRequired instead of throwing ────────────
  // Callers check isApprovalRequired(result) and surface to the user.
  // Re-call runTool with context.approved = true after user confirms.
  if (tool.risk === 'high' && !context.approved) {
    const approval: ApprovalRequired = {
      requiresApproval: true,
      tool:             name,
      risk:             'high',
      description:      tool.description,
      input:            sanitize(input),   // strip secrets before surfacing to UI
    }
    // Log the approval request (non-fatal)
    try {
      await supabaseAdmin.from('ai_generations').insert({
        user_id:   context.userId,
        tool_type: `javari.tool.${name}.approval_requested`,
        prompt:    truncateForLog(sanitize(input)),
        parameters: { tool: name, risk: 'high', approved: false, executionId: context.executionId ?? null },
        status: 'pending',
      })
    } catch { /* non-fatal */ }
    return approval
  }

  // ── 3. Execute ─────────────────────────────────────────────────────────────
  const startMs = Date.now()
  let   result:  ToolRunResult<TOutput>

  try {
    const output = await tool.run(input) as TOutput
    result = {
      success:    true,
      output,
      tool:       name,
      risk:       tool.risk,
      durationMs: Date.now() - startMs,
    }
  } catch (err: unknown) {
    result = {
      success:    false,
      error:      err instanceof Error ? err.message : String(err),
      tool:       name,
      risk:       tool.risk,
      durationMs: Date.now() - startMs,
    }
  }

  // ── 4. Log (non-blocking) ──────────────────────────────────────────────────
  result.logId = await logExecution(context, name, tool.risk, input, result)

  // ── 5. Re-throw on failure (not ApprovalRequired — that returned early above) ──
  if (!result.success) {
    throw new Error(result.error)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// listTools — returns the registry manifest (no credentials, no internals)
// ─────────────────────────────────────────────────────────────────────────────

export function listTools(): { name: string; description: string; risk: ToolRisk }[] {
  return Object.values(REGISTRY).map(t => ({
    name:        t.name,
    description: t.description,
    risk:        t.risk,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export types for callers
// ─────────────────────────────────────────────────────────────────────────────

export type { ToolContext, ToolRunResult, ToolRisk }
