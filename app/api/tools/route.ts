// app/api/tools/route.ts
// Purpose: Infrastructure Tool Layer HTTP endpoint — execute tools, get capabilities,
//          rollback operations. Integrated with multi-AI router for model tool use.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import {
  dispatchTool, rollbackTool, getCapabilities, TOOL_LAYER_VERSION,
} from "@/lib/tools/router";
import { ToolRequest } from "@/lib/tools/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: List available capabilities + health
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tool = url.searchParams.get("tool") ?? undefined;

  const capabilities = getCapabilities(tool);

  return NextResponse.json({
    ok: true,
    tool_layer_version: TOOL_LAYER_VERSION,
    tools: ["github", "vercel", "supabase"],
    capabilities_count: capabilities.length,
    capabilities,
  });
}

// POST: Execute a tool call or rollback
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json() as Record<string, unknown>;

    // Rollback path
    if (url.searchParams.get("action") === "rollback") {
      const rollbackId = body.rollback_id as string;
      if (!rollbackId) {
        return NextResponse.json({ ok: false, error: "rollback_id required" }, { status: 400 });
      }
      const result = await rollbackTool(rollbackId);
      return NextResponse.json(result);
    }

    // Tool execution path
    const toolReq: ToolRequest = {
      tool:        body.tool        as string,
      action:      body.action      as string,
      params:      (body.params     as Record<string, unknown>) ?? {},
      executionId: body.execution_id as string | undefined,
      calledBy:    (body.called_by  as string) ?? "api",
    };

    if (!toolReq.tool || !toolReq.action) {
      return NextResponse.json(
        { ok: false, error: "tool and action are required" },
        { status: 400 }
      );
    }

    const result = await dispatchTool(toolReq);

    return NextResponse.json({
      ok: result.ok,
      tool_layer_version: TOOL_LAYER_VERSION,
      result,
    }, {
      status: result.ok ? 200 : (result.error?.includes("BLOCKED") ? 403 : 500),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
