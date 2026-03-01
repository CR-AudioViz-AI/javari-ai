// app/api/admin/migrate/route.ts  
// ONE-TIME migration — adds routing audit columns via pg pooler
// Protected by ADMIN_MODE. DELETE after migration.

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const results: string[] = [];
  
  // Build pooler connection string from components
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(
    /https:\/\/([a-z0-9]+)\.supabase\.co/
  )?.[1];
  
  let connString = process.env.DATABASE_URL ?? "";
  
  // Fix: replace direct db hostname with pooler hostname
  if (connString.includes(".supabase.co")) {
    connString = connString
      .replace(/db\.[a-z0-9]+\.supabase\.co/, `aws-0-us-east-1.pooler.supabase.com`)
      .replace(":5432/", ":6543/");
    if (!connString.includes("pgbouncer=true")) {
      connString += connString.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
    }
    results.push(`Using pooler connection (ref: ${projectRef})`);
  } else if (dbPassword && projectRef) {
    connString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
    results.push("Built pooler connection from components");
  } else {
    results.push("No usable DATABASE_URL or components found");
    return Response.json({ results }, { status: 500 });
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

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

    // Verify columns exist
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'ai_router_executions' 
      AND column_name LIKE 'routing_%' OR column_name = 'capability_override'
      ORDER BY column_name;
    `);
    results.push(`Verified columns: ${rows.map((r: any) => r.column_name).join(", ")}`);

    await pool.end();
  } catch (err: any) {
    results.push(`Connection error: ${err.message}`);
  }

  return Response.json({ results }, { status: 200 });
}
