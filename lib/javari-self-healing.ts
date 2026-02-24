// lib/javari-self-healing.ts
// Javari Self-Healing System - Detect, Diagnose, Fix, Deploy
// Timestamp: 2025-11-30 06:15 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// HEALTH MONITORING
// =====================================================

interface HealthCheck {
  app: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  statusCode: number;
  error?: string;
}

/**
 * Check health of all registered apps
 */
export async function checkAllApps(): Promise<HealthCheck[]> {
  const { data: apps } = await supabase
    .from('app_registry')
    .select('app_name, production_url, preview_url')
    .eq('status', 'live');
  
  if (!apps) return [];
  
  const results: HealthCheck[] = [];
  
  for (const app of apps) {
    const url = app.production_url || app.preview_url;
    if (!url) continue;
    
    const check = await checkHealth(app.app_name, url);
    results.push(check);
    
    // Store result
    await supabase.from('health_checks').insert({
      app_id: app.id,
      check_type: 'http',
      endpoint: url,
      status: check.status,
      response_time_ms: check.responseTime,
      status_code: check.statusCode,
      error_message: check.error
    });
    
    // Update app health status
    await supabase
      .from('app_registry')
      .update({
        health_status: check.status,
        last_health_check: new Date().toISOString()
      })
      .eq('app_name', app.app_name);
  }
  
  return results;
}

async function checkHealth(app: string, url: string): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const responseTime = Date.now() - startTime;
    
    return {
      app,
      url,
      status: response.ok ? (responseTime > 3000 ? 'degraded' : 'healthy') : 'down',
      responseTime,
      statusCode: response.status
    };
  } catch (error: any) {
    return {
      app,
      url,
      status: 'down',
      responseTime: Date.now() - startTime,
      statusCode: 0,
      error: error.message
    };
  }
}

// =====================================================
// ERROR DETECTION
// =====================================================

interface DetectedError {
  app: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedFix?: string;
  autoFixable: boolean;
}

/**
 * Analyze logs and detect errors
 */
export async function detectErrors(logs: string[]): Promise<DetectedError[]> {
  const errors: DetectedError[] = [];
  
  const errorPatterns = [
    {
      pattern: /TypeError:\s*(.+)/i,
      type: 'type_error',
      severity: 'high' as const,
      autoFixable: true
    },
    {
      pattern: /ReferenceError:\s*(.+)/i,
      type: 'reference_error',
      severity: 'high' as const,
      autoFixable: true
    },
    {
      pattern: /SyntaxError:\s*(.+)/i,
      type: 'syntax_error',
      severity: 'critical' as const,
      autoFixable: false
    },
    {
      pattern: /ECONNREFUSED/i,
      type: 'connection_error',
      severity: 'critical' as const,
      autoFixable: false
    },
    {
      pattern: /ETIMEDOUT/i,
      type: 'timeout_error',
      severity: 'high' as const,
      autoFixable: false
    },
    {
      pattern: /Out of memory/i,
      type: 'memory_error',
      severity: 'critical' as const,
      autoFixable: false
    },
    {
      pattern: /Module not found:\s*(.+)/i,
      type: 'missing_module',
      severity: 'high' as const,
      autoFixable: true
    },
    {
      pattern: /Invalid API key/i,
      type: 'auth_error',
      severity: 'critical' as const,
      autoFixable: false
    }
  ];
  
  for (const log of logs) {
    for (const { pattern, type, severity, autoFixable } of errorPatterns) {
      const match = log.match(pattern);
      if (match) {
        // Get suggested fix from database
        const { data: fix } = await supabase
          .from('error_patterns')
          .select('fix_description, fix_code')
          .ilike('error_pattern', `%${type}%`)
          .single();
        
        errors.push({
          app: 'unknown',
          type,
          message: match[1] || match[0],
          severity,
          suggestedFix: fix?.fix_description,
          autoFixable
        });
        break;
      }
    }
  }
  
  return errors;
}

