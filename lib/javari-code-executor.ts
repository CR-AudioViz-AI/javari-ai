// lib/javari-code-executor.ts
// Javari Code Execution Engine - RUN code, TEST it, VERIFY it works
// Timestamp: 2025-11-30 06:03 AM EST

import { createClient } from '@supabase/supabase-js';
import * as vm from 'vm';
import * as ts from 'typescript';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// CODE EXECUTION SANDBOX
// =====================================================

export interface ExecutionResult {
  success: boolean;
  output: any;
  error: string | null;
  executionTimeMs: number;
  logs: string[];
}

/**
 * Execute JavaScript/TypeScript code in a sandbox
 */
export async function executeCode(
  code: string,
  language: 'javascript' | 'typescript' = 'javascript',
  timeout: number = 5000
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  
  try {
    // Transpile TypeScript if needed
    let jsCode = code;
    if (language === 'typescript') {
      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          strict: false
        }
      });
      jsCode = transpiled.outputText;
    }
    
    // Create sandbox context
    const sandbox = {
      console: {
        log: (...args: any[]) => logs.push(args.map(a => JSON.stringify(a)).join(' ')),
        error: (...args: any[]) => logs.push(`ERROR: ${args.map(a => JSON.stringify(a)).join(' ')}`),
        warn: (...args: any[]) => logs.push(`WARN: ${args.map(a => JSON.stringify(a)).join(' ')}`)
      },
      setTimeout: () => { throw new Error('setTimeout not allowed in sandbox'); },
      setInterval: () => { throw new Error('setInterval not allowed in sandbox'); },
      fetch: sandboxFetch,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      Promise,
      Map,
      Set,
      Buffer,
      __result__: undefined as any
    };
    
    // Wrap code to capture result
    const wrappedCode = `
      (async () => {
        ${jsCode}
      })().then(r => __result__ = r).catch(e => __result__ = { __error__: e.message });
    `;
    
    // Create context and run
    const context = vm.createContext(sandbox);
    const script = new vm.Script(wrappedCode);
    
    script.runInContext(context, { timeout });
    
    // Wait for async completion
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = sandbox.__result__;
    
    if (result && result.__error__) {
      return {
        success: false,
        output: null,
        error: result.__error__,
        executionTimeMs: Date.now() - startTime,
        logs
      };
    }
    
    return {
      success: true,
      output: result,
      error: null,
      executionTimeMs: Date.now() - startTime,
      logs
    };
    
  } catch (error: any) {
    return {
      success: false,
      output: null,
      error: error.message || String(error),
      executionTimeMs: Date.now() - startTime,
      logs
    };
  }
}

/**
 * Sandboxed fetch - only allows certain domains
 */
async function sandboxFetch(url: string, options?: RequestInit): Promise<Response> {
  const allowedDomains = [
    'api.stripe.com',
    'api.openai.com',
    'api.anthropic.com',
    'api.github.com',
    'api.vercel.com',
    'jsonplaceholder.typicode.com', // For testing
    'httpbin.org' // For testing
  ];
  
  const urlObj = new URL(url);
  if (!allowedDomains.some(d => urlObj.hostname.includes(d))) {
    throw new Error(`Fetch to ${urlObj.hostname} not allowed in sandbox`);
  }
  
  return fetch(url, options);
}

// =====================================================
// CODE VALIDATION
// =====================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate TypeScript code without executing
 */
export function validateTypeScript(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        strict: true,
        noEmit: false
      },
      reportDiagnostics: true
    });
    
    if (result.diagnostics) {
      for (const diag of result.diagnostics) {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.category === ts.DiagnosticCategory.Error) {
          errors.push(message);
        } else if (diag.category === ts.DiagnosticCategory.Warning) {
          warnings.push(message);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [error.message],
      warnings
    };
  }
}

/**
 * Check for common security issues
 */
