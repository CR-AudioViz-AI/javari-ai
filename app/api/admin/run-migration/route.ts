// app/api/admin/run-migration/route.ts
// Execute schema migration for routing audit columns
// Uses Supabase service role to call the pg REST SQL endpoint
// Protected by ADMIN_MODE=1

import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MIGRATION_SQL = `
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_version TEXT;
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_primary TEXT;
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_chain JSONB;
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_scores JSONB;
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS routing_weights JSONB;
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS capability_override TEXT;
`;

const VERIFY_SQL = `
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_router_executions'
  AND column_name IN ('routing_version','routing_primary','routing_chain','routing_scores','routing_weights','capability_override')
ORDER BY column_name;
`;

async function execSQL(sql: string): Promise<{ data: any; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { data: null, error: "Missing Supabase credentials" };

  // Supabase exposes a SQL execution endpoint for service role at /pg/query
  // This is undocumented but available on all Supabase instances
  const pgUrl = `${url}/pg/query`;

  const res = await fetch(pgUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "apikey": key,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json();
  return { data, error: null };
}

async function execSQLViaRPC(sql: string): Promise<{ data: any; error: string | null }> {
  // Fallback: Use Supabase REST to call a plpgsql function
  // First try to create the function, then call it
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { data: null, error: "Missing Supabase credentials" };

  // Try the /rest/v1/rpc endpoint with a dynamically created function
  // This won't work if exec_sql doesn't exist. Let's try another approach:
  // Use the Supabase Management API's SQL endpoint

  const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) return { data: null, error: "Cannot extract project ref" };

  // Supabase Management API: POST /v1/projects/{ref}/database/query
  // Requires SUPABASE_ACCESS_TOKEN (management token), not service role
  // Let's check if we have that
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!mgmtToken) return { data: null, error: "No management token available" };

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${mgmtToken}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Mgmt API ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json();
  return { data, error: null };
}

async function execSQLViaConnect(sql: string): Promise<{ data: any; error: string | null }> {
  // Third approach: Use Supabase's connect endpoint for direct pg
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { data: null, error: "Missing Supabase credentials" };

  // Supabase has a /rest/v1/ endpoint but it doesn't support raw SQL
  // However, we can use the @supabase/supabase-js client's .rpc() if we
  // first create a helper function. Let's try creating the function via
  // the management API, or use the pg HTTP gateway.

  // Actually, the most reliable approach for Supabase hosted:
  // POST to {url}/rest/v1/rpc/{function_name} after creating the function

  // Let's try a completely different approach: use the postgres connection
  // via the Supabase pg bouncer connection string
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { data: null, error: "No DATABASE_URL" };

  // Use pg module to connect directly
  try {
    // Dynamic import to avoid build errors if pg isn't installed
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();
    try {
      const result = await client.query(sql);
      return { data: result.rows ?? result, error: null };
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    return { data: null, error: `pg connect: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const t0 = Date.now();
  const results: Array<{ method: string; success: boolean; error?: string; data?: any }> = [];

  // ── Credential check ──
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasDbUrl = !!process.env.DATABASE_URL;
  const hasMgmt = !!(process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN);

  // ── Try methods in order of reliability ──

  // Method 1: Direct pg connection (most reliable for DDL)
  if (hasDbUrl) {
    const r = await execSQLViaConnect(MIGRATION_SQL);
    results.push({ method: "pg_direct", success: !r.error, error: r.error ?? undefined, data: r.data });
    if (!r.error) {
      // Verify
      const v = await execSQLViaConnect(VERIFY_SQL);
      const columns = v.data ?? [];
      return Response.json({
        success: true,
        method: "pg_direct",
        duration_ms: Date.now() - t0,
        columns_added: columns,
        credentials: { url: hasUrl, key: hasKey, db: hasDbUrl, mgmt: hasMgmt },
        results,
      });
    }
  }

  // Method 2: Supabase Management API
  if (hasMgmt) {
    const r = await execSQLViaRPC(MIGRATION_SQL);
    results.push({ method: "management_api", success: !r.error, error: r.error ?? undefined, data: r.data });
    if (!r.error) {
      const v = await execSQLViaRPC(VERIFY_SQL);
      const columns = v.data ?? [];
      return Response.json({
        success: true,
        method: "management_api",
        duration_ms: Date.now() - t0,
        columns_added: columns,
        credentials: { url: hasUrl, key: hasKey, db: hasDbUrl, mgmt: hasMgmt },
        results,
      });
    }
  }

  // Method 3: Supabase pg/query endpoint
  if (hasUrl && hasKey) {
    const r = await execSQL(MIGRATION_SQL);
    results.push({ method: "pg_query", success: !r.error, error: r.error ?? undefined, data: r.data });
    if (!r.error) {
      const v = await execSQL(VERIFY_SQL);
      const columns = v.data ?? [];
      return Response.json({
        success: true,
        method: "pg_query",
        duration_ms: Date.now() - t0,
        columns_added: columns,
        credentials: { url: hasUrl, key: hasKey, db: hasDbUrl, mgmt: hasMgmt },
        results,
      });
    }
  }

  // All methods failed
  return Response.json({
    success: false,
    duration_ms: Date.now() - t0,
    credentials: { url: hasUrl, key: hasKey, db: hasDbUrl, mgmt: hasMgmt },
    results,
    manual_sql: MIGRATION_SQL.trim(),
  });
}
