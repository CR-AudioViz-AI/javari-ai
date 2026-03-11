# Create Agent Performance Comparison Widget

```markdown
# Agent Performance Comparison Widget

## Purpose
The Agent Performance Comparison widget is a React component designed to visualize and compare the performance metrics of different agents in an AI marketplace. It provides users with a user-friendly interface to select agents, view their performance data, and perform statistical A/B testing on different metrics.

## Usage
To use the `AgentPerformanceComparison` component within your application, import it and provide the required props. The component renders a set of visualizations including charts and metrics that summarize agent performance.

### Example
```tsx
import AgentPerformanceComparison from './src/components/ai-marketplace/AgentPerformanceComparison';

const agents = [
  { id: '1', name: 'Agent A', version: '1.0', color: '#FF5733' },
  { id: '2', name: 'Agent B', version: '1.1', color: '#33FF57' },
];

const performanceData = [
  { timestamp: '2023-10-01', agentId: '1', latency: 200, throughput: 300, successRate: 95, errorRate: 5, costPerRequest: 0.1, accuracyScore: 90, memoryUsage: 128, cpuUsage: 35 },
  { timestamp: '2023-10-01', agentId: '2', latency: 180, throughput: 320, successRate: 97, errorRate: 3, costPerRequest: 0.08, accuracyScore: 92, memoryUsage: 120, cpuUsage: 30 },
];

const App = () => (
  <AgentPerformanceComparison
    agentIds={['1', '2']}
    agents={agents}
    performanceData={performanceData}
  />
);
```

## Parameters / Props

| Prop                        | Type                     | Required | Description                                                                                  |
|-----------------------------|--------------------------|----------|----------------------------------------------------------------------------------------------|
| `agentIds`                 | string[]                 | Yes      | Array of agent IDs to be compared in the widget.                                           |
| `agents`                   | Agent[]                  | Yes      | Array of agent objects containing the agent details such as id, name, version, and color.   |
| `performanceData`          | PerformanceMetric[]      | Yes      | Array of performance metrics for the agents, including latency, throughput, success rate, etc. |
| `abTestResults`            | ABTestResult[]           | No       | Optional array of A/B test results for statistical comparison of agent performance.          |
| `onTimeRangeChange`        | (timeRange: string) => void | No    | Callback function triggered when the time range for the performance data changes.            |

## Return Values
The component returns a visual representation of the selected agents' performance metrics, including charts and statistics, allowing users to analyze and compare performance effectively.

## Components Used
- Charts: LineChart, BarChart, RadarChart from `recharts`
- UI Elements: Card, Button, Select, Progress, Tabs, Badge from a custom UI library.

## Important Notes
- Ensure that the `performanceData` is in synch with the provided `agentIds` for accurate comparisons.
- The visual representations adapt based on the selected metrics and agents, providing a tailor-made analysis experience.
```