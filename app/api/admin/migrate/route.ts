// app/api/admin/migrate/route.ts

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const results: string[] = [];
  const origUrl = process.env.DATABASE_URL ?? "";
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const refMatch = sbUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = refMatch?.[1] ?? "unknown";

  // Parse the original URL
  let parsed: URL;
  try {
    parsed = new URL(origUrl);
    results.push(`Original: user=${parsed.username} host=${parsed.hostname} port=${parsed.port} db=${parsed.pathname}`);
  } catch {
    results.push("Failed to parse DATABASE_URL");
    return Response.json({ results }, { status: 500 });
  }

  // Strategy 1: Use original URL as-is (direct connection)
  // Strategy 2: Swap to pooler with same credentials  
  // Strategy 3: Use Supabase transaction mode pooler
  
  const strategies = [
    {
      name: "pooler-session",
      url: (() => {
        const u = new URL(origUrl);
        u.hostname = `aws-0-us-east-1.pooler.supabase.com`;
        u.port = "5432";
        u.username = `postgres.${projectRef}`;
        return u.toString();
      })(),
    },
    {
      name: "pooler-transaction",
      url: (() => {
        const u = new URL(origUrl);
        u.hostname = `aws-0-us-east-1.pooler.supabase.com`;
        u.port = "6543";
        u.username = `postgres.${projectRef}`;
        return u.toString();
      })(),
    },
    {
      name: "direct-ipv4",
      url: origUrl,
    },
  ];

  for (const strategy of strategies) {
    results.push(`\nTrying ${strategy.name}...`);
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: strategy.url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });

      // Test connection
      const { rows: test } = await pool.query("SELECT 1 as ok");
      if (test[0]?.ok === 1) {
        results.push(`${strategy.name}: ✅ Connected!`);

        // Run migration
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
            await pool.query(`ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS ${colDef};`);
            results.push(`${colName}: ✅`);
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
        results.push(`Columns: ${rows.map((r: any) => r.column_name).join(", ")}`);

        await pool.end();
        return Response.json({ results, success: true });
      }
      await pool.end();
    } catch (err: any) {
      results.push(`${strategy.name}: ❌ ${err.message}`);
    }
  }

  return Response.json({ results, success: false }, { status: 500 });
}
