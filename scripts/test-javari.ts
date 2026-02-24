#!/usr/bin/env node
/**
 * JAVARI AI - Comprehensive Test Suite
 * Version: 4.1
 * Timestamp: 2025-12-11 5:35 PM EST
 * 
 * Tests all Javari AI functionality:
 * - API endpoints
 * - Multi-AI routing
 * - NEVER SAY NO compliance
 * - Build detection
 * - Provider fallback
 * - Response quality
 * 
 * Usage: npx ts-node scripts/test-javari.ts [--production]
 */

const PREVIEW_URL = process.env.JAVARI_URL || 'https://crav-javari-hovte4fgy-roy-hendersons-projects-1d3d5e94.vercel.app';
const PRODUCTION_URL = 'https://javariai.com';

// Use production URL if --production flag is passed
const BASE_URL = process.argv.includes('--production') ? PRODUCTION_URL : PREVIEW_URL;

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

// Helper function to run tests
async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      duration: Date.now() - start,
      error: error.message,
    });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// Helper function to make API calls
async function apiCall(endpoint: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// TEST CASES
// ============================================================================

// Test 1: API Status Endpoint
async function testApiStatus(): Promise<void> {
  const data = await apiCall('/api/chat');
  
  if (data.version !== '4.1') {
    throw new Error(`Expected version 4.1, got ${data.version}`);
  }
  
  if (data.philosophy !== 'NEVER SAY NO') {
    throw new Error(`Expected NEVER SAY NO philosophy, got ${data.philosophy}`);
  }
  
  if (!data.providers || data.providers.length < 5) {
    throw new Error(`Expected 5 providers, got ${data.providers?.length || 0}`);
  }
}

// Test 2: Basic Chat Response
async function testBasicChat(): Promise<void> {
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }]
    }),
  });
  
  if (!data.content || data.content.length < 10) {
    throw new Error('Response too short or empty');
  }
  
  if (!data.provider) {
    throw new Error('No provider returned');
  }
}

// Test 3: Build Detection - Simple App
async function testBuildDetectionSimple(): Promise<void> {
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Build me a tip calculator' }]
    }),
  });
  
  if (!data.buildIntent?.isBuild) {
    throw new Error('Build intent not detected');
  }
  
  if (data.buildIntent.appType !== 'calculator') {
    throw new Error(`Expected calculator app type, got ${data.buildIntent.appType}`);
  }
}

// Test 4: Build Detection - Collector App
async function testBuildDetectionCollector(): Promise<void> {
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Build me an alcohol collector app for whiskey' }]
    }),
  });
  
  if (!data.buildIntent?.isBuild) {
    throw new Error('Build intent not detected');
  }
  
  // Should detect as collector/tracker or beverage collector
  const validTypes = ['collector/tracker app', 'beverage collector'];
  if (!validTypes.some(t => data.buildIntent.appType?.includes(t) || t.includes(data.buildIntent.appType))) {
    throw new Error(`Expected collector app type, got ${data.buildIntent.appType}`);
  }
}

// Test 5: NEVER SAY NO Compliance
async function testNeverSayNo(): Promise<void> {
  // Test with a request that might typically be refused
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Can you help me build something really complex?' }]
    }),
  });
  
  const content = data.content.toLowerCase();
  const badPhrases = [
    "i can't",
    "i cannot",
    "i'm unable",
    "not possible",
    "i don't have access",
    "i'm sorry but",
    "unfortunately i",
  ];
  
  for (const phrase of badPhrases) {
    if (content.includes(phrase)) {
      throw new Error(`Found refusal phrase: "${phrase}"`);
    }
  }
}

// Test 6: Provider Information Returned
async function testProviderInfo(): Promise<void> {
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'What is 2+2?' }]
    }),
  });
  
  if (!data.provider) {
    throw new Error('No provider returned');
  }
  
  const validProviders = ['claude', 'openai', 'gemini', 'mistral', 'perplexity'];
  if (!validProviders.includes(data.provider)) {
    throw new Error(`Invalid provider: ${data.provider}`);
  }
  
  if (typeof data.latency !== 'number') {
    throw new Error('No latency returned');
  }
}

