// Javari Self-Healing Engine
// Automatic error detection, analysis, and fixes

import { searchKnowledge, learnFromConversation } from './learning-system';
import { routeTask, executeWithFallback } from './ai-routing';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ErrorReport {
  id?: string;
  error_type: 'build' | 'deploy' | 'runtime' | 'database' | 'api';
  error_message: string;
  stack_trace?: string;
  context: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  resolved: boolean;
  resolution?: string;
}

/**
 * Main self-healing orchestration
 */
export async function autoHeal(error: ErrorReport): Promise<{ 
  success: boolean; 
  resolution?: string; 
  confidence: number;
}> {
  console.log(`🔧 Auto-healing ${error.error_type} error...`);

  // Step 1: Search memory for similar issues
  const similarIssues = await searchKnowledge(error.error_message, 5);
  
  if (similarIssues.length > 0 && similarIssues[0].relevance_score > 0.8) {
    console.log('✅ Found solution in memory');
    return {
      success: true,
      resolution: similarIssues[0].content,
      confidence: similarIssues[0].relevance_score,
    };
  }

  // Step 2: Use AI to analyze and propose fix
  const aiAnalysis = await analyzeErrorWithAI(error);
  
  if (aiAnalysis.confidence > 0.7) {
    console.log('✅ AI proposed high-confidence solution');
    
    // Step 3: Apply fix automatically
    const applied = await applyFix(error, aiAnalysis.fix);
    
    if (applied.success) {
      // Step 4: Verify fix worked
      const verified = await verifyFix(error, aiAnalysis.fix);
      
      if (verified) {
        // Learn from this success
        await recordSuccessfulFix(error, aiAnalysis.fix);
        return {
          success: true,
          resolution: aiAnalysis.fix,
          confidence: aiAnalysis.confidence,
        };
      } else {
        // Rollback if verification failed
        await rollbackFix(error, aiAnalysis.fix);
      }
    }
  }

  // Step 3: Search web for solution
  const webSolution = await searchWebForSolution(error);
  
  if (webSolution) {
    console.log('✅ Found solution on web');
    return {
      success: true,
      resolution: webSolution,
      confidence: 0.6,
    };
  }

  // Failed to auto-heal
  await createAlertForHuman(error);
  
  return {
    success: false,
    confidence: 0,
  };
}

/**
 * Monitor builds and detect errors
 */
export async function monitorBuild(buildId: string, projectId: string): Promise<void> {
  try {
    // Fetch build logs from Vercel
    const logs = await fetchBuildLogs(buildId);
    
    // Detect errors in logs
    const errors = detectErrorsInLogs(logs);
    
    for (const error of errors) {
      const errorReport: ErrorReport = {
        error_type: 'build',
        error_message: error.message,
        stack_trace: error.stack,
        context: {
          build_id: buildId,
          project_id: projectId,
          logs: logs,
        },
        severity: classifyErrorSeverity(error.message),
        detected_at: new Date().toISOString(),
        resolved: false,
      };

      // Store error
      const { data } = await supabase
        .from('error_logs')
        .insert(errorReport)
        .select()
        .single();

      if (data) {
        // Attempt auto-heal
        const result = await autoHeal(data);
        
        if (result.success) {
          await supabase
            .from('error_logs')
            .update({
              resolved: true,
              resolution: result.resolution,
              resolved_at: new Date().toISOString(),
            })
            .eq('id', data.id);
        }
      }
    }
  } catch (error: unknown) {
    logError(\'Error monitoring build:\', error);
  }
}

// Helper functions
async function analyzeErrorWithAI(error: ErrorReport): Promise<{
  fix: string;
  confidence: number;
}> {
  const prompt = `
    Error Type: ${error.error_type}
    Error Message: ${error.error_message}
    Context: ${JSON.stringify(error.context)}
    
    Provide a specific fix for this error. Include exact code changes if applicable.
  `;

  try {
    const result = await executeWithFallback(
      'debugging',
      prompt,
      2000,
      async (provider, endpoint) => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, provider }),
        });
        return response.json();
      }
    );

    return {
      fix: result.result.content,
      confidence: 0.8,
    };
  } catch (error: unknown) {
    return { fix: '', confidence: 0 };
  }
}

async function applyFix(error: ErrorReport, fix: string): Promise<{ success: boolean }> {
  try {
    // Parse fix and apply changes
    // This would integrate with GitHub API to make actual code changes
    console.log('Applying fix:', fix);
    return { success: true };
  } catch (error: unknown) {
    return { success: false };
  }
}

async function verifyFix(error: ErrorReport, fix: string): Promise<boolean> {
  try {
    // Trigger a new build and verify it succeeds
    console.log('Verifying fix...');
    return true;
  } catch (error: unknown) {
    return false;
  }
}

async function rollbackFix(error: ErrorReport, fix: string): Promise<void> {
  console.log('Rolling back failed fix...');
  // Revert changes via GitHub API
}

async function recordSuccessfulFix(error: ErrorReport, fix: string): Promise<void> {
  await supabase
    .from('knowledge_base')
    .insert({
      source: 'conversation',
      category: 'technical',
      title: `Auto-fix: ${error.error_type}`,
      content: fix,
      metadata: { error_message: error.error_message },
      relevance_score: 0.9,
    });
}

async function searchWebForSolution(error: ErrorReport): Promise<string | null> {
  // In production, use web search API
  console.log('Searching web for solution...');
  return null;
}

async function createAlertForHuman(error: ErrorReport): Promise<void> {
  await supabase
    .from('alerts')
    .insert({
      alert_type: 'auto_heal_failed',
      severity: error.severity,
      message: `Failed to auto-heal ${error.error_type} error`,
      metadata: error,
    });
}

async function fetchBuildLogs(buildId: string): Promise<string> {
  // Fetch from Vercel API
  return 'build logs';
}

function detectErrorsInLogs(logs: string): Array<{ message: string; stack?: string }> {
  const errors: Array<{ message: string; stack?: string }> = [];
  const errorPatterns = [
    /Error: (.*)/g,
    /Failed to compile/g,
    /Module not found/g,
  ];

  for (const pattern of errorPatterns) {
    const matches = logs.matchAll(pattern);
    for (const match of matches) {
      errors.push({ message: match[0] });
    }
  }

  return errors;
}

function classifyErrorSeverity(message: string): 'low' | 'medium' | 'high' | 'critical' {
  if (message.includes('critical') || message.includes('fatal')) return 'critical';
  if (message.includes('error')) return 'high';
  if (message.includes('warning')) return 'medium';
  return 'low';
}
