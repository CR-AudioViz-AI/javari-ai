import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { TerrainGenerator } from '@/lib/craiverse/world-generation/terrain-generator';
import { BiomeSystem } from '@/lib/craiverse/world-generation/biome-system';
import { NoiseAlgorithms } from '@/lib/craiverse/world-generation/noise-algorithms';
import { ContentPlacer } from '@/lib/craiverse/world-generation/content-placer';
import { ChunkManager } from '@/lib/craiverse/world-generation/chunk-manager';
import type { 
  WorldGenerationParams, 
  GeneratedWorld, 
  WorldChunk,
  BiomeType,
  TerrainData 
} from '@/types/craiverse/world-generation';

// Validation schemas
const worldGenerationSchema = z.object({
  seed: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  chunkSize: z.number().int().min(16).max(512).default(64),
  renderDistance: z.number().int().min(1).max(32).default(8),
  biomeScale: z.number().positive().min(0.001).max(1).default(0.01),
  terrainHeight: z.number().positive().min(1).max(1000).default(100),
  octaves: z.number().int().min(1).max(8).default(4),
  persistence: z.number().positive().min(0.1).max(1).default(0.5),
  lacunarity: z.number().positive().min(1).max(4).default(2.0),
  centerX: z.number().default(0),
  centerZ: z.number().default(0),
  includeStructures: z.boolean().default(true),
  audioIntegration: z.boolean().default(false)
});

const chunkRequestSchema = z.object({
  chunkIds: z.array(z.string()).max(100),
  detailLevel: z.number().int().min(0).max(4).default(2)
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] || request.ip || 'unknown';
  return `world-gen:${ip}`;
}

async function generateWorld(params: WorldGenerationParams): Promise<GeneratedWorld> {
  try {
    // Initialize generation systems
    const noiseGen = new NoiseAlgorithms(params.seed);
    const terrainGen = new TerrainGenerator(noiseGen, {
      octaves: params.octaves,
      persistence: params.persistence,
      lacunarity: params.lacunarity,
      scale: params.biomeScale,
      heightMultiplier: params.terrainHeight
    });
    
    const biomeSystem = new BiomeSystem(noiseGen, {
      temperatureScale: params.biomeScale * 0.8,
      moistureScale: params.biomeScale * 1.2,
      elevationInfluence: 0.3
    });
    
    const contentPlacer = new ContentPlacer(noiseGen, {
      structureDensity: 0.1,
      vegetationDensity: 0.3,
      poissonRadius: params.chunkSize * 0.1
    });
    
    const chunkManager = new ChunkManager({
      chunkSize: params.chunkSize,
      renderDistance: params.renderDistance,
      centerX: params.centerX,
      centerZ: params.centerZ
    });

    // Generate initial chunks
    const chunks: WorldChunk[] = [];
    const chunkPositions = chunkManager.getRequiredChunks(params.centerX, params.centerZ);

    for (const pos of chunkPositions) {
      const terrainData = terrainGen.generateChunk(pos.x, pos.z, params.chunkSize);
      const biomeData = biomeSystem.generateBiomes(pos.x, pos.z, params.chunkSize, terrainData);
      
      let contentData = null;
      if (params.includeStructures) {
        contentData = contentPlacer.placeContent(pos.x, pos.z, params.chunkSize, biomeData);
      }

      const chunk: WorldChunk = {
        id: `${pos.x}_${pos.z}`,
        x: pos.x,
        z: pos.z,
        size: params.chunkSize,
        terrain: terrainData,
        biomes: biomeData,
        content: contentData,
        meshData: terrainGen.generateMeshData(terrainData, biomeData),
        audioZones: params.audioIntegration ? 
          biomeSystem.generateAudioZones(biomeData) : null,
        generatedAt: new Date(),
        version: 1
      };

      chunks.push(chunk);
    }

    // Create world metadata
    const world: GeneratedWorld = {
      id: crypto.randomUUID(),
      seed: params.seed,
      parameters: params,
      chunks,
      metadata: {
        totalChunks: chunks.length,
        biomeStats: calculateBiomeStats(chunks),
        boundingBox: calculateBoundingBox(chunks),
        estimatedSize: chunks.length * params.chunkSize * params.chunkSize,
        features: {
          hasStructures: params.includeStructures,
          hasAudioIntegration: params.audioIntegration,
          terrainComplexity: calculateComplexity(chunks)
        }
      },
      createdAt: new Date(),
      lastAccessed: new Date()
    };

    return world;

  } catch (error) {
    console.error('World generation failed:', error);
    throw new Error('Failed to generate world');
  }
}

