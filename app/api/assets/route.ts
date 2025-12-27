// app/api/assets/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - PROJECT ASSETS API
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 27, 2025
// Manages project registry (central) and customer assets (per-user)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Retrieve projects/assets
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    const category = searchParams.get('category');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'registry' or 'customer'
    
    if (action === 'registry' || type === 'registry') {
      // Get central project registry
      let query = supabase
        .from('javari_project_registry')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      
      return NextResponse.json({
        success: true,
        total: data?.length || 0,
        projects: data || []
      });
    }
    
    if (action === 'customer' || type === 'customer') {
      // Get customer's assets
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }
      
      const { data, error } = await supabase
        .from('customer_assets')
        .select('*, project:javari_project_registry(*)')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return NextResponse.json({
        success: true,
        total: data?.length || 0,
        assets: data || []
      });
    }
    
    // Default: return both overview
    const [registryResult, categoriesResult] = await Promise.all([
      supabase
        .from('javari_project_registry')
        .select('category, count', { count: 'exact' })
        .eq('status', 'active'),
      supabase
        .from('javari_project_registry')
        .select('category')
        .eq('status', 'active')
    ]);
    
    const categoryStats = (categoriesResult.data || []).reduce((acc: Record<string, number>, item) => {
      acc[item.category || 'uncategorized'] = (acc[item.category || 'uncategorized'] || 0) + 1;
      return acc;
    }, {});
    
    return NextResponse.json({
      success: true,
      message: 'Javari Project Assets API',
      total_projects: registryResult.count || 0,
      categories: categoryStats,
      endpoints: {
        'GET ?action=registry': 'List all projects in central registry',
        'GET ?action=customer&userId=...': 'List customer assets',
        'POST': 'Save new project/asset'
      }
    });
    
  } catch (error) {
    console.error('Assets API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch assets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Save project to registry and/or customer assets
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectName,
      projectType = 'component',
      description,
      githubRepo,
      deploymentUrl,
      vercelProjectId,
      category,
      tags = [],
      complexity = 'simple',
      buildId,
      codeSnapshot,
      metadata,
      userId, // null = save to central (Roy's projects)
      saveToCustomer = true, // also save to customer's assets folder
    } = body;
    
    if (!projectName || !githubRepo) {
      return NextResponse.json({ 
        error: 'projectName and githubRepo are required' 
      }, { status: 400 });
    }
    
    // 1. Save to central registry
    const { data: registryEntry, error: registryError } = await supabase
      .from('javari_project_registry')
      .insert({
        project_name: projectName,
        project_type: projectType,
        description,
        github_repo: githubRepo,
        deployment_url: deploymentUrl,
        vercel_project_id: vercelProjectId,
        category: category || 'uncategorized',
        tags,
        complexity,
        build_id: buildId,
        created_for_user: userId || null,
        code_snapshot: codeSnapshot,
        metadata,
        status: 'active'
      })
      .select()
      .single();
    
    if (registryError) {
      console.error('Registry insert error:', registryError);
      // Continue even if registry fails
    }
    
    // 2. If user specified, also save to their assets folder
    let customerAsset = null;
    if (userId && saveToCustomer) {
      const { data: assetEntry, error: assetError } = await supabase
        .from('customer_assets')
        .insert({
          user_id: userId,
          project_id: registryEntry?.id || null,
          asset_type: 'project',
          asset_name: projectName,
          github_url: githubRepo,
          deployment_url: deploymentUrl,
          folder_path: `/${category || 'projects'}`,
          metadata: {
            complexity,
            buildId,
            ...metadata
          }
        })
        .select()
        .single();
      
      if (assetError) {
        console.error('Customer asset insert error:', assetError);
      } else {
        customerAsset = assetEntry;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Project saved successfully',
      registry: registryEntry ? {
        id: registryEntry.id,
        projectName: registryEntry.project_name,
        category: registryEntry.category
      } : null,
      customerAsset: customerAsset ? {
        id: customerAsset.id,
        folder: customerAsset.folder_path
      } : null,
      locations: {
        central: registryEntry ? 'Saved to project registry' : 'Failed',
        customer: customerAsset ? `Saved to customer assets (${customerAsset.folder_path})` : userId ? 'Failed' : 'Not requested'
      }
    });
    
  } catch (error) {
    console.error('Assets save error:', error);
    return NextResponse.json({ 
      error: 'Failed to save project',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
