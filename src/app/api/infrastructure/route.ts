```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit } from '@/lib/utils/rate-limit';
import { validateApiKey } from '@/lib/middleware/auth';
import { InfrastructureManager } from '@/lib/services/infrastructure-manager';
import { TerraformService } from '@/lib/services/terraform-service';
import { KubernetesService } from '@/lib/services/kubernetes-service';
import { DriftDetector } from '@/lib/services/drift-detector';
import { GitManager } from '@/lib/services/git-manager';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CreateInfrastructureSchema = z.object({
  name: z.string().min(1).max(255).regex(/^[a-zA-Z0-9-_]+$/),
  type: z.enum(['terraform', 'kubernetes', 'helm']),
  description: z.string().max(1000).optional(),
  manifest: z.string().min(1),
  variables: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).max(20).optional(),
  environment: z.enum(['dev', 'staging', 'production']),
  project_id: z.string().uuid(),
  auto_remediate: z.boolean().default(false),
  drift_detection: z.boolean().default(true)
});

const UpdateInfrastructureSchema = CreateInfrastructureSchema.partial();

const QuerySchema = z.object({
  project_id: z.string().uuid().optional(),
  environment: z.enum(['dev', 'staging', 'production']).optional(),
  type: z.enum(['terraform', 'kubernetes', 'helm']).optional(),
  status: z.enum(['active', 'inactive', 'error', 'drifted']).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 50, 100)).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional(),
  search: z.string().max(255).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'infrastructure_create', 20, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await validateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = CreateInfrastructureSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Verify project access
    const { data: projectAccess, error: projectError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', data.project_id)
      .eq('user_id', authResult.user.id)
      .single();

    if (projectError || !projectAccess) {
      return NextResponse.json(
        { error: 'Project access denied' },
        { status: 403 }
      );
    }

    if (!['admin', 'maintainer'].includes(projectAccess.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Initialize services
    const terraformService = new TerraformService();
    const kubernetesService = new KubernetesService();
    const gitManager = new GitManager();
    const infrastructureManager = new InfrastructureManager({
      terraformService,
      kubernetesService,
      gitManager,
      supabase
    });

    // Validate manifest syntax
    const validationErrors = await infrastructureManager.validateManifest(
      data.manifest,
      data.type
    );

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Manifest validation failed',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Check for duplicate names in project
    const { data: existing, error: duplicateError } = await supabase
      .from('infrastructure_definitions')
      .select('id')
      .eq('name', data.name)
      .eq('project_id', data.project_id)
      .eq('environment', data.environment)
      .maybeSingle();

    if (duplicateError) {
      throw new Error(`Database error: ${duplicateError.message}`);
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Infrastructure definition with this name already exists' },
        { status: 409 }
      );
    }

    // Create infrastructure definition
    const result = await infrastructureManager.createInfrastructure({
      ...data,
      created_by: authResult.user.id,
      updated_by: authResult.user.id
    });

    // Create audit log
    await supabase
      .from('infrastructure_audit_logs')
      .insert({
        infrastructure_id: result.id,
        action: 'create',
        user_id: authResult.user.id,
        metadata: {
          name: data.name,
          type: data.type,
          environment: data.environment
        }
      });

    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Infrastructure creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'infrastructure_read', 100, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await validateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validationResult = QuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { 
      project_id, 
      environment, 
      type, 
      status, 
      limit = 50, 
      offset = 0, 
      search 
    } = validationResult.data;

    // Build query
    let query = supabase
      .from('infrastructure_definitions')
      .select(`
        id,
        name,
        type,
        description,
        environment,
        status,
        drift_status,
        last_applied,
        last_drift_check,
        auto_remediate,
        drift_detection,
        tags,
        created_at,
        updated_at,
        projects!inner(id, name),
        created_by_user:users!infrastructure_definitions_created_by_fkey(id, email, full_name),
        updated_by_user:users!infrastructure_definitions_updated_by_fkey(id, email, full_name)
      `)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters based on user access
    if (project_id) {
      // Verify project access
      const { data: projectAccess, error: projectError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', project_id)
        .eq('user_id', authResult.user.id)
        .single();

      if (projectError || !projectAccess) {
        return NextResponse.json(
          { error: 'Project access denied' },
          { status: 403 }
        );
      }

      query = query.eq('project_id', project_id);
    } else {
      // Get user's accessible projects
      const { data: userProjects, error: userProjectsError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', authResult.user.id);

      if (userProjectsError) {
        throw new Error(`Database error: ${userProjectsError.message}`);
      }

      const projectIds = userProjects.map(p => p.project_id);
      if (projectIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, limit, offset }
        });
      }

      query = query.in('project_id', projectIds);
    }

    if (environment) {
      query = query.eq('environment', environment);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Get drift status summary
    const driftDetector = new DriftDetector();
    const infrastructureIds = data?.map(item => item.id) || [];
    
    const driftSummary = await driftDetector.getDriftSummary(infrastructureIds);

    return NextResponse.json({
      success: true,
      data: data || [],
      drift_summary: driftSummary,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('Infrastructure fetch error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'infrastructure_update', 30, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await validateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const infrastructureId = url.searchParams.get('id');
    
    if (!infrastructureId || !z.string().uuid().safeParse(infrastructureId).success) {
      return NextResponse.json(
        { error: 'Invalid infrastructure ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = UpdateInfrastructureSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Get existing infrastructure and verify access
    const { data: existingInfra, error: fetchError } = await supabase
      .from('infrastructure_definitions')
      .select('*, projects!inner(id)')
      .eq('id', infrastructureId)
      .single();

    if (fetchError || !existingInfra) {
      return NextResponse.json(
        { error: 'Infrastructure definition not found' },
        { status: 404 }
      );
    }

    // Verify project access
    const { data: projectAccess, error: projectError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', existingInfra.project_id)
      .eq('user_id', authResult.user.id)
      .single();

    if (projectError || !projectAccess || !['admin', 'maintainer'].includes(projectAccess.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Initialize services
    const terraformService = new TerraformService();
    const kubernetesService = new KubernetesService();
    const gitManager = new GitManager();
    const infrastructureManager = new InfrastructureManager({
      terraformService,
      kubernetesService,
      gitManager,
      supabase
    });

    // Validate manifest if provided
    if (data.manifest) {
      const validationErrors = await infrastructureManager.validateManifest(
        data.manifest,
        data.type || existingInfra.type
      );

      if (validationErrors.length > 0) {
        return NextResponse.json(
          { 
            error: 'Manifest validation failed',
            details: validationErrors
          },
          { status: 400 }
        );
      }
    }

    // Update infrastructure definition
    const result = await infrastructureManager.updateInfrastructure(
      infrastructureId,
      {
        ...data,
        updated_by: authResult.user.id,
        updated_at: new Date().toISOString()
      }
    );

    // Create audit log
    await supabase
      .from('infrastructure_audit_logs')
      .insert({
        infrastructure_id: infrastructureId,
        action: 'update',
        user_id: authResult.user.id,
        metadata: {
          changes: data,
          previous_version: existingInfra.version
        }
      });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Infrastructure update error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'infrastructure_delete', 10, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await validateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const infrastructureId = url.searchParams.get('id');
    const force = url.searchParams.get('force') === 'true';
    
    if (!infrastructureId || !z.string().uuid().safeParse(infrastructureId).success) {
      return NextResponse.json(
        { error: 'Invalid infrastructure ID' },
        { status: 400 }
      );
    }

    // Get existing infrastructure and verify access
    const { data: existingInfra, error: fetchError } = await supabase
      .from('infrastructure_definitions')
      .select('*, projects!inner(id)')
      .eq('id', infrastructureId)
      .single();

    if (fetchError || !existingInfra) {
      return NextResponse.json(
        { error: 'Infrastructure definition not found' },
        { status: 404 }
      );
    }

    // Verify project access
    const { data: projectAccess, error: projectError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', existingInfra.project_id)
      .eq('user_id', authResult.user.id)
      .single();

    if (projectError || !projectAccess || projectAccess.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permissions required for deletion' },
        { status: 403 }
      );
    }

    // Initialize services
    const terraformService = new TerraformService();
    const kubernetesService = new KubernetesService();
    const gitManager = new GitManager();
    const infrastructureManager = new InfrastructureManager({
      terraformService,
      kubernetesService,
      gitManager,
      supabase
    });

    // Delete infrastructure (includes cleanup)
    await infrastructureManager.deleteInfrastructure(infrastructureId, force);

    // Create audit log
    await supabase
      .from('infrastructure_audit_logs')
      .insert({
        infrastructure_id: infrastructureId,
        action: 'delete',
        user_id: authResult.user.id,
        metadata: {
          name: existingInfra.name,
          type: existingInfra.type,
          environment: existingInfra.environment,
          force_delete: force
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Infrastructure definition deleted successfully'
    });

  } catch (error) {
    console.error('Infrastructure deletion error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```