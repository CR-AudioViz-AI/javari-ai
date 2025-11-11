import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { type, description, fileName, code, error } = await request.json();

    if (!type || !description) {
      return NextResponse.json(
        { error: 'Type and description are required' },
        { status: 400 }
      );
    }

    // Log the event
    const { error: logError } = await supabase.from('developer_learning_log').insert({
      event_type: type,
      description,
      metadata: {
        fileName,
        codeSnippet: code?.substring(0, 500),
        error,
        timestamp: new Date().toISOString(),
      },
      success: type === 'success',
    });

    if (logError) {
      console.error('Failed to log learning event:', logError);
    }

    // Update knowledge base on success
    if (type === 'success' && fileName && code) {
      // Extract patterns from successful code
      const patterns = extractPatterns(code);
      
      await supabase.from('developer_knowledge').insert({
        description,
        file_name: fileName,
        code_pattern: code.substring(0, 1000),
        tags: patterns.tags,
        category: patterns.category,
        success: true,
        usage_count: 1,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logError('Learning API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to log learning event',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve learning insights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    let query = supabase
      .from('developer_learning_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('event_type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate success rate
    const successCount = data.filter(log => log.success).length;
    const totalCount = data.length;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    return NextResponse.json({
      logs: data,
      stats: {
        total: totalCount,
        successes: successCount,
        failures: totalCount - successCount,
        successRate: successRate.toFixed(2),
      },
    });
  } catch (error: unknown) {
    logError('Learning retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve learning data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract patterns from successful code for learning
 */
function extractPatterns(code: string): { tags: string[]; category: string } {
  const tags: string[] = [];
  let category = 'general';

  // Detect React patterns
  if (code.includes('use client') || code.includes('useState') || code.includes('useEffect')) {
    tags.push('react');
    category = 'frontend';
  }

  // Detect API patterns
  if (code.includes('NextRequest') || code.includes('NextResponse')) {
    tags.push('api');
    category = 'backend';
  }

  // Detect database patterns
  if (code.includes('supabase') || code.includes('createClient')) {
    tags.push('database');
  }

  // Detect UI component patterns
  if (code.includes('shadcn') || code.includes('@/components/ui')) {
    tags.push('ui-components');
  }

  // Detect form patterns
  if (code.includes('onSubmit') || code.includes('handleSubmit')) {
    tags.push('forms');
  }

  // Detect authentication patterns
  if (code.includes('auth') || code.includes('session') || code.includes('user')) {
    tags.push('authentication');
  }

  // Detect styling patterns
  if (code.includes('tailwind') || code.includes('className')) {
    tags.push('styling');
  }

  return { tags, category };
}
