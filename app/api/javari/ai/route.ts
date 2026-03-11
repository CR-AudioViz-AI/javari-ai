// app/api/javari/ai/route.ts
// Purpose: Universal Javari AI endpoint — all platform AI calls route through here.
//          POST body: { task_type, prompt, context?, system?, max_tokens?, json?, model?, provider? }
//          GET: returns router health, supported task types, and recent telemetry.
// Date: 2026-03-11

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { JavariRouter, type TaskType, type ProviderName } from "@/lib/javari/router";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 120;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

const VALID_TASK_TYPES: TaskType[] = [
  "simple_task",
  "reasoning_task",
  "code_task",
  "validation_task",
  "documentation_task",
];

const VALID_PROVIDERS: ProviderName[] = [
  "anthropic", "openai", "groq", "mistral", "together", "ollama", "replicate", "deepinfra",
];

// ── GET — health check + telemetry ────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const client = db();

  let recentLogs: Array<{
    task_type: string; model_used: string; provider: string;
    latency_ms: number; cost_usd: number; ok: boolean; created_at: string;
  }> = [];

  let totalRequests = 0;
  let successRate   = 0;
  let avgLatencyMs  = 0;
  let totalCostUsd  = 0;

  try {
    const { data: logs } = await client
      .from("ai_router_logs")
      .select("task_type, model_used, provider, latency_ms, cost_usd, ok, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (logs && logs.length > 0) {
      recentLogs    = logs as typeof recentLogs;
      totalRequests = logs.length;
      const succeeded = logs.filter((l: { ok: boolean }) => l.ok).length;
      successRate     = Math.round((succeeded / totalRequests) * 100);
      avgLatencyMs    = Math.round(logs.reduce((s: number, l: { latency_ms?: number }) => s + (l.latency_ms ?? 0), 0) / totalRequests);
      totalCostUsd    = logs.reduce((s: number, l: { cost_usd?: number }) => s + (l.cost_usd ?? 0), 0);
    }
  } catch {
    // Table may not exist yet — graceful degradation
  }

  return NextResponse.json({
    ok: true,
    router: "Javari Universal AI Router",
    version: "1.0.0",
    supportedTaskTypes: VALID_TASK_TYPES,
    supportedProviders: VALID_PROVIDERS,
    telemetry: {
      totalRequests,
      successRate: `${successRate}%`,
      avgLatencyMs,
      totalCostUsd: totalCostUsd.toFixed(4),
    },
    recentLogs: recentLogs.slice(0, 10),
    timestamp: new Date().toISOString(),
  });
}

// ── POST — route AI request ───────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    task_type,
    prompt,
    system,
    context,
    max_tokens,
    json: wantJson,
    model,
    provider,
  } = body as {
    task_type?  : string;
    prompt?     : string;
    system?     : string;
    context?    : Record<string, unknown>;
    max_tokens? : number;
    json?       : boolean;
    model?      : string;
    provider?   : string;
  };

  // Validate required fields
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
  }

  const taskType: TaskType = VALID_TASK_TYPES.includes(task_type as TaskType)
    ? (task_type as TaskType)
    : "simple_task";

  const forceProvider = VALID_PROVIDERS.includes(provider as ProviderName)
    ? (provider as ProviderName)
    : undefined;

  const result = await JavariRouter.generate({
    taskType,
    prompt       : prompt.trim(),
    system       : typeof system === "string" ? system : undefined,
    context,
    maxTokens    : typeof max_tokens === "number" ? max_tokens : undefined,
    json         : wantJson === true,
    forceModel   : typeof model === "string" ? model : undefined,
    forceProvider,
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      provider: result.provider,
      model:    result.model,
      latencyMs: Date.now() - t0,
    }, { status: 502 });
  }

  return NextResponse.json({
    ok:        true,
    content:   result.content,
    provider:  result.provider,
    model:     result.model,
    taskType:  result.taskType,
    tokens: {
      in:  result.tokensIn,
      out: result.tokensOut,
    },
    costUsd:   result.costUsd,
    latencyMs: result.latencyMs,
    timestamp: new Date().toISOString(),
  });
}
