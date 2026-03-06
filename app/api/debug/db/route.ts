import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("roadmap_tasks")
    .select("id,status");

  return Response.json({
    supabase_url: url,
    row_count: data ? data.length : 0,
    rows: data ?? [],
    error: error?.message ?? null,
  });
}
