```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Redis } from 'ioredis';
import { rateLimit } from '@/lib/rate-limit';
import { validateAuth } from '@/lib/auth';

// Types and schemas
const WorldEntitySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['object', 'terrain', 'structure', 'audio', 'visual']),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  rotation: z.object({
    x: z.number(),
    y: z.number(), 
    z: z.number()
  }),
  scale: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  properties: z.record(z.any()),
  metadata: z.object({
    created_by: z.string().uuid(),
    created_at: z.string(),
    modified_by: z.string().uuid(),
    modified_at: z.string(),
    version: z.number(),
    locked_by: z.string().uuid().optional(),
    locked_until: z.string().optional()
  })
});

const WorldStateRequestSchema = z.object({
  space_id: z.string().uuid(),
  chunk_coords: z.array(z.object({
    x: z.number(),
    y: z.number()
  })).optional(),
  include_locked: z.boolean().default(false)
});

const StateModificationSchema = z.object({
  space_id: z.string().uuid(),
  operation: z.enum(['create', 'update', 'delete', 'move']),
  entities: z.array(WorldEntitySchema.partial()),
  version_base: z.number(),
  conflict_resolution: z.enum(['merge', 'overwrite', 'branch']).default('merge')
});

interface WorldEntity {
  id: string;
  type: 'object' | 'terrain' | 'structure' | 'audio' | 'visual';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  properties: Record<string, any>;
  metadata: {
    created_by: string;
    created_at: string;
    modified_by: string;
    modified_at: string;
    version: number;
    locked_by?: string;
    locked_until?: string;
  };
}

interface SharedSpace {
  id: string;
  name: string;
  owner_id: string;
  collaborators: string[];
  permissions: Record<string, string[]>;
  world_version: number;
  last_modified: string;
  settings: {
    max_entities: number;
    allow_public_view: boolean;
    collaboration_mode: 'open' | 'restricted' | 'private';
  };
}

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

class WorldStateManager {
  async getWorldState(spaceId: string, userId: string, chunkCoords?: Array<{x: number, y: number}>) {
    // Check permissions
    const { data: space, error } = await supabase
      .from('shared_spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (error || !space) {
      throw new Error('Space not found or access denied');
    }

    if (!this.hasReadAccess(space, userId)) {
      throw new Error('Insufficient permissions');
    }

    // Try cache first
    const cacheKey = `world_state:${spaceId}:${chunkCoords?.map(c => `${c.x}_${c.y}`).join(',') || 'full'}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Build spatial query
    let query = supabase
      .from('world_entities')
      .select('*')
      .eq('space_id', spaceId);

    if (chunkCoords) {
      const chunkFilters = chunkCoords.map(coord => 
        `position->>'x' >= ${coord.x * 100} AND position->>'x' < ${(coord.x + 1) * 100} AND position->>'y' >= ${coord.y * 100} AND position->>'y' < ${(coord.y + 1) * 100}`
      );
      query = query.or(chunkFilters.join(','));
    }

    const { data: entities, error: entitiesError } = await query;

    if (entitiesError) {
      throw new Error('Failed to fetch world entities');
    }

    const worldState = {
      space_id: spaceId,
      version: space.world_version,
      entities: entities || [],
      timestamp: new Date().toISOString(),
      chunks: chunkCoords || []
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(worldState));

    return worldState;
  }

  async modifyWorldState(
    spaceId: string, 
    userId: string, 
    modifications: StateModificationSchema['_type']
  ) {
    // Validate permissions
    const { data: space } = await supabase
      .from('shared_spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (!space || !this.hasWriteAccess(space, userId)) {
      throw new Error('Insufficient permissions');
    }

    // Check for conflicts
    if (modifications.version_base !== space.world_version) {
      return await this.resolveConflicts(spaceId, userId, modifications);
    }

    // Process modifications atomically
    const { data: result, error } = await supabase.rpc('modify_world_state', {
      p_space_id: spaceId,
      p_user_id: userId,
      p_operations: modifications.entities,
      p_operation_type: modifications.operation
    });

    if (error) {
      throw new Error('Failed to apply modifications');
    }

    // Invalidate cache
    await this.invalidateWorldCache(spaceId);

    // Broadcast changes via WebSocket
    await this.broadcastChanges(spaceId, {
      type: 'world_state_change',
      operation: modifications.operation,
      entities: result.modified_entities,
      user_id: userId,
      version: result.new_version
    });

    return {
      success: true,
      version: result.new_version,
      modified_entities: result.modified_entities,
      conflicts: []
    };
  }

  private async resolveConflicts(
    spaceId: string,
    userId: string,
    modifications: StateModificationSchema['_type']
  ) {
    // Get current state
    const currentState = await this.getWorldState(spaceId, userId);
    const conflicts = [];

    // Operational Transform for conflict resolution
    for (const entity of modifications.entities) {
      const currentEntity = currentState.entities.find((e: WorldEntity) => e.id === entity.id);
      
      if (currentEntity && entity.metadata?.version !== currentEntity.metadata.version) {
        const resolved = await this.transformOperation(entity, currentEntity, modifications.conflict_resolution);
        conflicts.push({
          entity_id: entity.id,
          resolution: modifications.conflict_resolution,
          resolved_entity: resolved
        });
      }
    }

    // Apply resolved modifications
    const resolvedModifications = {
      ...modifications,
      entities: modifications.entities.map(entity => {
        const conflict = conflicts.find(c => c.entity_id === entity.id);
        return conflict ? conflict.resolved_entity : entity;
      })
    };

    return await this.modifyWorldState(spaceId, userId, resolvedModifications);
  }

  private async transformOperation(
    localEntity: Partial<WorldEntity>,
    remoteEntity: WorldEntity,
    strategy: 'merge' | 'overwrite' | 'branch'
  ): Promise<Partial<WorldEntity>> {
    switch (strategy) {
      case 'overwrite':
        return localEntity;
      
      case 'branch':
        // Create new entity with modified ID
        return {
          ...localEntity,
          id: `${localEntity.id}_branch_${Date.now()}`
        };
      
      case 'merge':
      default:
        // Merge properties intelligently
        return {
          ...remoteEntity,
          ...localEntity,
          properties: {
            ...remoteEntity.properties,
            ...localEntity.properties
          },
          metadata: {
            ...remoteEntity.metadata,
            modified_by: localEntity.metadata?.modified_by || remoteEntity.metadata.modified_by,
            modified_at: new Date().toISOString(),
            version: remoteEntity.metadata.version + 1
          }
        };
    }
  }

  private hasReadAccess(space: SharedSpace, userId: string): boolean {
    return space.owner_id === userId || 
           space.collaborators.includes(userId) ||
           space.settings.allow_public_view;
  }

  private hasWriteAccess(space: SharedSpace, userId: string): boolean {
    return space.owner_id === userId || 
           (space.collaborators.includes(userId) && 
            space.settings.collaboration_mode !== 'private');
  }

  private async invalidateWorldCache(spaceId: string) {
    const keys = await redis.keys(`world_state:${spaceId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  private async broadcastChanges(spaceId: string, change: any) {
    // Publish to Redis for WebSocket distribution
    await redis.publish(`world_changes:${spaceId}`, JSON.stringify(change));
  }
}

const worldStateManager = new WorldStateManager();

// GET - Retrieve world state
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, { limit: 100, window: 60000 });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Validate authentication
    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestData = {
      space_id: searchParams.get('space_id'),
      chunk_coords: searchParams.get('chunks') ? 
        JSON.parse(searchParams.get('chunks')!) : undefined,
      include_locked: searchParams.get('include_locked') === 'true'
    };

    const validatedData = WorldStateRequestSchema.parse(requestData);
    
    const worldState = await worldStateManager.getWorldState(
      validatedData.space_id,
      authResult.user.id,
      validatedData.chunk_coords
    );

    return NextResponse.json({
      success: true,
      data: worldState
    });

  } catch (error) {
    console.error('World state GET error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.message.includes('permissions') ? 403 : 500 }
    );
  }
}

// POST - Create new entities or spaces
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { limit: 50, window: 60000 });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = StateModificationSchema.parse({
      ...body,
      operation: 'create'
    });

    const result = await worldStateManager.modifyWorldState(
      validatedData.space_id,
      authResult.user.id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: result
    }, { status: 201 });

  } catch (error) {
    console.error('World state POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.message.includes('permissions') ? 403 : 500 }
    );
  }
}

// PUT - Update existing entities
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { limit: 100, window: 60000 });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = StateModificationSchema.parse({
      ...body,
      operation: body.operation || 'update'
    });

    const result = await worldStateManager.modifyWorldState(
      validatedData.space_id,
      authResult.user.id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('World state PUT error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.message.includes('permissions') ? 403 : 500 }
    );
  }
}

// DELETE - Remove entities
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { limit: 20, window: 60000 });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = StateModificationSchema.parse({
      ...body,
      operation: 'delete'
    });

    const result = await worldStateManager.modifyWorldState(
      validatedData.space_id,
      authResult.user.id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('World state DELETE error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.message.includes('permissions') ? 403 : 500 }
    );
  }
}
```