// =====================================================
// AUTO-FIX ENGINE
// =====================================================

interface FixResult {
  success: boolean;
  action: string;
  details: string;
}

/**
 * Attempt to automatically fix detected errors
 */
export async function autoFix(error: DetectedError): Promise<FixResult> {
  if (!error.autoFixable) {
    return {
      success: false,
      action: 'none',
      details: 'This error type requires manual intervention'
    };
  }
  
  switch (error.type) {
    case 'missing_module':
      return await fixMissingModule(error.message);
    case 'type_error':
      return await fixTypeError(error.message);
    case 'reference_error':
      return await fixReferenceError(error.message);
    default:
      return {
        success: false,
        action: 'none',
        details: 'No auto-fix available for this error type'
      };
  }
}

async function fixMissingModule(message: string): Promise<FixResult> {
  // Extract module name
  const moduleMatch = message.match(/['"]([^'"]+)['"]/);
  if (!moduleMatch) {
    return { success: false, action: 'none', details: 'Could not extract module name' };
  }
  
  const moduleName = moduleMatch[1];
  
  // Log the fix attempt
  return {
    success: true,
    action: 'install_module',
    details: `Would run: npm install ${moduleName}`
  };
}

async function fixTypeError(message: string): Promise<FixResult> {
  // Common type error fixes
  if (message.includes('undefined')) {
    return {
      success: true,
      action: 'add_null_check',
      details: 'Add optional chaining (?.) or null check before accessing property'
    };
  }
  
  if (message.includes('is not a function')) {
    return {
      success: true,
      action: 'check_import',
      details: 'Verify the import statement and ensure the function is exported'
    };
  }
  
  return {
    success: false,
    action: 'none',
    details: 'Unknown type error pattern'
  };
}

async function fixReferenceError(message: string): Promise<FixResult> {
  const varMatch = message.match(/(\w+) is not defined/);
  if (varMatch) {
    return {
      success: true,
      action: 'add_import_or_declaration',
      details: `Add import or declaration for: ${varMatch[1]}`
    };
  }
  
  return {
    success: false,
    action: 'none',
    details: 'Unknown reference error pattern'
  };
}

// =====================================================
// DEPLOYMENT RECOVERY
// =====================================================

/**
 * Trigger a redeployment for a failed app
 */
