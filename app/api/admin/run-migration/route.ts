// app/api/admin/run-migration/route.ts
// Temporary: Schema migration for quarantine columns on ai_provider_health
// Delete after migration succeeds

import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MIGRATION_SQL = `
ALTER TABLE ai_provider_health ADD COLUMN IF NOT EXISTS quarantined BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_provider_health ADD COLUMN IF NOT EXISTS quarantine_until TIMESTAMPTZ;
ALTER TABLE ai_provider_health ADD COLUMN IF NOT EXISTS failure_burst_count INT DEFAULT 0;
ALTER TABLE ai_provider_health ADD COLUMN IF NOT EXISTS last_failure_window_start TIMESTAMPTZ;
`;

const VERIFY_SQL = `
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_provider_health'
  AND column_name IN ('quarantined','quarantine_until','failure_burst_count','last_failure_window_start')
ORDER BY column_name;
`;

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const t0 = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN;

  if (!url || !mgmtToken) {
    return Response.json({ error: "Missing credentials" }, { status: 500 });
  }

  const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) {
    return Response.json({ error: "Cannot extract project ref" }, { status: 500 });
  }

  // Run migration
  const migRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${mgmtToken}` },
    body: JSON.stringify({ query: MIGRATION_SQL }),
  });

  if (!migRes.ok) {
    const text = await migRes.text();
    return Response.json({ error: `Migration failed: ${migRes.status}`, detail: text.slice(0, 300) }, { status: 500 });
  }

  // Verify
  const verRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${mgmtToken}` },
    body: JSON.stringify({ query: VERIFY_SQL }),
  });

  const columns = verRes.ok ? await verRes.json() : [];

  return Response.json({
    success: true,
    duration_ms: Date.now() - t0,
    columns_added: columns,
  });
}
