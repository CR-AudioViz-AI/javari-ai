```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { headers } from 'next/headers';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

// Environment validation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

// Validation schemas
const Vector3Schema = z.object({
  x: z.number().min(-10000).max(10000),
  y: z.number().min(-10000).max(10000),
  z: z.number().min(-10000).max(10000)
});

const QuaternionSchema = z.object({
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
  z: z.number().min(-1).max(1),
  w: z.number().min(-1).max(1)
});

const WorldObjectSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['mesh', 'light', 'camera', 'audio_source', 'trigger_zone']),
  position: Vector3Schema,
  rotation: QuaternionSchema,
  scale: Vector3Schema.optional(),
  properties: z.record(z.unknown()).optional(),
  metadata: z.object({
    created_by: z.string().uuid(),
    created_at: z.string().datetime(),
    modified_by: z.string().uuid().optional(),
    modified_at: z.string().datetime().optional(),
    version: z.number().int().min(0)
  })
});

const EnvironmentStateSchema = z.object({
  lighting: z.object({
    ambient_intensity: z.number().min(0).max(2),
    sun_position: Vector3Schema,
    sun_intensity: z.number().min(0).max(5),
    fog_density: z.number().min(0).max(1)
  }),
  weather: z.object({
    type: z.enum(['clear', 'cloudy', 'rain', 'snow', 'storm']),
    intensity: z.number().min(0).max(1),
    wind_direction: Vector3Schema,
    wind_strength: z.number().min(0).max(10)
  }),
  physics: z.object({
    gravity: Vector3Schema,
    air_resistance: z.number().min(0).max(1),
    collision_enabled: z.boolean()
  })
});

const WorldStateSchema = z.object({
  world_id: z.string().uuid(),
  region_id: z.string().uuid(),
  objects: z.array(WorldObjectSchema),
  environment: EnvironmentStateSchema,
  version: z.number().int().min(0),
  last_modified: z.string().datetime()
});

const StateModificationSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'move', 'transform']),
  target_id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  user_id: z.string().uuid(),
  session_id: z.string().uuid(),
  timestamp: z.string().datetime()
});

interface WorldState {
  world_id: string;
  region_id: string;
  objects: any[];
  environment: any;
  version: number;
  last_modified: string;
  created_by: string;
}

interface StateModification {
  action: string;
  target_id?: string;
  data: Record<string, unknown>;
  user_id: string;
  session_id: string;
  timestamp: string;
}

class WorldStateManager {
  private async getWorldState(worldId: string, regionId: string): Promise<WorldState | null> {
    try {
      // Try cache first
      const cacheKey = `world_state:${worldId}:${regionId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached as WorldState;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('world_states')
        .select('*')
        .eq('world_id', worldId)
        .eq('region_id', regionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Cache for 5 minutes
        await redis.setex(cacheKey, 300, data);
        return data;
      }

      return null;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error('Failed to retrieve world state');
    }
  }

  private async saveWorldState(state: WorldState): Promise<void> {
    try {
      const { error } = await supabase
        .from('world_states')
        .upsert(state, { onConflict: 'world_id,region_id' });

      if (error) throw error;

      // Update cache
      const cacheKey = `world_state:${state.world_id}:${state.region_id}`;
      await redis.setex(cacheKey, 300, state);

      // Broadcast change
      await this.broadcastStateChange(state);
    } catch (error) {
      Sentry.captureException(error);
      throw new Error('Failed to save world state');
    }
  }

  private async broadcastStateChange(state: WorldState): Promise<void> {
    try {
      // Send to Supabase realtime
      await supabase
        .channel(`world_state_${state.world_id}_${state.region_id}`)
        .send({
          type: 'broadcast',
          event: 'state_updated',
          payload: {
            world_id: state.world_id,
            region_id: state.region_id,
            version: state.version,
            timestamp: state.last_modified
          }
        });
    } catch (error) {
      Sentry.captureException(error);
      // Don't throw - broadcast failure shouldn't fail the operation
    }
  }
}

