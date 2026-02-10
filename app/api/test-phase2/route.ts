import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "VerifyForge Phase 2 Test API is running",
    timestamp: Date.now(),
    tests: [
      {
        name: "API Live Check",
        status: "passed",
        details: "The test-phase2 endpoint is responding correctly."
      },
      {
        name: "Router Endpoint Check",
        status: "pending",
        endpoint: "/api/javari/router"
      },
      {
        name: "Environment Variable Check",
        status: "pending",
        required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
      }
    ]
  });
}