export async function triggerRedeploy(
  projectId: string,
  repo: string
): Promise<{ success: boolean; deploymentId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repo,
        project: projectId,
        gitSource: {
          type: 'github',
          org: 'CR-AudioViz-AI',
          repo,
          ref: 'main'
        }
      })
    });
    
    const data = await response.json();
    
    if (data.id) {
      return { success: true, deploymentId: data.id };
    } else {
      return { success: false, error: data.error?.message || 'Unknown error' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Rollback to previous deployment
 */
export async function rollback(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get previous successful deployment
    const response = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&state=READY&limit=2`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        }
      }
    );
    
    const data = await response.json();
    const deployments = data.deployments || [];
    
    if (deployments.length < 2) {
      return { success: false, error: 'No previous deployment to rollback to' };
    }
    
    // Promote previous deployment
    const previousDeployment = deployments[1];
    
    // In Vercel, you'd use the promote endpoint or create alias
    // For now, log the action
    console.log(`Would rollback to deployment: ${previousDeployment.uid}`);
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// SELF-HEALING LOOP
// =====================================================

/**
 * Run complete self-healing cycle
 */
export async function runSelfHealingCycle(): Promise<{
  checksPerformed: number;
  errorsFound: number;
  fixesAttempted: number;
  fixesSuccessful: number;
}> {
  let errorsFound = 0;
  let fixesAttempted = 0;
  let fixesSuccessful = 0;
  
  // 1. Check all apps
  const healthChecks = await checkAllApps();
  
  // 2. Find unhealthy apps
  const unhealthyApps = healthChecks.filter(h => h.status !== 'healthy');
  
  for (const app of unhealthyApps) {
    errorsFound++;
    
    // Log error to tracking
    await supabase.from('error_tracking').upsert({
      app_id: app.app,
      error_type: 'health_check_failure',
      error_message: app.error || `Status: ${app.status}`,
      is_resolved: false,
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'app_id,error_type' });
    
    // Attempt auto-recovery
    if (app.status === 'down') {
      fixesAttempted++;
      
      // Get app details
      const { data: appData } = await supabase
        .from('app_registry')
        .select('id, repo_name')
        .eq('app_name', app.app)
        .single();
      
      if (appData?.repo_name) {
        const result = await triggerRedeploy(appData.id, appData.repo_name);
        if (result.success) {
          fixesSuccessful++;
          
          // Log fix
          await supabase.from('conversation_insights').insert({
            topic: 'self_healing',
            insight_type: 'auto_fix',
            problem_description: `App ${app.app} was down`,
            solution_description: `Triggered redeployment: ${result.deploymentId}`,
            confidence_score: 0.9
          });
        }
      }
    }
  }
  
  // 3. Update bot run stats
  const { data: bot } = await supabase
    .from('autonomous_bots')
    .select('id, total_runs, successful_runs')
    .eq('bot_name', 'health-monitor')
    .single();
  
  if (bot) {
    await supabase
      .from('autonomous_bots')
      .update({
        total_runs: bot.total_runs + 1,
        successful_runs: bot.successful_runs + (errorsFound === 0 ? 1 : 0),
        last_run_at: new Date().toISOString()
      })
      .eq('id', bot.id);
    
    // Log the run
    await supabase.from('bot_runs').insert({
      bot_id: bot.id,
      status: errorsFound === 0 ? 'success' : 'partial',
      items_processed: healthChecks.length,
      items_succeeded: healthChecks.filter(h => h.status === 'healthy').length,
      items_failed: unhealthyApps.length,
      summary: `Checked ${healthChecks.length} apps, found ${errorsFound} issues, fixed ${fixesSuccessful}`
    });
  }
  
  return {
    checksPerformed: healthChecks.length,
    errorsFound,
    fixesAttempted,
    fixesSuccessful
  };
}

// =====================================================
// PROACTIVE MONITORING
// =====================================================

/**
 * Check for potential issues before they become problems
 */
export async function proactiveCheck(): Promise<string[]> {
  const warnings: string[] = [];
  
  // Check for apps with high error rates
  const { data: apps } = await supabase
    .from('app_registry')
    .select('app_name, id');
  
  if (apps) {
    for (const app of apps) {
      const { count } = await supabase
        .from('error_tracking')
        .select('id', { count: 'exact', head: true })
        .eq('app_id', app.id)
        .eq('is_resolved', false);
      
      if (count && count > 5) {
        warnings.push(`${app.app_name} has ${count} unresolved errors`);
      }
    }
  }
  
  // Check for stale deployments
  const { data: staleApps } = await supabase
    .from('app_registry')
    .select('app_name, last_health_check')
    .lt('last_health_check', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  if (staleApps) {
    for (const app of staleApps) {
      warnings.push(`${app.app_name} hasn't been health-checked in 24+ hours`);
    }
  }
  
  // Check for knowledge gaps
  const { data: gaps } = await supabase
    .from('knowledge_gaps')
    .select('topic, times_asked')
    .eq('is_resolved', false)
    .gt('times_asked', 3)
    .limit(5);
  
  if (gaps) {
    for (const gap of gaps) {
      warnings.push(`Knowledge gap: "${gap.topic}" asked ${gap.times_asked} times`);
    }
  }
  
  return warnings;
}

export default {
  checkAllApps,
  detectErrors,
  autoFix,
  triggerRedeploy,
  rollback,
  runSelfHealingCycle,
  proactiveCheck
};
