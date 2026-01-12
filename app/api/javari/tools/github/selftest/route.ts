// app/api/javari/tools/github/selftest/route.ts
// Self-test endpoint for GitHub Read Tool

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/javari-tool-registry';
import { githubReadTool } from '@/lib/javari-github-tool';

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    tool_enabled: githubReadTool.enabled(),
    tests: [] as any[],
    overall: 'PENDING' as 'PASS' | 'FAIL' | 'PENDING',
  };

  // Register tool if not already registered
  toolRegistry.registerTool(githubReadTool);

  // Test 1: Check if tool is enabled
  results.tests.push({
    name: 'Tool Enabled Check',
    status: githubReadTool.enabled() ? 'PASS' : 'FAIL',
    message: githubReadTool.enabled() 
      ? 'GitHub Read Tool is enabled' 
      : 'GitHub Read Tool is disabled (check FEATURE_GITHUB_READ and GITHUB_READ_TOKEN)',
  });

  if (!githubReadTool.enabled()) {
    results.overall = 'FAIL';
    return NextResponse.json(results);
  }

  // Test 2: List repository root
  try {
    const treeResult = await toolRegistry.executeTool('github_read', {
      action: 'listRepoTree',
    });

    results.tests.push({
      name: 'List Repository Root',
      status: treeResult.success ? 'PASS' : 'FAIL',
      message: treeResult.success 
        ? `Found ${treeResult.data?.length || 0} items in repository` 
        : treeResult.error,
      sample_paths: treeResult.success 
        ? treeResult.data?.slice(0, 5).map((n: any) => n.path)
        : undefined,
    });

    if (!treeResult.success) {
      results.overall = 'FAIL';
      return NextResponse.json(results);
    }
  } catch (error: any) {
    results.tests.push({
      name: 'List Repository Root',
      status: 'FAIL',
      message: error.message,
    });
    results.overall = 'FAIL';
    return NextResponse.json(results);
  }

  // Test 3: Read package.json
  try {
    const fileResult = await toolRegistry.executeTool('github_read', {
      action: 'getFile',
      path: 'package.json',
    });

    results.tests.push({
      name: 'Read package.json',
      status: fileResult.success ? 'PASS' : 'FAIL',
      message: fileResult.success 
        ? `Read package.json (${fileResult.data?.size || 0} bytes)` 
        : fileResult.error,
      package_name: fileResult.success 
        ? JSON.parse(fileResult.data?.content || '{}').name
        : undefined,
    });

    if (!fileResult.success) {
      results.overall = 'FAIL';
      return NextResponse.json(results);
    }
  } catch (error: any) {
    results.tests.push({
      name: 'Read package.json',
      status: 'FAIL',
      message: error.message,
    });
    results.overall = 'FAIL';
    return NextResponse.json(results);
  }

  // Test 4: List app/ directory
  try {
    const appResult = await toolRegistry.executeTool('github_read', {
      action: 'listRepoTree',
      path: 'app/',
    });

    results.tests.push({
      name: 'List app/ directory',
      status: appResult.success ? 'PASS' : 'FAIL',
      message: appResult.success 
        ? `Found ${appResult.data?.length || 0} items in app/` 
        : appResult.error,
      sample_paths: appResult.success 
        ? appResult.data?.slice(0, 5).map((n: any) => n.path)
        : undefined,
    });
  } catch (error: any) {
    results.tests.push({
      name: 'List app/ directory',
      status: 'FAIL',
      message: error.message,
    });
  }

  // Determine overall status
  const allPassed = results.tests.every(t => t.status === 'PASS');
  results.overall = allPassed ? 'PASS' : 'FAIL';

  return NextResponse.json(results, {
    status: allPassed ? 200 : 500,
  });
}
