# Create Craiverse World Builder Interface

```markdown
# Craiverse World Builder Interface

## Purpose
The `WorldBuilder` component provides an interactive interface for users to build and customize 3D environments in the Craiverse platform. It leverages React features, 3D rendering via Three.js, and drag-and-drop functionalities to allow users to manipulate various world objects and environment settings effectively.

## Usage
To use the `WorldBuilder` component, simply import it into your desired React component file and include it in your JSX:

```tsx
import WorldBuilder from './src/components/craiverse/WorldBuilder';

function App() {
  return (
    <div>
      <WorldBuilder />
    </div>
  );
}
```

## Parameters/Props
The `WorldBuilder` component accepts the following props:

| Prop         | Type           | Default     | Description                                     |
|--------------|----------------|-------------|-------------------------------------------------|
| initialObjects | Array<WorldObject> | []        | An array of initial world objects to be displayed. |
| environment  | WorldEnvironment | Default values | Configuration for the initial environment settings.|

### WorldObject Interface
```typescript
interface WorldObject {
  id: string;                           // Unique identifier for the object.
  type: 'terrain' | 'building' | 'vegetation' | 'prop' | 'light'; // Type of the object.
  name: string;                         // Display name of the object.
  position: [number, number, number];   // 3D position in the world.
  rotation: [number, number, number];   // Rotation angles in radians.
  scale: [number, number, number];      // Scale factors for resizing.
  properties: Record<string, any>;      // Additional customizable properties.
  visible: boolean;                      // Visibility state of the object.
  locked: boolean;                       // Lock state of the object to prevent manipulation.
}
```

### WorldEnvironment Interface
```typescript
interface WorldEnvironment {
  skyType: 'sky' | 'hdri' | 'gradient'; // Type of sky rendering.
  sunPosition: [number, number, number]; // Position of the sun in the scene.
  sunIntensity: number;                   // Intensity of the sunlight.
  ambientIntensity: number;               // Overall ambient light intensity.
  fogDensity: number;                     // Density of fog in the scene.
  fogColor: string;                       // Color of the fog.
  gravity: number;                        // Gravity strength in the environment.
  windSpeed: number;                      // Speed of wind affecting the environment.
  timeOfDay: number;                     // Time of day in hours.
}
```

## Return Values
The `WorldBuilder` component does not return any values directly, as it primarily serves to render the UI for world building and provides functionality in response to user interactions.

## Examples
### Basic Example
```tsx
const initialObjects: WorldObject[] = [
  {
    id: '1',
    type: 'building',
    name: 'House',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    properties: {},
    visible: true,
    locked: false,
  },
];

const environmentSettings: WorldEnvironment = {
  skyType: 'gradient',
  sunPosition: [1, 1, 1],
  sunIntensity: 1,
  ambientIntensity: 0.5,
  fogDensity: 0.1,
  fogColor: '#ffffff',
  gravity: -9.81,
  windSpeed: 1,
  timeOfDay: 12,
};

function App() {
  return (
    <WorldBuilder initialObjects={initialObjects} environment={environmentSettings} />
  );
}
```
This sets up a simple world with a single building object and specific environmental configurations.
```