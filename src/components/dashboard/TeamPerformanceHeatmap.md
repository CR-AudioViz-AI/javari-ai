# Build Real-Time Team Performance Heatmap Component

```markdown
# Team Performance Heatmap Component

## Purpose
The Team Performance Heatmap component visualizes real-time performance metrics for team members, enabling managers to monitor and identify bottlenecks in workflow within different departments. It displays a heatmap based on various metrics such as utilization, completion rates, and bottleneck scores.

## Usage
To include the Team Performance Heatmap in your application, import the component and use it within your React component structure. Pass the needed props to customize its behavior and appearance.

```jsx
import TeamPerformanceHeatmap from 'src/components/dashboard/TeamPerformanceHeatmap';

const MyComponent = () => {
  return (
    <TeamPerformanceHeatmap 
      teamId="team-1" 
      department="Support" 
      refreshInterval={60000} 
      onAgentSelect={(agentId) => console.log(`Selected agent: ${agentId}`)} 
      onBottleneckDetected={(agentIds) => console.log(`Bottlenecks detected: ${agentIds}`)} 
    />
  );
};
```

## Parameters / Props
The component accepts the following props:

| Prop                   | Type               | Default      | Description                                                                                   |
|------------------------|--------------------|--------------|-----------------------------------------------------------------------------------------------|
| `teamId`               | `string`           | `undefined`  | The ID of the team whose performance to display.                                            |
| `department`           | `string`           | `undefined`  | The specific department to filter and display metrics for.                                   |
| `refreshInterval`      | `number`           | `60000`      | The interval in milliseconds for refreshing the heatmap data. Default is every 60 seconds. |
| `className`            | `string`           | `''`         | Additional CSS classes to apply to the root element for styling purposes.                    |
| `onAgentSelect`        | `(agentId: string) => void` | `undefined` | Callback invoked when an agent is selected.                                                |
| `onBottleneckDetected` | `(agentIds: string[]) => void` | `undefined` | Callback invoked when bottlenecks are detected, passing the affected agent IDs.             |

## Return Values
The component returns the rendered heatmap UI based on the performance metrics of the agents. It does not return any data directly but provides callbacks for external handling of events like agent selection or bottleneck detection.

## Examples
1. **Basic usage with default props:**
   ```jsx
   <TeamPerformanceHeatmap />
   ```

2. **With specific team and department configurations:**
   ```jsx
   <TeamPerformanceHeatmap teamId="team-2" department="Sales" />
   ```

3. **Using custom refresh intervals:**
   ```jsx
   <TeamPerformanceHeatmap refreshInterval={30000} />
   ```

4. **Handling agent selection and bottleneck detection:**
   ```jsx
   <TeamPerformanceHeatmap 
     onAgentSelect={(agentId) => console.log(`Selected agent: ${agentId}`)}
     onBottleneckDetected={(agentIds) => alert(`Bottlenecks detected: ${agentIds.join(', ')}`)}
   />
   ```

For best results, ensure the dataset passed contains performance metrics formatted as expected by the component.
```