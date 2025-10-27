/**
 * Javari AI - Projects API
 * Manage projects: create, list, update, delete
 * 
 * @route /api/javari/projects
 * @version 1.0.0
 * @date October 27, 2025 - 2:48 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Project {
  id: string;
  numeric_id: number;
  name: string;
  description?: string;
  repository_url?: string;
  vercel_project_id?: string;
  status: 'active' | 'inactive' | 'archived' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  health_score: number;
  starred: boolean;
  tags: string[];
  metadata: any;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/javari/projects
 * List all projects
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const starred = searchParams.get('starred');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'updated_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('created_by', userId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (starred === 'true') {
      query = query.eq('starred', true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      projects: data,
      total: count,
    });
  } catch (error) {
    console.error('Projects GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/javari/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      name,
      description,
      repository_url,
      vercel_project_id,
      priority = 'medium',
      tags = [],
      metadata = {},
    } = body;

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'userId and name are required' },
        { status: 400 }
      );
    }

    // Insert new project
    const { data, error } = await supabase
      .from('projects')
      .insert({
        created_by: userId,
        name,
        description,
        repository_url,
        vercel_project_id,
        priority,
        tags,
        metadata,
        status: 'active',
        starred: false,
        health_score: 100,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: data });
  } catch (error) {
    console.error('Projects POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/javari/projects/:id
 * Update a project
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updates: any = { 
      ...body, 
      updated_at: new Date().toISOString() 
    };

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Error updating project:', error);
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: data });
  } catch (error) {
    console.error('Projects PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/javari/projects/:id
 * Delete or archive a project
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');
    const archive = searchParams.get('archive') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (archive) {
      // Archive instead of delete
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: 'archived', 
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', projectId);

      if (error) {
        console.error('Error archiving project:', error);
        return NextResponse.json(
          { error: 'Failed to archive project' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, archived: true });
    } else {
      // Permanent delete
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json(
          { error: 'Failed to delete project' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, deleted: true });
    }
  } catch (error) {
    console.error('Projects DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
