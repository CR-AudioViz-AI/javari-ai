import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRegistryVersion, getActiveModelCount, initRegistry, getRegistrySnapshot } from "@/lib/javari/multi-ai/model-registry";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  let dbResult: any = null;
  let dbError: any = null;
  
  if (url && key) {
    try {
      const client = createClient(url, key);
      const { data, error } = await client
        .from("model_registry")
        .select("*")
        .eq("enabled", true)
        .order("provider", { ascending: true });
      dbResult = data;
      dbError = error;
    } catch (err: any) {
      dbError = err.message;
    }
  }

  // Force init
  await initRegistry();
  
  return Response.json({
    supabase_url: url?.slice(0, 30) + "...",
    has_service_key: !!key,
    db_query: {
      row_count: dbResult?.length ?? 0,
      error: dbError,
      sample: dbResult?.slice(0, 2) ?? null,
    },
    cache: {
      registry_version: getRegistryVersion(),
      active_models: getActiveModelCount(),
      snapshot_count: getRegistrySnapshot().length,
      first_model: getRegistrySnapshot()[0]?.id ?? null,
    },
  });
}
