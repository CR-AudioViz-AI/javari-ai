# Create Agent Comparison Matrix Component

# Agent Comparison Matrix Component

## Purpose
The `AgentComparisonMatrix` component enables users to compare multiple agents based on various metrics, features, and pricing. It allows for the selection of agents, visual representation of data, and actions for exporting comparisons.

## Usage
To use the `AgentComparisonMatrix` component, import it into your React application and provide the necessary props.

```tsx
import AgentComparisonMatrix from './src/components/marketplace/agent-comparison-matrix';

// Example usage
<AgentComparisonMatrix
  selectedAgentIds={['agent1', 'agent2']}
  agents={agentsData}
  onAgentRemove={handleAgentRemove}
  onExportComparison={handleExportComparison}
/>
```

## Parameters/Props

### AgentComparisonMatrixProps
- **selectedAgentIds** (string[]): An array of IDs for the agents currently selected for comparison.
- **agents** (Agent[]): An array of agent objects containing details about each agent.
- **onAgentRemove** (function, optional): A callback function triggered when an agent is removed from the comparison list.
- **onExportComparison** (function, optional): A callback function triggered when the user opts to export the comparison data.
- **className** (string, optional): Additional CSS classes to apply to the component.

### Agent Interface
- **id** (string): Unique identifier for the agent.
- **name** (string): Name of the agent.
- **description** (string): Description of the agent.
- **avatar** (string, optional): URL to the agent's avatar image.
- **category** (string): Category the agent belongs to.
- **rating** (number): Rating of the agent (typically out of 5).
- **pricing** (object): An object containing pricing details:
  - **tier** (string): Pricing tier name.
  - **price** (number): Price value.
  - **period** (string): Pricing period ('month', 'year', or 'usage').
  - **currency** (string): Currency symbol.
- **features** (object): A record of feature names and their availability (true/false).
- **metrics** (object): An object containing performance metrics:
  - **accuracy** (number): Accuracy score.
  - **speed** (number): Speed score.
  - **reliability** (number): Reliability score.
  - **usage** (number): Usage statistics.
- **tags** (string[]): An array of tags associated with the agent.
- **isPopular** (boolean, optional): Whether this agent is popular.
- **isBestValue** (boolean, optional): Whether this agent offers the best value.

### MetricBadgeProps
- **label** (string): Label for the metric.
- **value** (number): Value of the metric to display.
- **icon** (React.ElementType): An icon component from `lucide-react` to represent the metric.
- **variant** (string, optional): A visual variant for the badge; can be 'default', 'success', 'warning', 'destructive'.

## Return Values
The `AgentComparisonMatrix` component renders a matrix layout that visually compares the selected agents based on their detailed attributes—metrics, features, and pricing—while also providing interactive actions such as agent removal and data export.

## Example
```tsx
const agentsData = [
  {
    id: 'agent1',
    name: 'Agent One',
    description: 'Description for Agent One',
    avatar: 'url_to_avatar',
    category: 'Category A',
    rating: 4.5,
    pricing: {
      tier: 'Basic',
      price: 20,
      period: 'month',
      currency: 'USD',
    },
    features: { featureA: true, featureB: false },
    metrics: { accuracy: 90, speed: 80, reliability: 85, usage: 75 },
    tags: ['popular'],
  },
  // more agents...
];
```

This component simplifies the process of comparing multiple agents in an intuitive and organized way.