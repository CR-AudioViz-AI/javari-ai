import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "no creds" });
  
  const sb = createClient(url, key);
  
  // Test 1: query model_registry
  const t1 = await sb.from("model_registry").select("*").eq("enabled", true);
  
  // Test 2: query with rpc
  const t2 = await sb.rpc("", {}).catch(() => null);
  
  return Response.json({
    model_registry: {
      data: t1.data?.length ?? 0,
      error: t1.error?.message ?? null,
      status: t1.status,
    },
  });
}
