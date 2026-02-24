import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface VoteRequest {
  feature_request_id: string;
  user_id: string;
}

interface JavariResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ADD vote
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: VoteRequest = await request.json();

    // Validate required fields
    if (!body.feature_request_id || !body.user_id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required fields: feature_request_id, user_id',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('feature_request_votes')
      .select('id')
      .eq('feature_request_id', body.feature_request_id)
      .eq('user_id', body.user_id)
      .single();

    if (existingVote) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'User has already voted for this feature request',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Insert vote
    const { data: vote, error: voteError } = await supabase
      .from('feature_request_votes')
      .insert({
        feature_request_id: body.feature_request_id,
        user_id: body.user_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (voteError) {
      console.error('Error inserting vote:', voteError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to add vote',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Increment vote count on feature request
    const { error: updateError } = await supabase
      .rpc('increment_feature_votes', { 
        feature_id: body.feature_request_id 
      });

    if (updateError) {
      console.error('Error incrementing vote count:', updateError);
      // Don't fail the request - vote is recorded
    }

    // Get updated feature request
    const { data: feature } = await supabase
      .from('feature_requests')
      .select('*')
      .eq('id', body.feature_request_id)
      .single();

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        vote_id: vote.id,
        new_vote_count: feature?.votes || 0
      },
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Error in /api/feature-requests/vote POST:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// REMOVE vote
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const feature_request_id = searchParams.get('feature_request_id');
    const user_id = searchParams.get('user_id');

    if (!feature_request_id || !user_id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required parameters: feature_request_id, user_id',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Delete vote
    const { error: deleteError } = await supabase
      .from('feature_request_votes')
      .delete()
      .eq('feature_request_id', feature_request_id)
      .eq('user_id', user_id);

    if (deleteError) {
      console.error('Error deleting vote:', deleteError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to remove vote',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Decrement vote count on feature request
    const { error: updateError } = await supabase
      .rpc('decrement_feature_votes', { 
        feature_id: feature_request_id 
      });

    if (updateError) {
      console.error('Error decrementing vote count:', updateError);
      // Don't fail the request - vote is removed
    }

    // Get updated feature request
    const { data: feature } = await supabase
      .from('feature_requests')
      .select('*')
      .eq('id', feature_request_id)
      .single();

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        new_vote_count: feature?.votes || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/feature-requests/vote DELETE:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET user's votes
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const user_id = searchParams.get('user_id');
    const feature_request_id = searchParams.get('feature_request_id');

    if (!user_id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required parameter: user_id',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    let query = supabase
      .from('feature_request_votes')
      .select('*, feature_requests(*)')
      .eq('user_id', user_id);

    if (feature_request_id) {
      query = query.eq('feature_request_id', feature_request_id);
    }

    const { data: votes, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching votes:', fetchError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to fetch votes',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        votes,
        count: votes?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/feature-requests/vote GET:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
