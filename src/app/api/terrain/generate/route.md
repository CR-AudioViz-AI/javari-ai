# Create Procedural Terrain Generation API

```markdown
# Procedural Terrain Generation API

The Procedural Terrain Generation API allows developers to generate 3D terrain data based on specified parameters such as position, chunk size, level of detail, and more. This API is useful for applications such as video games, simulations, or any application requiring dynamic terrain generation.

## Purpose

This API generates terrain data, including heightmaps and other geological features, using procedural noise algorithms. It leverages the Supabase client for persistent storage and manages processing through worker threads for efficiency.

## Usage

The API is accessible via a route defined in `src/app/api/terrain/generate/route.ts`. It accepts a JSON payload with terrain generation parameters and responds with the generated terrain data.

### Endpoint

```http
POST /api/terrain/generate
```

### Request Body

The request body should be JSON formatted as follows:

```json
{
  "x": number,
  "z": number,
  "chunkSize": number,
  "lodLevel": number,
  "seed": string,
  "biomes": boolean,
  "erosion": boolean
}
```

### Parameters/Props

| Parameter  | Type       | Description                                               |
|------------|------------|-----------------------------------------------------------|
| `x`        | `number`   | The x-coordinate of the terrain chunk to generate.      |
| `z`        | `number`   | The z-coordinate of the terrain chunk to generate.      |
| `chunkSize`| `number`  | The size of the chunk to generate (width and depth).    |
| `lodLevel` | `number`   | Level of detail for the terrain (higher = more detail). |
| `seed`     | `string`   | Seed for random terrain generation, ensures unique output|
| `biomes`   | `boolean`  | Include biome data in the output if true.               |
| `erosion`  | `boolean`  | Apply erosion simulation if true.                        |

### Return Values

A successful response will return a JSON object containing:

```json
{
  "id": "string",
  "x": number,
  "z": number,
  "chunkSize": number,
  "lodLevel": number,
  "seed": string,
  "heightmap": {
    "heights": Float32Array,
    "biomes": Uint8Array,
    "moisture": Float32Array,
    "temperature": Float32Array
  },
  "vertices": Float32Array,
  "normals": Float32Array,
  "uvs": Float32Array,
  "indices": Uint32Array,
  "timestamp": number
}
```

## Examples

### Generating a Terrain Chunk

#### Request

```http
POST /api/terrain/generate
Content-Type: application/json

{
  "x": 10,
  "z": 15,
  "chunkSize": 256,
  "lodLevel": 2,
  "seed": "exampleSeed123",
  "biomes": true,
  "erosion": false
}
```

#### Response

```json
{
  "id": "terrainChunk1",
  "x": 10,
  "z": 15,
  "chunkSize": 256,
  "lodLevel": 2,
  "seed": "exampleSeed123",
  "heightmap": {
    "heights": [0.1, 0.5, ...],
    "biomes": [1, 2, ...],
    "moisture": [0.3, 0.4, ...],
    "temperature": [0.2, 0.6, ...]
  },
  "vertices": [...],
  "normals": [...],
  "uvs": [...],
  "indices": [...],
  "timestamp": 1678499035
}
```

## Notes

- Ensure that the Supabase service keys are correctly configured in the environment variables.
- The noise generation utilizes Perlin noise for realistic terrain features.
```