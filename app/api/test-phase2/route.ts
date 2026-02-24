import { NextResponse } from "next/server";

export async function GET() {
  const tests = [];
  
  // Test 1: API Live Check
  tests.push({
    name: "API Live Check",
    status: "passed",
    details: "The test-phase2 endpoint is responding correctly."
  });
  
  // Test 2: Router Endpoint Check
  try {
    const routerResponse = await fetch(
      'https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app/api/javari/router',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    
    const routerPassed = routerResponse.status === 401;
    tests.push({
      name: "Router Endpoint Check",
      status: routerPassed ? "passed" : "failed",
      endpoint: "/api/javari/router",
      details: routerPassed 
        ? "Router correctly returns 401 Unauthorized without auth" 
        : `Unexpected status: ${routerResponse.status}`,
      receivedStatus: routerResponse.status,
      expectedStatus: 401
    });
  } catch (error) {
    tests.push({
      name: "Router Endpoint Check",
      status: "failed",
      endpoint: "/api/javari/router",
      details: `Failed to connect: ${error}`
    });
  }
  
  // Test 3: Environment Variable Check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const envVarsPassed = !!(supabaseUrl && supabaseKey);
  
  tests.push({
    name: "Environment Variable Check",
    status: envVarsPassed ? "passed" : "failed",
    required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    details: envVarsPassed 
      ? "All required environment variables are configured" 
      : "Missing required environment variables",
    found: {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseKey
    }
  });
  
  return NextResponse.json({
    ok: true,
    message: "VerifyForge Phase 2 Test API - Enhanced",
    timestamp: Date.now(),
    tests
  });
}
