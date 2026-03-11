# Build CRAIverse Terrain Generation Interface

# TerrainGenerationInterface Documentation

## Purpose
The `TerrainGenerationInterface` component provides an interactive UI for generating and customizing terrain in a 3D environment using React and Three.js. It allows users to adjust various terrain parameters, save and load presets, and visualize the terrain interactively in real-time.

## Usage

To use the `TerrainGenerationInterface`, simply import and include it within your React application. Ensure that you have installed dependencies such as `@react-three/fiber` and `@react-three/drei`.

```tsx
import TerrainGenerationInterface from 'src/components/craiverse/terrain/TerrainGenerationInterface';

function App() {
  return (
    <div>
      <TerrainGenerationInterface />
    </div>
  );
}
```

## Parameters/Props

The `TerrainGenerationInterface` does not accept any props directly. It manages its internal state, including parameters for terrain generation and environmental settings.

### Terrain Parameters
The following parameters are utilized in the terrain generation:

- `seed`: Number to seed the terrain generation algorithm.
- `octaves`: Number of layers used in noise generation.
- `frequency`: Frequency for terrain features.
- `amplitude`: Amplitude for terrain height variations.
- `persistence`: Determines how amplitude decreases for each octave.
- `lacunarity`: The frequency multiplier for subsequent octaves.
- `ridgeOffset`: Offset applied to ridge noise generation.
- `ridgeGain`: Gain for ridge noise.
- `erosionStrength`: Influences the strength of terrain erosion effects.
- `erosionRadius`: Radius for erosion operation.
- `thermalErosion`: Amount of thermal erosion to apply.
- `hydraulicErosion`: Amount of hydraulic erosion to apply.

### Material Configuration
Materials used for rendering terrain can be defined as follows:

- `id`: Unique identifier for the material.
- `name`: Display name for the material.
- `color`: Base color of the material.
- `roughness`: Roughness value for the material surface.
- `metalness`: Metalness factor of the material texture.
- `normalScale`: Scale of the normal map.
- `heightRange`: Range of height values for the material.
- `blendWidth`: Width of blending between materials.

### Environmental Configuration
Environmental settings affecting the terrain rendering include:

- `sunIntensity`: Intensity of the sun light source.
- `sunPosition`: Position of the sun in the scene defined as a 3D coordinate array.
- `ambientIntensity`: Overall ambient light intensity.
- `fogDensity`: Density of fog in the scene.
- `fogColor`: Color of the fog.
- `skyboxType`: Type of skybox to render (options: 'clear', 'cloudy', 'sunset', 'night').
- `windStrength`: Strength of wind applied in the environment.
- `windDirection`: Direction of the wind defined as a 2D coordinate array.

## Return Values
The `TerrainGenerationInterface` does not return any values. It renders the interactive UI elements and manages the terrain generation process internally.

## Examples

### Basic Usage Example

To initialize a basic terrain generation interface:

```tsx
import TerrainGenerationInterface from 'src/components/craiverse/terrain/TerrainGenerationInterface';

const App = () => {
  return (
    <div style={{ height: '100vh' }}>
      <TerrainGenerationInterface />
    </div>
  );
};

export default App;
```

### Customize Terrain Parameters

Users can interact with sliders and other elements in the UI to adjust terrain parameters like this:

```tsx
// User interfaces for adjusting various terrain parameters will be available
// within the TerrainGenerationInterface component.
```

### Saving and Loading Terrain Presets

In the UI, you can access functionality to save your custom terrain settings and load them later using the presets feature, enhancing workflow and usability. 

This is managed automatically within the component, with options available through UI interactions.