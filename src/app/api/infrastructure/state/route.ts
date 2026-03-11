import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  REDIS_URL: z.string().url(),
  TERRAFORM_CLOUD_TOKEN: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  GCP_SERVICE_ACCOUNT_KEY: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Initialize clients
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis(env.REDIS_URL);

// Validation schemas
const infrastructureStateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  provider: z.enum(['aws', 'azure', 'gcp', 'multi-cloud']),
  region: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']),
  terraform_version: z.string().optional(),
  terraform_state: z.record(z.any()).optional(),
  resources: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    status: z.enum(['creating', 'active', 'updating', 'deleting', 'error']),
    provider_id: z.string(),
    configuration: z.record(z.any()),
    dependencies: z.array(z.string()).optional(),
  })).optional(),
  tags: z.record(z.string()).optional(),
});

const stateQuerySchema = z.object({
  provider: z.string().optional(),
  region: z.string().optional(),
  environment: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const stateLockSchema = z.object({
  operation: z.enum(['plan', 'apply', 'destroy']),
  user_id: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
});

// Infrastructure State Manager
class InfrastructureStateManager {
  private supabase: typeof supabase;
  private redis: Redis;

  constructor(supabaseClient: typeof supabase, redisClient: Redis) {
    this.supabase = supabaseClient;
    this.redis = redisClient;
  }

  async getStates(query: z.infer<typeof stateQuerySchema>) {
    let supabaseQuery = this.supabase
      .from('infrastructure_states')
      .select(`
        *,
        terraform_states(*),
        cloud_resources(*)
      `);

    if (query.provider) {
      supabaseQuery = supabaseQuery.eq('provider', query.provider);
    }
    if (query.region) {
      supabaseQuery = supabaseQuery.eq('region', query.region);
    }
    if (query.environment) {
      supabaseQuery = supabaseQuery.eq('environment', query.environment);
    }
    if (query.status) {
      supabaseQuery = supabaseQuery.eq('status', query.status);
    }

    const { data, error } = await supabaseQuery
      .range(query.offset, query.offset + query.limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createOrUpdateState(state: z.infer<typeof infrastructureStateSchema>) {
    const stateId = state.id || randomUUID();
    
    // Validate Terraform state if provided
    if (state.terraform_state) {
      await this.validateTerraformState(state.terraform_state);
    }

    const { data, error } = await this.supabase
      .from('infrastructure_states')
      .upsert({
        id: stateId,
        name: state.name,
        provider: state.provider,
        region: state.region,
        environment: state.environment,
        terraform_version: state.terraform_version,
        status: 'active',
        tags: state.tags,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    // Update Terraform state if provided
    if (state.terraform_state) {
      await this.updateTerraformState(stateId, state.terraform_state);
    }

    // Update resources if provided
    if (state.resources) {
      await this.updateResources(stateId, state.resources);
    }

    return data;
  }

  async updateTerraformState(stateId: string, terraformState: any) {
    const { error } = await this.supabase
      .from('terraform_states')
      .upsert({
        infrastructure_state_id: stateId,
        state_data: terraformState,
        version: terraformState.version || 4,
        terraform_version: terraformState.terraform_version,
        serial: terraformState.serial || 1,
        lineage: terraformState.lineage || randomUUID(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'infrastructure_state_id' });

    if (error) throw error;
  }

  async updateResources(stateId: string, resources: any[]) {
    // Delete existing resources
    await this.supabase
      .from('cloud_resources')
      .delete()
      .eq('infrastructure_state_id', stateId);

    // Insert new resources
    if (resources.length > 0) {
      const { error } = await this.supabase
        .from('cloud_resources')
        .insert(resources.map(resource => ({
          id: randomUUID(),
          infrastructure_state_id: stateId,
          resource_id: resource.id,
          resource_type: resource.type,
          resource_name: resource.name,
          status: resource.status,
          provider_id: resource.provider_id,
          configuration: resource.configuration,
          dependencies: resource.dependencies,
          created_at: new Date().toISOString(),
        })));

      if (error) throw error;
    }
  }

  async destroyState(stateId: string) {
    // Check for active locks
    const lockKey = `state:lock:${stateId}`;
    const existingLock = await this.redis.get(lockKey);
    
    if (existingLock) {
      throw new Error('Cannot destroy state: resource is locked');
    }

    // Acquire lock for destroy operation
    const lockId = randomUUID();
    await this.acquireLock(stateId, {
      operation: 'destroy',
      user_id: lockId,
    });

    try {
      // Mark resources for deletion
      await this.supabase
        .from('cloud_resources')
        .update({ status: 'deleting' })
        .eq('infrastructure_state_id', stateId);

      // Mark state as destroying
      const { data, error } = await this.supabase
        .from('infrastructure_states')
        .update({ 
          status: 'destroying',
          updated_at: new Date().toISOString(),
        })
        .eq('id', stateId)
        .select()
        .single();

      if (error) throw error;

      // In a real implementation, trigger async resource cleanup
      // For now, we'll mark as destroyed after a delay
      setTimeout(async () => {
        await this.supabase
          .from('infrastructure_states')
          .update({ status: 'destroyed' })
          .eq('id', stateId);
        
        await this.releaseLock(stateId);
      }, 5000);

      return data;
    } catch (error) {
      await this.releaseLock(stateId);
      throw error;
    }
  }

  async detectDrift(stateId: string) {
    const { data: state, error } = await this.supabase
      .from('infrastructure_states')
      .select(`
        *,
        terraform_states(*),
        cloud_resources(*)
      `)
      .eq('id', stateId)
      .single();

    if (error) throw error;

    // In a real implementation, this would compare actual cloud resources
    // with the stored state using cloud provider APIs
    const driftResults = {
      has_drift: false,
      drift_summary: {
        added: [],
        modified: [],
        removed: [],
      },
      last_checked: new Date().toISOString(),
    };

    // Update drift detection timestamp
    await this.supabase
      .from('infrastructure_states')
      .update({ 
        last_drift_check: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', stateId);

    return driftResults;
  }

  async acquireLock(stateId: string, lockData: z.infer<typeof stateLockSchema>) {
    const lockKey = `state:lock:${stateId}`;
    const lockValue = JSON.stringify({
      ...lockData,
      acquired_at: new Date().toISOString(),
      lock_id: randomUUID(),
    });

    const result = await this.redis.set(lockKey, lockValue, 'EX', 3600, 'NX');
    
    if (!result) {
      const existingLock = await this.redis.get(lockKey);
      throw new Error(`State is locked: ${existingLock}`);
    }

    // Store lock in database for tracking
    await this.supabase
      .from('state_locks')
      .insert({
        infrastructure_state_id: stateId,
        operation: lockData.operation,
        user_id: lockData.user_id,
        metadata: lockData.metadata,
        acquired_at: new Date().toISOString(),
      });

    return { locked: true, lock_key: lockKey };
  }

  async releaseLock(stateId: string) {
    const lockKey = `state:lock:${stateId}`;
    await this.redis.del(lockKey);

    // Remove from database
    await this.supabase
      .from('state_locks')
      .delete()
      .eq('infrastructure_state_id', stateId);

    return { locked: false };
  }

  async getAllResources() {
    const { data, error } = await this.supabase
      .from('cloud_resources')
      .select(`
        *,
        infrastructure_states(name, provider, region, environment)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  private async validateTerraformState(state: any) {
    // Basic Terraform state validation
    if (!state.version || !state.terraform_version) {
      throw new Error('Invalid Terraform state: missing version information');
    }
    
    if (state.version < 4) {
      throw new Error('Unsupported Terraform state version');
    }
  }
}

// Initialize manager
const stateManager = new InfrastructureStateManager(supabase, redis);

// GET - Fetch infrastructure states
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = stateQuerySchema.parse(Object.fromEntries(searchParams));

    // Handle specific resource endpoints
    const pathSegments = request.nextUrl.pathname.split('/');
    const stateId = pathSegments[pathSegments.indexOf('state') + 1];

    if (stateId && stateId !== 'resources') {
      // Handle drift detection
      if (pathSegments.includes('drift')) {
        const driftResults = await stateManager.detectDrift(stateId);
        return NextResponse.json({
          success: true,
          data: driftResults,
        });
      }
    }

    // Handle resources endpoint
    if (pathSegments.includes('resources')) {
      const resources = await stateManager.getAllResources();
      return NextResponse.json({
        success: true,
        data: resources,
      });
    }

    // Default: fetch states
    const states = await stateManager.getStates(query);
    return NextResponse.json({
      success: true,
      data: states,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: states.length,
      },
    });
  } catch (error) {
    console.error('GET /api/infrastructure/state error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: error instanceof z.ZodError ? 400 : 500 }
    );
  }
}

// POST - Create/update infrastructure state or acquire lock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pathSegments = request.nextUrl.pathname.split('/');
    const stateId = pathSegments[pathSegments.indexOf('state') + 1];

    // Handle lock acquisition
    if (stateId && pathSegments.includes('lock')) {
      const lockData = stateLockSchema.parse(body);
      const lockResult = await stateManager.acquireLock(stateId, lockData);
      return NextResponse.json({
        success: true,
        data: lockResult,
      });
    }

    // Handle state creation/update
    const stateData = infrastructureStateSchema.parse(body);
    const result = await stateManager.createOrUpdateState(stateData);
    
    return NextResponse.json({
      success: true,
      data: result,
    }, { status: stateData.id ? 200 : 201 });
  } catch (error) {
    console.error('POST /api/infrastructure/state error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: error instanceof z.ZodError ? 400 : 500 }
    );
  }
}

// PUT - Sync Terraform state
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const pathSegments = request.nextUrl.pathname.split('/');
    const stateId = pathSegments[pathSegments.indexOf('state') + 1];

    if (!stateId || !pathSegments.includes('terraform')) {
      return NextResponse.json(
        { success: false, error: 'Invalid endpoint' },
        { status: 400 }
      );
    }

    await stateManager.updateTerraformState(stateId, body);
    
    return NextResponse.json({
      success: true,
      message: 'Terraform state synchronized successfully',
    });
  } catch (error) {
    console.error('PUT /api/infrastructure/state error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// DELETE - Destroy infrastructure or release lock
export async function DELETE(request: NextRequest) {
  try {
    const pathSegments = request.nextUrl.pathname.split('/');
    const stateId = pathSegments[pathSegments.indexOf('state') + 1];

    if (!stateId) {
      return NextResponse.json(
        { success: false, error: 'State ID required' },
        { status: 400 }
      );
    }

    // Handle lock release
    if (pathSegments.includes('lock')) {
      const result = await stateManager.releaseLock(stateId);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Handle state destruction
    const result = await stateManager.destroyState(stateId);
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Infrastructure destruction initiated',
    });
  } catch (error) {
    console.error('DELETE /api/infrastructure/state error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}