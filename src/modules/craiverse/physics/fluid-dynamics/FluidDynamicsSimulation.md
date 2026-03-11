# Build CRAIverse Fluid Dynamics Simulation Module

# FluidDynamicsSimulation Module Documentation

## Purpose
The `FluidDynamicsSimulation` module implements a fluid dynamics simulation using the Smoothed Particle Hydrodynamics (SPH) method. It models fluid particles, boundary conditions, and simulates fluid interaction in a 3D environment using React and Three.js.

## Usage
To use the `FluidDynamicsSimulation` module, import it into your React component and supply the necessary parameters. The module handles the simulation lifecycle, including setup, updates, and rendering.

```tsx
import { FluidDynamicsSimulation } from './src/modules/craiverse/physics/fluid-dynamics/FluidDynamicsSimulation';
```

## Parameters/Props

### FluidParameters
- **restDensity**: number - The rest density of the fluid.
- **gasConstant**: number - The gas constant for pressure calculation.
- **viscosity**: number - The viscosity of the fluid.
- **surfaceTension**: number - The surface tension coefficient.
- **damping**: number - The damping factor for motion.
- **gravity**: THREE.Vector3 - The gravitational force vector.
- **timeStep**: number - The time step for simulation updates.
- **kernelRadius**: number - The radius for the SPH kernel.
- **maxParticles**: number - Maximum number of fluid particles to simulate.

### BoundaryCondition
- **type**: 'wall' | 'inlet' | 'outlet' | 'periodic' - Type of boundary condition.
- **position**: THREE.Vector3 - The position of the boundary.
- **normal**: THREE.Vector3 - The normal vector for the boundary.
- **velocity**: THREE.Vector3 (optional) - Inflow velocity for inlet conditions.
- **temperature**: number (optional) - Temperature at the boundary.

### PerformanceMetrics
Returns simulation performance metrics:
- **fps**: number - Frames per second of the simulation.
- **particleCount**: number - Current number of fluid particles.
- **computeTime**: number - Time taken for computations.
- **renderTime**: number - Time taken to render each frame.
- **memoryUsage**: number - Memory usage of the simulation.
- **gpuUtilization**: number - GPU resource utilization.

## Return Values
The `FluidDynamicsSimulation` component does not return any values directly. It handles its own internal state and lifecycle, updating the rendered scene based on the simulation state.

## Examples

### Basic Fluid Simulation
```tsx
const fluidParams = {
  restDensity: 1000,
  gasConstant: 100,
  viscosity: 0.1,
  surfaceTension: 0.05,
  damping: 0.5,
  gravity: new THREE.Vector3(0, -9.81, 0),
  timeStep: 0.016,
  kernelRadius: 0.1,
  maxParticles: 10000,
};

const FluidSim = () => (
  <FluidDynamicsSimulation parameters={fluidParams} />
);
```

### Adding Boundary Conditions
```tsx
const boundaries = [
  {
    type: 'wall',
    position: new THREE.Vector3(0, 0, 0),
    normal: new THREE.Vector3(0, 1, 0),
  },
  {
    type: 'inlet',
    position: new THREE.Vector3(1, 1, 0),
    normal: new THREE.Vector3(-1, 0, 0),
    velocity: new THREE.Vector3(1, 0, 0),
  },
];

// Use FluidDynamicsSimulation with boundary props
const FluidSimWithBounds = () => (
  <FluidDynamicsSimulation parameters={fluidParams} boundaries={boundaries} />
);
```

This documentation provides concisely the necessary information for utilizing the Fluid Dynamics Simulation module within your React applications, ensuring clarity and ease of integration.