// app/api/javari/tools/vercel/selftest/route.ts
// Self-test endpoint for Vercel Read Tool

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/javari-tools-init';
import { vercelReadTool } from '@/lib/javari-vercel-tool';

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    tool_enabled: vercelReadTool.enabled(),
    tests: [] as any[],
    overall: 'PENDING' as 'PASS' | 'FAIL' | 'PENDING',
  };

  // Register tool
  toolRegistry.registerTool(vercelReadTool);

  // Test 1: Check if tool is enabled
  results.tests.push({
    name: 'Tool Enabled Check',
    status: vercelReadTool.enabled() ? 'PASS' : 'FAIL',
    message: vercelReadTool.enabled() 
      ? 'Vercel Read Tool is enabled' 
      : 'Vercel Read Tool is disabled (check FEATURE_VERCEL_READ, VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID)',
  });

  if (!vercelReadTool.enabled()) {
    results.overall = 'FAIL';
    return NextResponse.json(results);
  }

  // Test 2: List 3 recent deployments
  try {
    const deploymentsResult = await toolRegistry.executeTool('vercel_read', {
      action: 'listRecentDeployments',
      limit: 3,
    });

    results.tests.push({
      name: 'List Recent Deployments',
      status: deploymentsResult.success ? 'PASS' : 'FAIL',
      message: deploymentsResult.success 
        ? `Found ${deploymentsResult.data?.length || 0} recent deployments` 
        : deploymentsResult.error,
      deployments: deploymentsResult.success 
        ? deploymentsResult.data?.map((d: any) => ({
            uid: d.uid.substring(0, 12) + '...',
            url: d.url,
            state: d.state,
            created: new Date(d.created).toISOString(),
          }))
        : undefined,
    });

    if (!deploymentsResult.success) {
      results.overall = 'FAIL';
      return NextResponse.json(results);
    }

    // Test 3: Get events for latest deployment
    const latestDeployment = deploymentsResult.data?.[0];
    if (latestDeployment) {
      const eventsResult = await toolRegistry.executeTool('vercel_read', {
        action: 'getDeploymentEvents',
        deploymentId: latestDeployment.uid,
        limit: 50,
      });

      results.tests.push({
        name: 'Get Deployment Events',
        status: eventsResult.success ? 'PASS' : 'FAIL',
        message: eventsResult.success 
          ? `Retrieved ${eventsResult.data?.events?.length || 0} events` 
          : eventsResult.error,
        has_errors: eventsResult.success && eventsResult.data?.errorSummary ? true : false,
        error_summary: eventsResult.success 
          ? eventsResult.data?.errorSummary?.substring(0, 200)
          : undefined,
      });
    }

  } catch (error: any) {
    results.tests.push({
      name: 'List Recent Deployments',
      status: 'FAIL',
      message: error.message,
    });
    results.overall = 'FAIL';
    return NextResponse.json(results);
  }

  // Determine overall status
  const allPassed = results.tests.every(t => t.status === 'PASS');
  results.overall = allPassed ? 'PASS' : 'FAIL';

  return NextResponse.json(results, {
    status: allPassed ? 200 : 500,
  });
}
