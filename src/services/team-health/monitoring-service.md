# Deploy Real-Time Team Health Monitoring Microservice

# Real-Time Team Health Monitoring Microservice

## Purpose
The Real-Time Team Health Monitoring Microservice provides a solution for monitoring the health status and performance metrics of agents in a distributed system. It facilitates real-time data collection, analysis, and alerting based on various health parameters, ensuring optimal performance and workload distribution among agents.

## Usage
This microservice is designed to collect, evaluate, and report on the health and performance of agents. It integrates with external services such as Supabase and Redis for data storage and messaging, while also utilizing WebSocket for real-time communication.

## Parameters/Props
### Interfaces
- **AgentHealth**
  - `agentId: string`: Unique identifier for the agent.
  - `status: 'online' | 'offline' | 'busy' | 'idle' | 'error'`: Current operational status of the agent.
  - `lastHeartbeat: Date`: Timestamp of the last heartbeat received from the agent.
  - `responseTime: number`: Average response time of the agent in milliseconds.
  - `cpuUsage: number`: Current CPU usage as a percentage.
  - `memoryUsage: number`: Memory usage in megabytes.
  - `activeConnections: number`: Number of active connections handled by the agent.
  - `errorRate: number`: Rate of errors encountered (0-100%).
  - `throughput: number`: Number of requests processed per second.

- **PerformanceMetrics**
  - `agentId: string`: Identifier for the agent being monitored.
  - `timestamp: Date`: Time when metrics were recorded.
  - `requestsPerSecond: number`: Requests processed by the agent per second.
  - `averageResponseTime: number`: Average response time in milliseconds.
  - `successRate: number`: Percentage of successful requests.
  - `errorCount: number`: Total number of errors encountered.
  - `queueLength: number`: Current queue length of requests waiting for processing.
  - `processingTime: number`: Average time taken to process requests.

- **WorkloadAnalysis**
  - `totalAgents: number`: Total number of agents.
  - `activeAgents: number`: Current number of active agents.
  - `averageLoad: number`: Average load across all agents.
  - `imbalanceScore: number`: A score indicating workload distribution imbalance.
  - `recommendations: string[]`: Suggested actions for improving balance.
  - `criticalAgents: string[]`: List of agents requiring immediate attention.

- **HealthAlert**
  - `id: string`: Unique identifier for the alert.
  - `type: 'warning' | 'critical' | 'info'`: Severity type of the alert.
  - `agentId?: string`: Optional ID of the affected agent.
  - `message: string`: Alert message description.
  - `threshold: number`: Threshold value that triggered the alert.
  - `currentValue: number`: Current value of the metric at alert time.
  - `timestamp: Date`: Time when the alert was generated.
  - `resolved: boolean`: Status indicating if the alert is resolved.
  - `suggestions: string[]`: Recommended actions to address the alert.

- **RecoveryRecommendation**
  - `id: string`: Unique identifier for the recommendation.
  - `type: 'scale_up' | 'scale_down' | 'redistribute' | 'restart' | 'maintenance'`: Type of recovery action suggested.
  - `priority: 'low' | 'medium' | 'high' | 'critical'`: Importance of the recommendation.
  - `description: string`: Detailed description of the recommendation.
  - `estimatedImpact: string`: Expected impact of implementing the recommendation.
  - `automatable: boolean`: Indicates if the recommendation can be automated.
  - `steps: string[]`: Detailed steps for implementing the recommendation.

- **HealthThresholds**
  - Various properties to set thresholds for response time, error rate, CPU/memory usage, and heartbeat timeout.

## Return Values
The microservice returns structured health and performance data through the interfaces defined above, which can be used for monitoring dashboards, alert systems, and analytics platforms.

## Examples
```typescript
const agentStatus: AgentHealth = {
  agentId: "agent-123",
  status: "online",
  lastHeartbeat: new Date(),
  responseTime: 250,
  cpuUsage: 75.5,
  memoryUsage: 512,
  activeConnections: 10,
  errorRate: 1.5,
  throughput: 20
};

const performanceMetrics: PerformanceMetrics = {
  agentId: "agent-123",
  timestamp: new Date(),
  requestsPerSecond: 15,
  averageResponseTime: 300,
  successRate: 98,
  errorCount: 2,
  queueLength: 3,
  processingTime: 150
};

// Usage