class ConflictResolver {
  async resolveConflict(
    currentState: WorldState,
    incomingModification: StateModification
  ): Promise<{ resolved: boolean; state?: WorldState; error?: string }> {
    try {
      // Check if modification is based on current version
      const expectedVersion = parseInt(incomingModification.data.expected_version as string) || 0;
      
      if (expectedVersion < currentState.version) {
        return {
          resolved: false,
          error: 'Modification based on outdated state version'
        };
      }

      // Apply conflict resolution strategy based on action type
      switch (incomingModification.action) {
        case 'create':
          return this.resolveCreateConflict(currentState, incomingModification);
        case 'update':
          return this.resolveUpdateConflict(currentState, incomingModification);
        case 'delete':
          return this.resolveDeleteConflict(currentState, incomingModification);
        case 'move':
        case 'transform':
          return this.resolveTransformConflict(currentState, incomingModification);
        default:
          return { resolved: false, error: 'Unknown modification action' };
      }
    } catch (error) {
      Sentry.captureException(error);
      return { resolved: false, error: 'Conflict resolution failed' };
    }
  }

  private async resolveCreateConflict(
    state: WorldState,
    modification: StateModification
  ): Promise<{ resolved: boolean; state?: WorldState; error?: string }> {
    const objectId = modification.data.id as string;
    const existingObject = state.objects.find(obj => obj.id === objectId);
    
    if (existingObject) {
      // Object already exists, generate new ID
      const newId = crypto.randomUUID();
      const newObject = { ...modification.data, id: newId };
      
      return {
        resolved: true,
        state: {
          ...state,
          objects: [...state.objects, newObject],
          version: state.version + 1,
          last_modified: new Date().toISOString()
        }
      };
    }

    return {
      resolved: true,
      state: {
        ...state,
        objects: [...state.objects, modification.data],
        version: state.version + 1,
        last_modified: new Date().toISOString()
      }
    };
  }

  private async resolveUpdateConflict(
    state: WorldState,
    modification: StateModification
  ): Promise<{ resolved: boolean; state?: WorldState; error?: string }> {
    const targetId = modification.target_id;
    const objectIndex = state.objects.findIndex(obj => obj.id === targetId);
    
    if (objectIndex === -1) {
      return { resolved: false, error: 'Target object not found' };
    }

    const updatedObjects = [...state.objects];
    updatedObjects[objectIndex] = {
      ...updatedObjects[objectIndex],
      ...modification.data,
      metadata: {
        ...updatedObjects[objectIndex].metadata,
        modified_by: modification.user_id,
        modified_at: modification.timestamp,
        version: updatedObjects[objectIndex].metadata.version + 1
      }
    };

    return {
      resolved: true,
      state: {
        ...state,
        objects: updatedObjects,
        version: state.version + 1,
        last_modified: new Date().toISOString()
      }
    };
  }

  private async resolveDeleteConflict(
    state: WorldState,
    modification: StateModification
  ): Promise<{ resolved: boolean; state?: WorldState; error?: string }> {
    const targetId = modification.target_id;
    const filteredObjects = state.objects.filter(obj => obj.id !== targetId);
    
    return {
      resolved: true,
      state: {
        ...state,
        objects: filteredObjects,
        version: state.version + 1,
        last_modified: new Date().toISOString()
      }
    };
  }

  private async resolveTransformConflict(
    state: WorldState,
    modification: StateModification
  ): Promise<{ resolved: boolean; state?: WorldState; error?: string }> {
    const targetId = modification.target_id;
    const objectIndex = state.objects.findIndex(obj => obj.id === targetId);
    
    if (objectIndex === -1) {
      return { resolved: false, error: 'Target object not found' };
    }

    const updatedObjects = [...state.objects];
    const currentObject = updatedObjects[objectIndex];
    
    // Apply transform data
    if (modification.data.position) {
      currentObject.position = modification.data.position;
    }
    if (modification.data.rotation) {
      currentObject.rotation = modification.data.rotation;
    }
    if (modification.data.scale) {
      currentObject.scale = modification.data.scale;
    }

    currentObject.metadata.modified_by = modification.user_id;
    currentObject.metadata.modified_at = modification.timestamp;
    currentObject.metadata.version++;

    return {
      resolved: true,
      state: {
        ...state,
        objects: updatedObjects,
        version: state.version + 1,
        last_modified: new Date().toISOString()
      }
    };
  }
}

