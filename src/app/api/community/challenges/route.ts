```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Types
interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  start_date: string;
  end_date: string;
  max_participants: number;
  prize_pool: number;
  status: 'draft' | 'active' | 'judging' | 'completed' | 'cancelled';
  judging_criteria: JudgingCriteria[];
  rules: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface JudgingCriteria {
  name: string;
  weight: number;
  description: string;
  automated: boolean;
}

interface Submission {
  id: string;
  challenge_id: string;
  user_id: string;
  title: string;
  description: string;
  audio_url: string;
  visualization_url: string;
  metadata: Record<string, any>;
  scores: Record<string, number>;
  total_score: number;
  submitted_at: string;
}

// Validation schemas
const createChallengeSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  category: z.string().min(2).max(50),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  max_participants: z.number().min(1).max(10000),
  prize_pool: z.number().min(0),
  judging_criteria: z.array(z.object({
    name: z.string().min(2).max(100),
    weight: z.number().min(0.1).max(1),
    description: z.string().min(5).max(500),
    automated: z.boolean()
  })),
  rules: z.array(z.string().min(5).max(500))
});

const updateChallengeSchema = createChallengeSchema.partial();

// Helper functions
function initSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function getCurrentUser(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('sb-access-token')?.value;
    
    if (!token) {
      return null;
    }

    const supabase = initSupabase(request);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

async function validateChallengeOwnership(supabase: any, challengeId: string, userId: string) {
  const { data: challenge, error } = await supabase
    .from('challenges')
    .select('created_by, status')
    .eq('id', challengeId)
    .single();

  if (error || !challenge) {
    return { valid: false, message: 'Challenge not found' };
  }

  if (challenge.created_by !== userId && challenge.status !== 'draft') {
    return { valid: false, message: 'Unauthorized to modify this challenge' };
  }

  return { valid: true, challenge };
}

async function calculateAutomatedScores(submission: any) {
  // Simulate automated judging based on audio analysis
  const scores: Record<string, number> = {};
  
  try {
    // Audio quality analysis (mock implementation)
    scores.audio_quality = Math.random() * 40 + 60; // 60-100 range
    
    // Visualization creativity (mock implementation)
    scores.creativity = Math.random() * 30 + 70; // 70-100 range
    
    // Technical execution (mock implementation)
    scores.technical = Math.random() * 25 + 75; // 75-100 range
    
    // Sync accuracy (mock implementation)
    scores.sync_accuracy = Math.random() * 20 + 80; // 80-100 range

    return scores;
  } catch (error) {
    console.error('Error calculating automated scores:', error);
    return {};
  }
}

async function updateLeaderboard(supabase: any, challengeId: string) {
  try {
    const { data: submissions, error } = await supabase
      .from('challenge_submissions')
      .select(`
        id,
        user_id,
        title,
        total_score,
        users!inner(username, avatar_url)
      `)
      .eq('challenge_id', challengeId)
      .order('total_score', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Cache leaderboard data
    await supabase
      .from('challenge_leaderboards')
      .upsert({
        challenge_id: challengeId,
        leaderboard_data: submissions,
        updated_at: new Date().toISOString()
      });

    return submissions;
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    return [];
  }
}

async function distributeRewards(supabase: any, challengeId: string) {
  try {
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('prize_pool, status')
      .eq('id', challengeId)
      .single();

    if (challengeError || challenge.status !== 'completed') {
      throw new Error('Challenge not eligible for reward distribution');
    }

    const { data: winners, error: winnersError } = await supabase
      .from('challenge_submissions')
      .select('user_id, total_score')
      .eq('challenge_id', challengeId)
      .order('total_score', { ascending: false })
      .limit(3);

    if (winnersError || !winners.length) {
      throw new Error('No winners found');
    }

    // Distribute rewards (simplified allocation)
    const rewards = [
      { place: 1, percentage: 0.5 },
      { place: 2, percentage: 0.3 },
      { place: 3, percentage: 0.2 }
    ];

    for (let i = 0; i < Math.min(winners.length, 3); i++) {
      const amount = challenge.prize_pool * rewards[i].percentage;
      
      await supabase
        .from('reward_distributions')
        .insert({
          challenge_id: challengeId,
          user_id: winners[i].user_id,
          place: i + 1,
          amount,
          status: 'pending',
          created_at: new Date().toISOString()
        });
    }

    return { success: true, distributed_count: Math.min(winners.length, 3) };
  } catch (error) {
    console.error('Error distributing rewards:', error);
    return { success: false, error: error.message };
  }
}

// GET - Fetch challenges with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';

    const supabase = initSupabase(request);
    
    let query = supabase
      .from('challenges')
      .select(`
        id,
        title,
        description,
        category,
        difficulty,
        start_date,
        end_date,
        max_participants,
        prize_pool,
        status,
        judging_criteria,
        rules,
        created_by,
        created_at,
        updated_at,
        users!inner(username, avatar_url),
        challenge_participants(count),
        challenge_submissions(count)
      `, { count: 'exact' });

    // Apply filters
    if (status && ['draft', 'active', 'judging', 'completed', 'cancelled'].includes(status)) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (difficulty && ['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
      query = query.eq('difficulty', difficulty);
    }

    // Apply sorting and pagination
    const offset = (page - 1) * limit;
    query = query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: challenges, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch challenges' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      challenges: challenges || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('GET /api/community/challenges error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new challenge
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createChallengeSchema.parse(body);

    // Validate dates
    const startDate = new Date(validatedData.start_date);
    const endDate = new Date(validatedData.end_date);
    const now = new Date();

    if (startDate <= now) {
      return NextResponse.json(
        { error: 'Start date must be in the future' },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Validate judging criteria weights sum to 1
    const totalWeight = validatedData.judging_criteria.reduce((sum, criteria) => sum + criteria.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      return NextResponse.json(
        { error: 'Judging criteria weights must sum to 1.0' },
        { status: 400 }
      );
    }

    const supabase = initSupabase(request);

    const { data: challenge, error } = await supabase
      .from('challenges')
      .insert({
        ...validatedData,
        created_by: user.id,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create challenge' },
        { status: 500 }
      );
    }

    // Initialize leaderboard
    await supabase
      .from('challenge_leaderboards')
      .insert({
        challenge_id: challenge.id,
        leaderboard_data: [],
        updated_at: new Date().toISOString()
      });

    return NextResponse.json(challenge, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('POST /api/community/challenges error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update challenge
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('id');

    if (!challengeId) {
      return NextResponse.json(
        { error: 'Challenge ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateChallengeSchema.parse(body);

    const supabase = initSupabase(request);

    // Validate ownership
    const ownership = await validateChallengeOwnership(supabase, challengeId, user.id);
    if (!ownership.valid) {
      return NextResponse.json(
        { error: ownership.message },
        { status: 403 }
      );
    }

    const { data: challenge, error } = await supabase
      .from('challenges')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', challengeId)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update challenge' },
        { status: 500 }
      );
    }

    return NextResponse.json(challenge);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('PUT /api/community/challenges error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete challenge
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('id');

    if (!challengeId) {
      return NextResponse.json(
        { error: 'Challenge ID required' },
        { status: 400 }
      );
    }

    const supabase = initSupabase(request);

    // Validate ownership
    const ownership = await validateChallengeOwnership(supabase, challengeId, user.id);
    if (!ownership.valid) {
      return NextResponse.json(
        { error: ownership.message },
        { status: 403 }
      );
    }

    // Check if challenge has active participants
    const { data: participants, error: participantsError } = await supabase
      .from('challenge_participants')
      .select('count')
      .eq('challenge_id', challengeId);

    if (participantsError) {
      return NextResponse.json(
        { error: 'Failed to check participants' },
        { status: 500 }
      );
    }

    if (participants && participants.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete challenge with active participants' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete challenge' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/community/challenges error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```