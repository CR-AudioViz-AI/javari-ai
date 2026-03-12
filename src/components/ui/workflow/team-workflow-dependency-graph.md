# Create Team Workflow Dependency Graph

# Team Workflow Dependency Graph

## Purpose
The `TeamWorkflowDependencyGraph` component visualizes the dependencies and executions of a workflow team using a dependency graph. It displays agents, their statuses, and the data flows between them, providing an interactive tool for monitoring team activity and performance.

## Usage
To use the `TeamWorkflowDependencyGraph`, import the component and pass the required props defining the agents, executions, and data flows within the workflow.

```tsx
import TeamWorkflowDependencyGraph from 'src/components/ui/workflow/team-workflow-dependency-graph';

const agents = [...]; // Array of Agent objects
const executions = [...]; // Array of WorkflowExecution objects
const dataFlows = [...]; // Array of DataFlow objects

const MyComponent = () => (
  <TeamWorkflowDependencyGraph 
    agents={agents} 
    executions={executions} 
    dataFlows={dataFlows}
    className="custom-class"
    onAgentSelect={handleAgentSelect}
    onExecutionPathTrace={handlePathTrace}
    enableRealTimeUpdates={true}
    showPerformanceMetrics={true}
  />
);
```

## Parameters/Props

### `agents` (Agent[])
An array of agent objects representing the team members and their attributes.

### `executions` (WorkflowExecution[])
An array of workflow execution objects representing the statuses and metrics of each workflow.

### `dataFlows` (DataFlow[])
An array of data flow objects showing the connections and interactions between agents.

### `className` (string, optional)
A custom class name for styling the component.

### `onAgentSelect` (function, optional)
A callback function triggered when an agent is selected in the graph. Receives the selected agent as a parameter.

### `onExecutionPathTrace` (function, optional)
A callback function triggered to trace the execution path when a path is selected. Receives an array of agent IDs involved in the path.

### `enableRealTimeUpdates` (boolean, optional)
Enables real-time updates of agent statuses and metrics when set to `true`.

### `showPerformanceMetrics` (boolean, optional)
When set to `true`, displays performance metrics of agents within the graph.

## Return Values
The `TeamWorkflowDependencyGraph` component returns a JSX element rendering the dependency graph. It does not return any other data.

## Examples

### Basic Example
```tsx
<TeamWorkflowDependencyGraph 
  agents={[{id: '1', name: 'Agent 1', type: 'coordinator', status: 'running', dependencies: [], performance: {averageExecutionTime: 5, successRate: 100, currentLoad: 0}, metadata: {}}]} 
  executions={[{id: 'e1', agentId: '1', status: 'running', startTime: new Date(), duration: 10}]} 
  dataFlows={[{id: 'd1', sourceAgentId: '1', targetAgentId: '2', dataType: 'data', volume: 100, latency: 5, isActive: true}]}
/>
```

### With Callbacks and Options
```tsx
const handleAgentSelect = (agent) => {
  console.log("Selected Agent:", agent);
};

const handlePathTrace = (path) => {
  console.log("Execution Path Traced:", path);
};

<TeamWorkflowDependencyGraph 
  agents={agents} 
  executions={executions} 
  dataFlows={dataFlows} 
  onAgentSelect={handleAgentSelect} 
  onExecutionPathTrace={handlePathTrace} 
  enableRealTimeUpdates={true} 
  showPerformanceMetrics={true}
/>
```

This documentation provides a clear overview of how to implement and utilize the `TeamWorkflowDependencyGraph` component effectively.