import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';

// Environment validation
const requiredEnvVars = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
};

Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

// Initialize clients
const supabase = createClient(
  requiredEnvVars.SUPABASE_URL,
  requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: requiredEnvVars.OPENAI_API_KEY,
});

// Validation schemas
const createMemorySchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  category: z.enum(['decision', 'learning', 'context', 'process', 'insight', 'reference']),
  tags: z.array(z.string()).max(20).optional(),
  metadata: z.record(z.any()).optional(),
  team_id: z.string().uuid(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

const updateMemorySchema = createMemorySchema.partial().omit(['team_id']);

const searchMemorySchema = z.object({
  query: z.string().min(1).max(500),
  team_id: z.string().uuid(),
  category: z.enum(['decision', 'learning', 'context', 'process', 'insight', 'reference']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  threshold: z.number().min(0).max(1).default(0.7),
});

// Types
interface TeamMemory {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  metadata: Record<string, any>;
  team_id: string;
  priority: string;
  embedding: number[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

interface SearchResult extends Omit<TeamMemory, 'embedding'> {
  similarity: number;
  relevance_score: number;
}

// Utility functions
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Limit input length
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw new Error('Failed to generate embedding');
  }
}

async function authenticateUser(request: NextRequest): Promise<{ user_id: string; team_id?: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid authentication token');
  }

  return { user_id: user.id };
}

async function checkTeamAccess(user_id: string, team_id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', user_id)
    .eq('team_id', team_id)
    .eq('status', 'active')
    .single();

  return !error && !!data;
}

async function applyRateLimit(request: NextRequest, user_id: string): Promise<void> {
  const identifier = `team_memory:${user_id}`;
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    throw new Error('Rate limit exceeded');
  }
}

// POST - Create new memory entry
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user_id } = await authenticateUser(request);
    
    // Rate limiting
    await applyRateLimit(request, user_id);

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createMemorySchema.parse(body);

    // Check team access
    const hasAccess = await checkTeamAccess(user_id, validatedData.team_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to team' },
        { status: 403 }
      );
    }

    // Generate embedding
    const embeddingText = `${validatedData.title} ${validatedData.content}`;
    const embedding = await generateEmbedding(embeddingText);

    // Store memory
    const { data, error } = await supabase
      .from('team_memory')
      .insert({
        ...validatedData,
        embedding,
        created_by: user_id,
        updated_by: user_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create memory' },
        { status: 500 }
      );
    }

    // Notify team members via real-time channel
    await supabase.channel(`team:${validatedData.team_id}:memory`)
      .send({
        type: 'broadcast',
        event: 'memory_created',
        payload: {
          id: data.id,
          title: data.title,
          category: data.category,
          created_by: user_id,
        }
      });

    // Return without embedding for response size optimization
    const { embedding: _, ...responseData } = data;
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    console.error('POST /api/team/memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'Rate limit exceeded') {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
      
      if (error.message.includes('authentication') || error.message.includes('Access denied')) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Retrieve memories with optional search
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const { user_id } = await authenticateUser(request);
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id');
    const category = searchParams.get('category');
    const tags = searchParams.get('tags')?.split(',');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    if (!team_id) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    // Check team access
    const hasAccess = await checkTeamAccess(user_id, team_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to team' },
        { status: 403 }
      );
    }

    let query = supabase
      .from('team_memory')
      .select(`
        id, title, content, category, tags, metadata, priority,
        created_at, updated_at, created_by, updated_by
      `)
      .eq('team_id', team_id)
      .order('updated_at', { ascending: false });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    if (search) {
      query = query.textSearch('content', search, { type: 'websearch' });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve memories' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      memories: data,
      pagination: {
        offset,
        limit,
        total: data.length,
      }
    });

  } catch (error) {
    console.error('GET /api/team/memory error:', error);
    
    if (error instanceof Error && error.message.includes('authentication')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update existing memory
export async function PUT(request: NextRequest) {
  try {
    // Authentication
    const { user_id } = await authenticateUser(request);
    
    // Rate limiting
    await applyRateLimit(request, user_id);

    // Parse URL and body
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateMemorySchema.parse(body);

    // Get existing memory and check access
    const { data: existingMemory, error: fetchError } = await supabase
      .from('team_memory')
      .select('team_id, title, content')
      .eq('id', id)
      .single();

    if (fetchError || !existingMemory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    // Check team access
    const hasAccess = await checkTeamAccess(user_id, existingMemory.team_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to team' },
        { status: 403 }
      );
    }

    // Generate new embedding if content changed
    let embedding;
    const titleChanged = validatedData.title && validatedData.title !== existingMemory.title;
    const contentChanged = validatedData.content && validatedData.content !== existingMemory.content;
    
    if (titleChanged || contentChanged) {
      const newTitle = validatedData.title || existingMemory.title;
      const newContent = validatedData.content || existingMemory.content;
      const embeddingText = `${newTitle} ${newContent}`;
      embedding = await generateEmbedding(embeddingText);
    }

    // Update memory
    const updateData: any = {
      ...validatedData,
      updated_by: user_id,
      updated_at: new Date().toISOString(),
    };

    if (embedding) {
      updateData.embedding = embedding;
    }

    const { data, error } = await supabase
      .from('team_memory')
      .update(updateData)
      .eq('id', id)
      .select(`
        id, title, content, category, tags, metadata, priority,
        created_at, updated_at, created_by, updated_by
      `)
      .single();

    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json(
        { error: 'Failed to update memory' },
        { status: 500 }
      );
    }

    // Notify team members
    await supabase.channel(`team:${existingMemory.team_id}:memory`)
      .send({
        type: 'broadcast',
        event: 'memory_updated',
        payload: {
          id: data.id,
          title: data.title,
          category: data.category,
          updated_by: user_id,
        }
      });

    return NextResponse.json(data);

  } catch (error) {
    console.error('PUT /api/team/memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'Rate limit exceeded') {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
      
      if (error.message.includes('authentication')) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete memory entry
export async function DELETE(request: NextRequest) {
  try {
    // Authentication
    const { user_id } = await authenticateUser(request);

    // Parse URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    // Get existing memory and check access
    const { data: existingMemory, error: fetchError } = await supabase
      .from('team_memory')
      .select('team_id, title, category')
      .eq('id', id)
      .single();

    if (fetchError || !existingMemory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    // Check team access
    const hasAccess = await checkTeamAccess(user_id, existingMemory.team_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to team' },
        { status: 403 }
      );
    }

    // Delete memory
    const { error: deleteError } = await supabase
      .from('team_memory')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete memory' },
        { status: 500 }
      );
    }

    // Notify team members
    await supabase.channel(`team:${existingMemory.team_id}:memory`)
      .send({
        type: 'broadcast',
        event: 'memory_deleted',
        payload: {
          id,
          title: existingMemory.title,
          category: existingMemory.category,
          deleted_by: user_id,
        }
      });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/team/memory error:', error);
    
    if (error instanceof Error && error.message.includes('authentication')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}