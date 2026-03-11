# Build CRAIverse Physics Simulation Service

# CRAIverse Physics Simulation Service Documentation

## Purpose
The **CRAIverse Physics Simulation Service** provides a framework for simulating physics in 3D environments. It supports rigid body dynamics, particle systems, fluid simulations, and collision detection using a variety of physics materials and shapes.

## Usage
Instantiate the `PhysicsSimulationService`, create rigid bodies and particle systems, and start the simulation process by updating the simulation state based on time steps.

## Parameters/Props

### Interfaces
- **Vector3**
  - Represents a 3D vector with properties:
    - `x`: number (X coordinate)
    - `y`: number (Y coordinate)
    - `z`: number (Z coordinate)

- **Quaternion**
  - Represents rotation in 3D with properties:
    - `x`: number
    - `y`: number
    - `z`: number
    - `w`: number

- **AABB**
  - Defines an Axis-Aligned Bounding Box for collision detection with properties:
    - `min`: Vector3 (minimum corner)
    - `max`: Vector3 (maximum corner)

- **PhysicsMaterial**
  - Defines material properties for physics objects:
    - `density`: number
    - `restitution`: number
    - `friction`: number
    - `viscosity`: number (optional)

- **RigidBody**
  - Represents a physical object in simulation:
    - `id`: string (unique identifier)
    - `position`: Vector3
    - `rotation`: Quaternion
    - `velocity`: Vector3
    - `angularVelocity`: Vector3
    - `mass`: number
    - `inverseMass`: number
    - `material`: PhysicsMaterial
    - `isStatic`: boolean (static or dynamic)
    - `isActive`: boolean
    - `bounds`: AABB
    - `forces`: Vector3[] (applied forces)
    - `torques`: Vector3[] (applied torques)
    - `shape`: CollisionShape

- **CollisionShape**
  - Represents different collision shapes:
    - **Sphere**: `{ type: 'sphere', radius: number }`
    - **Box**: `{ type: 'box', extents: Vector3 }`
    - **Plane**: `{ type: 'plane', normal: Vector3, distance: number }`
    - **Mesh**: `{ type: 'mesh', vertices: Vector3[], indices: number[] }`

- **ParticleSystemConfig**
  - Configuration for particle systems:
    - `maxParticles`: number
    - `emissionRate`: number
    - `lifetime`: number
    - `startVelocity`: Vector3
    - `gravity`: Vector3
    - `damping`: number
    - `size`: number
    - `color`: [number, number, number, number]

- **Particle**
  - Represents an individual particle:
    - `position`: Vector3
    - `velocity`: Vector3
    - `lifetime`: number
    - `age`: number
    - `size`: number
    - `color`: [number, number, number, number]
    - `active`: boolean

- **FluidParticle**
  - Represents a particle used in Smoothed Particle Hydrodynamics (SPH) simulations:
    - `position`: Vector3
    - `velocity`: Vector3
    - `density`: number
    - `pressure`: number
    - `force`: Vector3
    - `mass`: number
    - `id`: number

- **GravityField**
  - Configuration for a gravity field:
    - `position`: Vector3

## Return Values
The service will manage and compute physics states through its various methods, returning updated positions, velocities, and simulation states for each frame of the simulation.

## Examples
1. **Creating a Rigid Body:**
   ```typescript
   const rigidBody: RigidBody = {
       id: 'body1',
       position: { x: 0, y: 0, z: 0 },
       rotation: { x: 0, y: 0, z: 0, w: 1 },
       velocity: { x: 0, y: 0, z: 0 },
       angularVelocity: { x: 0, y: 0, z: 0 },
       mass: 5,
       inverseMass: 0.2,
       material: { density: 1, restitution: 0.5, friction: 0.5 },
       isStatic: false,
       isActive: true,
       bounds: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: