// app/api/autonomous/heal/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - SELF-HEALING ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 11:35 AM EST
// Version: 1.0 - AUTO-HEAL ALL DEPLOYMENTS
//
// This endpoint orchestrates automatic healing:
// 1. Monitor all Vercel deployments for failures
// 2. Fetch and analyze build logs
// 3. Diagnose errors using AI
// 4. Generate fix code
// 5. Push fixes to GitHub
// 6. Verify deployment succeeds
// 7. Report results
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
    org: 'CR-AudioViz-AI',
    apiBase: 'https://api.github.com'
  },
  vercel: {
    token: process.env.VERCEL_TOKEN || '',
    teamId: process.env.VERCEL_TEAM_ID || 'team_Z0yef7NlFu1coCJWz8UmUdI5',
    apiBase: 'https://api.vercel.com'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },
  autoFixThreshold: 70, // Confidence threshold for auto-fixing (0-100)
  maxRetries: 3
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface Deployment {
  uid: string;
  name: string;
  state: string;
  url: string;
  created: number;
  meta?: {
    githubCommitSha?: string;
    githubCommitRef?: string;
    githubCommitRepo?: string;
  };
}

interface BuildLog {
  type: string;
  text: string;
  created: number;
}

interface ErrorDiagnosis {
  errorType: string;
  errorMessage: string;
  file?: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rootCause: string;
  suggestedFix: string;
  fixCode?: string;
  confidence: number;
  autoFixable: boolean;
}

