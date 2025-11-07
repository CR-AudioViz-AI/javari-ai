import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

/**
 * GET /api/health - List build health tracking records
 * Query params:
 *   - project_id: Filter by project
 *   - build_status: Filter by status (success, failed, pending)
 *   - auto_fixable: Filter by auto-fixable flag
 *   - limit: Number of results (default 50)
 *   - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const projectId = searchParams.get('project_id');
    const buildStatus = searchParams.get('build_status');
    const autoFixable = searchParams.get('auto_fixable');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build query
    let query = supabase
      .from('javari_build_health_tracking')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    if (buildStatus) {
      query = query.eq('build_status', buildStatus);
    }
    
    if (autoFixable !== null && autoFixable !== undefined) {
      query = query.eq('auto_fixable', autoFixable === 'true');
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      logError(\'Error fetching health records:\', error);
      return NextResponse.json(
        { error: 'Failed to fetch health records', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      health_records: data || [],
      total: count || 0,
      limit,
      offset,
    });
    
  } catch (error: unknown) {
    logError(\'Unexpected error fetching health records:\', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/health - Create a new health tracking record
 * Body: Build health data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Validate required fields
    if (!body.project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }
    
    if (!body.build_status) {
      return NextResponse.json(
        { error: 'build_status is required' },
        { status: 400 }
      );
    }
    
    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('javari_projects')
      .select('id')
      .eq('id', body.project_id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Analyze error and generate fix suggestion if build failed
    let autoFixable = false;
    let fixSuggestion = null;
    let fixConfidence = null;
    
    if (body.build_status === 'failed' && body.error_message) {
      const analysis = await analyzeError(body.error_message, body.error_stack);
      autoFixable = analysis.autoFixable;
      fixSuggestion = analysis.fixSuggestion;
      fixConfidence = analysis.confidence;
    }
    
    // Prepare health record data
    const healthData = {
      project_id: body.project_id,
      chat_session_id: body.chat_session_id || null,
      build_id: body.build_id,
      build_status: body.build_status,
      error_type: body.error_type,
      error_message: body.error_message,
      error_stack: body.error_stack,
      auto_fixable: autoFixable,
      fix_suggestion: fixSuggestion,
      fix_confidence: fixConfidence,
      fix_applied: false,
      build_duration_seconds: body.build_duration_seconds,
      files_affected: body.files_affected || [],
      build_started_at: body.build_started_at || new Date().toISOString(),
      build_completed_at: body.build_completed_at,
    };
    
    // Insert health record
    const { data: record, error } = await supabase
      .from('javari_build_health_tracking')
      .insert(healthData)
      .select()
      .single();
    
    if (error) {
      logError(\'Error creating health record:\', error);
      return NextResponse.json(
        { error: 'Failed to create health record', details: error.message },
        { status: 500 }
      );
    }
    
    // If auto-fixable with high confidence, trigger auto-fix
    if (autoFixable && fixConfidence && fixConfidence >= 0.8) {
      // Queue auto-fix (implement in separate endpoint)
      console.log('Auto-fix queued for record:', record.id);
    }
    
    return NextResponse.json(record, { status: 201 });
    
  } catch (error: unknown) {
    logError(\'Unexpected error creating health record:\', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Analyze error message and generate fix suggestion
 */
async function analyzeError(
  errorMessage: string,
  errorStack?: string
): Promise<{
  autoFixable: boolean;
  fixSuggestion: string | null;
  confidence: number;
}> {
  const error = errorMessage.toLowerCase();
  const stack = (errorStack || '').toLowerCase();
  
  // TypeScript errors
  if (error.includes('type') && error.includes('not assignable')) {
    return {
      autoFixable: true,
      fixSuggestion: 'Add proper type annotations or use type assertions. Check the TypeScript error output for specific type mismatches.',
      confidence: 0.7,
    };
  }
  
  // Missing dependency
  if (error.includes('cannot find module') || error.includes('module not found')) {
    const match = error.match(/['"]([^'"]+)['"]/);
    const moduleName = match ? match[1] : null;
    return {
      autoFixable: true,
      fixSuggestion: moduleName 
        ? `Install missing dependency: npm install ${moduleName}`
        : 'Install missing dependencies: npm install',
      confidence: moduleName ? 0.9 : 0.7,
    };
  }
  
  // Import/Export errors
  if (error.includes('does not provide an export')) {
    return {
      autoFixable: true,
      fixSuggestion: 'Check the import statement. The module may use default export instead of named export, or vice versa.',
      confidence: 0.75,
    };
  }
  
  // Syntax errors
  if (error.includes('unexpected token') || error.includes('syntax error')) {
    return {
      autoFixable: false,
      fixSuggestion: 'Fix syntax error in the code. Check for missing brackets, semicolons, or invalid syntax.',
      confidence: 0.5,
    };
  }
  
  // Environment variable errors
  if (error.includes('env') || error.includes('environment variable')) {
    return {
      autoFixable: true,
      fixSuggestion: 'Add missing environment variables to Vercel project settings or .env file.',
      confidence: 0.85,
    };
  }
  
  // Build timeout
  if (error.includes('timeout') || error.includes('timed out')) {
    return {
      autoFixable: true,
      fixSuggestion: 'Optimize build process or increase build timeout. Consider code splitting or lazy loading.',
      confidence: 0.6,
    };
  }
  
  // Memory errors
  if (error.includes('out of memory') || error.includes('heap out of memory')) {
    return {
      autoFixable: true,
      fixSuggestion: 'Increase Node memory limit with NODE_OPTIONS=--max-old-space-size=4096 or optimize memory usage.',
      confidence: 0.8,
    };
  }
  
  // API errors
  if (error.includes('api') && (error.includes('401') || error.includes('403'))) {
    return {
      autoFixable: true,
      fixSuggestion: 'Check API credentials and authentication tokens. Ensure API keys are correctly set in environment variables.',
      confidence: 0.75,
    };
  }
  
  // Network errors
  if (error.includes('network') || error.includes('econnrefused') || error.includes('etimedout')) {
    return {
      autoFixable: false,
      fixSuggestion: 'Network issue detected. This may be temporary. Try rebuilding or check external service availability.',
      confidence: 0.5,
    };
  }
  
  // Unknown error
  return {
    autoFixable: false,
    fixSuggestion: 'Manual investigation required. Check build logs for more details.',
    confidence: 0.3,
  };
}
