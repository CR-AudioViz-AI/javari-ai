import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');
    
    let query = supabase.from('javari_dependency_tracking').select('*');
    if (projectId) query = query.eq('project_id', projectId);
    
    const { data: deps, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch dependency stats' },
        { status: 500 }
      );
    }
    
    const stats = {
      total_dependencies: deps?.length || 0,
      outdated_count: deps?.filter(d => d.is_outdated).length || 0,
      vulnerable_count: deps?.filter(d => d.has_vulnerabilities).length || 0,
      critical_vulnerabilities: deps?.filter(d => d.severity === 'critical').length || 0,
      high_vulnerabilities: deps?.filter(d => d.severity === 'high').length || 0,
      auto_update_recommended_count: deps?.filter(d => d.auto_update_recommended).length || 0,
      breaking_changes_count: deps?.filter(d => d.breaking_changes_expected).length || 0,
      by_severity: {} as Record<string, number>,
      by_type: {} as Record<string, number>,
    };
    
    deps?.forEach(dep => {
      if (dep.severity) {
        stats.by_severity[dep.severity] = (stats.by_severity[dep.severity] || 0) + 1;
      }
      stats.by_type[dep.package_type] = (stats.by_type[dep.package_type] || 0) + 1;
    });
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error calculating dependency stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
