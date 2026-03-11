# Build Agent Preview Sandbox Interface

# AgentPreviewSandbox Component Documentation

## Purpose

The `AgentPreviewSandbox` component provides an interactive interface for viewing and testing agents in a marketplace setting. It allows users to see detailed information about agents, input parameters, and execution logs. It also supports executing agents and observing their performance.

## Usage

To use the `AgentPreviewSandbox` component, import it into your React application and include it within your desired container. Make sure it is wrapped in a client-side context as it utilizes React hooks and Zustand for state management.

```tsx
import AgentPreviewSandbox from 'src/components/marketplace/AgentPreviewSandbox';

const App = () => {
  return <AgentPreviewSandbox />;
};
```

## Parameters/Props

The `AgentPreviewSandbox` component may accept the following props:

- **agents** (`Array<Agent>`): A list of agent objects to display in the sandbox. Each agent should conform to the `Agent` interface.
- **onExecute** (`function`): A callback function invoked when an agent is executed. This function should handle the execution logic.
- **initialAgentId** (`string`, optional): A string representing the default agent to be viewed/selected when the component mounts.

### Agent Interface

An agent object must have the following structure:

```tsx
interface Agent {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  parameters: AgentParameter[];
  inputTypes: string[];
  outputTypes: string[];
  maxExecutionTime: number;
  resourceLimits: {
    cpu: number;
    memory: number;
    storage: number;
  };
}
```

### AgentParameter Interface

Each agent can have the following parameters:

```tsx
interface AgentParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}
```

## Return Values

The `AgentPreviewSandbox` component renders the sandbox interface:

- Displays a list of agents available for selection.
- Shows detailed information about the selected agent including its parameters and resource limits.
- Provides an execution button to test the agent with provided parameters.
- Displays logs of past executions including info, warnings, and errors.

## Examples

```tsx
const sampleAgents = [
  {
    id: "agent-1",
    name: "Sample Agent",
    description: "An example agent for demonstration.",
    version: "1.0.0",
    category: "Data Processing",
    parameters: [
      {
        name: "inputData",
        type: "string",
        required: true,
        description: "The data to be processed by the agent.",
        defaultValue: "",
      },
    ],
    inputTypes: ["text"],
    outputTypes: ["json"],
    maxExecutionTime: 3000,
    resourceLimits: {
      cpu: 2,
      memory: 2048,
      storage: 50000,
    },
  },
];

const App = () => {
  const handleExecute = (agentId, params) => {
    console.log(`Executing agent: ${agentId} with params:`, params);
  };

  return <AgentPreviewSandbox agents={sampleAgents} onExecute={handleExecute} />;
};
```

This example shows how to utilize the `AgentPreviewSandbox` by providing sample agents and handling their execution.