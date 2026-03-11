# Create CRAIverse VR Environment Builder

# CRAIverse VR Environment Builder

## Purpose
The CRAIverse VR Environment Builder is a React component that enables users to create and manage 3D virtual environments in a VR setting. It provides tools for adding and editing scene objects with customizable properties, physics, lighting configurations, and environmental settings. 

## Usage
To use the CRAIverse VR Environment Builder, import the component into your application and render it within a `Canvas` component provided by `@react-three/fiber`. The builder allows users to dynamically create and manipulate 3D scenes.

### Example
```tsx
import React from 'react';
import { Canvas } from '@react-three/fiber';
import VRBuilder from 'src/modules/craiverse/vr-environment-builder';

function App() {
  return (
    <Canvas>
      <VRBuilder />
    </Canvas>
  );
}

export default App;
```

## Parameters/Props
The VR Environment Builder may have the following customizable props:

- **objects**: Array of `SceneObject` which includes all objects in the scene.
- **lightingConfig**: An object containing settings for scene lighting (of type `LightingConfig`).
- **environmentConfig**: An object to configure the virtual environment (of type `EnvironmentConfig`).

### SceneObject
```typescript
interface SceneObject {
  id: string;             // Unique identifier for the object
  name: string;           // Name of the object
  type: 'primitive' | 'model' | 'light' | 'camera'; // Type of the object
  geometry: 'box' | 'sphere' | 'plane' | 'cylinder' | 'custom'; // Object shape
  position: [number, number, number]; // 3D position
  rotation: [number, number, number]; // Rotation angles
  scale: [number, number, number]; // Scaling factors
  material: MaterialProperties; // Material properties for the object
  physics?: PhysicsProperties; // Optional physics properties
  metadata?: Record<string, any>; // Additional info
}
```

### MaterialProperties
```typescript
interface MaterialProperties {
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  opacity: number;
  transparent: boolean;
  texture?: string; // Optional texture map
  normalMap?: string; // Optional normal map
}
```

### PhysicsProperties
```typescript
interface PhysicsProperties {
  type: 'static' | 'dynamic' | 'kinematic'; // Type of physics
  mass: number; // Object mass
  friction: number; // Surface friction
  restitution: number; // Bounciness
  collisionGroup: number; // Collision group index
}
```

### LightingConfig
```typescript
interface LightingConfig {
  ambientIntensity: number; // Overall ambient light intensity
  ambientColor: string; // Color of ambient light
  directionalLight: { // Directional light settings
    intensity: number;
    color: string;
    position: [number, number, number];
    castShadow: boolean;
  };
  pointLights: Array<{
    id: string;
    position: [number, number, number];
    color: string;
    intensity: number;
    decay: number;
  }>; // List of point lights
}
```

### EnvironmentConfig
```typescript
interface EnvironmentConfig {
  skybox: 'none' | 'sunset' | 'dawn' | 'night' | 'custom'; // Type of skybox
  fog: {
    enabled: boolean; // Fog enable/disable flag
    color: string; // Color of the fog
    near: number; // Near view distance for fog
    far: number; // Far view distance for fog
  };
  gravity: [number, number, number]; // Gravity vector
}
```

## Return Values
The component does not return values in the traditional sense; instead, it manages the state of the VR environment and renders the scene based on the provided configuration and interactions made by the user. 

This builder is designed to be extensible, allowing developers to integrate advanced features into their VR applications easily.