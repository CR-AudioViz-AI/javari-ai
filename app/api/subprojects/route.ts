import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { JavariSubProject, CreateSubProjectRequest, UpdateSubProjectRequest, ApiResponse } from '@/types/javari';

// GET /api/subprojects - List all subprojects
// GET /api/subprojects?id=xxx - Get specific subproject
// GET /api/subprojects?parent_project_id=xxx - Get subprojects for a parent project
export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const parent_project_id = searchParams.get('parent_project_id');
    const starred = searchParams.get('starred');

    // Handle single subproject fetch
    if (id) {
      const { data, error } = await supabase
        .from('javari_sub_projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json<ApiResponse<JavariSubProject>>(
        { success: true, data },
        { status: 200 }
      );
    }

    // Build query for list
    let query = supabase.from('javari_sub_projects').select('*');

    if (parent_project_id) {
      query = query.eq('parent_project_id', parent_project_id);
    }

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

    return NextResponse.json<ApiResponse<JavariSubProject[]>>(
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

// POST /api/subprojects - Create new subproject
export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    const body: CreateSubProjectRequest = await request.json();

    const { parent_project_id, name, display_name, description, github_repo, vercel_project, credential_overrides } = body;

    if (!parent_project_id || !name) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Parent project ID and name are required' },
        { status: 400 }
      );
    }

    // Verify parent project exists
    const { data: parentProject, error: parentError } = await supabase
      .from('javari_projects')
      .select('id')
      .eq('id', parent_project_id)
      .single();

    if (parentError || !parentProject) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Parent project not found' },
        { status: 404 }
      );
    }

    const subprojectData = {
      parent_project_id,
      name,
      display_name: display_name || name,
      description,
      github_repo,
      vercel_project,
      credential_overrides: credential_overrides || {},
      health_score: 100,
      active_chats_count: 0,
      starred: false,
    };

    const { data, error } = await supabase
      .from('javari_sub_projects')
      .insert(subprojectData)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariSubProject>>(
      { success: true, data, message: 'Subproject created successfully' },
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

// PATCH /api/subprojects?id=xxx - Update subproject
export async function PATCH(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Subproject ID is required' },
        { status: 400 }
      );
    }

    const body: UpdateSubProjectRequest = await request.json();

    const { data, error } = await supabase
      .from('javari_sub_projects')
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

    return NextResponse.json<ApiResponse<JavariSubProject>>(
      { success: true, data, message: 'Subproject updated successfully' },
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

// DELETE /api/subprojects?id=xxx - Delete subproject
export async function DELETE(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Subproject ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('javari_sub_projects')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<null>>(
      { success: true, message: 'Subproject deleted successfully' },
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
