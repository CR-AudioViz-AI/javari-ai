// app/api/factory/route.ts
// Javari Module Factory API — /api/factory
// 2026-02-20 — STEP 4 implementation
//
// POST /api/factory
//   Body: { moduleName, description, options?, stream?, inspect? }
//   inspect=true → return blueprint only (no generation)
//   stream=true  → SSE stream of factory events + final bundle
//   stream=false → buffered JSON response
//
// GET /api/factory
//   Returns factory system status

import { NextRequest } from "next/server";
import { buildBlueprint, blueprintToPlanningSummary } from "@/lib/javari/factory/blueprint";
import { runModuleFactory, type FactoryEvent, type FactoryOptions }
  from "@/lib/javari/factory/module-factory";

export const maxDuration = 180;   // 3 min max for large modules
export const runtime     = "nodejs";

// ── GET — status ──────────────────────────────────────────────────────────────

export async function GET() {
  return Response.json({
    success:    true,
    status:     "operational",
    version:    "factory-v1",
    capabilities: [
      "blueprint_generation",
      "react_page_generator",
      "api_route_generator",
      "supabase_schema_generator",
      "ui_component_generator",
      "utility_module_generator",
      "types_generator",
      "multi_agent_orchestration",
      "conflict_resolution",
      "sse_streaming",
      "ready_to_commit_bundle",
    ],
    generators: {
      reactPage:       "architect + engineer pipeline",
      apiRoute:        "engineer + validator (high-risk)",
      supabaseSchema:  "json_specialist (Mistral strict)",
      uiComponent:     "architect + engineer",
      utilityModule:   "engineer (Claude Sonnet)",
      types:           "engineer (Claude Sonnet) + validator",
    },
    timestamp: new Date().toISOString(),
  });
}

// ── POST — generate ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    moduleName?:  string;
    description?: string;
    options?:     FactoryOptions;
    inspect?:     boolean;
    stream?:      boolean;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const moduleName  = body.moduleName?.trim()  ?? "";
  const description = body.description?.trim() ?? "";

  if (!moduleName) {
    return Response.json(
      { success: false, error: "moduleName is required" },
      { status: 400 }
    );
  }
  if (!description) {
    return Response.json(
      { success: false, error: "description is required" },
      { status: 400 }
    );
  }

  const options     = body.options   ?? {};
  const inspectOnly = body.inspect   ?? false;
  const streamMode  = body.stream    ?? true;

  // ── Inspect-only: return blueprint ─────────────────────────────────────────
  if (inspectOnly) {
    try {
      const bp = buildBlueprint(moduleName, description, options);
      return Response.json({
        success:   true,
        blueprint: {
          moduleId:    bp.moduleId,
          moduleName:  bp.moduleName,
          slug:        bp.slug,
          complexity:  bp.complexity,
          auth:        bp.auth,
          summary:     blueprintToPlanningSummary(bp),
          routes:      bp.routes,
          apis:        bp.apis,
          components:  bp.components.map((c) => ({ name: c.name, path: c.path, description: c.description })),
          database:    bp.database?.map((d) => ({ tableName: d.tableName, columns: d.columns.length })),
          estimatedTasks: bp.estimatedTasks,
          needsRealtime:  bp.needsRealtime,
          needsSearch:    bp.needsSearch,
        },
      });
    } catch (err) {
      return Response.json(
        { success: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // ── SSE streaming ──────────────────────────────────────────────────────────
  if (streamMode) {
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        function enq(event: FactoryEvent): void {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          } catch { /* client disconnected */ }
        }

        const result = await runModuleFactory(moduleName, description, enq, options);

        // Send final bundle as last SSE event
        if (result.bundle) {
          enq({
            type:       "factory_done",
            moduleId:   result.bundle.moduleId,
            moduleName,
            timestamp:  new Date().toISOString(),
            meta: {
              success:        result.success,
              successFiles:   result.bundle.successFiles,
              failedFiles:    result.bundle.failedFiles,
              readyToCommit:  result.bundle.readyToCommit,
              durationMs:     result.durationMs,
              files: result.bundle.files.map((f) => ({
                path:      f.path,
                category:  f.category,
                lineCount: f.lineCount,
                charCount: f.charCount,
                agentRole: f.agentRole,
              })),
              // Include full file contents in final event for client to save
              fileContents: Object.fromEntries(
                result.bundle.files.map((f) => [f.path, f.content])
              ),
            },
          });
        }

        try { controller.close(); } catch { /* already closed */ }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type":      "text/event-stream",
        "Cache-Control":     "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection:          "keep-alive",
        "X-Factory-Version": "factory-v1",
      },
    });
  }

  // ── Buffered mode ──────────────────────────────────────────────────────────
  const events: FactoryEvent[] = [];
  const result = await runModuleFactory(
    moduleName, description,
    (e) => events.push(e),
    options
  );

  if (!result.success || !result.bundle) {
    return Response.json(
      { success: false, error: result.error ?? "Factory returned no bundle" },
      { status: 500 }
    );
  }

  return Response.json({
    success:       result.success,
    moduleName,
    moduleId:      result.bundle.moduleId,
    durationMs:    result.durationMs,
    successFiles:  result.bundle.successFiles,
    failedFiles:   result.bundle.failedFiles,
    readyToCommit: result.bundle.readyToCommit,
    warnings:      result.bundle.warnings,
    files: result.bundle.files.map((f) => ({
      path:           f.path,
      category:       f.category,
      lineCount:      f.lineCount,
      charCount:      f.charCount,
      agentRole:      f.agentRole,
      validationScore: f.validationScore,
    })),
    fileContents: Object.fromEntries(
      result.bundle.files.map((f) => [f.path, f.content])
    ),
    events: events.map((e) => ({ type: e.type, fileId: e.fileId, timestamp: e.timestamp })),
  });
}
