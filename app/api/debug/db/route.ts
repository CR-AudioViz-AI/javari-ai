import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(url, key);

  const { count, error } = await supabase
    .from("roadmap_tasks")
    .select("*", { count: "exact", head: true });

  return Response.json({
    supabase_url: url,
    roadmap_tasks_count: count ?? 0,
    error: error?.message ?? null,
  });
}
