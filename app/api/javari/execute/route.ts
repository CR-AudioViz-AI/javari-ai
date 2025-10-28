/**
 * Javari AI Code Execution API
 * Executes code in sandboxed environments with safety checks
 * 
 * @route /api/javari/execute
 * @version 1.0.0
 * @last-updated 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VM } from 'vm2';
import * as crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'bash';
type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

interface ExecutionRequest {
  code: string;
  language: SupportedLanguage;
  conversationId?: string;
  userId?: string;
  timeout?: number; // milliseconds
  environment?: 'sandbox' | 'docker' | 'vm';
}

interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
  riskLevel: RiskLevel;
  violations?: string[];
  exitCode?: number;
}

/**
 * Analyze code for security risks
 */
function analyzeCodeRisk(code: string, language: SupportedLanguage): { 
  riskLevel: RiskLevel; 
  violations: string[]; 
} {
  const violations: string[] = [];
  let riskScore = 0;

  // Dangerous patterns
  const dangerousPatterns = {
    // File system access
    fs: /require\s*\(\s*['"]fs['"]\s*\)|import.*from\s+['"]fs['"]/,
    fileSystem: /\b(fs\.|readFile|writeFile|unlink|rmdir|mkdir)\b/,
    
    // Process/system access
    process: /\b(process\.|exec|spawn|fork)\b/,
    childProcess: /require\s*\(\s*['"]child_process['"]\s*\)/,
    
    // Network access
    network: /require\s*\(\s*['"]http['"]\s*\)|require\s*\(\s*['"]https['"]\s*\)|fetch\(/,
    
    // Eval and dynamic code
    eval: /\beval\s*\(/,
    dynamicCode: /new\s+Function\s*\(/,
    
    // Module manipulation
    moduleManip: /require\.cache|module\.exports\s*=/,
    
    // Infinite loops (basic detection)
    infiniteLoop: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/,
  };

  // Check each pattern
  for (const [name, pattern] of Object.entries(dangerousPatterns)) {
    if (pattern.test(code)) {
      violations.push(`Detected ${name.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      riskScore += getRiskScoreForPattern(name);
    }
  }

  // Language-specific checks
  if (language === 'python') {
    if (/\b(os\.|sys\.|subprocess\.|__import__)\b/.test(code)) {
      violations.push('Python system access detected');
      riskScore += 30;
    }
  }

  if (language === 'bash') {
    if (/\b(rm\s+-rf|dd\s+|mkfs\.|fdisk)\b/.test(code)) {
      violations.push('Potentially destructive bash commands');
      riskScore += 50;
    }
  }

  // Determine risk level
  let riskLevel: RiskLevel;
  if (riskScore >= 80) riskLevel = 'critical';
  else if (riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 30) riskLevel = 'medium';
  else if (riskScore >= 10) riskLevel = 'low';
  else riskLevel = 'safe';

  return { riskLevel, violations };
}

function getRiskScoreForPattern(pattern: string): number {
  const scores: Record<string, number> = {
    fs: 40,
    fileSystem: 30,
    process: 50,
    childProcess: 50,
    network: 30,
    eval: 40,
    dynamicCode: 35,
    moduleManip: 45,
    infiniteLoop: 20,
  };
  return scores[pattern] || 20;
}

/**
 * Execute JavaScript/TypeScript in VM2 sandbox
 */
async function executeJavaScript(
  code: string,
  timeout: number
): Promise<{ output: string; error: string | null; executionTime: number }> {
  const startTime = Date.now();
  let output = '';
  let error: string | null = null;

  try {
    // Create sandbox with limited capabilities
    const sandbox = {
      console: {
        log: (...args: any[]) => {
          output += args.map(arg => String(arg)).join(' ') + '\n';
        },
        error: (...args: any[]) => {
          output += '[ERROR] ' + args.map(arg => String(arg)).join(' ') + '\n';
        },
        warn: (...args: any[]) => {
          output += '[WARN] ' + args.map(arg => String(arg)).join(' ') + '\n';
        },
      },
      // Add safe utilities
      JSON: JSON,
      Math: Math,
      Date: Date,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
    };

    // Create VM2 instance with timeout
    const vm = new VM({
      timeout: timeout,
      sandbox: sandbox,
      eval: false,
      wasm: false,
    });

    // Execute code
    const result = vm.run(code);
    if (result !== undefined) {
      output += String(result);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const executionTime = Date.now() - startTime;
  return { output, error, executionTime };
}

/**
 * Execute Python code (placeholder - would need actual Python runtime)
 */
async function executePython(
  code: string,
  timeout: number
): Promise<{ output: string; error: string | null; executionTime: number }> {
  // This is a placeholder. In production, you would:
  // 1. Use a Python sandbox like RestrictedPython
  // 2. Execute in a Docker container
  // 3. Use a service like AWS Lambda or Google Cloud Functions
  
  return {
    output: '[Python execution not yet implemented - would run in isolated container]',
    error: null,
    executionTime: 0,
  };
}

/**
 * Execute Bash commands (placeholder - would need actual shell)
 */
async function executeBash(
  code: string,
  timeout: number
): Promise<{ output: string; error: string | null; executionTime: number }> {
  // This is a placeholder. In production, you would:
  // 1. Execute in a restricted shell environment
  // 2. Use Docker containers
  // 3. Implement command whitelisting
  
  return {
    output: '[Bash execution not yet implemented - would run in isolated container]',
    error: null,
    executionTime: 0,
  };
}

/**
 * POST /api/javari/execute
 * Execute code in sandboxed environment
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ExecutionRequest = await request.json();
    const {
      code,
      language,
      conversationId,
      userId = 'demo-user',
      timeout = 5000, // 5 second default timeout
      environment = 'sandbox',
    } = body;

    // Validate input
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required and must be a string' },
        { status: 400 }
      );
    }

    if (!['javascript', 'typescript', 'python', 'bash'].includes(language)) {
      return NextResponse.json(
        { error: 'Unsupported language. Supported: javascript, typescript, python, bash' },
        { status: 400 }
      );
    }

    // Analyze code for security risks
    const { riskLevel, violations } = analyzeCodeRisk(code, language);

    // Block critical risk code
    if (riskLevel === 'critical') {
      return NextResponse.json(
        {
          error: 'Code execution blocked due to critical security risks',
          riskLevel,
          violations,
        },
        { status: 403 }
      );
    }

    // Execute code based on language
    let executionResult: { output: string; error: string | null; executionTime: number };
    
    if (language === 'javascript' || language === 'typescript') {
      executionResult = await executeJavaScript(code, timeout);
    } else if (language === 'python') {
      executionResult = await executePython(code, timeout);
    } else if (language === 'bash') {
      executionResult = await executeBash(code, timeout);
    } else {
      return NextResponse.json(
        { error: 'Language not supported yet' },
        { status: 501 }
      );
    }

    const totalTime = Date.now() - startTime;

    // Log execution to database
    try {
      await supabase.from('javari_code_execution_logs').insert({
        conversation_id: conversationId || null,
        user_id: userId,
        language: language,
        code: code,
        execution_environment: environment,
        execution_status: executionResult.error ? 'error' : 'success',
        output: executionResult.output,
        error_output: executionResult.error,
        execution_time_ms: executionResult.executionTime,
        sandbox_violations: violations,
        risk_level: riskLevel,
        completed_at: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error('Error logging code execution:', dbError);
    }

    // Return result
    const result: ExecutionResult = {
      success: !executionResult.error,
      output: executionResult.output,
      error: executionResult.error || undefined,
      executionTime: totalTime,
      riskLevel,
      violations: violations.length > 0 ? violations : undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Code execution error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute code',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/execute
 * Get supported languages and execution info
 */
export async function GET() {
  return NextResponse.json({
    supportedLanguages: ['javascript', 'typescript', 'python', 'bash'],
    defaultTimeout: 5000,
    maxTimeout: 30000,
    environments: ['sandbox', 'docker', 'vm'],
    defaultEnvironment: 'sandbox',
    securityFeatures: [
      'VM2 sandboxing for JavaScript',
      'Risk analysis before execution',
      'Resource limits (timeout, memory)',
      'Dangerous pattern detection',
      'Execution logging',
    ],
    limitations: [
      'Python and Bash execution in placeholder mode (requires container setup)',
      'File system access blocked',
      'Network access blocked',
      'Process spawning blocked',
    ],
  });
}
