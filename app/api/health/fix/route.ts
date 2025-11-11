import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/health/fix - Attempt to auto-fix a build issue
 * Body: { health_record_id: string, force?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.health_record_id) {
      return NextResponse.json(
        { error: 'health_record_id is required' },
        { status: 400 }
      );
    }
    
    // Fetch health record
    const { data: record, error: fetchError } = await supabase
      .from('javari_build_health_tracking')
      .select('*')
      .eq('id', body.health_record_id)
      .single();
    
    if (fetchError || !record) {
      return NextResponse.json(
        { error: 'Health record not found' },
        { status: 404 }
      );
    }
    
    // Check if auto-fixable
    if (!record.auto_fixable && !body.force) {
      return NextResponse.json(
        { 
          error: 'Issue is not auto-fixable', 
          suggestion: record.fix_suggestion,
          confidence: record.fix_confidence,
        },
        { status: 400 }
      );
    }
    
    // Check confidence threshold (unless forced)
    if (!body.force && record.fix_confidence < 0.7) {
      return NextResponse.json(
        { 
          error: 'Fix confidence too low for auto-fix',
          confidence: record.fix_confidence,
          suggestion: record.fix_suggestion,
          message: 'Use force=true to override this check',
        },
        { status: 400 }
      );
    }
    
    // Attempt auto-fix based on error type
    const fixResult = await attemptFix(record);
    
    // Update health record with fix result
    await supabase
      .from('javari_build_health_tracking')
      .update({
        fix_applied: true,
        fix_result: fixResult.success ? 'success' : 'failed',
      })
      .eq('id', record.id);
    
    // If fix was successful, create a work log
    if (fixResult.success && record.chat_session_id) {
      await supabase
        .from('javari_chat_work_logs')
        .insert({
          chat_session_id: record.chat_session_id,
          action_type: 'bug_fixed',
          action_category: 'code',
          description: `Auto-fixed build error: ${record.error_type || 'Unknown error'}`,
          impact_level: 'moderate',
          files_affected: fixResult.files_modified || [],
          needs_review: true,
        });
    }
    
    return NextResponse.json({
      success: fixResult.success,
      message: fixResult.message,
      actions_taken: fixResult.actions,
      files_modified: fixResult.files_modified,
      next_steps: fixResult.next_steps,
    });
    
  } catch (error: unknown) {
    logError('Unexpected error during auto-fix:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Attempt to automatically fix the issue
 */
async function attemptFix(record: any): Promise<{
  success: boolean;
  message: string;
  actions: string[];
  files_modified?: string[];
  next_steps?: string[];
}> {
  const actions: string[] = [];
  const files_modified: string[] = [];
  const next_steps: string[] = [];
  
  const error = (record.error_message || '').toLowerCase();
  
  // Missing dependency fix
  if (error.includes('cannot find module') || error.includes('module not found')) {
    const match = error.match(/['"]([^'"]+)['"]/);
    const moduleName = match ? match[1] : null;
    
    if (moduleName) {
      actions.push(`Identified missing module: ${moduleName}`);
      actions.push(`Would install: npm install ${moduleName}`);
      next_steps.push(`Run: npm install ${moduleName}`);
      next_steps.push('Commit package.json and package-lock.json');
      next_steps.push('Trigger rebuild');
      
      return {
        success: false, // We can't actually install in this environment
        message: `Auto-fix suggestion generated for missing module: ${moduleName}`,
        actions,
        next_steps,
      };
    }
  }
  
  // TypeScript type errors
  if (error.includes('type') && error.includes('not assignable')) {
    actions.push('TypeScript type mismatch detected');
    actions.push('Analysis: Add proper type annotations or assertions');
    next_steps.push('Review TypeScript error details');
    next_steps.push('Add explicit type annotations');
    next_steps.push('Consider using type assertions if types are correct');
    
    return {
      success: false,
      message: 'Type error detected - manual fix recommended',
      actions,
      next_steps,
    };
  }
  
  // Environment variable errors
  if (error.includes('env') || error.includes('environment variable')) {
    actions.push('Missing environment variable detected');
    next_steps.push('Add missing environment variables to Vercel');
    next_steps.push('Go to Project Settings > Environment Variables');
    next_steps.push('Add required variables and redeploy');
    
    return {
      success: false,
      message: 'Environment variable issue detected',
      actions,
      next_steps,
    };
  }
  
  // Memory errors
  if (error.includes('out of memory') || error.includes('heap out of memory')) {
    actions.push('Memory limit exceeded during build');
    next_steps.push('Add NODE_OPTIONS=--max-old-space-size=4096 to environment variables');
    next_steps.push('Consider code splitting and lazy loading');
    next_steps.push('Optimize bundle size');
    
    return {
      success: false,
      message: 'Memory optimization suggestions generated',
      actions,
      next_steps,
    };
  }
  
  // Import/Export errors
  if (error.includes('does not provide an export')) {
    actions.push('Import/Export mismatch detected');
    next_steps.push('Check if module uses default export vs named export');
    next_steps.push('Update import statement accordingly');
    next_steps.push('Example: import Module from "..." vs import { Module } from "..."
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';');
    
    return {
      success: false,
      message: 'Import/Export fix suggestions generated',
      actions,
      next_steps,
    };
  }
  
  // Build timeout
  if (error.includes('timeout') || error.includes('timed out')) {
    actions.push('Build timeout detected');
    next_steps.push('Optimize build performance');
    next_steps.push('Consider incremental static regeneration');
    next_steps.push('Implement code splitting');
    next_steps.push('Use dynamic imports for large components');
    
    return {
      success: false,
      message: 'Build timeout optimization suggestions generated',
      actions,
      next_steps,
    };
  }
  
  // Default: Unknown error
  return {
    success: false,
    message: 'Unable to automatically fix this error',
    actions: ['Manual investigation required'],
    next_steps: [
      'Review full build logs',
      'Check error stack trace',
      'Search for similar issues',
      'Consult documentation',
    ],
  };
}

/**
 * GET /api/health/fix/stats - Get auto-fix statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');
    
    // Build query
    let query = supabase
      .from('javari_build_health_tracking')
      .select('*');
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data: records, error } = await query;
    
    if (error) {
      logError('Error fetching fix stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fix statistics' },
        { status: 500 }
      );
    }
    
    // Calculate statistics
    const stats = {
      total_failures: 0,
      auto_fixable_count: 0,
      fixes_attempted: 0,
      fixes_successful: 0,
      fixes_failed: 0,
      success_rate: 0,
      by_error_type: {} as Record<string, number>,
      average_fix_confidence: 0,
    };
    
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    records?.forEach((record) => {
      if (record.build_status === 'failed') {
        stats.total_failures += 1;
      }
      
      if (record.auto_fixable) {
        stats.auto_fixable_count += 1;
      }
      
      if (record.fix_applied) {
        stats.fixes_attempted += 1;
        
        if (record.fix_result === 'success') {
          stats.fixes_successful += 1;
        } else if (record.fix_result === 'failed') {
          stats.fixes_failed += 1;
        }
      }
      
      if (record.error_type) {
        stats.by_error_type[record.error_type] = 
          (stats.by_error_type[record.error_type] || 0) + 1;
      }
      
      if (record.fix_confidence) {
        totalConfidence += record.fix_confidence;
        confidenceCount += 1;
      }
    });
    
    stats.success_rate = stats.fixes_attempted > 0
      ? (stats.fixes_successful / stats.fixes_attempted) * 100
      : 0;
    
    stats.average_fix_confidence = confidenceCount > 0
      ? totalConfidence / confidenceCount
      : 0;
    
    return NextResponse.json({
      ...stats,
      success_rate: parseFloat(stats.success_rate.toFixed(2)),
      average_fix_confidence: parseFloat(stats.average_fix_confidence.toFixed(2)),
    });
    
  } catch (error: unknown) {
    logError('Unexpected error calculating fix stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
