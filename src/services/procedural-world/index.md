# Deploy Procedural World Generation Service

```markdown
# Procedural World Generation Service

## Purpose
The Procedural World Generation Service provides the capability to create infinite, explorable worlds with dynamic ecosystems, weather systems, and real-time streaming. It's designed for applications requiring procedurally generated landscapes, such as video games or simulations.

## Usage
This service can be utilized to generate biome-specific terrains and ecosystems on-demand. The core functionalities are implemented in the primary module located in `src/services/procedural-world/index.ts`. 

To deploy the service, ensure you have the necessary dependencies: `@supabase/supabase-js`, `ioredis`, and `ws`. Access and configure a Redis instance and a Supabase database for data storage and management.

## Parameters / Props

### Core Interfaces
- **WorldCoordinates**
  - `x`: (number) X-coordinate in the world.
  - `z`: (number) Z-coordinate in the world.
  - `chunkX`: (number) Chunk X index.
  - `chunkZ`: (number) Chunk Z index.

- **HeightMap**
  - `width`: (number) Width of the height map.
  - `height`: (number) Height of the height map.
  - `heights`: (Float32Array) Array of height values.
  - `minHeight`: (number) Minimum height value.
  - `maxHeight`: (number) Maximum height value.

- **BiomeData**
  - `type`: (BiomeType) Type of biome.
  - `temperature`: (number) Temperature in the biome.
  - `humidity`: (number) Humidity level.
  - `elevation`: (number) Elevation level.
  - `vegetationDensity`: (number) Density of vegetation.
  - `resourceDensity`: (number) Density of resources.

- **WeatherState**
  - `temperature`, `humidity`, `precipitation`, `windSpeed`, `windDirection`, `pressure`: (number) Various weather parameters.
  - `season`: (Season) Current season.
  - `timeOfDay`: (number) Current time of day.

- **EcosystemData**
  - `flora`: (FloraDistribution[]) Flora distribution in the ecosystem.
  - `fauna`: (FaunaPopulation[]) Fauna population data.
  - `resources`: (ResourceNode[]) Resources in the ecosystem.
  - `waterSources`: (WaterSource[]) Water source data.

- **WorldChunk**
  - `id`: (string) Unique identifier for the chunk.
  - `coordinates`: (WorldCoordinates) Coordinates of the chunk.
  - `heightMap`, `biomeData`, `weatherState`, `ecosystemData`: (HeightMap, BiomeData[][], WeatherState, EcosystemData) Corresponding world data.
  - `meshData`?: (TerrainMesh) Optional terrain mesh data.
  - `lastUpdated`: (Date) Timestamp of the last update.
  - `version`: (number) Version of the chunk.

- **WorldGenerationConfig**
  - Various parameters like `seed`, `chunkSize`, `maxHeight`, `octaves`, etc. used for configuration settings of the generation process.

### Enums
- **BiomeType**: Enum for biome types (e.g., OCEAN, DESERT, FOREST, MOUNTAINS, TUNDRA).

## Return Values
The service returns generated world chunks, each containing comprehensive data about coordinates, ecosystems, biomes, weather, and terrain mesh.

## Examples
```typescript
import { generateWorldChunk } from './procedural-world';

const config = {
    seed: 12345,
    chunkSize: 16,
    maxHeight: 256,
    octaves: 4,
    frequency: 1.0,
    amplitude: 1.0,
    persistence: 0.5,
    lacunarity: 2.0,
    biomeScale: 100,
    weatherIntensity: 0.75,
    ecosystemComplexity: 5,
};

const worldChunk = generateWorldChunk(config, { x: 0, z: 0 });
console.log(worldChunk);
```
``` 

This example demonstrates how to set up the generation configuration and generate a world chunk using the service's core function.
```