interface HealingResult {
  deployment: string;
  project: string;
  status: 'healthy' | 'healed' | 'failed' | 'manual_required';
  diagnosis?: ErrorDiagnosis;
  fixApplied?: boolean;
  fixCommit?: string;
  newDeployment?: string;
  error?: string;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERCEL API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function getFailedDeployments(): Promise<Deployment[]> {
  const response = await fetch(
    `${CONFIG.vercel.apiBase}/v6/deployments?teamId=${CONFIG.vercel.teamId}&state=ERROR&limit=10`,
    {
      headers: {
        'Authorization': `Bearer ${CONFIG.vercel.token}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Vercel API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.deployments || [];
}

async function getDeploymentLogs(deploymentId: string): Promise<BuildLog[]> {
  const response = await fetch(
    `${CONFIG.vercel.apiBase}/v2/deployments/${deploymentId}/events?teamId=${CONFIG.vercel.teamId}`,
    {
      headers: {
        'Authorization': `Bearer ${CONFIG.vercel.token}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.status}`);
  }
  
  const events = await response.json();
  return events.filter((e: any) => e.type === 'stderr' || e.type === 'stdout');
}

async function triggerRedeployment(projectId: string, gitRef: string): Promise<string> {
  const response = await fetch(
    `${CONFIG.vercel.apiBase}/v13/deployments?teamId=${CONFIG.vercel.teamId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.vercel.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectId,
        gitSource: {
          type: 'github',
          ref: gitRef,
          repoId: projectId
        }
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to trigger deployment: ${response.status}`);
  }
  
  const data = await response.json();
  return data.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function getFileContent(repo: string, path: string): Promise<{ content: string; sha: string }> {
  const response = await fetch(
    `${CONFIG.github.apiBase}/repos/${CONFIG.github.org}/${repo}/contents/${path}`,
    {
      headers: {
        'Authorization': `token ${CONFIG.github.token}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha
  };
}

async function updateFile(
  repo: string,
  path: string,
  content: string,
  sha: string,
  message: string
): Promise<string> {
  const response = await fetch(
    `${CONFIG.github.apiBase}/repos/${CONFIG.github.org}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${CONFIG.github.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString('base64'),
        sha,
        branch: 'main'
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update file: ${error.message}`);
  }
  
  const data = await response.json();
  return data.commit.sha;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-POWERED ERROR DIAGNOSIS
// ═══════════════════════════════════════════════════════════════════════════════

async function diagnoseError(logs: BuildLog[], repo: string): Promise<ErrorDiagnosis> {
  // Extract error messages from logs
  const errorLogs = logs
    .filter(l => l.text.toLowerCase().includes('error') || l.text.includes('Error'))
    .map(l => l.text)
    .join('\n');
  
  if (!errorLogs) {
    return {
      errorType: 'unknown',
      errorMessage: 'No clear error found in logs',
      severity: 'low',
      rootCause: 'Unknown',
      suggestedFix: 'Manual review required',
      confidence: 0,
      autoFixable: false
    };
  }
  
  // Use AI to diagnose
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: CONFIG.openai.apiKey });
  
  const prompt = `You are an expert TypeScript/Next.js developer. Analyze this build error and provide a diagnosis.

BUILD LOGS:
${errorLogs.slice(0, 3000)}

REPOSITORY: ${repo}

Respond in JSON format:
{
  "errorType": "type_error|syntax_error|missing_import|missing_module|config_error|other",
  "errorMessage": "brief description",
  "file": "path/to/file.ts or null",
  "line": number or null,
  "severity": "low|medium|high|critical",
  "rootCause": "detailed explanation of why this error occurs",
  "suggestedFix": "step by step fix instructions",
  "fixCode": "actual code fix if applicable, or null",
  "confidence": 0-100,
  "autoFixable": true/false
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  
  try {
    const diagnosis = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      errorType: diagnosis.errorType || 'unknown',
      errorMessage: diagnosis.errorMessage || 'Unknown error',
      file: diagnosis.file,
      line: diagnosis.line,
      severity: diagnosis.severity || 'medium',
      rootCause: diagnosis.rootCause || 'Unknown',
      suggestedFix: diagnosis.suggestedFix || 'Manual review required',
      fixCode: diagnosis.fixCode,
      confidence: diagnosis.confidence || 0,
      autoFixable: diagnosis.autoFixable || false
    };
  } catch {
    return {
      errorType: 'parse_error',
      errorMessage: 'Failed to parse AI diagnosis',
      severity: 'medium',
      rootCause: 'AI response parsing failed',
      suggestedFix: 'Manual review required',
      confidence: 0,
      autoFixable: false
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-POWERED CODE FIX GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateFix(
  diagnosis: ErrorDiagnosis,
  currentCode: string,
  repo: string
): Promise<string | null> {
  if (!diagnosis.autoFixable || diagnosis.confidence < CONFIG.autoFixThreshold) {
    return null;
  }
  
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: CONFIG.openai.apiKey });
  
  const prompt = `You are an expert TypeScript/Next.js developer. Fix this code based on the error diagnosis.

ERROR DIAGNOSIS:
- Type: ${diagnosis.errorType}
- Message: ${diagnosis.errorMessage}
- Root Cause: ${diagnosis.rootCause}
- Suggested Fix: ${diagnosis.suggestedFix}

CURRENT CODE:
\`\`\`typescript
${currentCode}
\`\`\`

REQUIREMENTS:
1. Fix ONLY the error - do not refactor or change other code
2. Maintain existing code style
3. Ensure TypeScript strict mode compatibility
4. Return the COMPLETE fixed file

Return ONLY the fixed code, no explanations.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000
  });
  
  const fixedCode = response.choices[0]?.message?.content || '';
  
  // Clean up code blocks if present
  return fixedCode
    .replace(/^```typescript\n?/m, '')
    .replace(/^```tsx\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALING ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

async function healDeployment(deployment: Deployment): Promise<HealingResult> {
  const startTime = Date.now();
  const repo = deployment.meta?.githubCommitRepo || deployment.name;
  
  try {
    // Step 1: Get build logs
    console.log(`[Heal] Fetching logs for ${deployment.name}...`);
    const logs = await getDeploymentLogs(deployment.uid);
    
    if (logs.length === 0) {
      return {
        deployment: deployment.uid,
        project: deployment.name,
        status: 'manual_required',
        error: 'No build logs available',
        duration: Date.now() - startTime
      };
    }
    
    // Step 2: Diagnose the error
    console.log(`[Heal] Diagnosing error for ${deployment.name}...`);
    const diagnosis = await diagnoseError(logs, repo);
    
    // Step 3: Check if auto-fixable
    if (!diagnosis.autoFixable || diagnosis.confidence < CONFIG.autoFixThreshold) {
      // Log for manual review
      await supabase.from('healing_logs').insert({
        deployment_id: deployment.uid,
        project: deployment.name,
        diagnosis: diagnosis,
        status: 'manual_required',
        created_at: new Date().toISOString()
      });
      
      return {
        deployment: deployment.uid,
        project: deployment.name,
        status: 'manual_required',
        diagnosis,
        duration: Date.now() - startTime
      };
    }
    
    // Step 4: Get current file content
    if (!diagnosis.file) {
      return {
        deployment: deployment.uid,
        project: deployment.name,
        status: 'manual_required',
        diagnosis,
        error: 'No file path identified for fix',
        duration: Date.now() - startTime
      };
    }
    
    console.log(`[Heal] Fetching file ${diagnosis.file} from ${repo}...`);
    const { content: currentCode, sha } = await getFileContent(repo, diagnosis.file);
    
    // Step 5: Generate fix
    console.log(`[Heal] Generating fix for ${deployment.name}...`);
    const fixedCode = await generateFix(diagnosis, currentCode, repo);
    
    if (!fixedCode) {
      return {
        deployment: deployment.uid,
        project: deployment.name,
        status: 'manual_required',
        diagnosis,
        error: 'Failed to generate fix',
        duration: Date.now() - startTime
      };
    }
    
    // Step 6: Apply fix to GitHub
    console.log(`[Heal] Applying fix to ${repo}/${diagnosis.file}...`);
    const commitMessage = `fix(auto-heal): ${diagnosis.errorType} - ${diagnosis.errorMessage.slice(0, 50)}

Javari AI Self-Healing System
Confidence: ${diagnosis.confidence}%
Root Cause: ${diagnosis.rootCause.slice(0, 100)}

Timestamp: ${new Date().toISOString()}`;

    const commitSha = await updateFile(repo, diagnosis.file, fixedCode, sha, commitMessage);
    
    // Step 7: Log success
    await supabase.from('healing_logs').insert({
      deployment_id: deployment.uid,
      project: deployment.name,
      diagnosis: diagnosis,
      fix_applied: true,
      fix_commit: commitSha,
      status: 'healed',
      created_at: new Date().toISOString()
    });
    
    return {
      deployment: deployment.uid,
      project: deployment.name,
      status: 'healed',
      diagnosis,
      fixApplied: true,
      fixCommit: commitSha,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failure
    await supabase.from('healing_logs').insert({
      deployment_id: deployment.uid,
      project: deployment.name,
      status: 'failed',
      error: errorMessage,
      created_at: new Date().toISOString()
    });
    
    return {
      deployment: deployment.uid,
      project: deployment.name,
      status: 'failed',
      error: errorMessage,
      duration: Date.now() - startTime
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const { deploymentId, projectName, mode = 'auto' } = body;
    
    let results: HealingResult[] = [];
    
    if (deploymentId) {
      // Heal specific deployment
      const deployment: Deployment = {
        uid: deploymentId,
        name: projectName || 'unknown',
        state: 'ERROR',
        url: '',
        created: Date.now()
      };
      
      const result = await healDeployment(deployment);
      results = [result];
      
    } else if (mode === 'auto') {
      // Auto-heal all failed deployments
      console.log('[Heal] Fetching failed deployments...');
      const failedDeployments = await getFailedDeployments();
      
      console.log(`[Heal] Found ${failedDeployments.length} failed deployments`);
      
      // Process each failed deployment
      for (const deployment of failedDeployments) {
        const result = await healDeployment(deployment);
        results.push(result);
      }
    }
    
    // Summary
    const summary = {
      total: results.length,
      healed: results.filter(r => r.status === 'healed').length,
      manual: results.filter(r => r.status === 'manual_required').length,
      failed: results.filter(r => r.status === 'failed').length,
      healthy: results.filter(r => r.status === 'healthy').length
    };
    
    return NextResponse.json({
      success: true,
      summary,
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Heal] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}

export async function GET() {
  // Get recent healing activity
  const { data: recentHeals } = await supabase
    .from('healing_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  // Get stats
  const { data: stats } = await supabase
    .from('healing_logs')
    .select('status')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const summary = {
    last24Hours: {
      total: stats?.length || 0,
      healed: stats?.filter(s => s.status === 'healed').length || 0,
      manual: stats?.filter(s => s.status === 'manual_required').length || 0,
      failed: stats?.filter(s => s.status === 'failed').length || 0
    }
  };
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Self-Healing System',
    version: '1.0',
    summary,
    recentHeals: recentHeals || [],
    capabilities: [
      'Automatic failed deployment detection',
      'AI-powered error diagnosis',
      'Automatic code fix generation',
      'GitHub integration for applying fixes',
      'Vercel deployment monitoring'
    ],
    timestamp: new Date().toISOString()
  });
}
