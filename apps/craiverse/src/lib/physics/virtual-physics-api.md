# Build Virtual Physics Simulation API

# Virtual Physics Simulation API Documentation

## Purpose
The Virtual Physics Simulation API provides an interface for simulating real-time physics interactions in a 3D environment. This API enables developers to create and manipulate rigid bodies, fluid particles, and handle collision events, with customizable physics world settings.

## Usage
To use the Virtual Physics Simulation API, instantiate a `PhysicsWorld` with the desired configuration. You can then add rigid bodies and fluid particles, update the physics simulation, and retrieve collision events or performance metrics.

## Parameters/Props

### PhysicsWorldConfig
- **gravity**: `Vector3` - The gravity vector applied to the physics world.
- **timeScale**: `number` - The scale at which time progresses in the simulation.
- **maxSubSteps**: `number` - The maximum number of sub-steps for physics calculations.
- **fixedTimeStep**: `number` - The time step duration for each update in milliseconds.
- **enableFluids**: `boolean` - Toggle for enabling fluid simulation.
- **enableDebug**: `boolean` - Toggle for enabling debug visualization.

### RigidBodyConfig
- **id**: `string` - Unique identifier for the rigid body.
- **mass**: `number` - Mass of the body.
- **velocity**: `Vector3` - Initial velocity of the body.
- **angularVelocity**: `Vector3` - Initial angular velocity of the body.
- **friction**: `number` - Coefficient of friction.
- **restitution**: `number` - Coefficient of restitution (bounciness).
- **isKinematic**: `boolean` - Whether the body is kinematic.
- **shape**: `'box' | 'sphere' | 'capsule' | 'mesh'` - Shape type of the body.
- **dimensions**: `Vector3` - Dimensions of the shape.

### CollisionEvent
- **bodyA**: `string` - ID of the first body involved in the collision.
- **bodyB**: `string` - ID of the second body involved in the collision.
- **contactPoint**: `Vector3` - Point of contact on the bodies.
- **normal**: `Vector3` - Normal vector at the point of contact.
- **impulse**: `number` - Collision impact impulse.
- **timestamp**: `number` - Time at which the collision occurred.

### FluidParticle
- **id**: `string` - Unique identifier for the fluid particle.
- **position**: `Vector3` - Position of the fluid particle.
- **velocity**: `Vector3` - Velocity of the fluid particle.
- **density**: `number` - Density of the fluid particle.
- **pressure**: `number` - Pressure exerted by the fluid particle.
- **mass**: `number` - Mass of the fluid particle.

### PerformanceMetrics
- **frameTime**: `number` - Time taken to render a frame.
- **physicsCpuTime**: `number` - Processing time for physics calculations.
- **collisionCount**: `number` - Total number of collisions detected in the frame.
- **activeBodyCount**: `number` - Total count of active rigid bodies.
- **fluidParticleCount**: `number` - Total count of fluid particles.

## Return Values
The API returns various outputs such as performance metrics and collision events upon simulation updates. Configuration and manipulation functions may return success statuses or updated objects.

## Examples
```typescript
// Instantiate Physics World
const physicsConfig: PhysicsWorldConfig = {
  gravity: { x: 0, y: -9.81, z: 0 },
  timeScale: 1,
  maxSubSteps: 10,
  fixedTimeStep: 16,
  enableFluids: true,
  enableDebug: false
};

const physicsWorld = new PhysicsWorld(physicsConfig);

// Adding a rigid body
const bodyConfig: RigidBodyConfig = {
  id: 'body1',
  mass: 10,
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  friction: 0.5,
  restitution: 0.3,
  isKinematic: false,
  shape: 'box',
  dimensions: { x: 1, y: 1, z: 1 }
};

physicsWorld.addRigidBody(bodyConfig);

// Simulate physics update
physicsWorld.update();
```