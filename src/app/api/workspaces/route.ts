import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Input validation schemas
const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  visibility: z.enum(['private', 'team', 'public']).default('team'),
  settings: z.object({
    allowGuestAccess: z.boolean().default(false),
    requireApproval: z.boolean().default(true),
    enableAIAgents: z.boolean().default(true),
    maxMembers: z.number().min(1).max(100).default(50)
  }).optional()
});

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  search: z.string().optional(),
  visibility: z.enum(['private', 'team', 'public']).optional(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  sort: z.enum(['created_at', 'updated_at', 'name', 'member_count']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc')
});

interface WorkspaceData {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  settings: Record<string, any>;
  owner_id: string;
  member_count: number;
  resource_count: number;
  agent_count: number;
  created_at: string;
  updated_at: string;
  user_role: string;
  last_activity: string | null;
}

// GET /api/workspaces - List workspaces with filtering
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const queryResult = QuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.issues },
        { status: 400 }
      );
    }

    const { page, limit, search, visibility, role, sort, order } = queryResult.data;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query with RLS and joins
    let query = supabase
      .from('workspaces')
      .select(`
        id,
        name,
        description,
        visibility,
        settings,
        owner_id,
        created_at,
        updated_at,
        workspace_members!inner(
          role,
          joined_at
        ),
        workspace_stats:workspace_stats(
          member_count,
          resource_count,
          agent_count,
          last_activity
        )
      `)
      .eq('workspace_members.user_id', user.id);

    // Apply filters
    if (visibility) {
      query = query.eq('visibility', visibility);
    }

    if (role) {
      query = query.eq('workspace_members.role', role);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    const sortField = sort === 'member_count' ? 'workspace_stats.member_count' : sort;
    query = query.order(sortField, { ascending: order === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: workspaces, error: queryError, count } = await query;

    if (queryError) {
      console.error('Database query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    // Transform data
    const transformedWorkspaces: WorkspaceData[] = workspaces?.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      visibility: workspace.visibility,
      settings: workspace.settings || {},
      owner_id: workspace.owner_id,
      member_count: workspace.workspace_stats?.[0]?.member_count || 0,
      resource_count: workspace.workspace_stats?.[0]?.resource_count || 0,
      agent_count: workspace.workspace_stats?.[0]?.agent_count || 0,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
      user_role: workspace.workspace_members?.[0]?.role || 'viewer',
      last_activity: workspace.workspace_stats?.[0]?.last_activity
    })) || [];

    // Get total count for pagination
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      workspaces: transformedWorkspaces,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('Workspace listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/workspaces - Create new workspace
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validationResult = CreateWorkspaceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name, description, visibility, settings } = validationResult.data;

    // Check workspace limit for user
    const { count: userWorkspaceCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'owner');

    if (userWorkspaceCount && userWorkspaceCount >= 10) {
      return NextResponse.json(
        { error: 'Maximum workspace limit reached' },
        { status: 403 }
      );
    }

    // Create workspace in transaction
    const { data: workspace, error: createError } = await supabase
      .from('workspaces')
      .insert([{
        name,
        description: description || null,
        visibility,
        settings: settings || {},
        owner_id: user.id
      }])
      .select()
      .single();

    if (createError) {
      console.error('Workspace creation error:', createError);
      
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: 'Workspace name already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create workspace' },
        { status: 500 }
      );
    }

    // Add owner as workspace member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert([{
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
        permissions: {
          canManageMembers: true,
          canManageResources: true,
          canManageAgents: true,
          canManageSettings: true,
          canDelete: true
        }
      }]);

    if (memberError) {
      console.error('Member creation error:', memberError);
      // Clean up workspace if member creation fails
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      return NextResponse.json(
        { error: 'Failed to initialize workspace membership' },
        { status: 500 }
      );
    }

    // Log activity
    const { error: activityError } = await supabase
      .from('workspace_activities')
      .insert([{
        workspace_id: workspace.id,
        user_id: user.id,
        action: 'workspace_created',
        details: {
          workspace_name: name,
          visibility: visibility
        }
      }]);

    if (activityError) {
      console.error('Activity logging error:', activityError);
      // Don't fail the request for activity logging errors
    }

    // Initialize workspace stats
    await supabase
      .from('workspace_stats')
      .insert([{
        workspace_id: workspace.id,
        member_count: 1,
        resource_count: 0,
        agent_count: 0,
        last_activity: new Date().toISOString()
      }]);

    // Return created workspace with user role
    const workspaceData: WorkspaceData = {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      visibility: workspace.visibility,
      settings: workspace.settings || {},
      owner_id: workspace.owner_id,
      member_count: 1,
      resource_count: 0,
      agent_count: 0,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
      user_role: 'owner',
      last_activity: new Date().toISOString()
    };

    return NextResponse.json({ workspace: workspaceData }, { status: 201 });

  } catch (error) {
    console.error('Workspace creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}