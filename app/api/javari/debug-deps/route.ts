// app/api/javari/debug-deps/route.ts
// Purpose: One-shot diagnostic — expose pending task dep state to diagnose worker block.
// Date: 2026-03-10
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";
export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
  // Get pending tasks
  const { data: pending } = await db.from("roadmap_tasks")
    .select("id, title, depends_on, source, phase_id")
    .eq("status", "pending").limit(25);
  // Get completed IDs
  const { data: done } = await db.from("roadmap_tasks")
    .select("id").eq("status", "completed");
  const doneSet = new Set((done ?? []).map((r: {id:string}) => r.id));
  // Analyze each pending task
  const analysis = (pending ?? []).map((t: {id:string;title:string;depends_on:string[]|null;source:string;phase_id:string}) => {
    const deps = t.depends_on ?? [];
    const unmet = deps.filter((d:string) => !doneSet.has(d));
    const depsExistAtAll = deps.filter((d:string) => {
      // check if the dep ID exists anywhere in roadmap_tasks (any status)
      return true; // we'll check below
    });
    return {
      id: t.id,
      title: t.title.slice(0,50),
      phase_id: t.phase_id,
      source: t.source,
      deps_total: deps.length,
      deps_unmet: unmet.length,
      unmet_ids: unmet,
      executable: deps.length === 0 || unmet.length === 0,
    };
  });
  // Also check if any dep IDs exist in the table at all
  const allDepIds = [...new Set(analysis.flatMap((t: {unmet_ids:string[]}) => t.unmet_ids))];
  let depExistence: Record<string,boolean> = {};
  if (allDepIds.length > 0) {
    const { data: found } = await db.from("roadmap_tasks")
      .select("id").in("id", allDepIds);
    const foundSet = new Set((found ?? []).map((r: {id:string}) => r.id));
    for (const id of allDepIds) {
      depExistence[id] = foundSet.has(id);
    }
  }
  const executable = analysis.filter((t: {executable:boolean}) => t.executable);
  return NextResponse.json({
    total_pending: pending?.length ?? 0,
    executable_count: executable.length,
    analysis,
    dep_existence: depExistence,
    kill_switch: process.env.JAVARI_EXECUTION_ENABLED ?? "UNSET",
  });
}
