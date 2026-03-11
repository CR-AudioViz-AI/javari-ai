import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';
import { headers } from 'next/headers';

// Validation schemas
const CreateMemorySchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(['learning', 'context', 'decision', 'insight', 'reference']),
  tags: z.array(z.string()).optional().default([]),
  privacy_level: z.enum(['public', 'team', 'private']).default('team'),
  project_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional().default({}),
  expires_at: z.string().datetime().optional()
});

const GetMemoriesSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(['learning', 'context', 'decision', 'insight', 'reference']).optional(),
  project_id: z.string().uuid().optional(),
  privacy_level: z.enum(['public', 'team', 'private']).optional(),
  include_expired: z.coerce.boolean().default(false)
});

interface DatabaseMemoryEntry {
  id: string;
  content: string;
  type: string;
  tags: string[];
  privacy_level: string;
  project_id?: string;
  metadata: Record<string, any>;
  embedding?: number[];
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  access_count: number;
  last_accessed_at?: string;
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit input size
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

async function getUserId(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const { success } = await ratelimit.limit(`team-memory:${userId}`);
    return success;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return true; // Allow on error
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitOk = await checkRateLimit(userId);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = CreateMemorySchema.parse(body);

    // Generate embedding for semantic search
    const embedding = await generateEmbedding(
      `${validatedData.content} ${validatedData.tags.join(' ')}`
    );

    // Insert memory entry
    const { data: memoryEntry, error: insertError } = await supabase
      .from('memory_entries')
      .insert({
        content: validatedData.content,
        type: validatedData.type,
        tags: validatedData.tags,
        privacy_level: validatedData.privacy_level,
        project_id: validatedData.project_id,
        metadata: validatedData.metadata,
        embedding,
        created_by: userId,
        expires_at: validatedData.expires_at,
        access_count: 0
      })
      .select(`
        id,
        content,
        type,
        tags,
        privacy_level,
        project_id,
        metadata,
        created_by,
        created_at,
        updated_at,
        expires_at,
        access_count,
        last_accessed_at
      `)
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create memory entry' },
        { status: 500 }
      );
    }

    // Log memory creation activity
    await supabase
      .from('memory_activities')
      .insert({
        memory_id: memoryEntry.id,
        action: 'created',
        user_id: userId,
        metadata: {
          type: validatedData.type,
          privacy_level: validatedData.privacy_level
        }
      });

    return NextResponse.json({
      success: true,
      data: memoryEntry
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/team-memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = GetMemoriesSchema.parse(queryParams);

    let query = supabase
      .from('memory_entries')
      .select(`
        id,
        content,
        type,
        tags,
        privacy_level,
        project_id,
        metadata,
        created_by,
        created_at,
        updated_at,
        expires_at,
        access_count,
        last_accessed_at,
        profiles:created_by (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(validatedParams.offset, validatedParams.offset + validatedParams.limit - 1);

    // Apply privacy filters
    query = query.or(`privacy_level.eq.public,and(privacy_level.eq.team,created_by.eq.${userId}),and(privacy_level.eq.private,created_by.eq.${userId})`);

    // Apply type filter
    if (validatedParams.type) {
      query = query.eq('type', validatedParams.type);
    }

    // Apply project filter
    if (validatedParams.project_id) {
      query = query.eq('project_id', validatedParams.project_id);
    }

    // Apply privacy level filter
    if (validatedParams.privacy_level) {
      query = query.eq('privacy_level', validatedParams.privacy_level);
    }

    // Handle expired memories
    if (!validatedParams.include_expired) {
      query = query.or('expires_at.is.null,expires_at.gt.now()');
    }

    const { data: memories, error: selectError, count } = await query;

    if (selectError) {
      console.error('Database select error:', selectError);
      return NextResponse.json(
        { error: 'Failed to fetch memories' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('memory_entries')
      .select('*', { count: 'exact', head: true })
      .or(`privacy_level.eq.public,and(privacy_level.eq.team,created_by.eq.${userId}),and(privacy_level.eq.private,created_by.eq.${userId})`)
      .apply(builder => {
        if (validatedParams.type) builder.eq('type', validatedParams.type);
        if (validatedParams.project_id) builder.eq('project_id', validatedParams.project_id);
        if (validatedParams.privacy_level) builder.eq('privacy_level', validatedParams.privacy_level);
        if (!validatedParams.include_expired) {
          builder.or('expires_at.is.null,expires_at.gt.now()');
        }
        return builder;
      });

    return NextResponse.json({
      success: true,
      data: memories,
      pagination: {
        total: totalCount || 0,
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        hasMore: (validatedParams.offset + validatedParams.limit) < (totalCount || 0)
      }
    });

  } catch (error) {
    console.error('GET /api/team-memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    // Validate update data
    const validatedData = CreateMemorySchema.partial().parse(updateData);

    // Check if user can update this memory
    const { data: existingMemory, error: fetchError } = await supabase
      .from('memory_entries')
      .select('created_by, privacy_level')
      .eq('id', id)
      .single();

    if (fetchError || !existingMemory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    if (existingMemory.created_by !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Can only update own memories' },
        { status: 403 }
      );
    }

    // Generate new embedding if content changed
    let embedding;
    if (validatedData.content || validatedData.tags) {
      const content = validatedData.content || '';
      const tags = validatedData.tags || [];
      embedding = await generateEmbedding(`${content} ${tags.join(' ')}`);
    }

    const updateFields = {
      ...validatedData,
      ...(embedding && { embedding }),
      updated_at: new Date().toISOString()
    };

    const { data: updatedMemory, error: updateError } = await supabase
      .from('memory_entries')
      .update(updateFields)
      .eq('id', id)
      .select(`
        id,
        content,
        type,
        tags,
        privacy_level,
        project_id,
        metadata,
        created_by,
        created_at,
        updated_at,
        expires_at,
        access_count,
        last_accessed_at
      `)
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update memory' },
        { status: 500 }
      );
    }

    // Log memory update activity
    await supabase
      .from('memory_activities')
      .insert({
        memory_id: id,
        action: 'updated',
        user_id: userId,
        metadata: { updated_fields: Object.keys(validatedData) }
      });

    return NextResponse.json({
      success: true,
      data: updatedMemory
    });

  } catch (error) {
    console.error('PUT /api/team-memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    // Check if user can delete this memory
    const { data: existingMemory, error: fetchError } = await supabase
      .from('memory_entries')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existingMemory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    if (existingMemory.created_by !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Can only delete own memories' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from('memory_entries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete memory' },
        { status: 500 }
      );
    }

    // Log memory deletion activity
    await supabase
      .from('memory_activities')
      .insert({
        memory_id: id,
        action: 'deleted',
        user_id: userId,
        metadata: {}
      });

    return NextResponse.json({
      success: true,
      message: 'Memory deleted successfully'
    });

  } catch (error) {
    console.error('DELETE /api/team-memory error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}