export function securityCheck(code: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /eval\s*\(/g, issue: 'eval() is dangerous' },
    { pattern: /Function\s*\(/g, issue: 'Function constructor is dangerous' },
    { pattern: /child_process/g, issue: 'child_process access not allowed' },
    { pattern: /require\s*\(\s*['"]fs['"]\s*\)/g, issue: 'File system access not allowed' },
    { pattern: /process\.env/g, issue: 'Environment variable access detected' },
    { pattern: /__proto__/g, issue: 'Prototype pollution risk' },
    { pattern: /constructor\s*\[/g, issue: 'Constructor access risk' }
  ];
  
  for (const { pattern, issue } of dangerousPatterns) {
    if (pattern.test(code)) {
      issues.push(issue);
    }
  }
  
  return {
    safe: issues.length === 0,
    issues
  };
}

// =====================================================
// TEST RUNNER
// =====================================================

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  executionTimeMs: number;
}

/**
 * Run tests against code
 */
export async function runTests(
  code: string,
  tests: Array<{ name: string; test: string }>
): Promise<{ passed: number; failed: number; results: TestResult[] }> {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of tests) {
    const fullCode = `
      ${code}
      
      // Test
      ${test}
    `;
    
    const startTime = Date.now();
    const result = await executeCode(fullCode, 'typescript');
    
    if (result.success && result.output !== false) {
      passed++;
      results.push({
        name,
        passed: true,
        executionTimeMs: Date.now() - startTime
      });
    } else {
      failed++;
      results.push({
        name,
        passed: false,
        error: result.error || 'Test returned false',
        executionTimeMs: Date.now() - startTime
      });
    }
  }
  
  return { passed, failed, results };
}

// =====================================================
// CODE IMPROVEMENT
// =====================================================

/**
 * Auto-fix common issues in code
 */
export function autoFix(code: string): { fixed: string; changes: string[] } {
  let fixed = code;
  const changes: string[] = [];
  
  // Fix missing semicolons (basic)
  if (!/;\s*$/.test(fixed.trim()) && !/[{}]\s*$/.test(fixed.trim())) {
    // Don't add semicolons after blocks
  }
  
  // Fix common typos
  const typoFixes: [RegExp, string, string][] = [
    [/cosnt\s/g, 'const ', 'Fixed typo: cosnt → const'],
    [/fucntion\s/g, 'function ', 'Fixed typo: fucntion → function'],
    [/retrun\s/g, 'return ', 'Fixed typo: retrun → return'],
    [/ture/g, 'true', 'Fixed typo: ture → true'],
    [/flase/g, 'false', 'Fixed typo: flase → false'],
    [/lenght/g, 'length', 'Fixed typo: lenght → length'],
  ];
  
  for (const [pattern, replacement, change] of typoFixes) {
    if (pattern.test(fixed)) {
      fixed = fixed.replace(pattern, replacement);
      changes.push(change);
    }
  }
  
  // Add missing imports for common patterns
  if (/useState|useEffect|useRef/.test(fixed) && !fixed.includes("from 'react'")) {
    const hooks = [];
    if (/useState/.test(fixed)) hooks.push('useState');
    if (/useEffect/.test(fixed)) hooks.push('useEffect');
    if (/useRef/.test(fixed)) hooks.push('useRef');
    
    fixed = `import { ${hooks.join(', ')} } from 'react';\n\n${fixed}`;
    changes.push(`Added React import for: ${hooks.join(', ')}`);
  }
  
  return { fixed, changes };
}

// =====================================================
// EXECUTION WITH LEARNING
// =====================================================

/**
 * Execute code and learn from the result
 */
export async function executeAndLearn(
  code: string,
  language: 'javascript' | 'typescript',
  context: {
    userId?: string;
    conversationId?: string;
    taskDescription?: string;
  }
): Promise<ExecutionResult & { learned: boolean }> {
  // Validate first
  const validation = language === 'typescript' ? validateTypeScript(code) : { valid: true, errors: [], warnings: [] };
  
  if (!validation.valid) {
    // Try auto-fix
    const { fixed, changes } = autoFix(code);
    if (changes.length > 0) {
      code = fixed;
    }
  }
  
  // Security check
  const security = securityCheck(code);
  if (!security.safe) {
    return {
      success: false,
      output: null,
      error: `Security issues: ${security.issues.join(', ')}`,
      executionTimeMs: 0,
      logs: [],
      learned: false
    };
  }
  
  // Execute
  const result = await executeCode(code, language);
  
  // Learn from result
  let learned = false;
  if (context.conversationId) {
    try {
      if (result.success) {
        // Cache successful solution
        await supabase.from('solution_cache').upsert({
          problem_hash: hashString(context.taskDescription || code.substring(0, 100)),
          problem_description: context.taskDescription || 'Code execution',
          solution_description: 'Executed successfully',
          solution_code: code,
          success_count: 1,
          last_used_at: new Date().toISOString()
        }, { onConflict: 'problem_hash' });
        learned = true;
      } else if (result.error) {
        // Record error pattern
        await supabase.from('error_patterns').upsert({
          error_type: language,
          error_pattern: result.error.substring(0, 100),
          error_message_sample: result.error,
          fix_description: 'Auto-detected from execution failure',
          source: 'execution_learning',
          times_suggested: 1
        }, { onConflict: 'error_type,error_pattern' });
        learned = true;
      }
    } catch (e) {
      // Don't fail if learning fails
    }
  }
  
  return { ...result, learned };
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// =====================================================
// API EXECUTION
// =====================================================

/**
 * Execute API calls with stored credentials
 */
export async function executeAPI(
  service: string,
  endpoint: string,
  method: string,
  body: any,
  userId: string
): Promise<{ success: boolean; data: any; error: string | null }> {
  // Get credentials
  const { data: creds } = await supabase
    .from('credential_vault')
    .select('credentials')
    .eq('user_id', userId)
    .eq('service_name', service)
    .single();
  
  if (!creds) {
    return {
      success: false,
      data: null,
      error: `No ${service} credentials found. Connect your ${service} account first.`
    };
  }
  
  const credentials = creds.credentials;
  
  // Build request based on service
  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  switch (service) {
    case 'stripe':
      url = `https://api.stripe.com/v1/${endpoint}`;
      headers['Authorization'] = `Bearer ${credentials.secret_key}`;
      break;
    case 'openai':
      url = `https://api.openai.com/v1/${endpoint}`;
      headers['Authorization'] = `Bearer ${credentials.api_key}`;
      break;
    case 'github':
      url = `https://api.github.com/${endpoint}`;
      headers['Authorization'] = `token ${credentials.token}`;
      break;
    default:
      return { success: false, data: null, error: `Service ${service} not supported` };
  }
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(body) : undefined
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      data,
      error: response.ok ? null : data.error?.message || 'API call failed'
    };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

export default {
  executeCode,
  validateTypeScript,
  securityCheck,
  runTests,
  autoFix,
  executeAndLearn,
  executeAPI
};
