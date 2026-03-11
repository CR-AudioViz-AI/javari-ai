# Create Environmental Dynamics Simulation Service

# Environmental Dynamics Simulation Service

## Purpose
The `EnvironmentalDynamicsService` is designed to simulate complex environmental systems within CRAIverse worlds. It handles intricate weather patterns, ecological dynamics, and resource flows. This service is integral for creating realistic and interactive environments that respond to various simulated conditions in real time.

## Usage
To utilize the `EnvironmentalDynamicsService`, instantiate it and invoke its methods to start simulations, manage weather systems, and handle ecological interactions. The service also emits events related to simulation state changes, which can be subscribed to for real-time updates.

```typescript
import { EnvironmentalDynamicsService } from './src/services/craiverse/environmental-dynamics.service';

const envService = new EnvironmentalDynamicsService();
envService.on('simulationUpdated', (data) => {
    console.log('Simulation updated:', data);
});
envService.startSimulation('simulationId');
```

## Parameters / Props
- **activeSimulations**: `Map<string, EnvironmentalDynamics>` - Stores ongoing simulations with their unique identifiers.
- **simulationWorkers**: `Map<string, Worker>` - Manages worker instances for parallel processing of simulations.
- **weatherSystems**: `Map<string, WeatherSystem>` - Holds different weather system configurations.
- **ecologicalStates**: `Map<string, EcologicalState>` - Represents the current ecological states associated with simulations.
- **resourceFlows**: `Map<string, ResourceFlow[]>` - Tracks resource dynamics within the simulation context.
- **climateData**: `Map<string, ClimateData>` - Stores climate-related information for simulations.
- **simulationMetrics**: `Map<string, SimulationMetrics>` - Captures performance metrics of the simulations for optimization purposes.

## Return Values
The service primarily emits events for various actions within the simulation, rather than returning values directly. Events include:
- `simulationStarted`: Triggered when a simulation begins.
- `simulationStopped`: Triggered when a simulation ends.
- `simulationUpdated`: Triggered when there’s an update in the simulation state.

## Examples

### Starting a Simulation
```typescript
envService.startSimulation('simulationId');
```

### Stopping a Simulation
```typescript
envService.stopSimulation('simulationId');
```

### Subscribing to Updates
```typescript
envService.on('simulationUpdated', (metrics) => {
    console.log('New metrics received:', metrics);
});
```

### Handling Weather Systems
```typescript
const newWeatherSystem: WeatherSystem = { /* Weather system properties */ };
envService.addWeatherSystem('systemId', newWeatherSystem);
```

### Optimizing Simulations
```typescript
const metrics = envService.getSimulationMetrics('simulationId');
console.log('Simulation metrics:', metrics);
```

This documentation provides an overview of how to implement and interact with the `EnvironmentalDynamicsService`, along with the key properties and capabilities it affords for advanced environmental simulation within CRAIverse worlds.