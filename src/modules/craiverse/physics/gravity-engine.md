# Build CRAIverse Gravity Simulation Engine

```markdown
# CRAIverse Gravity Simulation Engine

## Purpose
The CRAIverse Gravity Simulation Engine facilitates the simulation of gravitational interactions among celestial bodies within a WebGL context. It utilizes graphics acceleration for real-time rendering and calculation, making it suitable for educational, research, and entertainment applications related to astrophysics.

## Usage
To use the Gravity Engine, initialize it with a `WebGL2RenderingContext` and an optional configuration object. Then, add gravitational bodies to the simulation, and start the simulation loop.

### Example
```typescript
import { GravityEngine, GravityConfig } from './src/modules/craiverse/physics/gravity-engine';

// Initialize WebGL context (assuming a canvas element exists)
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2');

// Create simulation config
const config: GravityConfig = {
  gravitationalConstant: 6.67430e-11,
  timeStep: 0.01,
  maxBodies: 100,
  dampingFactor: 0.99,
  collisionEnabled: true,
  visualizationEnabled: true,
  softening: 1e-9,
};

// Instantiate Gravity Engine
const gravityEngine = new GravityEngine(gl, config);

// Add a gravitational body
gravityEngine.addBody({
  id: 'earth',
  name: 'Earth',
  position: new Float32Array([0, 0, 0]),
  velocity: new Float32Array([0, 0, 0]),
  acceleration: new Float32Array([0, 0, 0]),
  mass: 5.972e24,
  radius: 6371e3,
  type: 'planet',
  fixed: true,
});

// Start the simulation
gravityEngine.start();
```

## Parameters/Props

### Properties of the `GravityEngine` class:
- `gl`: WebGL2RenderingContext
- `config`: GravityConfig
- `bodies`: Map<string, GravitationalBody>
- `isRunning`: boolean
- `timeAccumulator`: number
- `orbitCalculator`: OrbitCalculator

### Interfaces
#### GravitationalBody
- `id`: string - Unique identifier for the body.
- `name`: string - Display name of the body.
- `position`: Float32Array - 3D coordinates [x, y, z].
- `velocity`: Float32Array - Current velocity [vx, vy, vz].
- `acceleration`: Float32Array - Current acceleration [ax, ay, az].
- `mass`: number - Mass of the body.
- `radius`: number - Radius of the body.
- `type`: 'planet' | 'star' | 'asteroid' | 'moon' - Type classification.
- `fixed`: boolean - Indicates if the body is fixed in space.

#### GravityConfig
- `gravitationalConstant`: number - The gravitational constant.
- `timeStep`: number - Duration of each simulation step.
- `maxBodies`: number - Maximum number of gravitational bodies allowed.
- `dampingFactor`: number - Factor for reducing velocity over time.
- `collisionEnabled`: boolean - Whether to handle collisions.
- `visualizationEnabled`: boolean - Whether to enable visualization.
- `softening`: number - Softening factor to prevent singularities.

## Return Values
The `GravityEngine` class does not return values directly from its constructor. Instead, it manipulates the internal state of the simulation and can emit events regarding simulation state changes.

## Events
- **bodyAdded**: Triggered when a body is added to the simulation.
- **simulationStep**: Triggered on each simulation step.
- **collisionDetected**: Triggered when a collision occurs, if enabled.
```