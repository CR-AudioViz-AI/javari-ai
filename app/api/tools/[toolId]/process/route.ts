// app/api/tools/[toolId]/process/route.ts
// Javari AI — Universal Tool Process Route
// Purpose: Single handler for all tool executions. Replace individual stub routes.
// Auth via session cookie. Credits checked and deducted. AI is real.
// Date: 2026-03-09

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeTool, TOOL_REGISTRY } from "@/lib/tools/toolEngine";

export const runtime  = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { toolId: string } }
) {
  const { toolId } = params;

  // ── Auth — session cookie (no Bearer token needed) ──────────────────────
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();

  if (!user) {
    return Response.json({ success: false, error: "Please sign in to use this tool." }, { status: 401 });
  }

  // ── Validate tool exists ────────────────────────────────────────────────
  if (!TOOL_REGISTRY[toolId]) {
    return Response.json(
      { success: false, error: `Tool "${toolId}" not found.` },
      { status: 404 }
    );
  }

  // ── Parse input ─────────────────────────────────────────────────────────
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  // Accept both 'input' and 'description' for backward compat
  const input = body.input ?? body.description ?? body.text ?? body.content ?? "";

  if (!input?.trim()) {
    return Response.json({ success: false, error: "Input is required." }, { status: 400 });
  }

  // ── Execute tool ─────────────────────────────────────────────────────────
  const result = await executeTool(toolId, user.id, input, body);

  if (!result.success) {
    return Response.json(
      { success: false, error: result.error },
      { status: result.code ?? 500 }
    );
  }

  // ── Return result ────────────────────────────────────────────────────────
  const tool = TOOL_REGISTRY[toolId];
  return Response.json({
    success:     true,
    output:      result.output,
    result:      result.output,    // legacy compat
    parsed:      result.parsed,
    creditsUsed: result.creditsUsed,
    remainingCredits: undefined,   // fetched client-side
    tool:        tool.name,
  });
}

export async function GET() {
  return Response.json(
    { error: "Use POST to execute tools." },
    { status: 405 }
  );
}
