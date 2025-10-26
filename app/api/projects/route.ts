import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { JavariProject, CreateProjectRequest, UpdateProjectRequest, ApiResponse } from '@/types/javari';

// GET /api/projects - List all projects
// GET /api/projects?id=xxx - Get specific project
export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const starred = searchParams.get('starred');

    // Handle single project fetch
    if (id) {
      const { data, error } = await supabase
        .from('javari_projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json<ApiResponse<JavariProject>>(
        { success: true, data },
        { status: 200 }
      );
    }

    // Build query for list
    let query = supabase.from('javari_projects').select('*');

    if (starred === 'true') {
      query = query.eq('starred', true);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariProject[]>>(
      { success: true, data },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create new project
export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    const body: CreateProjectRequest = await request.json();

    const { name, display_name, description, github_repo, vercel_project } = body;

    if (!name) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const projectData = {
      name,
      display_name: display_name || name,
      description,
      github_repo,
      vercel_project,
      health_score: 100,
      active_chats_count: 0,
      starred: false,
    };

    const { data, error } = await supabase
      .from('javari_projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariProject>>(
      { success: true, data, message: 'Project created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH /api/projects?id=xxx - Update project
export async function PATCH(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const body: UpdateProjectRequest = await request.json();

    const { data, error } = await supabase
      .from('javari_projects')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariProject>>(
      { success: true, data, message: 'Project updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/projects?id=xxx - Delete project
export async function DELETE(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('javari_projects')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>(
      { success: true, message: 'Project deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
