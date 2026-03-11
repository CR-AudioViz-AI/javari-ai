# Build Terrain Generation Component

# TerrainGenerator Component Documentation

## Purpose
The `TerrainGenerator` component is designed to create customizable terrain visuals using parameters for noise generation, texture layers, geological features, and erosion settings. It provides a user interface for adjusting terrain characteristics interactively.

## Usage
To use the `TerrainGenerator` component, import it into your desired React component and include it in your JSX. 

```tsx
import TerrainGenerator from '@/components/craiverse/terrain/TerrainGenerator';

function App() {
  return <TerrainGenerator />;
}
```

## Parameters/Props
The `TerrainGenerator` does not expose props directly as it manages its own state and functionalities internally. Instead, it operates with several configurable parameters for terrain generation upon user input:

### TerrainParameters
- **width**: `number` - The width of the terrain.
- **height**: `number` - The height of the terrain.
- **scale**: `number` - The scale at which the terrain is generated.
- **octaves**: `number` - The number of layers of noise contributing to the terrain.
- **persistence**: `number` - Controls the amplitude of each octave.
- **lacunarity**: `number` - Frequency between octaves.
- **seed**: `number` - Random seed for terrain generation.

### NoiseSettings
- **type**: `'perlin' | 'simplex' | 'ridged' | 'fbm'` - Type of noise used for terrain generation.
- **frequency**: `number` - Base frequency of the noise.
- **amplitude**: `number` - Height of the noise.
- **ridgeOffset**: `number` - (optional) Offset for ridged noise.
- **gain**: `number` - (optional) Gain factor for noise.

### TextureLayer
- **id**: `string` - Unique identifier for the texture layer.
- **name**: `string` - Name of the texture layer.
- **texture**: `string` - URL or identifier for the texture image.
- **heightMin**: `number` - Minimum height for this texture to be applied.
- **heightMax**: `number` - Maximum height for this texture to be applied.
- **blendMode**: `'multiply' | 'overlay' | 'normal'` - How the texture blends with underlying layers.
- **opacity**: `number` - Opacity of the texture.
- **scale**: `number` - Tile scale of the texture.

### GeologicalFeature
- **id**: `string` - Unique identifier for the geological feature.
- **type**: `'volcano' | 'crater' | 'ridge' | 'valley' | 'plateau'` - Type of geological formation.
- **x**: `number` - X-coordinate for feature placement.
- **y**: `number` - Y-coordinate for feature placement.
- **radius**: `number` - Radius of the feature.
- **intensity**: `number` - Strength of the feature.
- **falloff**: `number` - How the feature affects surrounding terrain.

### ErosionSettings
- **iterations**: `number` - Number of erosion iterations to apply.
- **strength**: `number` - Strength of erosion effect.
- **evaporation**: `number` - Evaporation rate in erosion.
- **deposition**: `number` - Rate of deposition in erosion.
- **capacity**: `number` - Capacity for material accumulation.
- **minSlope**: `number` - Minimum slope for erosion.
- **gravity**: `number` - Gravity factor affecting erosion dynamics.

### BrushSettings
- **size**: `number` - Size of the brush for modifying terrain.
- **strength**: `number` - Strength of the brush effect.
- **mode**: `'raise' | 'lower' | 'smooth' | 'plateau'` - Mode of terrain modification.
- **falloff**: `number` - Falloff rate for brush effects.

## Return Values
The component does not return values but rather updates the UI based on user interactions, generating terrain in real-time.

## Examples
```tsx
<TerrainGenerator />
```

This will render a basic terrain generator with default parameters allowing for interactive terrain modification. Adjust the parameters through the UI controls to see immediate changes in the generated terrain.