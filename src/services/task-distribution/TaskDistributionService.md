# Build Dynamic Task Distribution Service

# TaskDistributionService Documentation

## Purpose
The `TaskDistributionService` is designed to efficiently manage and distribute tasks among AI team members based on their capabilities, current load, and performance metrics. It ensures optimal task assignment to enhance productivity and resource utilization.

## Usage
To use the `TaskDistributionService`, first instantiate the service by providing the necessary configuration parameters. The service utilizes Supabase for real-time data updates and Redis for quick data caching and retrieval.

## Parameters/Props

### Task
Interface defining the properties of a task.

- `id` (string): Unique identifier for the task.
- `type` (string): Type of the task.
- `complexity` (number): Complexity level of the task.
- `requiredCapabilities` (string[]): Skills required to perform the task.
- `payload` (any): Data related to the task.
- `priority` ('low' | 'medium' | 'high' | 'critical'): Task urgency.
- `deadline` (Date, optional): Due date for the task.
- `estimatedDuration` (number): Estimated time to complete the task.
- `metadata` (Record<string, any>): Additional information about the task.
- `createdAt` (Date): Timestamp of task creation.

### AITeamMember
Interface defining AI team member attributes.

- `id` (string): Unique identifier for the team member.
- `name` (string): Name of the team member.
- `type` ('analyzer' | 'generator' | 'processor' | 'coordinator'): Role of the member.
- `capabilities` (string[]): Skills possessed.
- `maxConcurrentTasks` (number): Maximum number of tasks that can be handled simultaneously.
- `currentLoad` (number): Current number of tasks assigned.
- `status` ('available' | 'busy' | 'offline' | 'maintenance'): Current status.
- `performanceScore` (number): Score reflecting member's performance.
- `averageTaskTime` (number): Average time taken to complete tasks.
- `successRate` (number): Success rate for completed tasks.
- `specializations` (string[]): Specific areas of expertise.
- `lastActive` (Date): Timestamp of last activity.

### TaskAssignment
Interface for the result of a task assignment.

- `taskId` (string): Unique identifier of the assigned task.
- `assignedMemberId` (string): ID of the member to whom the task is assigned.
- `assignedAt` (Date): Timestamp of assignment.
- `estimatedCompletion` (Date): Estimated completion time.
- `confidenceScore` (number): Confidence in assignment decision.
- `routingReason` (string): Reason for task routing.

### DistributionMetrics
Interface for performance metrics of task distribution.

- `totalTasksDistributed` (number): Count of all distributed tasks.
- `averageAssignmentTime` (number): Average time taken for assignments.
- `successfulAssignments` (number): Count of successful task assignments.
- `failedAssignments` (number): Count of failed task assignments.
- `loadBalanceEfficiency` (number): Efficiency of load balancing efforts.
- `memberUtilizationRates` (Record<string, number>): Utilization rates of team members.
- `taskTypeDistribution` (Record<string, number>): Distribution counts of each task type.

### TaskDistributionConfig
Interface providing configuration options for the service.

- `supabaseUrl` (string): Supabase project URL.
- `supabaseKey` (string): Authentication key for Supabase.
- `redisUrl` (string): Redis server URL.
- `maxRetryAttempts` (number): Maximum retry attempts for task assignments.
- `loadBalanceThreshold` (number): Threshold for load balancing between members.
- `performanceWindowMinutes` (number): Time window for performance metrics.
- `complexityWeights` (Record<string, number>): Weights for task complexity evaluation.
- `capabilityWeights` (Record<string, number>): Weights for evaluating member capabilities.

## Examples

```typescript
const config: TaskDistributionConfig = {
  supabaseUrl: 'https://xyz.supabase.co',
  supabaseKey: 'your_supabase_key',
  redisUrl: 'redis://localhost:6379',
  maxRetryAttempts: 3,
  loadBalanceThreshold: 0.8,
  performanceWindowMinutes: 30,
  complexityWeights: { easy: 1, medium: 2, hard: 3 },
  capabilityWeights: { analyzer: 1, generator: 2, processor: 3 }
};

const taskService = new TaskDistributionService(config);
```

In this example, the `TaskDistributionService` is initialized with configuration settings that facilitate task management and distribution for a team of AI members.