# Implement CRAIverse Physics Engine API

```markdown
# CRAIverse Physics Engine API Documentation

## Purpose
The CRAIverse Physics Engine API provides a comprehensive physics simulation system optimized for real-time performance. It allows for the creation and manipulation of rigid bodies, soft bodies, and fluid simulations within a 3D environment.

## Usage
To utilize the CRAIverse Physics Engine, instantiate a physics world, configure rigid bodies and particles, and then step the simulation frame by frame. This engine supports various collision shapes and enables customization of physical properties for objects.

## Parameters/Props

### Core Types
- **`Vec3`**: Represents a 3D vector with `x`, `y`, and `z` coordinates.
- **`Quaternion`**: Represents rotation in 3D space as four components.
- **`Transform`**: Combines position, rotation, and scale of a rigid body.
- **`AABB`**: Axis-Aligned Bounding Box defined by minimum and maximum corners.
- **`CollisionShape`**: Defines the shape of an object for collision detection. Properties include:
  - `type`: Type of shape (`box`, `sphere`, `capsule`, `mesh`).
  - `bounds`: The AABB representing the shape’s spatial boundaries.
  - `data`: Optional additional data for shape configuration.

- **`RigidBodyConfig`**: Configuration settings for a rigid body, including:
  - `id`: Unique identifier for the body.
  - `transform`: Transform properties.
  - `shape`: Associated collision shape.
  - `mass`: Mass of the body.
  - `velocity`: Current linear velocity.
  - `angularVelocity`: Current angular velocity.
  - `isStatic`: Whether the body is static.
  - `restitution`, `friction`, `linearDamping`, `angularDamping`: Physical properties affecting interactions.

- **`ParticleConfig`**: Configuration for individual particles in fluid simulations.
- **`FluidParticle`**: Extends `ParticleConfig` to include properties relevant to fluid dynamics.
  
- **`PhysicsWorldConfig`**: General configuration for the physics world, including:
  - `gravity`: The gravity vector.
  - `timeStep`: The duration of each simulation step.
  - `maxSubSteps`: Maximum sub-steps for increased accuracy.
  - `spatialGridSize`: For spatial partitioning.
  - `particleCount`: Number of particles for simulation.
  - `enableFluidDynamics`: Enable or disable fluid simulation.
  - `enableMultithreading`: Enable multithreaded processing.

### Vector Math Utilities
- **`Vec3Utils`**: A utility class for vector operations, including methods like:
  - `create(x: number, y: number, z: number): Vec3`: Create a new Vec3 instance.
  - `add(a: Vec3, b: Vec3): Vec3`: Add two vectors.
  - `subtract(a: Vec3, b: Vec3): Vec3`: Subtract two vectors.
  - `multiply(v: Vec3, scalar: number): Vec3`: Scale a vector by a scalar.

## Return Values
Certain methods may return instances of the defined types (e.g., `Vec3`, `RigidBodyConfig`) or perform actions without returning values (e.g., updating simulation states).

## Examples

### Example 1: Creating a Physics World
```typescript
const worldConfig: PhysicsWorldConfig = {
  gravity: Vec3Utils.create(0, -9.81, 0),
  timeStep: 0.016,
  maxSubSteps: 8,
  spatialGridSize: 100,
  particleCount: 200,
  enableFluidDynamics: true,
  enableMultithreading: false
};

const physicsWorld = new PhysicsWorld(worldConfig);
```

### Example 2: Adding a Rigid Body
```typescript
const bodyConfig: RigidBodyConfig = {
  id: 'box1',
  transform: {
    position: Vec3Utils.create(0, 0, 0),
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: Vec3Utils.create(1, 1, 1)
  },
  shape: {
    type: 'box',
    bounds: { min: Vec3Utils.create(-0.5, -0.5, -0.5), max: Vec3Utils.create(0.5, 0.5, 0.5) },
    data: null
  },
  mass: 1,
  velocity: Vec3Utils.create(0, 0, 0),
  angularVelocity: Vec3Utils.create(0, 0, 0),
  isStatic: false,
  restitution: 0.5,
  friction