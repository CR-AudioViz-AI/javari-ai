# Create Interactive Scaling Topology Visualizer

# ScalingTopologyVisualizer Documentation

## Purpose
The `ScalingTopologyVisualizer` component provides an interactive visualization of a service architecture, displaying various nodes such as services, databases, load balancers, and gateways. It enables users to monitor real-time metrics like CPU usage, memory usage, and network traffic, as well as manage scaling events and analyze performance bottlenecks.

## Usage
To use the `ScalingTopologyVisualizer` component, include it in your React application as follows:

```tsx
import ScalingTopologyVisualizer from '@/components/visualization/ScalingTopologyVisualizer';

function App() {
  return (
    <div>
      <h1>Service Scaling Topology</h1>
      <ScalingTopologyVisualizer />
    </div>
  );
}
```

## Parameters/Props
- **nodes** (TopologyNode[]): An array containing the topology nodes to be visualized.
- **links** (TopologyLink[]): An array of links representing connections between the nodes.
- **scalingEvents** (ScalingEvent[]): An array of scaling events that have occurred in the topology.
- **bottlenecks** (Bottleneck[]): Optional, an array of identified bottlenecks in the system.

### Node Structure
Each `TopologyNode` object contains:
- `id` (string): Unique identifier for the node.
- `name` (string): Display name of the node.
- `type` (string): Type of the node (service, database, etc.).
- `status` (string): Current status of the node (healthy, warning, critical, scaling).
- `replicas` (number): Current number of replicas.
- `maxReplicas` (number): Maximum number of replicas allowed.
- `minReplicas` (number): Minimum number of replicas allowed.
- Metrics: (cpuUsage, memoryUsage, networkUsage, requestsPerSecond, responseTime, errorRate).

### Link Structure
Each `TopologyLink` object contains:
- `source` (string | TopologyNode): Source node identifier or node object.
- `target` (string | TopologyNode): Target node identifier or node object.
- `bandwidth` (number): Bandwidth of the link.
- `latency` (number): Latency of the link.
- `errorCount` (number): Number of errors on the link.
- `requestCount` (number): Number of requests passing through the link.

### Scaling Event Structure
Each `ScalingEvent` object contains:
- `id` (string): Unique identifier for the scaling event.
- `serviceId` (string): ID of the service being managed.
- `action` (string): Action taken (scale_up, scale_down, auto_scale).
- `fromReplicas` (number): Initial number of replicas before scaling.
- `toReplicas` (number): Target number of replicas after scaling.
- `reason` (string): Reason for scaling.
- `timestamp` (string): Time when the event occurred.
- `duration` (number): Duration taken for the scaling action (optional).
- `success` (boolean): Status of the scaling action.

## Return Values
The component does not return a value; instead, it renders an interactive visualization directly to the DOM.

## Examples
Here’s a simple example of how to use the `ScalingTopologyVisualizer` component with sample data:

```tsx
const nodes = [
  { id: '1', name: 'Service A', type: 'service', status: 'healthy', replicas: 3, maxReplicas: 5, minReplicas: 1, cpuUsage: 20, memoryUsage: 30, networkUsage: 15, requestsPerSecond: 100, responseTime: 300, errorRate: 0 },
  // Add more nodes...
];

const links = [
  { source: '1', target: '2', bandwidth: 100, latency: 10, errorCount: 0, requestCount: 1000 },
  // Add more links...
];

const scalingEvents = [
  { id: 'e1', serviceId: '1', action: 'scale_up', fromReplicas: 3, toReplicas: 4, reason: 'Increased traffic', timestamp: '2023-10-01T12:00:00Z', success: true },
  // Add more events...
];

<ScalingTopologyVisualizer nodes={nodes} links={links} scalingEvents={scalingEvents} />;
```

This configuration allows users to visualize the scaling topology and monitor performance metrics effectively.