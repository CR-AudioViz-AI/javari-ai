# Generate Agent Demo Playground UI Component

```markdown
# Agent Demo Playground Component

## Purpose
The `AgentDemoPlayground` component provides an interactive UI for demonstrating and testing AI agent capabilities. It allows users to input parameters and visualize the results based on various agent configurations, facilitating experimentation with different inputs and settings.

## Usage
To use the `AgentDemoPlayground` component, import it and include it in your JSX. Ensure you have the necessary UI components and styles available as imports.

```tsx
import AgentDemoPlayground from 'src/components/marketplace/agent-demo-playground';

function App() {
  return <AgentDemoPlayground />;
}
```

## Parameters/Props
The `AgentDemoPlayground` component accepts the following props:

- `agentCapabilities` (array of `AgentCapability`): A list of capabilities that an AI agent can execute, which includes specific parameters and their settings.

### AgentCapability Interface
```typescript
interface AgentCapability {
  id: string;             // Unique identifier for the capability
  name: string;           // User-friendly name of the capability
  description: string;    // Brief description of the capability
  inputType: string;      // Type of input (e.g., 'text', 'file')
  outputType: string;     // Type of expected output (e.g., 'text', 'image')
  parameters: AgentParameter[]; // List of parameters for the capability
}
```

### AgentParameter Interface
```typescript
interface AgentParameter {
  id: string;             // Unique identifier for the parameter
  name: string;           // User-friendly name of the parameter
  type: string;           // Type of the parameter (e.g., 'string', 'boolean')
  description: string;    // Description of what the parameter does
  defaultValue: any;      // Default value for the parameter
  required: boolean;      // Indicates if the parameter is required
  options?: string[];     // Optional: list of selectable options for 'select' type
  min?: number;           // Optional: minimum value for 'range' type
  max?: number;           // Optional: maximum value for 'range' type
  step?: number;          // Optional: step increment for 'range' type
}
```

## Return Values
The `AgentDemoPlayground` component returns a render of the playground UI. It organizes controls for user input along with sections to display output results.

## Examples
Here’s how you might define and render the `AgentDemoPlayground` component with sample capabilities:

```tsx
const agentCapabilities = [
  {
    id: 'text-analysis',
    name: 'Text Analysis',
    description: 'Analyzes input text and provides insights.',
    inputType: 'text',
    outputType: 'json',
    parameters: [
      {
        id: 'text-input',
        name: 'Input Text',
        type: 'string',
        description: 'Text to be analyzed.',
        defaultValue: '',
        required: true
      },
      {
        id: 'detailed-report',
        name: 'Detailed Report',
        type: 'boolean',
        description: 'Generate detailed analysis report.',
        defaultValue: false,
        required: false
      }
    ]
  }
];

function App() {
  return <AgentDemoPlayground agentCapabilities={agentCapabilities} />;
}
```

This setup allows users to input text and toggle options to explore the capabilities of the associated AI agent.
```