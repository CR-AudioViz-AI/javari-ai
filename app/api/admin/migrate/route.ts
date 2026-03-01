// app/api/admin/migrate/route.ts
// Migration: add routing audit columns to ai_router_executions
// Uses pg Pool with DATABASE_URL, falls back to constructed URL
// Gate: ADMIN_MODE=1

import { NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  // Build connection string from available env vars
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    (process.env.SUPABASE_PROJECT_REF && process.env.SUPABASE_DB_PASSWORD
      ? `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
      : null);

  if (!dbUrl) {
    return Response.json({
      error: "No database connection available",
      available_env: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        SUPABASE_DB_URL: !!process.env.SUPABASE_DB_URL,
        SUPABASE_PROJECT_REF: !!process.env.SUPABASE_PROJECT_REF,
        SUPABASE_DB_PASSWORD: !!process.env.SUPABASE_DB_PASSWORD,
      },
    }, { status: 500 });
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

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
        results[name] = "ok";
      } catch (e) {
        results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // Verify
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ai_router_executions'
        AND (column_name LIKE 'routing_%' OR column_name = 'capability_override')
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
      hint: "Check DATABASE_URL or SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD env vars",
    }, { status: 500 });
  }
}
