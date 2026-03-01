// app/api/admin/migrate/route.ts  
// Migration: add routing audit columns to ai_router_executions
// Tries Supabase pooler connection first, then DATABASE_URL
// Gate: ADMIN_MODE=1

import { NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function tryConnect(url: string, label: string): Promise<{ pool: Pool; label: string } | null> {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await pool.query("SELECT 1");
    return { pool, label };
  } catch {
    try { await pool.end(); } catch {}
    return null;
  }
}

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  // Try multiple connection strategies
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  const dbUrl = process.env.DATABASE_URL;

  const attempts: Array<[string, string]> = [];
  
  // Strategy 1: Supabase pooler (session mode, port 5432)
  if (ref && pwd) {
    attempts.push([
      `postgresql://postgres.${ref}:${pwd}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      "pooler-session"
    ]);
  }
  
  // Strategy 2: Supabase pooler (transaction mode, port 6543)
  if (ref && pwd) {
    attempts.push([
      `postgresql://postgres.${ref}:${pwd}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
      "pooler-transaction"
    ]);
  }

  // Strategy 3: Direct DATABASE_URL
  if (dbUrl) {
    attempts.push([dbUrl, "DATABASE_URL"]);
  }

  // Strategy 4: Direct connection with project ref
  if (ref && pwd) {
    attempts.push([
      `postgresql://postgres:${pwd}@db.${ref}.supabase.co:5432/postgres`,
      "direct"
    ]);
  }

  if (attempts.length === 0) {
    return Response.json({
      error: "No database credentials available",
      env: {
        SUPABASE_PROJECT_REF: !!ref,
        SUPABASE_DB_PASSWORD: !!pwd,
        DATABASE_URL: !!dbUrl,
      },
    }, { status: 500 });
  }

  let connection: { pool: Pool; label: string } | null = null;
  const tried: string[] = [];

  for (const [url, label] of attempts) {
    tried.push(label);
    connection = await tryConnect(url, label);
    if (connection) break;
  }

  if (!connection) {
    return Response.json({
      error: "All connection strategies failed",
      tried,
      env: {
        SUPABASE_PROJECT_REF: !!ref,
        SUPABASE_DB_PASSWORD: !!pwd,
        DATABASE_URL: !!dbUrl,
      },
    }, { status: 500 });
  }

  const { pool, label } = connection;

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

    // Reload PostgREST schema cache
    try {
      await pool.query("NOTIFY pgrst, 'reload schema'");
      results["schema_reload"] = "notified";
    } catch {
      results["schema_reload"] = "skipped";
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
      connection: label,
      tried,
      results,
      verified_columns: rows.map((r: any) => r.column_name),
    });
  } catch (e) {
    try { await pool.end(); } catch {}
    return Response.json({
      error: e instanceof Error ? e.message : String(e),
      connection: label,
    }, { status: 500 });
  }
}
