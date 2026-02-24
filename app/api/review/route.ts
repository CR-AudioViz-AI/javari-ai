import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let query = supabase
      .from('javari_code_review_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (projectId) query = query.eq('project_id', projectId);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch review queue', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ reviews: data || [] });
  } catch (error: unknown) {
    logError('Error fetching review queue:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.project_id || !body.chat_session_id || !body.work_log_id || !body.file_path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Analyze code complexity (simplified)
    const complexity = analyzeComplexity(body.code_diff || '');
    const concerns = detectConcerns(body.code_diff || '');
    
    const reviewData = {
      project_id: body.project_id,
      chat_session_id: body.chat_session_id,
      work_log_id: body.work_log_id,
      file_path: body.file_path,
      change_type: body.change_type || 'modified',
      code_diff: body.code_diff,
      complexity_score: complexity.score,
      potential_issues: concerns.issues,
      security_concerns: concerns.security,
      performance_concerns: concerns.performance,
      suggestions: concerns.suggestions,
      status: 'pending',
      priority: determinePriority(complexity.score, concerns),
    };
    
    const { data, error } = await supabase
      .from('javari_code_review_queue')
      .insert(reviewData)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create review', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    logError('Error creating review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function analyzeComplexity(code: string): { score: number } {
  let score = 0;
  
  // Simple heuristics
  if (code.includes('for') || code.includes('while')) score += 10;
  if (code.includes('if') || code.includes('switch')) score += 5;
  if (code.includes('async') || code.includes('await')) score += 15;
  if (code.includes('try') || code.includes('catch')) score += 10;
  
  const lines = code.split('\n').length;
  score += Math.min(lines, 50); // Cap at 50 for lines
  
  return { score: Math.min(score, 100) };
}

function detectConcerns(code: string) {
  const issues: string[] = [];
  const security: string[] = [];
  const performance: string[] = [];
  const suggestions: string[] = [];
  
  const lowerCode = code.toLowerCase();
  
  // Security concerns
  if (lowerCode.includes('eval(')) {
    security.push('Avoid using eval() - potential security risk');
  }
  if (lowerCode.includes('dangerouslysetinnerhtml')) {
    security.push('dangerouslySetInnerHTML detected - ensure content is sanitized');
  }
  if (lowerCode.includes('password') && !lowerCode.includes('hash')) {
    security.push('Password handling detected - ensure proper hashing');
  }
  
  // Performance concerns
  if (lowerCode.includes('.map(') && lowerCode.includes('.filter(')) {
    performance.push('Consider combining map and filter operations');
  }
  if (lowerCode.includes('useeffect') && lowerCode.includes('[]') === false) {
    performance.push('useEffect without dependency array may cause performance issues');
  }
  
  // General issues
  if (lowerCode.includes('any')) {
    issues.push('TypeScript "any" type detected - consider using specific types');
  }
  if (lowerCode.includes('console.log')) {
    issues.push('console.log statements found - remove before production');
  }
  
  // Suggestions
  if (code.length > 500) {
    suggestions.push('Consider breaking this into smaller functions');
  }
  if (!lowerCode.includes('test') && !lowerCode.includes('spec')) {
    suggestions.push('Consider adding unit tests for this code');
  }
  
  return { issues, security, performance, suggestions };
}

function determinePriority(complexity: number, concerns: any): string {
  if (concerns.security.length > 0) return 'urgent';
  if (complexity > 70 || concerns.performance.length > 2) return 'high';
  if (concerns.issues.length > 3) return 'medium';
  return 'low';
}
