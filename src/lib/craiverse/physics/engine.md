# Build CRAIverse Physics Simulation API

# CRAIverse Physics Simulation API

## Purpose
The CRAIverse Physics Simulation API provides functionality for simulating rigid bodies and fluid dynamics in a 3D space. It enables users to define physical entities, manipulate their properties, and handle collisions within a simulated environment.

## Usage
To utilize the Physics Engine, instantiate the `PhysicsEngine` class in your application. The engine processes physics simulations from specified world states and manages various physical entities like rigid bodies and fluid particles.

### Example
```typescript
import { PhysicsEngine } from './src/lib/craiverse/physics/engine';

const physicsEngine = new PhysicsEngine('world-id');

// Add bodies, update simulation, and handle collisions
```

## Parameters/Props

### `PhysicsEngine`
- **Constructor**: `constructor(private worldId: string)`

#### Props
- `fixedTimeStep` (number): The time step used for the simulation, set at 1/60 seconds for 60 FPS.
- `maxSubSteps` (number): Maximum number of sub-steps per frame for the physics update.
- `bodies` (Map<string, RigidBody>): Stores rigid bodies indexed by their IDs.
- `fluidParticles` (Map<string, FluidParticle>): Stores fluid particles indexed by their IDs.
- `octree` (OctreeNode | null): Spatial partitioning structure for optimizing collision detection.
- `predictionFrames` (Map<number, PredictionFrame>): Stores frames for predictive simulations.
- `lagCompensationBuffer` (PhysicsState[]): Buffer for storing historical state data for lag compensation.

## Return Values
The methods within the `PhysicsEngine` class manipulate and return various physical states, collision events, or updates. Key return types include:
- **CollisionEvent**: Captures details about the collision between two bodies.
- **PhysicsState**: Represents the current state of all bodies, fluid particles, and environmental forces in the simulation.
- **PredictionFrame**: Represents the predicted state of the world at a specific frame, including input and state data.

## Example Methods
### Adding a Rigid Body
```typescript
physicsEngine.addRigidBody({
  id: 'box1',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  mass: 1.0,
  restitution: 0.5,
  friction: 0.5,
  isStatic: false,
  shape: 'box',
  dimensions: { x: 1, y: 1, z: 1 },
  material: 'concrete'
});
```

### Simulate the Physics
```typescript
function update() {
  physicsEngine.step(); // Calls the simulation update with the defined time step.
}
```

### Handling Collisions
```typescript
const collisions = physicsEngine.getCollisions(); // Retrieves recent collision events.
collisions.forEach(event => {
  console.log(`Collision between ${event.bodyA} and ${event.bodyB} at ${event.point}`);
});
```

This API aims to provide a comprehensive framework for integrating physics into 3D applications, enhancing interactivity and realism in simulations.