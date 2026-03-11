# Build Interactive Agent Comparison Matrix

# AgentComparisonMatrix Component

## Purpose
The `AgentComparisonMatrix` component provides an interactive comparison interface for various agents in a marketplace. Users can select agents, view their features and pricing plans, and filter options for better decision-making.

## Usage
To use the `AgentComparisonMatrix` component, import it into your React application and pass the required props. The component enables interaction through selection and filtering of agents based on their features and prices.

```tsx
import { AgentComparisonMatrix } from '@/components/marketplace/AgentComparisonMatrix';

// Example usage in a React component
const App = () => {
  return (
    <AgentComparisonMatrix 
      selectedAgentIds={['agent1', 'agent2']}
      onAgentRemove={(agentId) => console.log('Removed agent:', agentId)}
      onComparisonExport={(format) => console.log('Exported as:', format)}
      maxAgents={5}
      className="custom-class"
    />
  );
};
```

## Parameters/Props

### AgentComparisonMatrixProps

- **selectedAgentIds** (`string[]`, optional): An array of IDs for the agents currently selected for comparison.
- **onAgentRemove** (`(agentId: string) => void`, optional): Callback function triggered when an agent is removed from the comparison. Receives the agent's ID as an argument.
- **onComparisonExport** (`(format: 'pdf' | 'csv') => void`, optional): Callback function to handle export actions; accepts the desired format as an argument (either 'pdf' or 'csv').
- **maxAgents** (`number`, optional): The maximum number of agents that can be selected for comparison. Defaults to a predefined limit.
- **className** (`string`, optional): Custom CSS class name for styling the component.

## Return Values
The component renders a structured comparison matrix showcasing agent details such as features, pricing, and reviews. It returns a JSX element representing the UI, complete with interactive features like selection and filtering.

## Examples

### Basic Example

```tsx
<AgentComparisonMatrix 
  selectedAgentIds={['agent1', 'agent2']}
  onAgentRemove={(id) => console.log(`Removed: ${id}`)}
  onComparisonExport={(format) => alert(`Exporting as: ${format}`)}
  maxAgents={3}
/>
```

### With Custom Styles

```tsx
<AgentComparisonMatrix 
  selectedAgentIds={['agent3']}
  onAgentRemove={(id) => console.log(`Agent ${id} removed`)}
  onComparisonExport={(format) => console.log(`Comparing agents in ${format} format`)}
  maxAgents={5}
  className="my-custom-class"
/>
```

### Export Options

```tsx
<AgentComparisonMatrix 
  onComparisonExport={(format) => {
    // Add export logic here
    console.log(`Exporting comparison in ${format} format.`);
  }}
/>
```

This documentation provides a clear understanding of how to implement and leverage the `AgentComparisonMatrix` component in a React application.