class StateValidator {
  validateModification(modification: StateModification): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      StateModificationSchema.parse(modification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push('Invalid modification format');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateWorldState(state: WorldState): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      WorldStateSchema.parse(state);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push('Invalid world state format');
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// GET: Retrieve world state
export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get('world_id');
    const regionId = searchParams.get('region_id');

    if (!worldId || !regionId) {
      return NextResponse.json(
        { error: 'world_id and region_id are required' },
        { status: 400 }
      );
    }

    const worldStateManager = new WorldStateManager();
    const state = await worldStateManager['getWorldState'](worldId, regionId);

    if (!state) {
      // Create default state
      const defaultState: WorldState = {
        world_id: worldId,
        region_id: regionId,
        objects: [],
        environment: {
          lighting: {
            ambient_intensity: 0.3,
            sun_position: { x: 0, y: 1000, z: 0 },
            sun_intensity: 1.0,
            fog_density: 0.0
          },
          weather: {
            type: 'clear',
            intensity: 0.0,
            wind_direction: { x: 1, y: 0, z: 0 },
            wind_strength: 0.0
          },
          physics: {
            gravity: { x: 0, y: -9.81, z: 0 },
            air_resistance: 0.01,
            collision_enabled: true
          }
        },
        version: 0,
        last_modified: new Date().toISOString(),
        created_by: 'system'
      };

      await worldStateManager['saveWorldState'](defaultState);
      return NextResponse.json(defaultState);
    }

    return NextResponse.json(state);
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Failed to retrieve world state' },
      { status: 500 }
    );
  }
}

// POST: Apply state modifications
export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { world_id, region_id, modification } = body;

    if (!world_id || !region_id || !modification) {
      return NextResponse.json(
        { error: 'world_id, region_id, and modification are required' },
        { status: 400 }
      );
    }

    // Validate modification
    const validator = new StateValidator();
    const validation = validator.validateModification(modification);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid modification', details: validation.errors },
        { status: 400 }
      );
    }

    // Get current state
    const worldStateManager = new WorldStateManager();
    const currentState = await worldStateManager['getWorldState'](world_id, region_id);

    if (!currentState) {
      return NextResponse.json(
        { error: 'World state not found' },
        { status: 404 }
      );
    }

    // Resolve conflicts
    const conflictResolver = new ConflictResolver();
    const resolution = await conflictResolver.resolveConflict(currentState, modification);

    if (!resolution.resolved || !resolution.state) {
      return NextResponse.json(
        { error: 'Conflict resolution failed', details: resolution.error },
        { status: 409 }
      );
    }

    // Validate final state
    const stateValidation = validator.validateWorldState(resolution.state);
    if (!stateValidation.valid) {
      return NextResponse.json(
        { error: 'Resulting state is invalid', details: stateValidation.errors },
        { status: 400 }
      );
    }

    // Save state
    await worldStateManager['saveWorldState'](resolution.state);

    // Log modification
    await supabase
      .from('world_state_modifications')
      .insert({
        world_id,
        region_id,
        modification: modification,
        applied_at: new Date().toISOString(),
        resulting_version: resolution.state.version
      });

    return NextResponse.json({
      success: true,
      state: resolution.state,
      version: resolution.state.version
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Failed to apply modification' },
      { status: 500 }
    );
  }
}

// PUT: Full state replacement (admin only)
export async function PUT(request: NextRequest) {
  try {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { state, user_id } = body;

    if (!state || !user_id) {
      return NextResponse.json(
        { error: 'state and user_id are required' },
        { status: 400 }
      );
    }

    // Verify user has admin permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user_id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate state
    const validator = new StateValidator();
    const validation = validator.validateWorldState(state);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid world state', details: validation.errors },
        { status: 400 }
      );
    }

    // Save state
    const worldStateManager = new WorldStateManager();
    await worldStateManager['saveWorldState']({
      ...state,
      version: (state.version || 0) + 1,
      last_modified: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Failed to replace world state' },
      { status: 500 }
    );
  }
}

// DELETE: Reset world state
export async function DELETE(request: NextRequest) {
  try {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get('world_id');
    const regionId = searchParams.get('region_id');
    const userId = searchParams.get('user_id');

    if (!worldId || !regionId || !userId) {
      return NextResponse.json(
        { error: 'world_id, region_id, and user_id are required' },
        { status: 400 }
      );
    }

    // Verify permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!profile || !['admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Delete from database
    const { error } = await supabase
      .from('world_states')
      .delete()
      .eq('world_id', worldId)
      .eq('region_id', regionId);

    if (error) throw error;

    // Clear cache
    const cacheKey = `world_state:${worldId}:${regionId}`;
    await redis.del(cacheKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Failed to reset world state' },
      { status: 500 }
    );
  }
}
```