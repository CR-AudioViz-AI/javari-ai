import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const db = createAdminClient();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET';
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'UNKNOWN';
    
    console.log("[debug] Connecting to Supabase:", supabaseUrl);
    console.log("[debug] Project ref:", projectRef);
    
    // Query for the specific user
    const { data, error } = await db
      .from("user_subscriptions")
      .select("user_id, plan_tier, status")
      .eq("user_id", "roy_test_user");
    
    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        errorDetails: error,
        supabaseUrl,
        projectRef,
      });
    }
    
    // Also get total count
    const { count, error: countError } = await db
      .from("user_subscriptions")
      .select("*", { count: 'exact', head: true });
    
    return NextResponse.json({
      ok: true,
      supabaseUrl,
      projectRef,
      expectedRef: "kteobfyferrukqeolofj",
      match: projectRef === "kteobfyferrukqeolofj",
      query: "SELECT user_id, plan_tier, status FROM user_subscriptions WHERE user_id = 'roy_test_user'",
      result: data,
      rowCount: data?.length || 0,
      totalRowsInTable: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}
