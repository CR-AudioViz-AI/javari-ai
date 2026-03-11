# Create Procedural World Generation API

```markdown
# Procedural World Generation API

## Purpose
The Procedural World Generation API provides a mechanism to generate detailed worlds in a game environment based on specified parameters. Utilizing different algorithms for terrain, biome, and content placement, developers can create diverse and expansive game worlds.

## Usage
The API exposes a single route for generating worlds and retrieving world chunks:

```
POST /api/craiverse/world-generation
```

This route accepts parameters to configure the world generation process and has built-in support for request validation and rate limiting.

## Parameters/Props

### World Generation Parameters (POST Body)
- **seed** (string): A unique identifier for world generation. Must be alphanumeric, 1 to 100 characters long.  
- **chunkSize** (number): Defines the size of the world chunk. Must be an integer between 16 and 512. Default is 64.
- **renderDistance** (number): The distance at which the world is rendered. Must be an integer between 1 and 32. Default is 8.
- **biomeScale** (number): Controls the scale of biomes. Must be positive and between 0.001 and 1. Default is 0.01.
- **terrainHeight** (number): Maximum height of terrain. Must be positive and between 1 and 1000. Default is 100.
- **octaves** (number): Number of octaves for noise generation. Must be an integer between 1 and 8. Default is 4.
- **persistence** (number): Determines amplitude decay for octaves. Must be positive and between 0.1 and 1. Default is 0.5.
- **lacunarity** (number): Frequency multiplier for octaves. Must be positive and between 1 and 4. Default is 2.0.
- **centerX** (number): The X coordinate of the center point for world generation. Default is 0.
- **centerZ** (number): The Z coordinate of the center point for world generation. Default is 0.
- **includeStructures** (boolean): Flag to include structures in the world. Default is true.
- **audioIntegration** (boolean): Flag to enable audio integration. Default is false.

### Chunk Request Parameters (POST Body)
- **chunkIds** (array of strings): An array of chunk identifiers to request. Maximum of 100.
- **detailLevel** (number): Level of detail for rendering the chunks. Must be an integer between 0 and 4. Default is 2.

## Return Values
The API returns a JSON response containing:
- **GeneratedWorld**: The entire generated world data including terrain, biomes, and structures (if requested).
- **WorldChunk**: A specific chunk of the world with high detail as per the request parameters.

## Examples

### Generating a World
```json
POST /api/craiverse/world-generation
{
  "seed": "my_unique_seed",
  "chunkSize": 64,
  "renderDistance": 8,
  "biomeScale": 0.01,
  "terrainHeight": 100,
  "octaves": 4,
  "persistence": 0.5,
  "lacunarity": 2.0,
  "centerX": 0,
  "centerZ": 0,
  "includeStructures": true,
  "audioIntegration": false
}
```

### Requesting Specific Chunks
```json
POST /api/craiverse/world-generation
{
  "chunkIds": ["chunk_1", "chunk_2"],
  "detailLevel": 2
}
```
``` 

This documentation provides a concise overview of the API's functionality, parameters, and return values aiding developers in effectively utilizing the Procedural World Generation API within their applications.
```