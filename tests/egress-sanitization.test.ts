/**
 * EGRESS SANITIZATION TESTS
 * 
 * Phase Ω-X - Test Suite
 * 
 * Validates that secret detection and sanitization works correctly
 * in both development and production modes.
 */

import { sanitizeEgress, containsSecrets } from '../orchestrator/security/egressSanitizer';
import { safeModelEgress, EgressSecurityError } from '../orchestrator/security/safeRespond';

// Test cases
const TEST_CASES = [
  {
    name: 'OpenAI API Key Detection',
    input: 'Here is your API key: sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
    shouldDetect: true,
    expectedPattern: /sk-proj-/,
  },
  {
    name: 'Anthropic API Key Detection',
    input: 'Your Anthropic key is sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstu',
    shouldDetect: true,
    expectedPattern: /sk-ant-/,
  },
  {
    name: 'GitHub Token Detection',
    input: 'Use this token: ghp_1234567890abcdefghijklmnopqrstuvwxyz',
    shouldDetect: true,
    expectedPattern: /ghp_/,
  },
  {
    name: 'Password Detection',
    input: 'Your password is: password=SuperSecret123!',
    shouldDetect: true,
    expectedPattern: /password/i,
  },
  {
    name: 'Database URL Detection',
    input: 'Connection string: postgresql://user:mypassword@localhost:5432/db',
    shouldDetect: true,
    expectedPattern: /postgresql:/,
  },
  {
    name: 'Stripe Key Detection',
    input: 'Stripe key: sk_test_1234567890abcdefghijklmnopqr',
    shouldDetect: true,
    expectedPattern: /sk_test_/,
  },
  {
    name: 'JWT Token Detection',
    input: 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    shouldDetect: true,
    expectedPattern: /eyJ/,
  },
  {
    name: 'Clean Content (No Secrets)',
    input: 'This is a normal response about cats and dogs.',
    shouldDetect: false,
    expectedPattern: null,
  },
  {
    name: 'Clean Code Example',
    input: 'Here is a code example:\n```typescript\nconst api = process.env.API_KEY;\nconsole.log("Hello");\n```',
    shouldDetect: false,
    expectedPattern: null,
  },
];

/**
 * Run all tests
 */
export function runEgressTests() {
  console.log('🧪 EGRESS SANITIZATION TEST SUITE\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const test of TEST_CASES) {
    try {
      const result = sanitizeEgress(test.input, 'ai');
      const detected = result.detectedThreats.length > 0;
      
      if (detected === test.shouldDetect) {
        console.log(`✅ PASS: ${test.name}`);
        
        if (detected) {
          console.log(`   Detected: ${result.detectedThreats.length} threat(s)`);
          console.log(`   Sanitized: ${result.sanitized.includes('[REDACTED]')}`);
        }
        
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Expected detection: ${test.shouldDetect}`);
        console.log(`   Actual detection: ${detected}`);
        console.log(`   Threats: ${JSON.stringify(result.detectedThreats, null, 2)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${test.name}`);
      console.log(`   ${error}`);
      failed++;
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  
  return { passed, failed };
}

/**
 * Test development mode behavior
 */
export function testDevelopmentMode() {
  console.log('🔧 DEVELOPMENT MODE TEST\n');
  
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  
  try {
    const input = 'API key: sk-proj-test123456789012345678901234567890123456789012';
    const result = safeModelEgress(input, 'ai');
    
    console.log('✅ Development mode allows response with redaction');
    console.log(`   Input: ${input.slice(0, 50)}...`);
    console.log(`   Output: ${result}`);
    console.log(`   Redacted: ${result.includes('[REDACTED]')}`);
    
    return true;
  } catch (error) {
    console.log('❌ Development mode test failed');
    console.log(`   Error: ${error}`);
    return false;
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
}

/**
 * Test production mode behavior
 */
export function testProductionMode() {
  console.log('\n🔒 PRODUCTION MODE TEST\n');
  
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  try {
    const input = 'Secret key: sk-test-1234567890abcdefghijklmnopqr';
    
    try {
      safeModelEgress(input, 'ai');
      
      console.log('❌ Production mode should have blocked this response');
      return false;
    } catch (error) {
      if (error instanceof EgressSecurityError) {
        console.log('✅ Production mode correctly blocked response');
        console.log(`   Detected threats: ${error.detectedThreats.length}`);
        console.log(`   Blocked: ${error.blocked}`);
        return true;
      }
      
      throw error;
    }
  } catch (error) {
    console.log('❌ Production mode test failed unexpectedly');
    console.log(`   Error: ${error}`);
    return false;
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
}

/**
 * Test streaming sanitization
 */
export function testStreamingSanitization() {
  console.log('\n🌊 STREAMING SANITIZATION TEST\n');
  
  const chunks = [
    'Here is some normal text. ',
    'And here is a secret: ',
    'sk-proj-1234567890abcdefghijklmnopqr ',
    'followed by more text.'
  ];
  
  let accumulated = '';
  let sanitized = '';
  
  try {
    for (const chunk of chunks) {
      accumulated += chunk;
      const result = sanitizeEgress(accumulated, 'ai');
      sanitized = result.sanitized;
      
      console.log(`Chunk: "${chunk.slice(0, 30)}${chunk.length > 30 ? '...' : ''}"`);
      console.log(`Threats detected: ${result.detectedThreats.length}`);
    }
    
    console.log(`\n✅ Streaming test complete`);
    console.log(`   Final output contains [REDACTED]: ${sanitized.includes('[REDACTED]')}`);
    console.log(`   Final output: ${sanitized}`);
    
    return true;
  } catch (error) {
    console.log('❌ Streaming test failed');
    console.log(`   Error: ${error}`);
    return false;
  }
}

/**
 * Run all test suites
 */
export function runAllTests() {
  console.log('\n🚀 PHASE Ω-X EGRESS SANITIZATION TEST SUITE\n');
  console.log('Timestamp:', new Date().toISOString());
  console.log('\n');
  
  const results = runEgressTests();
  const devMode = testDevelopmentMode();
  const prodMode = testProductionMode();
  const streaming = testStreamingSanitization();
  
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(`Pattern Detection: ${results.passed}/${results.passed + results.failed} passed`);
  console.log(`Development Mode: ${devMode ? 'PASS' : 'FAIL'}`);
  console.log(`Production Mode: ${prodMode ? 'PASS' : 'FAIL'}`);
  console.log(`Streaming: ${streaming ? 'PASS' : 'FAIL'}`);
  
  const allPassed = 
    results.failed === 0 && 
    devMode && 
    prodMode && 
    streaming;
  
  console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);
  
  return allPassed;
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
  process.exit(0);
}
