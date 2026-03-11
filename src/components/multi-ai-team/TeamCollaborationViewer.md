# Build Real-Time Team Collaboration Viewer

# TeamCollaborationViewer Component Documentation

## Purpose
The `TeamCollaborationViewer` component provides a real-time visualization of team collaboration activities, allowing users to monitor agents, communications, and decision-making processes within a collaborative environment.

## Usage
To utilize the `TeamCollaborationViewer`, include it in your React application, passing the necessary props to configure its behavior and appearance.

```tsx
<TeamCollaborationViewer 
  className="your-custom-class" 
  teamId="team-123" 
  autoRefresh={true} 
  refreshInterval={5000} 
  onAgentSelect={handleAgentSelect} 
  onCommunicationClick={handleCommunicationClick}
  enableRealtimeUpdates={true} 
  maxMessages={100} 
/>
```

## Parameters / Props
| Prop                    | Type                    | Default    | Description                                                                                                   |
|-------------------------|-------------------------|------------|---------------------------------------------------------------------------------------------------------------|
| `className`             | `string`                | `undefined`| Optional custom class name for styling the component                                                          |
| `teamId`                | `string`                | `undefined`| Identifier for the team being monitored                                                                       |
| `autoRefresh`           | `boolean`               | `false`    | Controls automatic refreshing of the component's data                                                          |
| `refreshInterval`       | `number`                | `5000`     | Interval (in milliseconds) for auto-refresh when `autoRefresh` is enabled                                     |
| `onAgentSelect`         | `(agent: Agent) => void`| `undefined`| Callback function triggered when an agent is selected                                                         |
| `onCommunicationClick`   | `(communication: Communication) => void`| `undefined`| Callback function triggered when a communication is clicked                                                    |
| `enableRealtimeUpdates` | `boolean`               | `false`    | Enables real-time updates of collaboration events and metrics                                                  |
| `maxMessages`           | `number`                | `100`      | Maximum number of messages to display in the viewer                                                            |

## Return Values
The `TeamCollaborationViewer` component does not return a value directly. Instead, it renders a visual representation of the collaboration metrics, agents, and their communications.

## Examples
### Basic Example

```tsx
import { TeamCollaborationViewer } from './src/components/multi-ai-team/TeamCollaborationViewer';

function App() {
  const handleAgentSelect = (agent) => {
    console.log('Selected Agent:', agent);
  };

  const handleCommunicationClick = (communication) => {
    console.log('Clicked Communication:', communication);
  };

  return (
    <TeamCollaborationViewer 
      teamId="team-001" 
      autoRefresh={true} 
      refreshInterval={3000} 
      onAgentSelect={handleAgentSelect}
      onCommunicationClick={handleCommunicationClick}
      enableRealtimeUpdates={true}
      maxMessages={50} 
    />
  );
}

export default App;
```

### Custom Styling Example

```tsx
<TeamCollaborationViewer 
  className="custom-viewer-style" 
  teamId="team-456" 
  enableRealtimeUpdates={true} 
/>
```

This component is intended for use in applications that require real-time monitoring of team collaboration, such as project management tools, team communication platforms, or multi-agent systems. Adjust the parameters as needed to fit your specific requirements.