# Implement Craiverse Physics Simulation Service

# Craiverse Physics Simulation Service

## Purpose
The **Craiverse Physics Simulation Service** is designed to provide advanced physics simulation capabilities for Craiverse environments. Utilizing WebAssembly and GPU acceleration, it supports features like collision detection, particle systems, and realistic environmental interactions with real-time synchronization.

## Usage
To utilize the Physics Simulation Service, you need to import and instantiate the service within your application. The service can be configured with various parameters for optimal performance depending on the specific requirements of your Craiverse environment.

### Example
```typescript
import { PhysicsSimulationService } from './src/services/craiverse/physics/PhysicsSimulationService';

const physicsService = new PhysicsSimulationService({
  gravity: { x: 0, y: -9.81, z: 0 },
  timeStep: 0.016,
  maxSubsteps: 8,
  enableGPUAcceleration: true,
  spatialPartitionSize: 10,
  particleLimit: 1000,
  enableDebugMode: false,
});

// Initialize the physics world
const worldId = physicsService.createWorld();
// Add rigid bodies, update the simulation, handle collisions, etc.
```

## Parameters/Props
The service accepts the following configuration parameters:

- `gravity: Vector3` - Represents the gravitational force applied to the simulation.
- `timeStep: number` - Duration of each simulation step.
- `maxSubsteps: number` - Maximum number of substeps to take in each frame.
- `enableGPUAcceleration: boolean` - Flag to enable or disable GPU acceleration.
- `spatialPartitionSize: number` - Size of the spatial partition grid for collision detection.
- `particleLimit: number` - Maximum number of particles in the system.
- `enableDebugMode: boolean` - Enable or disable debug mode for visualizing physics data.

## Return Values
The service returns several important values and objects:

- `createWorld(config: PhysicsConfig): number` - Creates a new physics world and returns its unique identifier.
- `addRigidBody(worldId: number, body: RigidBody): number` - Adds a rigid body to the specified world and returns its identifier.
- `removeRigidBody(worldId: number, bodyId: number): boolean` - Removes a rigid body from the world.
- `stepSimulation(worldId: number, deltaTime: number): void` - Advances the simulation by a specified time interval.
- `getCollisions(worldId: number): CollisionEvent[]` - Returns an array of collisions detected in the current simulation step.
- `updateBodyTransform(worldId: number, bodyId: number, transform: Float32Array): void` - Updates the transformation of a rigid body based on input data.
- `cleanup(worldId: number): void` - Cleans up the resources associated with the specified physics world.

## Notes
- Ensure that WebAssembly and GPU resources are properly initialized before performing operations.
- Handle collisions and updates in your game loop or simulation framework to maintain synchronization.
- Regularly call `stepSimulation` and monitor collisions to keep the physics engine responsive and accurate.