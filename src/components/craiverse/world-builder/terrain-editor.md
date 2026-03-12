# Create World Builder Terrain Editor

# World Builder Terrain Editor

## Purpose
The **World Builder Terrain Editor** is a React component designed for creating and editing terrains in a 3D environment. It provides various tools and settings for terrain manipulation, including brush settings, texture application, and height adjustments.

## Usage
To use the Terrain Editor, simply import and embed the component within your React application. Ensure you have the necessary dependencies installed for React Three Fiber and the UI components.

```tsx
import TerrainEditor from 'src/components/craiverse/world-builder/terrain-editor';

function App() {
  return (
    <div>
      <TerrainEditor />
    </div>
  );
}
```

## Parameters / Props
The **TerrainEditor** component accepts the following props:

| Prop           | Type              | Description                                   |
|----------------|-------------------|-----------------------------------------------|
| `initialTerrain` | Array<TerrainPoint> | An optional initial terrain configuration consisting of terrain points. |

### TerrainPoint Interface
Represents a point on the terrain.

```typescript
interface TerrainPoint {
  x: number;    // X-coordinate
  y: number;    // Y-coordinate
  height: number; // Height value for the point
  texture?: string; // Optional texture identifier for the point
}
```

### BrushSettings Interface
Configures the brush used for terrain modifications.

```typescript
interface BrushSettings {
  size: number;      // Diameter of the brush
  strength: number;  // Strength of the brush effect
  falloff: number;   // Falloff gradient for the brush
  type: 'raise' | 'lower' | 'smooth' | 'flatten' | 'texture'; // Type of brush action
  texture?: string;  // Optional texture for the brush
}
```

## Return Values
The **TerrainEditor** component renders a 3D canvas using React Three Fiber for visualization and includes UI elements for user interaction. It does not return any specific values, but enables various terrain editing functionalities, and manages internal state for the terrain and brush settings.

## Examples
Here's an example of using the Terrain Editor with some initial terrain data:

```tsx
const initialTerrain = [
  { x: 0, y: 0, height: 10 },
  { x: 1, y: 0, height: 12 },
  { x: 0, y: 1, height: 8 },
  { x: 1, y: 1, height: 9 }
];

function App() {
  return (
    <div>
      <h1>Terrain Editor</h1>
      <TerrainEditor initialTerrain={initialTerrain} />
    </div>
  );
}
```

This sets up a basic terrain grid initialized with specific height values, ready for further manipulation through the editor’s user interface.