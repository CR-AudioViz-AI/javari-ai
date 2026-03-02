// app/api/admin/test-registry/route.ts
// TEMPORARY: Test endpoint for model registry verification
// Allows toggling enabled flag and checking routing effects
// Delete after verification

import { NextRequest } from "next/server";
import { getRegistrySnapshot, getRegistryVersion, getActiveModelCount, initRegistry, buildDefaultChain, buildCapabilityChain } from "@/lib/javari/multi-ai/model-registry";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "status"; // "status", "disable", "enable"
  const provider = body.provider;
  const model = body.model;

  await initRegistry();

  if ((action === "disable" || action === "enable") && provider && model) {
    // Toggle enabled flag via Supabase Management API
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN;
    const projectRef = url?.match(/https:\/\/([^.]+)\./)?.[1];

    if (projectRef && mgmtToken) {
      const enabled = action === "enable";
      const sql = `UPDATE model_registry SET enabled = ${enabled}, updated_at = NOW() WHERE provider = '${provider}' AND model = '${model}';`;
      await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${mgmtToken}` },
        body: JSON.stringify({ query: sql }),
      });

      // Force re-sync
      // Hack: reset the cache by re-initializing (since _syncFromDb is not exported)
      // We'll just wait for the next sync cycle. In the meantime, return what the DB has.
    }
  }

  const snapshot = getRegistrySnapshot();
  const defaultChain = buildDefaultChain();
  const jsonChain = buildCapabilityChain("json_reliability", 4);
  const reasonChain = buildCapabilityChain("reasoning", 4);

  return Response.json({
    registry_version: getRegistryVersion(),
    active_models: getActiveModelCount(),
    total_cached: snapshot.length,
    source: getRegistryVersion().includes("static") ? "static_fallback" : "database",
    default_chain: defaultChain,
    json_chain: jsonChain,
    reasoning_chain: reasonChain,
    models: snapshot.map((m) => ({
      id: m.id,
      provider: m.provider,
      model_id: m.model_id,
      active: m.active,
      reasoning: m.capabilities.reasoning,
      json_reliability: m.capabilities.json_reliability,
      code_quality: m.capabilities.code_quality,
      cost: m.cost_per_1k_tokens,
      registry_version: m.registry_version,
    })),
  });
}
