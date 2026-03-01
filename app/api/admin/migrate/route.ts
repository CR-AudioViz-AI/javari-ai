// app/api/admin/migrate/route.ts
// TEMPORARY: Run schema migration for routing audit columns
// Delete this file after migration completes

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return new Response(JSON.stringify({ error: "Admin mode disabled" }), { status: 403 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const columns = [
    { name: "routing_version",      type: "TEXT" },
    { name: "routing_primary",      type: "TEXT" },
    { name: "routing_chain",        type: "JSONB" },
    { name: "routing_scores",       type: "JSONB" },
    { name: "routing_weights",      type: "JSONB" },
    { name: "capability_override",  type: "TEXT" },
  ];

  const results: Array<{ column: string; status: string }> = [];

  for (const col of columns) {
    // Check if column exists
    const { data: existing } = await sb
      .from("information_schema.columns" as any)
      .select("column_name")
      .eq("table_name", "ai_router_executions")
      .eq("column_name", col.name)
      .limit(1);

    if (existing && existing.length > 0) {
      results.push({ column: col.name, status: "already_exists" });
      continue;
    }

    // Add column via raw SQL using rpc (need to create a helper function first)
    // Actually, Supabase doesn't let us query information_schema via REST easily
    // Let's just try inserting with the new columns and see what happens
    results.push({ column: col.name, status: "needs_manual_add" });
  }

  // Alternative: Try a test insert with the new columns to see which ones exist
  const testResult = await sb.from("ai_router_executions").insert({
    provider: "__migration_test__",
    latency_ms: 0,
    success: false,
    error_type: "migration_test",
    routing_version: "test",
    routing_primary: "test",
    routing_chain: ["test"],
    routing_scores: { test: 0 },
    routing_weights: { test: 0 },
    capability_override: "test",
  });

  if (testResult.error) {
    // Columns don't exist — need to add them
    return new Response(JSON.stringify({
      status: "columns_missing",
      error: testResult.error.message,
      hint: "Run this SQL in Supabase Dashboard:\n" + columns.map(c => 
        `ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS ${c.name} ${c.type};`
      ).join("\n"),
      results,
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  // Clean up test row
  await sb.from("ai_router_executions")
    .delete()
    .eq("provider", "__migration_test__");

  return new Response(JSON.stringify({
    status: "columns_exist",
    message: "All routing audit columns present",
    results,
  }, null, 2), { headers: { "Content-Type": "application/json" } });
}
