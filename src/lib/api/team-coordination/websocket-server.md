# Generate Real-Time Team Coordination API

# Real-Time Team Coordination API

The Real-Time Team Coordination API provides functionality for managing agent interactions in a collaborative environment using WebSockets. This allows agents to join teams, update their status, request resources, and trigger workflows.

## Purpose

The API is designed to facilitate real-time communication among team members' agents, allowing them to coordinate efforts effectively. It ensures efficient status updates and resource management for ongoing tasks.

## Usage

1. **Set up the WebSocket server** to listen for incoming connections.
2. **Handle messages** from connected agents following specific schemas for various actions.
3. **Manage agent statuses and workflows** through event-driven updates.

## Parameters/Props

### WebSocketTeamServer Methods

- **constructor()**
  - Initializes the WebSocket server.

- **handleConnection(ws: WebSocket)**
  - Handles incoming WebSocket connections from agents.

### Message Schema Types

The API uses a discriminated union to validate incoming messages, which can have the following types:

1. **join_team**
   - `teamId: string` - ID of the team joining.
   - `agentId: string` - Unique identifier for the agent.
   - `token: string` - Authentication token.

2. **status_update**
   - `agentId: string` - Unique identifier for the agent.
   - `status: AgentStatus` - Agent's current status (idle, busy, error, offline).

3. **resource_request**
   - `agentId: string` - Unique identifier for the agent.
   - `resourceId: string` - ID of the requested resource.
   - `duration?: number` - Optional duration for the resource usage.

4. **workflow_trigger**
   - `workflowId: string` - ID of the workflow to trigger.
   - `dependencies: string[]` - List of dependencies required to trigger the workflow.
   - `parallelTasks: Array<{taskId: string, agentId: string, dependencies: string[]}>` - Tasks to run in parallel.

5. **heartbeat**
   - `agentId: string` - Unique identifier for the agent.
   - `timestamp: number` - Current timestamp of the heartbeat signal.

## Return Values

The API does not directly return values through methods, as it operates over WebSocket connections. Instead, it emits events based on the processed messages, which may include confirmations or updates sent back to the originating agents.

## Examples

### Example of Joining a Team

```javascript
const message = {
  type: 'join_team',
  teamId: 'team123',
  agentId: 'agent456',
  token: 'secureToken'
};
ws.send(JSON.stringify(message));
```

### Example of Sending a Status Update

```javascript
const statusUpdate = {
  type: 'status_update',
  agentId: 'agent456',
  status: {
    agentId: 'agent456',
    status: 'busy',
    currentTask: 'task789',
    resources: ['resourceA', 'resourceB']
  }
};
ws.send(JSON.stringify(statusUpdate));
```

### Example of Triggering a Workflow

```javascript
const workflowTrigger = {
  type: 'workflow_trigger',
  workflowId: 'workflow321',
  dependencies: ['resourceA'],
  parallelTasks: [
    { taskId: 'task1', agentId: 'agent456', dependencies: [] },
    { taskId: 'task2', agentId: 'agent789', dependencies: ['task1'] }
  ]
};
ws.send(JSON.stringify(workflowTrigger));
```

Utilize this API to ensure efficient coordination and task management among agents in real-time scenarios.