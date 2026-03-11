# Implement Advanced Physics Simulation Service

# Advanced Physics Simulation Service Documentation

## Purpose
The Advanced Physics Simulation Service provides realistic physics simulations using the Bullet Physics engine within the CRAIverse. This service supports various features such as gravity, collision detection, fluid dynamics, and particle systems, while allowing for multi-threaded execution for enhanced performance.

## Usage
To utilize the Physics Simulation Service, you need to create an instance by configuring the physics world and defining the properties of the rigid bodies for simulation.

### Example Initialization
```typescript
import { PhysicsSimulationService, PhysicsWorldConfig, RigidBodyProps } from 'src/lib/services/physics/physics-simulation-service';

const config: PhysicsWorldConfig = {
  gravity: new Vector3(0, -9.81, 0),
  timestep: 0.016, // 60 FPS
  maxSubSteps: 10,
  enableCollisionDetection: true,
  enableFluidDynamics: false,
  enableParticleSystems: false,
  workerThreads: 4,
  enableDebugRenderer: true
};

const physicsService = new PhysicsSimulationService(config);

// Example of adding a rigid body
const rigidBody: RigidBodyProps = {
  id: 'ball1',
  type: 'dynamic',
  mass: 1,
  position: new Vector3(0, 10, 0),
  rotation: new Quaternion(),
  shape: 'sphere',
  material: { friction: 0.5, restitution: 0.6 },
  linearVelocity: new Vector3(1, 0, 0)
};

physicsService.addRigidBody(rigidBody);
```

## Parameters/Props

### PhysicsWorldConfig
- **gravity**: `Vector3` - The gravitational vector affecting the physics world (default: [0, -9.81, 0]).
- **timestep**: `number` - The simulation timestep in seconds.
- **maxSubSteps**: `number` - Maximum substeps per frame during simulation.
- **enableCollisionDetection**: `boolean` - Flag to enable or disable collision detection.
- **enableFluidDynamics**: `boolean` - Flag to enable or disable fluid dynamics simulation.
- **enableParticleSystems**: `boolean` - Flag to enable or disable particle systems simulation.
- **workerThreads**: `number` - Number of worker threads for multi-threaded execution.
- **enableDebugRenderer**: `boolean` - Flag to enable debug rendering for visualization.

### RigidBodyProps
- **id**: `string` - Unique identifier for the rigid body.
- **type**: `'static' | 'dynamic' | 'kinematic'` - Type of the body (static, dynamic, or kinematic).
- **mass**: `number` - Mass of the body in kilograms (0 for static bodies).
- **position**: `Vector3` - Initial position of the rigid body.
- **rotation**: `Quaternion` - Initial rotation of the rigid body.
- **shape**: `CollisionShape` - The collision shape type for the body.
- **material**: `PhysicsMaterial` - Material properties such as friction and restitution.
- **linearVelocity**: `Vector3` (optional) - Initial linear velocity of the body.
- **angularVelocity**: `Vector3` (optional) - Initial angular velocity of the body.
- **linearDamping**: `number` (optional) - Linear damping factor.

## Return Values
The service will return instances of simulated objects, maintain the state of the physics world, and allow for real-time updates and interactions based on the parameters set in the configuration.

## Examples
Add a static floor:
```typescript
const floor: RigidBodyProps = {
  id: 'floor',
  type: 'static',
  mass: 0,
  position: new Vector3(0, 0, 0),
  rotation: new Quaternion(),
  shape: 'box',
  material: { friction: 0.8, restitution: 0.2 }
};

physicsService.addRigidBody(floor);
```

Run the simulation loop:
```typescript
function update() {
  physicsService.update(); // Update physics world
  requestAnimationFrame(update);
}

update();
```