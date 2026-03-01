// app/api/admin/migrate/route.ts
// ONE-TIME migration — adds routing audit columns
// Uses Supabase pooler from DATABASE_URL components
// DELETE after migration

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const results: string[] = [];

  // Parse DATABASE_URL for password, then build pooler URL
  const origUrl = process.env.DATABASE_URL ?? "";
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const refMatch = sbUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = refMatch?.[1];

  // Extract password from DATABASE_URL  
  const passMatch = origUrl.match(/:([^@]+)@/);
  const password = passMatch?.[1] ?? process.env.SUPABASE_DB_PASSWORD ?? "";

  if (!projectRef || !password) {
    return Response.json({
      results: [`Missing: projectRef=${!!projectRef} password=${!!password}`],
    }, { status: 500 });
  }

  // Build pooler connection string
  // Format: postgresql://postgres.{ref}:{password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres
  const poolerUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  results.push(`Connecting to pooler (ref: ${projectRef})`);

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ 
      connectionString: poolerUrl, 
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    const columns = [
      "routing_version TEXT",
      "routing_primary TEXT",
      "routing_chain JSONB",
      "routing_scores JSONB",
      "routing_weights JSONB",
      "capability_override TEXT",
    ];

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

    // Verify
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'ai_router_executions' 
      AND (column_name LIKE 'routing_%' OR column_name = 'capability_override')
      ORDER BY column_name;
    `);
    results.push(`Verified columns: ${rows.map((r: any) => r.column_name).join(", ")}`);

    await pool.end();
  } catch (err: any) {
    results.push(`Connection error: ${err.message}`);
  }

  return Response.json({ results }, { status: 200 });
}