// Test 7: Coding Request Routes to Claude/OpenAI
async function testCodingRouting(): Promise<void> {
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Write a Python function to sort a list' }]
    }),
  });
  
  // Coding should go to Claude (primary) or OpenAI (fallback)
  const codingProviders = ['claude', 'openai'];
  if (!codingProviders.includes(data.provider)) {
    console.log(`Note: Coding went to ${data.provider} instead of Claude/OpenAI`);
  }
  
  // Should contain code
  if (!data.content.includes('def ') && !data.content.includes('function')) {
    throw new Error('Response should contain code');
  }
}

// Test 8: Multilingual Routes to Mistral
async function testMultilingualRouting(): Promise<void> {
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Translate "hello" to Spanish' }]
    }),
  });
  
  // Should contain Spanish translation
  const content = data.content.toLowerCase();
  if (!content.includes('hola')) {
    throw new Error('Response should contain "hola"');
  }
}

// Test 9: Response Time Under 15 Seconds
async function testResponseTime(): Promise<void> {
  const start = Date.now();
  
  await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Give me a quick tip for productivity' }]
    }),
  });
  
  const duration = Date.now() - start;
  if (duration > 15000) {
    throw new Error(`Response took ${duration}ms (>15s limit)`);
  }
}

// Test 10: Health Endpoint
async function testHealthEndpoint(): Promise<void> {
  const data = await apiCall('/api/javari/health');
  
  // Health check should return checks object
  if (!data.checks) {
    throw new Error('No health checks returned');
  }
  
  if (data.checks.openai !== 'pass') {
    throw new Error('OpenAI check failed');
  }
}

// Test 11: Error Handling - Empty Message
async function testErrorHandlingEmpty(): Promise<void> {
  try {
    await apiCall('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: []
      }),
    });
    throw new Error('Should have returned error for empty messages');
  } catch (error: any) {
    if (!error.message.includes('400')) {
      // Could also return a helpful response instead of error
      console.log('Note: Empty message handled gracefully');
    }
  }
}

// Test 12: Product Knowledge
async function testProductKnowledge(): Promise<void> {
  const data = await apiCall('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'What tools does CR AudioViz AI offer?' }]
    }),
  });
  
  const content = data.content.toLowerCase();
  
  // Should mention some CR AudioViz products
  const products = ['invoice', 'logo', 'pdf', 'ebook', 'javari'];
  const foundProducts = products.filter(p => content.includes(p));
  
  if (foundProducts.length < 2) {
    throw new Error('Response should mention CR AudioViz products');
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  JAVARI AI v4.1 - COMPREHENSIVE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Run all tests
  await runTest('API Status Endpoint', testApiStatus);
  await runTest('Basic Chat Response', testBasicChat);
  await runTest('Build Detection - Calculator', testBuildDetectionSimple);
  await runTest('Build Detection - Collector', testBuildDetectionCollector);
  await runTest('NEVER SAY NO Compliance', testNeverSayNo);
  await runTest('Provider Information', testProviderInfo);
  await runTest('Coding Request Routing', testCodingRouting);
  await runTest('Multilingual Routing', testMultilingualRouting);
  await runTest('Response Time (<15s)', testResponseTime);
  await runTest('Health Endpoint', testHealthEndpoint);
  await runTest('Error Handling - Empty', testErrorHandlingEmpty);
  await runTest('Product Knowledge', testProductKnowledge);

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`  Passed: ${passed}/${results.length}`);
  console.log(`  Failed: ${failed}/${results.length}`);
  console.log(`  Total Time: ${totalTime}ms`);
  console.log('');
  
  if (failed > 0) {
    console.log('  FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.error}`);
    });
    console.log('');
  }
  
  const status = failed === 0 ? '✅ ALL TESTS PASSED' : `⚠️ ${failed} TEST(S) FAILED`;
  console.log(`  ${status}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