function calculateBiomeStats(chunks: WorldChunk[]): Record<BiomeType, number> {
  const stats: Record<string, number> = {};
  
  for (const chunk of chunks) {
    for (const biome of chunk.biomes) {
      stats[biome.type] = (stats[biome.type] || 0) + biome.coverage;
    }
  }
  
  return stats as Record<BiomeType, number>;
}

function calculateBoundingBox(chunks: WorldChunk[]) {
  if (chunks.length === 0) return { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
  
  let minX = chunks[0].x;
  let minZ = chunks[0].z;
  let maxX = chunks[0].x + chunks[0].size;
  let maxZ = chunks[0].z + chunks[0].size;
  
  for (const chunk of chunks) {
    minX = Math.min(minX, chunk.x);
    minZ = Math.min(minZ, chunk.z);
    maxX = Math.max(maxX, chunk.x + chunk.size);
    maxZ = Math.max(maxZ, chunk.z + chunk.size);
  }
  
  return { minX, minZ, maxX, maxZ };
}

function calculateComplexity(chunks: WorldChunk[]): number {
  let totalVariance = 0;
  
  for (const chunk of chunks) {
    const heights = chunk.terrain.heightMap.flat();
    const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
    const variance = heights.reduce((sum, height) => sum + Math.pow(height - mean, 2), 0) / heights.length;
    totalVariance += variance;
  }
  
  return totalVariance / chunks.length;
}

async function cacheWorld(world: GeneratedWorld): Promise<void> {
  try {
    const { error } = await supabase
      .from('generated_worlds')
      .upsert({
        id: world.id,
        seed: world.seed,
        parameters: world.parameters,
        metadata: world.metadata,
        created_at: world.createdAt.toISOString(),
        last_accessed: world.lastAccessed.toISOString()
      });

    if (error) {
      console.error('Failed to cache world metadata:', error);
    }

    // Cache chunks separately for better performance
    for (const chunk of world.chunks) {
      const { error: chunkError } = await supabase
        .from('world_chunks')
        .upsert({
          id: chunk.id,
          world_id: world.id,
          x: chunk.x,
          z: chunk.z,
          size: chunk.size,
          data: {
            terrain: chunk.terrain,
            biomes: chunk.biomes,
            content: chunk.content,
            meshData: chunk.meshData,
            audioZones: chunk.audioZones
          },
          generated_at: chunk.generatedAt.toISOString(),
          version: chunk.version
        });

      if (chunkError) {
        console.error('Failed to cache chunk:', chunk.id, chunkError);
      }
    }
  } catch (error) {
    console.error('Cache operation failed:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before generating more worlds.' },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const params = worldGenerationSchema.parse(body);

    // Check for cached world
    const { data: cachedWorld } = await supabase
      .from('generated_worlds')
      .select('*')
      .eq('seed', params.seed)
      .single();

    if (cachedWorld && 
        Date.now() - new Date(cachedWorld.last_accessed).getTime() < 3600000) { // 1 hour cache
      
      // Load cached chunks
      const { data: chunks } = await supabase
        .from('world_chunks')
        .select('*')
        .eq('world_id', cachedWorld.id)
        .order('x, z');

      if (chunks) {
        const world: GeneratedWorld = {
          ...cachedWorld,
          chunks: chunks.map(chunk => ({
            ...chunk.data,
            id: chunk.id,
            x: chunk.x,
            z: chunk.z,
            size: chunk.size,
            generatedAt: new Date(chunk.generated_at),
            version: chunk.version
          })),
          createdAt: new Date(cachedWorld.created_at),
          lastAccessed: new Date()
        };

        // Update last accessed time
        await supabase
          .from('generated_worlds')
          .update({ last_accessed: new Date().toISOString() })
          .eq('id', cachedWorld.id);

        return NextResponse.json({ 
          success: true, 
          data: world,
          cached: true 
        });
      }
    }

    // Generate new world
    const world = await generateWorld(params);
    
    // Cache the generated world
    await cacheWorld(world);

    return NextResponse.json({ 
      success: true, 
      data: world,
      cached: false 
    });

  } catch (error) {
    console.error('World generation API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid parameters', 
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error during world generation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get('worldId');
    const seed = searchParams.get('seed');
    const chunkIds = searchParams.get('chunkIds')?.split(',');

    if (!worldId && !seed && !chunkIds) {
      return NextResponse.json(
        { error: 'Must provide worldId, seed, or chunkIds parameter' },
        { status: 400 }
      );
    }

    // Get specific chunks
    if (chunkIds) {
      const validation = chunkRequestSchema.safeParse({
        chunkIds,
        detailLevel: parseInt(searchParams.get('detailLevel') || '2')
      });

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid chunk request parameters', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { data: chunks } = await supabase
        .from('world_chunks')
        .select('*')
        .in('id', validation.data.chunkIds);

      return NextResponse.json({ 
        success: true, 
        data: chunks?.map(chunk => ({
          ...chunk.data,
          id: chunk.id,
          x: chunk.x,
          z: chunk.z,
          size: chunk.size,
          generatedAt: new Date(chunk.generated_at),
          version: chunk.version
        })) || []
      });
    }

    // Get world by ID or seed
    const query = supabase
      .from('generated_worlds')
      .select('*');

    if (worldId) {
      query.eq('id', worldId);
    } else if (seed) {
      query.eq('seed', seed);
    }

    const { data: worldData } = await query.single();

    if (!worldData) {
      return NextResponse.json(
        { error: 'World not found' },
        { status: 404 }
      );
    }

    // Load world chunks
    const { data: chunks } = await supabase
      .from('world_chunks')
      .select('*')
      .eq('world_id', worldData.id)
      .order('x, z');

    const world: GeneratedWorld = {
      ...worldData,
      chunks: chunks?.map(chunk => ({
        ...chunk.data,
        id: chunk.id,
        x: chunk.x,
        z: chunk.z,
        size: chunk.size,
        generatedAt: new Date(chunk.generated_at),
        version: chunk.version
      })) || [],
      createdAt: new Date(worldData.created_at),
      lastAccessed: new Date()
    };

    // Update last accessed time
    await supabase
      .from('generated_worlds')
      .update({ last_accessed: new Date().toISOString() })
      .eq('id', worldData.id);

    return NextResponse.json({ 
      success: true, 
      data: world 
    });

  } catch (error) {
    console.error('World retrieval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during world retrieval' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get('worldId');

    if (!worldId) {
      return NextResponse.json(
        { error: 'worldId parameter is required' },
        { status: 400 }
      );
    }

    // Delete chunks first
    const { error: chunksError } = await supabase
      .from('world_chunks')
      .delete()
      .eq('world_id', worldId);

    if (chunksError) {
      console.error('Failed to delete world chunks:', chunksError);
    }

    // Delete world
    const { error: worldError } = await supabase
      .from('generated_worlds')
      .delete()
      .eq('id', worldId);

    if (worldError) {
      console.error('Failed to delete world:', worldError);
      return NextResponse.json(
        { error: 'Failed to delete world' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'World deleted successfully' 
    });

  } catch (error) {
    console.error('World deletion API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during world deletion' },
      { status: 500 }
    );
  }
}