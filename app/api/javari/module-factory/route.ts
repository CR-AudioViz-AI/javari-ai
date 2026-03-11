// app/api/javari/module-factory/route.ts
// Purpose: Autonomous Module Factory API — trigger gap detection and task generation,
//          query module registry metrics, and inspect capability state.
//
// GET  → module metrics (total, complete, missing, by_capability)
// POST → run factory: detect gaps and generate roadmap tasks
//        Body: { maxGapsToFill?: number, dryRun?: boolean, capabilities?: string[] }
//
// Date: 2026-03-11

import { NextRequest, NextResponse }   from "next/server";
import { runModuleFactory, getModuleMetrics, CAPABILITY_CATEGORIES } from "@/lib/javari/moduleFactory";
import { createClient }                from "@supabase/supabase-js";

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

// GET — factory status and module metrics
export async function GET(): Promise<NextResponse> {
  try {
    const metrics = await getModuleMetrics();

    // Recent module registry entries
    const { data: recent } = await db()
      .from("module_registry")
      .select("module_name, capability, status, version, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      ok         : true,
      endpoint   : "Javari Module Factory v1.0",
      capabilities: CAPABILITY_CATEGORIES,
      metrics,
      recent_modules: recent ?? [],
      timestamp  : new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

// POST — run factory
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const maxGapsToFill = typeof body.maxGapsToFill === "number" ? body.maxGapsToFill : 10;
  const dryRun        = body.dryRun === true;
  const capabilities  = Array.isArray(body.capabilities)
    ? (body.capabilities as string[]).filter(c => (CAPABILITY_CATEGORIES as readonly string[]).includes(c)) as typeof CAPABILITY_CATEGORIES[number][]
    : undefined;

  const result = await runModuleFactory({ maxGapsToFill, dryRun, capabilities });

  return NextResponse.json({
    ok              : result.ok,
    gapsFound       : result.gapsFound,
    tasksGenerated  : result.tasksGenerated,
    modulesRegistered: result.modulesRegistered,
    dryRun,
    gaps            : result.gaps.slice(0, 20),
    errors          : result.errors,
    durationMs      : result.durationMs,
    timestamp       : new Date().toISOString(),
  }, { status: result.ok ? 200 : 500 });
}
