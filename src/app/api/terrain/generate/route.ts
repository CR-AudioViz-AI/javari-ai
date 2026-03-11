```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { Worker } from 'worker_threads';
import { Readable } from 'stream';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface TerrainRequest {
  x: number;
  z: number;
  chunkSize: number;
  lodLevel: number;
  seed: string;
  biomes: boolean;
  erosion: boolean;
}

interface HeightmapData {
  heights: Float32Array;
  biomes: Uint8Array;
  moisture: Float32Array;
  temperature: Float32Array;
}

interface TerrainChunk {
  id: string;
  x: number;
  z: number;
  chunkSize: number;
  lodLevel: number;
  seed: string;
  heightmap: HeightmapData;
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  timestamp: number;
}

// Perlin Noise Implementation
class PerlinNoise {
  private permutation: number[];
  private p: number[];

  constructor(seed: string) {
    this.permutation = this.generatePermutation(seed);
    this.p = [...this.permutation, ...this.permutation];
  }

  private generatePermutation(seed: string): number[] {
    const hash = createHash('sha256').update(seed).digest();
    const perm = Array.from({ length: 256 }, (_, i) => i);
    
    for (let i = 255; i > 0; i--) {
      const j = hash[i % hash.length] % (i + 1);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    
    return perm;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;

    return this.lerp(w,
      this.lerp(v,
        this.lerp(u, this.grad(this.p[AA], x, y, z),
          this.grad(this.p[BA], x - 1, y, z)),
        this.lerp(u, this.grad(this.p[AB], x, y - 1, z),
          this.grad(this.p[BB], x - 1, y - 1, z))),
      this.lerp(v,
        this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1),
          this.grad(this.p[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1),
          this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
  }

  octaveNoise(x: number, y: number, z: number, octaves: number, persistence: number, lacunarity: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }
}

// Hydraulic Erosion Simulator
class HydraulicErosion {
  static async erode(heightmap: Float32Array, width: number, height: number, iterations: number = 50000): Promise<Float32Array> {
    const eroded = new Float32Array(heightmap);
    const waterMap = new Float32Array(width * height);
    const velocityMap = new Float32Array(width * height * 2); // x, y velocity
    const sedimentMap = new Float32Array(width * height);

    const evaporationRate = 0.01;
    const depositionRate = 0.3;
    const erosionRate = 0.3;
    const gravity = 4;
    const inertia = 0.05;
    const minSlope = 0.01;

    for (let iter = 0; iter < iterations; iter++) {
      // Random droplet position
      let x = Math.random() * (width - 1);
      let z = Math.random() * (height - 1);
      let dir_x = 0;
      let dir_z = 0;
      let speed = 1;
      let water = 1;
      let sediment = 0;

      for (let lifetime = 0; lifetime < 30; lifetime++) {
        const nodeX = Math.floor(x);
        const nodeZ = Math.floor(z);

        if (nodeX < 0 || nodeX >= width - 1 || nodeZ < 0 || nodeZ >= height - 1) break;

        // Calculate droplet's offset inside the cell (0,0) to (1,1)
        const cellOffsetX = x - nodeX;
        const cellOffsetZ = z - nodeZ;

        // Get heights of four corners of the droplet's cell
        const h_00 = eroded[nodeZ * width + nodeX];
        const h_10 = eroded[nodeZ * width + nodeX + 1];
        const h_01 = eroded[(nodeZ + 1) * width + nodeX];
        const h_11 = eroded[(nodeZ + 1) * width + nodeX + 1];

        // Bilinear interpolation
        const height = h_00 * (1 - cellOffsetX) * (1 - cellOffsetZ) +
                      h_10 * cellOffsetX * (1 - cellOffsetZ) +
                      h_01 * (1 - cellOffsetX) * cellOffsetZ +
                      h_11 * cellOffsetX * cellOffsetZ;

        // Calculate gradient
        const gradX = (h_10 - h_00) * (1 - cellOffsetZ) + (h_11 - h_01) * cellOffsetZ;
        const gradZ = (h_01 - h_00) * (1 - cellOffsetX) + (h_11 - h_10) * cellOffsetX;

        // Update velocity and position
        dir_x = dir_x * inertia - gradX * (1 - inertia);
        dir_z = dir_z * inertia - gradZ * (1 - inertia);

        const len = Math.sqrt(dir_x * dir_x + dir_z * dir_z);
        if (len > 0) {
          dir_x /= len;
          dir_z /= len;
        }

        x += dir_x;
        z += dir_z;

        if (Math.sqrt(gradX * gradX + gradZ * gradZ) <= minSlope) break;

        const newHeight = h_00 * (1 - cellOffsetX) * (1 - cellOffsetZ) +
                         h_10 * cellOffsetX * (1 - cellOffsetZ) +
                         h_01 * (1 - cellOffsetX) * cellOffsetZ +
                         h_11 * cellOffsetX * cellOffsetZ;

        const deltaHeight = newHeight - height;
        const sedimentCapacity = Math.max(-deltaHeight, minSlope) * speed * water * 4;

        if (sediment > sedimentCapacity || deltaHeight > 0) {
          const toDeposit = deltaHeight > 0 ? Math.min(deltaHeight, sediment) : (sediment - sedimentCapacity) * depositionRate;
          sediment -= toDeposit;

          // Add sediment to four nodes of the current cell using bilinear interpolation
          eroded[nodeZ * width + nodeX] += toDeposit * (1 - cellOffsetX) * (1 - cellOffsetZ);
          eroded[nodeZ * width + nodeX + 1] += toDeposit * cellOffsetX * (1 - cellOffsetZ);
          eroded[(nodeZ + 1) * width + nodeX] += toDeposit * (1 - cellOffsetX) * cellOffsetZ;
          eroded[(nodeZ + 1) * width + nodeX + 1] += toDeposit * cellOffsetX * cellOffsetZ;
        } else {
          const toErode = Math.min((sedimentCapacity - sediment) * erosionRate, -deltaHeight);

          // Remove sediment from four nodes
          eroded[nodeZ * width + nodeX] -= toErode * (1 - cellOffsetX) * (1 - cellOffsetZ);
          eroded[nodeZ * width + nodeX + 1] -= toErode * cellOffsetX * (1 - cellOffsetZ);
          eroded[(nodeZ + 1) * width + nodeX] -= toErode * (1 - cellOffsetX) * cellOffsetZ;
          eroded[(nodeZ + 1) * width + nodeX + 1] -= toErode * cellOffsetX * cellOffsetZ;

          sediment += toErode;
        }

        speed = Math.sqrt(speed * speed + deltaHeight * gravity);
        water *= (1 - evaporationRate);
      }
    }

    return eroded;
  }
}

// Biome Mapper
class BiomeMapper {
  static readonly BIOMES = {
    OCEAN: 0,
    BEACH: 1,
    DESERT: 2,
    SAVANNA: 3,
    TROPICAL_RAINFOREST: 4,
    GRASSLAND: 5,
    WOODLAND: 6,
    SEASONAL_FOREST: 7,
    TEMPERATE_RAINFOREST: 8,
    BOREAL_FOREST: 9,
    TUNDRA: 10,
    ALPINE: 11,
    SNOW: 12
  };

  static mapBiomes(heights: Float32Array, temperatures: Float32Array, moisture: Float32Array, width: number, height: number): Uint8Array {
    const biomes = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const elevation = heights[i];
      const temp = temperatures[i];
      const humid = moisture[i];

      if (elevation < -0.1) {
        biomes[i] = this.BIOMES.OCEAN;
      } else if (elevation < 0.05) {
        biomes[i] = this.BIOMES.BEACH;
      } else if (temp > 0.8 && humid < 0.2) {
        biomes[i] = this.BIOMES.DESERT;
      } else if (temp > 0.6 && humid < 0.4) {
        biomes[i] = this.BIOMES.SAVANNA;
      } else if (temp > 0.7 && humid > 0.8) {
        biomes[i] = this.BIOMES.TROPICAL_RAINFOREST;
      } else if (temp > 0.4 && temp < 0.8 && humid < 0.6) {
        biomes[i] = this.BIOMES.GRASSLAND;
      } else if (temp > 0.3 && temp < 0.7 && humid > 0.3 && humid < 0.8) {
        biomes[i] = this.BIOMES.SEASONAL_FOREST;
      } else if (temp > 0.2 && humid > 0.8) {
        biomes[i] = this.BIOMES.TEMPERATE_RAINFOREST;
      } else if (temp > 0.1 && temp < 0.5) {
        biomes[i] = this.BIOMES.BOREAL_FOREST;
      } else if (elevation > 0.6) {
        if (temp < 0.1) {
          biomes[i] = this.BIOMES.SNOW;
        } else if (temp < 0.3) {
          biomes[i] = this.BIOMES.ALPINE;
        } else {
          biomes[i] = this.BIOMES.WOODLAND;
        }
      } else if (temp < 0.2) {
        biomes[i] = this.BIOMES.TUNDRA;
      } else {
        biomes[i] = this.BIOMES.GRASSLAND;
      }
    }

    return biomes;
  }
}

// Terrain Mesh Generator
class TerrainMesh {
  static generateMesh(heightmap: Float32Array, width: number, height: number, scale: number = 1): {
    vertices: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
  } {
    const vertices = new Float32Array(width * height * 3);
    const normals = new Float32Array(width * height * 3);
    const uvs = new Float32Array(width * height * 2);
    const indices = new Uint32Array((width - 1) * (height - 1) * 6);

    // Generate vertices and UVs
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const i = z * width + x;
        const vertexIndex = i * 3;
        const uvIndex = i * 2;

        vertices[vertexIndex] = x * scale;
        vertices[vertexIndex + 1] = heightmap[i] * scale;
        vertices[vertexIndex + 2] = z * scale;

        uvs[uvIndex] = x / (width - 1);
        uvs[uvIndex + 1] = z / (height - 1);
      }
    }

    // Generate normals
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const i = z * width + x;
        const normalIndex = i * 3;

        // Calculate normal using neighboring vertices
        const left = x > 0 ? heightmap[z * width + (x - 1)] : heightmap[i];
        const right = x < width - 1 ? heightmap[z * width + (x + 1)] : heightmap[i];
        const up = z > 0 ? heightmap[(z - 1) * width + x] : heightmap[i];
        const down = z < height - 1 ? heightmap[(z + 1) * width + x] : heightmap[i];

        const normalX = (left - right) / (2 * scale);
        const normalZ = (up - down) / (2 * scale);
        const normalY = 1;

        const length = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);
        normals[normalIndex] = normalX / length;
        normals[normalIndex + 1] = normalY / length;
        normals[normalIndex + 2] = normalZ / length;
      }
    }

    // Generate indices
    let indexCount = 0;
    for (let z = 0; z < height - 1; z++) {
      for (let x = 0; x < width - 1; x++) {
        const topLeft = z * width + x;
        const topRight = z * width + x + 1;
        const bottomLeft = (z + 1) * width + x;
        const bottomRight = (z + 1) * width + x + 1;

        // First triangle
        indices[indexCount++] = topLeft;
        indices[indexCount++] = bottomLeft;
        indices[indexCount++] = topRight;

        // Second triangle
        indices[indexCount++] = topRight;
        indices[indexCount++] = bottomLeft;
        indices[indexCount++] = bottomRight;
      }
    }

    return { vertices, normals, uvs, indices };
  }
}

// Terrain Generator
class TerrainGenerator {
  private noise: PerlinNoise;

  constructor(seed: string) {
    this.noise = new PerlinNoise(seed);
  }

  async generateChunk(x: number, z: number, chunkSize: number, lodLevel: number, options: {
    erosion: boolean;
    biomes: boolean;
  }): Promise<HeightmapData> {
    const resolution = Math.max(16, chunkSize >> lodLevel);
    const heights = new Float32Array(resolution * resolution);
    const moisture = new Float32Array(resolution * resolution);
    const temperature = new Float32Array(resolution * resolution);

    // Generate base heightmap using multi-octave Perlin noise
    for (let gz = 0; gz < resolution; gz++) {
      for (let gx = 0; gx < resolution; gx++) {
        const worldX = x * chunkSize + (gx / resolution) * chunkSize;
        const worldZ = z * chunkSize + (gz / resolution) * chunkSize;

        // Base terrain
        const continents = this.noise.octaveNoise(worldX * 0.0001, 0, worldZ * 0.0001, 4, 0.5, 2) * 200;
        const mountains = this.noise.octaveNoise(worldX * 0.0005, 0, worldZ * 0.0005, 6, 0.6, 2) * 150;
        const hills = this.noise.octaveNoise(worldX * 0.002, 0, worldZ * 0.002, 4, 0.5, 2) * 50;
        const details = this.noise.octaveNoise(worldX * 0.01, 0, worldZ * 0.01, 3, 0.4, 2) * 10;

        heights[gz * resolution + gx] = continents + mountains + hills + details;

        // Climate data
        temperature[gz * resolution + gx] = Math.max(0, Math.min(1,
          0.5 + this.noise.octaveNoise(worldX * 0.0003, 100, worldZ * 0.0003, 3, 0.5, 2) * 0.5
        ));

        moisture[gz * resolution + gx] = Math.max(0, Math.min(1,
          0.5 + this.noise.octaveNoise(worldX * 0.0004, 200, worldZ * 0.0004, 4, 0.6, 2) * 0.5
        ));
      }
    }

    // Apply hydraulic erosion
    if (options.erosion) {
      const eroded = await HydraulicErosion.erode(heights, resolution, resolution, 5000);
      heights.set(eroded);
    }

    // Generate biomes
    const biomes = options.biomes 
      ? BiomeMapper.mapBiomes(heights, temperature, moisture, resolution, resolution)
      : new Uint8Array(resolution * resolution);

    return { heights, biomes, moisture, temperature };
  }
}

// Chunk Cache Manager
class ChunkCache {
  static async getChunk(chunkId: string): Promise<TerrainChunk | null> {
    try {
      const { data, error } = await supabase
        .from('terrain_chunks')
        .select('*')
        .eq('id', chunkId)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        x: data.x,
        z: data.z,
        chunkSize: data.chunk_size,
        lodLevel: data.lod_level,
        seed: data.seed,
        heightmap: {
          heights: new Float32Array(data.heights),
          biomes: new Uint8Array(data.biomes),
          moisture: new Float32Array(data.moisture),
          temperature: new Float32Array(data.temperature)
        },
        vertices: new Float32Array(data.vertices),
        normals: new Float32Array(data.normals),
        uvs: new Float32Array(data.uvs),
        indices: new Uint32Array(data.indices),
        timestamp: data.timestamp
      };
    } catch (error) {
      console.error('Error fetching chunk from cache:', error);
      return null;
    }
  }

  static async setChunk(chunk: TerrainChunk): Promise<void> {
    try {
      await supabase
        .from('terrain_chunks')
        .upsert({
          id: chunk.id,
          x: chunk.x,
          z: chunk.z,
          chunk_size: chunk.chunkSize,
          lod_level: chunk.lodLevel,
          seed: chunk.seed,
          heights: Array.from(chunk.heightmap.heights),
          biomes: Array.from(chunk.heightmap.biomes),
          moisture: Array.from(chunk.heightmap.moisture),
          temperature: Array.from(chunk.heightmap.temperature),
          vertices: Array.from(chunk.vertices),
          normals: Array.from(chunk.normals),
          uvs: Array.from(chunk.uvs),
          indices: Array.from(chunk.indices),
          timestamp: chunk.timestamp
        });
    } catch (error) {
      console.error('Error caching chunk:', error);
    }
  }
}

// Validation
function validateRequest(params: URLSearchParams): TerrainRequest {
  const x = parseInt(params.get('x') || '0');
  const z = parseInt(params.get('z') || '0');
  const chunkSize = parseInt(params.get('chunkSize') || '64');
  const lodLevel = parseInt(params.get('lodLevel') || '0');
  const seed = params.get('seed') || 'default';
  const bi