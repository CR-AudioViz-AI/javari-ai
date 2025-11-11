import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const projectId = searchParams.get('project_id');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let query = supabase
      .from('javari_smart_suggestions')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (projectId) query = query.eq('project_id', projectId);
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch suggestions', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ suggestions: data || [] });
  } catch (error: unknown) {
    logError('Error fetching suggestions:\', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.project_id || !body.type || !body.title || !body.description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const suggestionData = {
      project_id: body.project_id,
      chat_session_id: body.chat_session_id,
      type: body.type,
      title: body.title,
      description: body.description,
      rationale: body.rationale,
      code_example: body.code_example,
      files_to_modify: body.files_to_modify || [],
      estimated_effort_hours: body.estimated_effort_hours || 1.0,
      priority: body.priority || 'medium',
      confidence_score: body.confidence_score || 0.5,
      expected_impact: body.expected_impact || '',
      potential_risks: body.potential_risks,
      status: 'pending',
    };
    
    const { data, error } = await supabase
      .from('javari_smart_suggestions')
      .insert(suggestionData)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create suggestion', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    logError('Error creating suggestion:\', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json({ error: 'Suggestion ID is required' }, { status: 400 });
    }
    
    const updateData: any = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.implemented_in_chat_id !== undefined) {
      updateData.implemented_in_chat_id = body.implemented_in_chat_id;
    }
    
    const { data, error } = await supabase
      .from('javari_smart_suggestions')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to update suggestion', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error: unknown) {
    logError('Error updating suggestion:\', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
