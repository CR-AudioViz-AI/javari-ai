# Build Adaptive Load Distribution Engine

# Adaptive Load Distribution Engine Documentation

## Purpose
The Adaptive Load Distribution Engine is designed to intelligently distribute incoming traffic across multiple servers using various load balancing algorithms. It promotes efficient resource usage by considering server health metrics, traffic patterns, and adaptive weights.

## Usage
To use the Adaptive Load Distribution Engine, you need to instantiate the engine with the appropriate configuration, register server details, and periodically monitor server health. The engine will provide routing results based on the defined load balancing algorithm.

## Parameters/Props

### ServerConfig
```typescript
interface ServerConfig {
  id: string; // Unique identifier for the server
  endpoint: string; // Server endpoint for traffic routing
  region: string; // Geographic region of the server
  weight: number; // Weight for load distribution
  maxConnections: number; // Maximum concurrent connections allowed
  healthCheckInterval: number; // Interval for health checks in milliseconds
  coordinates?: { lat: number; lng: number }; // Optional geographic coordinates
}
```

### ServerHealth
```typescript
interface ServerHealth {
  serverId: string; // ID of the server
  status: 'healthy' | 'degraded' | 'unhealthy'; // Health status of the server
  responseTime: number; // Average response time of the server in ms
  cpuUsage: number; // Current CPU usage percentage
  memoryUsage: number; // Current memory usage percentage
  activeConnections: number; // Current number of active connections
  errorRate: number; // Error rate percentage
  lastCheck: Date; // Timestamp of the last health check
}
```

### LoadBalanceAlgorithm
```typescript
type LoadBalanceAlgorithm = 
  | 'weighted-round-robin'
  | 'least-connections'
  | 'response-time'
  | 'geographic-affinity'
  | 'adaptive-hybrid';
```

### RequestContext
```typescript
interface RequestContext {
  id: string; // Unique request identifier
  clientIp: string; // IP address of the client making the request
  region?: string; // Optional region information
  userAgent?: string; // User agent string of the client
  timestamp: Date; // Timestamp of the request
  headers: Record<string, string>; // Request headers
}
```

### RoutingResult
```typescript
interface RoutingResult {
  serverId: string; // ID of the selected server
  endpoint: string; // Endpoint of the selected server
  weight: number; // Weight of the selected server
  estimatedLatency: number; // Estimated latency for the request
  algorithm: string; // Algorithm used for routing
  confidence: number; // Confidence level of the routing decision
}
```

### EngineConfig
```typescript
interface EngineConfig {
  algorithm: LoadBalanceAlgorithm; // Load balancing algorithm to use
  healthCheckInterval: number; // Interval for health checks in milliseconds
  trafficAnalysisWindow: number; // Time window for traffic analysis in minutes
  maxRetries: number; // Maximum number of retries allowed for failed requests
  failoverThreshold: number; // Threshold for server failover conditions
  adaptiveThreshold: number; // Dynamic adjustment threshold for load distribution
  redis?: { host: string; port: number; password?: string }; // Optional Redis connection details
  supabase?: { url: string; key: string }; // Optional Supabase connection details
}
```

## Return Values
- The engine returns a `RoutingResult` upon processing a request, indicating which server to route to based on the current load, health metrics, and defined algorithms.

## Example
```typescript
const engineConfig: EngineConfig = {
  algorithm: 'adaptive-hybrid',
  healthCheckInterval: 10000,
  trafficAnalysisWindow: 60,
  maxRetries: 3,
  failoverThreshold: 0.5,
  adaptiveThreshold: 0.3,
  redis: { host: 'localhost', port: 6379 },
  supabase: { url: 'https://xyz.supabase.co', key: 'your-api-key' },
};

const loadBalancer = new AdaptiveLoadDistributor(engineConfig);
const routingResult = loadBalancer.routeRequest(requestContext);
console.log(routingResult);
```

In this example, an `AdaptiveLoadDistributor` is instantiated using the `engineConfig` object, and routing decisions can be made through the `routeRequest` method.