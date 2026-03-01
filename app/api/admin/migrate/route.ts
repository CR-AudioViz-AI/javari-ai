// app/api/admin/migrate/route.ts
// Migration runner — adds routing audit columns via direct SQL
// Gate: ADMIN_MODE=1

import { NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  // Use DATABASE_URL for direct SQL execution
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    return Response.json({ error: "No DATABASE_URL configured" }, { status: 500 });
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    const columns = [
      "routing_version TEXT",
      "routing_primary TEXT",
      "routing_chain JSONB",
      "routing_scores JSONB",
      "routing_weights JSONB",
      "capability_override TEXT",
    ];

    const results: Record<string, string> = {};

    for (const col of columns) {
      const name = col.split(" ")[0];
      try {
        await pool.query(`ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS ${col}`);
        results[name] = "added_or_exists";
      } catch (e) {
        results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // Verify
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ai_router_executions'
      AND column_name LIKE 'routing_%' OR column_name = 'capability_override'
      ORDER BY column_name
    `);

    await pool.end();

    return Response.json({
      success: true,
      results,
      verified_columns: rows.map((r: any) => r.column_name),
    });
  } catch (e) {
    try { await pool.end(); } catch {}
    return Response.json({
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
