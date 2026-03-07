// app/api/javari/tools/route.ts
// Purpose: Infrastructure Tool Router endpoint — execute GitHub/Vercel/Supabase tools
//          with guardrail pre-validation, execution logging, and rollback support.
//          Integrated with multi-AI router for model tool use.
//          Namespace: /api/javari/tools (avoids conflict with legacy /api/tools)
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import {
  dispatchTool, rollbackTool, getCapabilities, TOOL_LAYER_VERSION,
} from "@/lib/tools/router";
import { ToolRequest } from "@/lib/tools/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: List all available tool capabilities + health
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const toolFilter = url.searchParams.get("tool") ?? undefined;

  const capabilities = getCapabilities(toolFilter);

  return NextResponse.json({
    ok: true,
    tool_layer_version: TOOL_LAYER_VERSION,
    tools: ["github", "vercel", "supabase"],
    capabilities_count: capabilities.length,
    capabilities,
  });
}

// POST: Execute a tool call, or rollback a prior write/destructive operation
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json() as Record<string, unknown>;

    // ── Rollback path ──────────────────────────────────────────────────────
    if (url.searchParams.get("action") === "rollback") {
      const rollbackId = body.rollback_id as string;
      if (!rollbackId) {
        return NextResponse.json({ ok: false, error: "rollback_id required" }, { status: 400 });
      }
      const result = await rollbackTool(rollbackId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    // ── Tool execution path ────────────────────────────────────────────────
    const toolReq: ToolRequest = {
      tool:        body.tool        as string,
      action:      body.action      as string,
      params:      (body.params     as Record<string, unknown>) ?? {},
      executionId: body.execution_id as string | undefined,
      calledBy:    (body.called_by  as string) ?? "api",
    };

    if (!toolReq.tool || !toolReq.action) {
      return NextResponse.json(
        { ok: false, error: "Both 'tool' and 'action' are required fields" },
        { status: 400 }
      );
    }

    const result = await dispatchTool(toolReq);

    const status = result.ok
      ? 200
      : result.error?.includes("BLOCKED") ? 403 : 500;

    return NextResponse.json({
      ok: result.ok,
      tool_layer_version: TOOL_LAYER_VERSION,
      result,
    }, { status });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
