import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), "supabase/migrations/aree_phase3.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    
    // Execute raw SQL
    const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
    
    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
      }, { status: 500 });
    }
    
    return NextResponse.json({
      ok: true,
      message: "Migration executed successfully",
      tables: [
        "roadmaps",
        "roadmap_tasks", 
        "roadmap_executions",
        "roadmap_locks",
        "roadmap_costs",
        "user_monthly_usage",
        "user_subscriptions"
      ]
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
    }, { status: 500 });
  }
}
