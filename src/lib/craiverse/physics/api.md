# Generate CRAIverse Physics Simulation API

# CRAIverse Physics Simulation API

## Purpose
The CRAIverse Physics Simulation API provides a robust framework for simulating physics in a 2D environment using Matter.js. It enables the creation, management, and manipulation of physical bodies and constraints, while supporting real-time updates and interactions.

## Usage
To use the PhysicsEngine class, instantiate it and use its methods to control the physics simulation. Start the simulation to begin updating it at a regular interval.

## Parameters/Props
### Constructor
- **`PhysicsEngine()`**: Initializes a new instance of the PhysicsEngine.
  
### Methods
- **`start(): void`**
  - Starts the physics simulation. Creates a runner for the engine and begins processing updates.

- **`stop(): void`**
  - Stops the running physics simulation gracefully.

- **`addBody(id: string, body: Matter.Body): void`**
  - Adds a physical body to the simulation.
  - **Parameters:**
    - `id`: A unique identifier for the body.
    - `body`: An instance of `Matter.Body` representing the physical entity.

- **`removeBody(id: string): void`**
  - Removes a body from the simulation using its unique identifier.
  - **Parameters:**
    - `id`: The unique identifier of the body to remove.

- **`getBody(id: string): Matter.Body | undefined`**
  - Retrieves a physical body from the simulation.
  - **Parameters:**
    - `id`: The unique identifier of the body.
  - **Return Value:** Returns the `Matter.Body` if found, or `undefined`.

- **`addConstraint(id: string, constraint: Matter.Constraint): void`**
  - Adds a constraint to the simulation.
  - **Parameters:**
    - `id`: A unique identifier for the constraint.
    - `constraint`: An instance of `Matter.Constraint`.

## Return Values
- Most methods do not return values. The `getBody` method returns a `Matter.Body` instance or `undefined` based on the existence of the body.

## Examples

```typescript
import { PhysicsEngine } from './src/lib/craiverse/physics/api';
import Matter from 'matter-js';

// Initialize the physics engine
const physicsEngine = new PhysicsEngine();

// Create a new body
const box = Matter.Bodies.rectangle(400, 200, 80, 80);
physicsEngine.addBody('box1', box);

// Start the physics simulation
physicsEngine.start();

// After some operations you might want to stop the engine
setTimeout(() => {
  physicsEngine.stop();
}, 5000);
```

This example demonstrates how to create a `PhysicsEngine` instance, add a box body to the simulation, and start the physics engine. The engine will run until it is manually stopped after 5 seconds.