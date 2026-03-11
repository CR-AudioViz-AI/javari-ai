# Implement Agent Usage Tracking Service

# Agent Usage Tracking Service

## Purpose
The Agent Usage Tracking Service is designed to monitor and track execution metrics for agents in real-time. It aggregates performance statistics, maintains performance data, and broadcasts relevant information over WebSocket, enabling stakeholders to make informed decisions based on usage patterns.

## Usage
The service initializes connections to various databases and tracks the execution of agents. It handles metrics collection, updates aggregate statistics, and broadcasts real-time data.

### Example Initialization
```typescript
import { AgentUsageTrackingService } from './src/services/agent-usage-tracking.service';

const config: UsageTrackingConfig = {
  clickhouseConfig: {
    host: 'localhost',
    port: 8123,
    username: 'default',
    password: '',
    database: 'metrics'
  },
  supabaseConfig: {
    url: 'https://your-supabase-url',
    key: 'your-supabase-key'
  },
  redisConfig: {
    host: 'localhost',
    port: 6379,
    password: undefined
  },
  batchSize: 100,
  flushInterval: 30000, // in milliseconds
  realtimeUpdateInterval: 10000, // in milliseconds
  metricsRetentionDays: 30
};

const agentUsageTrackingService = new AgentUsageTrackingService(config);
```

## Parameters / Props

### `UsageTrackingConfig`
- `clickhouseConfig`: Configuration for ClickHouse database connection.
  - `host`: Hostname for the ClickHouse database.
  - `port`: Port number for ClickHouse.
  - `username`: Username for ClickHouse authentication.
  - `password`: Password for ClickHouse authentication.
  - `database`: Database name in ClickHouse.
  
- `supabaseConfig`: Configuration for Supabase connection.
  - `url`: Supabase project URL.
  - `key`: Anonymized API key for Supabase.

- `redisConfig`: Configuration for Redis.
  - `host`: Hostname for the Redis server.
  - `port`: Port number for the Redis server.
  - `password` (optional): Password for Redis authentication.
  
- `batchSize`: Maximum number of metrics to process in a single batch.
- `flushInterval`: Time interval for flushing collected metrics to persistence (in milliseconds).
- `realtimeUpdateInterval`: Time interval for updating real-time metrics over WebSocket (in milliseconds).
- `metricsRetentionDays`: Number of days to retain metrics data.

## Return Values
The service does not return values directly but constantly updates its internal state and broadcasts real-time metrics to connected clients via WebSocket.

## Example of Usage
1. Start tracking an agent execution:
   ```typescript
   const metrics: AgentExecutionMetrics = {
     agentId: 'agent-123',
     userId: 'user-456',
     sessionId: 'session-789',
     executionId: 'exec-001',
     startTime: new Date(),
     status: 'running',
     inputSize: 1024 // in bytes
   };
   agentUsageTrackingService.trackAgentExecution(metrics);
   ```

2. Retrieve aggregated usage statistics for an agent:
   ```typescript
   const stats: UsageStatistics = agentUsageTrackingService.getUsageStatistics('agent-123', 'daily');
   console.log(stats);
   ```

3. Listen for real-time metrics via WebSocket:
   ```typescript
   const ws = new WebSocket('ws://localhost:8080');
   ws.onmessage = (message) => {
     const realtimeMetrics: RealtimeUsageMetrics = JSON.parse(message.data);
     console.log(realtimeMetrics);
   };
   ```

This service allows teams to maintain robust performance monitoring, facilitating an agile response to user needs and resource management.