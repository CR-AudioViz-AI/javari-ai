// app/api/admin/migrate/route.ts
// ONE-TIME migration endpoint — runs schema updates
// Protected by ADMIN_MODE env var
// DELETE THIS FILE after migration completes

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return new Response(JSON.stringify({ error: "Admin mode disabled" }), { status: 403 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: string[] = [];

  // Add columns one by one (idempotent — Supabase ignores if already exists via RPC)
  const columns = [
    { name: "routing_version", type: "text" },
    { name: "routing_primary", type: "text" },
    { name: "routing_chain", type: "jsonb" },
    { name: "routing_scores", type: "jsonb" },
    { name: "routing_weights", type: "jsonb" },
    { name: "capability_override", type: "text" },
  ];

  for (const col of columns) {
    try {
      // Try selecting the column — if it works, it exists
      const { error: testErr } = await sb
        .from("ai_router_executions")
        .select(col.name)
        .limit(1);

      if (!testErr) {
        results.push(`${col.name}: already exists`);
        continue;
      }

      // Column doesn't exist — use raw SQL via RPC if available, or use alter
      // Since Supabase REST doesn't support DDL, we'll use the rpc approach
      const { error: rpcErr } = await sb.rpc("exec_sql", {
        query: `ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
      });

      if (rpcErr) {
        // Fallback: try inserting a test row with the column to trigger auto-creation
        // (This won't work for Supabase — columns must be added manually)
        results.push(`${col.name}: needs manual creation (${rpcErr.message})`);
      } else {
        results.push(`${col.name}: created`);
      }
    } catch (err) {
      results.push(`${col.name}: error — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Also try the DO $$ block approach via raw SQL
  const migrationSql = `
    ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_version TEXT;
    ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_primary TEXT;
    ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_chain JSONB;
    ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_scores JSONB;
    ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_weights JSONB;
    ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS capability_override TEXT;
  `;

  // Try exec_sql RPC
  const { error: sqlErr } = await sb.rpc("exec_sql", { query: migrationSql });
  if (sqlErr) {
    results.push(`exec_sql RPC: ${sqlErr.message}`);
  } else {
    results.push("exec_sql RPC: SUCCESS — all columns added");
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
