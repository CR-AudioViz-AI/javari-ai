import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface FeatureRequest {
  app_id: string;
  title: string;
  description: string;
  category?: string;
  user_id: string;
}

interface JavariResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// CREATE feature request
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: FeatureRequest = await request.json();

    // Validate required fields
    if (!body.app_id || !body.title || !body.description || !body.user_id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required fields: app_id, title, description, user_id',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Insert feature request
    const { data: feature, error: insertError } = await supabase
      .from('feature_requests')
      .insert({
        app_id: body.app_id,
        title: body.title,
        description: body.description,
        category: body.category,
        user_id: body.user_id,
        status: 'pending',
        votes: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting feature request:', insertError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to create feature request',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        feature_request_id: feature.id,
        feature
      },
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Error in /api/feature-requests POST:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// READ feature requests
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const app_id = searchParams.get('app_id');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const user_id = searchParams.get('user_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sort = searchParams.get('sort') || 'votes'; // votes | created_at

    let query = supabase
      .from('feature_requests')
      .select('*, feature_request_votes(count)')
      .limit(limit);

    if (app_id) query = query.eq('app_id', app_id);
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (user_id) query = query.eq('user_id', user_id);

    // Apply sorting
    if (sort === 'votes') {
      query = query.order('votes', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: features, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching feature requests:', fetchError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to fetch feature requests',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        features,
        count: features?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/feature-requests GET:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// UPDATE feature request
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing feature request ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = ['title', 'description', 'category', 'status'];
    const updates: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'No valid fields to update',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: feature, error: updateError } = await supabase
      .from('feature_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating feature request:', updateError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to update feature request',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: { feature },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/feature-requests PATCH:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// DELETE feature request
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing feature request ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('feature_requests')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting feature request:', deleteError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to delete feature request',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: { deleted_id: id },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/feature-requests DELETE:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
