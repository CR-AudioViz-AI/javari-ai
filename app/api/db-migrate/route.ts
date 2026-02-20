// app/api/db-migrate/route.ts
// ONE-SHOT migration relay — executes 004_javari_autonomous_engine.sql
// Uses pg (node-postgres) with Supabase DB URL
// 2026-02-20 — STEP 2 SQL bootstrap

import { NextResponse } from "next/server";
import { Pool } from "pg";

const MIGRATION_SQL = "-- Javari Autonomous Engine \u2014 Task State + Heartbeat Tables\n-- 2026-02-20 \u2014 STEP 2 migration\n\nCREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n\n-- \u2500\u2500 javari_task_state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nCREATE TABLE IF NOT EXISTS javari_task_state (\n  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  goal_id          TEXT NOT NULL,\n  task_id          TEXT NOT NULL,\n  task_title       TEXT NOT NULL DEFAULT '',\n  task_type        TEXT NOT NULL DEFAULT 'generation'\n                     CHECK (task_type IN ('analysis','generation','validation',\n                                         'memory','api_call','decision','aggregation')),\n  status           TEXT NOT NULL DEFAULT 'pending'\n                     CHECK (status IN ('pending','running','validating','done',\n                                       'failed','retrying','skipped','escalated')),\n  attempt          INTEGER NOT NULL DEFAULT 0,\n  max_attempts     INTEGER NOT NULL DEFAULT 3,\n  output           TEXT,\n  error            TEXT,\n  provider         TEXT,\n  model            TEXT,\n  validation_score  NUMERIC CHECK (validation_score >= 0 AND validation_score <= 100),\n  validation_passed BOOLEAN,\n  memory_chunk_id  TEXT,\n  routing_meta     JSONB DEFAULT '{}'::JSONB,\n  started_at       TIMESTAMPTZ,\n  completed_at     TIMESTAMPTZ,\n  duration_ms      INTEGER,\n  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS uidx_task_state_goal_task\n  ON javari_task_state (goal_id, task_id);\n\nCREATE INDEX IF NOT EXISTS idx_task_state_goal_id   ON javari_task_state (goal_id);\nCREATE INDEX IF NOT EXISTS idx_task_state_status     ON javari_task_state (status);\nCREATE INDEX IF NOT EXISTS idx_task_state_started_at ON javari_task_state (started_at)\n  WHERE status = 'running';\n\nCREATE OR REPLACE FUNCTION update_task_state_updated_at()\nRETURNS TRIGGER LANGUAGE plpgsql AS $$\nBEGIN\n  NEW.updated_at = NOW();\n  RETURN NEW;\nEND;\n$$;\n\nDROP TRIGGER IF EXISTS trg_task_state_updated_at ON javari_task_state;\nCREATE TRIGGER trg_task_state_updated_at\n  BEFORE UPDATE ON javari_task_state\n  FOR EACH ROW EXECUTE FUNCTION update_task_state_updated_at();\n\nALTER TABLE javari_task_state ENABLE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS \"service_role_full_access\" ON javari_task_state;\nCREATE POLICY \"service_role_full_access\"\n  ON javari_task_state FOR ALL\n  USING (auth.role() = 'service_role')\n  WITH CHECK (auth.role() = 'service_role');\n\n-- \u2500\u2500 javari_heartbeat_log \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nCREATE TABLE IF NOT EXISTS javari_heartbeat_log (\n  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  stuck_tasks      TEXT[]  DEFAULT '{}',\n  recovered_tasks  TEXT[]  DEFAULT '{}',\n  active_goals     INTEGER DEFAULT 0,\n  health_score     NUMERIC DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),\n  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\n\nCREATE INDEX IF NOT EXISTS idx_heartbeat_created_at ON javari_heartbeat_log (created_at DESC);\n\nALTER TABLE javari_heartbeat_log ENABLE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS \"service_role_full_access_heartbeat\" ON javari_heartbeat_log;\nCREATE POLICY \"service_role_full_access_heartbeat\"\n  ON javari_heartbeat_log FOR ALL\n  USING (auth.role() = 'service_role')\n  WITH CHECK (auth.role() = 'service_role');\n\n-- \u2500\u2500 active goals view \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nCREATE OR REPLACE VIEW javari_active_goals AS\nSELECT\n  goal_id,\n  COUNT(*) FILTER (WHERE status = 'done')    AS done_tasks,\n  COUNT(*) FILTER (WHERE status = 'failed')  AS failed_tasks,\n  COUNT(*) FILTER (WHERE status = 'running') AS running_tasks,\n  COUNT(*) FILTER (WHERE status = 'pending') AS pending_tasks,\n  COUNT(*)                                   AS total_tasks,\n  MAX(started_at)                            AS last_activity,\n  MIN(created_at)                            AS started_at\nFROM javari_task_state\nWHERE status NOT IN ('done','skipped')\nGROUP BY goal_id;\n\nCOMMENT ON TABLE javari_task_state    IS 'Javari autonomous engine \u2014 per-task execution state';\nCOMMENT ON TABLE javari_heartbeat_log IS 'Javari autonomous engine \u2014 heartbeat health analytics';\n";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  // Supabase DB connection string format
  const connStr = process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD || "oce@N251812345"}@db.kteobfyferrukqeolofj.supabase.co:5432/postgres`;
  pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });
  return pool;
}

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { secret?: string };
  
  if ((body.secret ?? "") !== "step2_migrate_2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = await getPool().connect();
  const results: Array<{ stmt: string; ok: boolean; error?: string }> = [];
  
  try {
    // Run entire migration as a single transaction
    await client.query("BEGIN");
    
    // Split on semicolons but respect function bodies
    // We run the whole thing as one block for safety
    await client.query(MIGRATION_SQL);
    
    await client.query("COMMIT");
    results.push({ stmt: "FULL_MIGRATION", ok: true });
    
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ stmt: "FULL_MIGRATION", ok: false, error: msg });
  } finally {
    client.release();
  }

  const allOk = results.every((r) => r.ok);
  
  // Verify tables were created
  let tablesCreated: string[] = [];
  if (allOk) {
    const verifyClient = await getPool().connect();
    try {
      const r = await verifyClient.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('javari_task_state','javari_heartbeat_log')
        ORDER BY table_name
      `);
      tablesCreated = r.rows.map((row: { table_name: string }) => row.table_name);
    } finally {
      verifyClient.release();
    }
  }

  return NextResponse.json({
    success: allOk,
    results,
    tablesCreated,
    timestamp: new Date().toISOString(),
  });
}
