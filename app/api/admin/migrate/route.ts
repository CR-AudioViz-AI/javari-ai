// app/api/admin/migrate/route.ts
// ONE-TIME migration endpoint — adds routing audit columns
// Protected by ADMIN_MODE env var
// DELETE THIS FILE after migration completes

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: string[] = [];
  const columns = [
    "routing_version TEXT",
    "routing_primary TEXT",
    "routing_chain JSONB",
    "routing_scores JSONB",
    "routing_weights JSONB",
    "capability_override TEXT",
  ];

  // Approach: Use Supabase's raw SQL via the pg_net extension or 
  // the database connection string directly
  const dbUrl = process.env.DATABASE_URL;
  
  if (dbUrl) {
    // Use pg directly
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      
      for (const colDef of columns) {
        const colName = colDef.split(" ")[0];
        try {
          await pool.query(
            `ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS ${colDef};`
          );
          results.push(`${colName}: ✅ added/exists`);
        } catch (err: any) {
          results.push(`${colName}: ❌ ${err.message}`);
        }
      }
      
      await pool.end();
      results.push("Connection: closed cleanly");
    } catch (err: any) {
      results.push(`pg connection failed: ${err.message}`);
    }
  } else {
    results.push("DATABASE_URL not set — cannot run DDL");
    
    // Fallback: try inserting a row with the new columns to test
    const { error } = await sb.from("ai_router_executions").insert({
      provider: "__migration_test__",
      latency_ms: 0,
      success: true,
      routing_version: "test",
      routing_primary: "test",
      routing_chain: ["test"],
      routing_scores: { test: 0 },
      routing_weights: { test: 0 },
      capability_override: "test",
    });
    
    if (error) {
      results.push(`Test insert: ${error.message}`);
    } else {
      results.push("Test insert succeeded — columns exist!");
      // Clean up test row
      await sb.from("ai_router_executions").delete().eq("provider", "__migration_test__");
      results.push("Test row cleaned up");
    }
  }

  return Response.json({ results }, { status: 200 });
}
