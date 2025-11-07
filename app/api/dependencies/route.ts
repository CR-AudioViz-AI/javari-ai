import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

/**
 * GET /api/dependencies - List dependencies with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const projectId = searchParams.get('project_id');
    const hasVulnerabilities = searchParams.get('has_vulnerabilities');
    const isOutdated = searchParams.get('is_outdated');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    let query = supabase
      .from('javari_dependency_tracking')
      .select('*', { count: 'exact' })
      .order('package_name', { ascending: true })
      .limit(limit);
    
    if (projectId) query = query.eq('project_id', projectId);
    if (hasVulnerabilities !== null) query = query.eq('has_vulnerabilities', hasVulnerabilities === 'true');
    if (isOutdated !== null) query = query.eq('is_outdated', isOutdated === 'true');
    if (severity) query = query.eq('severity', severity);
    
    const { data, error, count } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch dependencies', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      dependencies: data || [],
      total: count || 0,
    });
  } catch (error: unknown) {
    logError(\'Error fetching dependencies:\', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/dependencies - Add or update dependency tracking
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.project_id || !body.package_name || !body.current_version || !body.latest_version) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if dependency already exists
    const { data: existing } = await supabase
      .from('javari_dependency_tracking')
      .select('*')
      .eq('project_id', body.project_id)
      .eq('package_name', body.package_name)
      .single();
    
    const isOutdated = body.current_version !== body.latest_version;
    
    const depData = {
      project_id: body.project_id,
      package_name: body.package_name,
      current_version: body.current_version,
      latest_version: body.latest_version,
      package_type: body.package_type || 'npm',
      has_vulnerabilities: body.has_vulnerabilities || false,
      cve_ids: body.cve_ids || [],
      severity: body.severity,
      is_outdated: isOutdated,
      update_available: isOutdated,
      breaking_changes_expected: body.breaking_changes_expected || false,
      auto_update_recommended: body.auto_update_recommended || false,
      last_checked: new Date().toISOString(),
    };
    
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('javari_dependency_tracking')
        .update(depData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        return NextResponse.json(
          { error: 'Failed to update dependency', details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(data);
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('javari_dependency_tracking')
        .insert(depData)
        .select()
        .single();
      
      if (error) {
        return NextResponse.json(
          { error: 'Failed to create dependency', details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(data, { status: 201 });
    }
  } catch (error: unknown) {
    logError(\'Error managing dependency:\', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/dependencies - Bulk delete dependencies
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('javari_dependency_tracking')
      .delete()
      .eq('project_id', projectId);
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete dependencies', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ message: 'Dependencies deleted successfully' });
  } catch (error: unknown) {
    logError(\'Error deleting dependencies:\', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
