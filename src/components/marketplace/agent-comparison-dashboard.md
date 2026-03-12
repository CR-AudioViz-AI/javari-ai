# Create Agent Comparison Dashboard

# Agent Comparison Dashboard

## Purpose
The `AgentComparisonDashboard` component provides a visual interface for comparing multiple agents based on various metrics and capabilities. It allows users to add or remove agents from comparison, view detailed metrics, and export the comparison data if enabled.

## Usage
To use the `AgentComparisonDashboard`, import it into your desired component and pass the appropriate props. This component is designed for scenarios where you need to compare agents in a marketplace or service context.

```tsx
import AgentComparisonDashboard from 'src/components/marketplace/agent-comparison-dashboard';

const agentIds = ["agent1", "agent2", "agent3"];
<AgentComparisonDashboard 
  agentIds={agentIds} 
  onAgentAdd={(id) => console.log("Add agent:", id)} 
  onAgentRemove={(id) => console.log("Remove agent:", id)} 
  maxComparisons={3} 
  enableExport={true} 
/>;
```

## Parameters/Props

| Prop                | Type                | Description                                                      |
|---------------------|---------------------|------------------------------------------------------------------|
| `agentIds`         | `string[]`          | Array of agent IDs to compare.                                   |
| `onAgentAdd`       | `(agentId: string) => void` | Callback function triggered when an agent is added.           |
| `onAgentRemove`    | `(agentId: string) => void` | Callback function triggered when an agent is removed.        |
| `className`        | `string`            | Optional CSS class for styling the component.                   |
| `maxComparisons`   | `number`            | Maximum number of agents that can be compared simultaneously.    |
| `enableExport`     | `boolean`           | Flag to enable or disable data export functionality.             |
| `availableAgents`   | `Agent[]`          | List of available agents that can be added for comparison.      |

## Return Values
The `AgentComparisonDashboard` component does not return values directly. Instead, it renders the UI based on the provided props and user interactions such as adding/removing agents or exporting data.

## Examples

### Basic Usage
```tsx
<AgentComparisonDashboard 
  agentIds={["agent1", "agent2"]} 
  onAgentAdd={(id) => console.log("Added:", id)} 
  onAgentRemove={(id) => console.log("Removed:", id)} 
  enableExport={true} 
/>
```

### With Maximum Comparisons
```tsx
<AgentComparisonDashboard 
  agentIds={["agent1", "agent2", "agent3"]} 
  maxComparisons={3} 
 />
```

### Custom Styling
```tsx
<AgentComparisonDashboard 
  agentIds={["agent1"]} 
  className="my-custom-class" 
/>
```

This component leverages multiple UI components from a design system and hooks for managing agent comparison logic, ensuring a responsive and interactive user experience.