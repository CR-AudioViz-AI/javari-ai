# Build Multi-Agent Workflow Execution Engine

# Multi-Agent Workflow Execution Engine

## Purpose
The Multi-Agent Workflow Execution Engine provides a framework for defining and executing workflows comprising multiple tasks. It supports various task types such as AI agents, conditions, parallel and sequential processing, and webhook integration. The engine also includes robust error handling, retry policies, and notification configurations.

## Usage
To utilize the Workflow Execution Engine, define your workflows using the `WorkflowDefinition` interface, create appropriate tasks using the `WorkflowTask` interface, and handle execution status through the provided types. The engine can be integrated with services such as Supabase for data management and Redis for state storage.

## Interfaces and Types

### `WorkflowTask`
Defines a single task in the workflow.
- **Properties:**
  - `id` (string): Unique identifier for the task.
  - `name` (string): Name of the task.
  - `type` ('ai_agent' | 'condition' | 'parallel' | 'sequential' | 'webhook'): Specifies the task type.
  - `agentType` (string, optional): Type of the AI agent if applicable.
  - `config` (Record<string, any>): Configuration parameters for the task.
  - `dependencies` (string[]): List of task IDs this task depends on.
  - `retryPolicy` (RetryPolicy, optional): Retry strategy for the task.
  - `timeout` (number, optional): Maximum duration for the task execution.
  - `condition` (string, optional): Condition under which the task should execute.

### `WorkflowDefinition`
Defines the structure of an entire workflow.
- **Properties:**
  - `id` (string): Unique identifier for the workflow.
  - `name` (string): Name of the workflow.
  - `version` (string): Version of the workflow.
  - `description` (string, optional): Description of the workflow.
  - `variables` (Record<string, any>): Variables usable within the workflow.
  - `tasks` (WorkflowTask[]): List of tasks in the workflow.
  - `errorHandling` (ErrorHandlingConfig, optional): Error handling strategies.
  - `triggers` (WorkflowTrigger[], optional): Triggers that initiate the workflow.

### `RetryPolicy`
Configuration for retrying tasks.
- **Properties:**
  - `maxAttempts` (number): Maximum number of retry attempts.
  - `backoffStrategy` ('linear' | 'exponential' | 'fixed'): Strategy used for retry timing.
  - `baseDelay` (number): Initial delay before retrying.
  - `maxDelay` (number): Maximum delay allowed between retries.
  - `retryOn` (string[], optional): Error types that should trigger a retry.

### `ErrorHandlingConfig`
Configures error handling for the workflow.
- **Properties:**
  - `onFailure` ('stop' | 'continue' | 'compensate'): Action taken on task failure.
  - `compensationTasks` (string[], optional): Tasks to execute for compensation.
  - `notifications` (NotificationConfig[], optional): Notifications to send on errors.

### `NotificationConfig`
Configuration for notifications.
- **Properties:**
  - `type` ('email' | 'webhook' | 'slack'): Type of notification method.
  - `recipients` (string[]): List of recipients for notifications.
  - `template` (string): Template for the notification message.

## Return Values
The engine returns the execution results of tasks, detailing their status, outputs, errors, and execution times via `TaskExecutionResult`.

## Examples

### Defining a Workflow
```typescript
const sampleWorkflow: WorkflowDefinition = {
  id: '1',
  name: 'Sample Workflow',
  version: '1.0',
  variables: { userId: '123' },
  tasks: [
    {
      id: 'task1',
      name: 'Process User Data',
      type: 'ai_agent',
      agentType: 'textProcessor',
      config: {},
      dependencies: [],
    },
    {
      id: 'task2',
      name: 'Send Notification',
      type: 'webhook',
      config: { url: 'https://example.com/notify' },
      dependencies: ['task1'],
    }
  ],
};
```

This documentation provides a concise reference for implementing the Multi-Agent Workflow Execution Engine in application development.