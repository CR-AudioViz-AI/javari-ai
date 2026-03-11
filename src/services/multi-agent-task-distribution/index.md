# Deploy Multi-Agent Task Distribution Microservice

# Multi-Agent Task Distribution Microservice

## Purpose
The Multi-Agent Task Distribution Microservice intelligently distributes complex tasks across team agents based on their capabilities, current workload, and performance history. It features load balancing and fallback mechanisms to enhance efficiency and reliability in task management.

## Usage
This microservice is designed to automate the task assignment process, ensuring that tasks are handled by the most suitable agents based on predefined criteria. It integrates with Redis for job queue management and uses WebSocket for real-time communication.

## Parameters / Props
### Agent (Interface)
- **id**: `string` - Unique identifier for the agent.
- **name**: `string` - Name of the agent.
- **capabilities**: `AgentCapability[]` - Array of capabilities possessed by the agent.
- **status**: `AgentStatus` - Current operational status of the agent (e.g., ONLINE, OFFLINE).
- **currentLoad**: `number` - Current number of tasks assigned to the agent.
- **maxLoad**: `number` - Maximum number of tasks the agent can handle.
- **performanceMetrics**: `PerformanceMetrics` - Metrics tracking the agent's performance.
- **lastHeartbeat**: `Date` - Timestamp of the agent's last activity update.
- **circuitBreakerState**: `CircuitBreakerState` - State of the circuit breaker for fault tolerance.

### Task (Interface)
- **id**: `string` - Unique identifier for the task.
- **type**: `string` - Type/category of the task.
- **priority**: `TaskPriority` - Priority level of the task.
- **requiredCapabilities**: `string[]` - Array of skills required to complete the task.
- **complexityScore**: `number` - Score representing the task's complexity.
- **estimatedDuration**: `number` - Estimated time to complete the task.
- **payload**: `Record<string, any>` - Additional data associated with the task.
- **retryCount**: `number` - Current retry attempt number.
- **maxRetries**: `number` - Maximum allowable retries for the task.
- **createdAt**: `Date` - Timestamp of task creation.
- **deadline**: `Date` (optional) - Due date for the task completion.

### PerformanceMetrics (Interface)
- **successRate**: `number` - Ratio of completed to assigned tasks.
- **averageCompletionTime**: `number` - Average time taken to complete tasks.
- **totalTasksCompleted**: `number` - Total tasks successfully completed by the agent.
- **totalTasksFailed**: `number` - Total tasks failed by the agent.
- **efficiencyScore**: `number` - Computed efficiency score based on performance.
- **lastPerformanceUpdate**: `Date` - Timestamp of the last performance metrics update.

### TaskAssignment (Interface)
- **taskId**: `string` - Identifier for the assigned task.
- **agentId**: `string` - Identifier for the agent assigned to the task.
- **assignedAt**: `Date` - Timestamp of when the task was assigned.
- **estimatedCompletion**: `Date` - Estimated time for task completion.
- **score**: `number` - Score representing the suitability of the agent for the task.

## Return Values
The microservice returns the results of task assignments, including the `TaskAssignment` details, or suitable error messages if agents are unable to accept new tasks due to load, status, or configuration issues.

## Examples
### Assigning a Task
```typescript
const task: Task = {
    id: 'task-001',
    type: 'data_analysis',
    priority: TaskPriority.HIGH,
    requiredCapabilities: ['data_analysis', 'reporting'],
    complexityScore: 5,
    estimatedDuration: 7200,
    payload: { dataSetId: 'dataset-123' },
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
};

const assignment: TaskAssignment = assignTaskToAgent(task);
console.log(assignment);
```

### Checking Agent Status
```typescript
const agentStatus: AgentStatus = getAgentStatus(agentId);
console.log(`Agent status: ${agentStatus}`);
```

This documentation summarizes the microservice's functionality, data structures, and provides practical examples for integration.