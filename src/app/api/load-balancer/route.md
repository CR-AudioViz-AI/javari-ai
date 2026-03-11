# Build Dynamic Load Balancing Control API

# Dynamic Load Balancing Control API Documentation

## Purpose
The Dynamic Load Balancing Control API provides a set of endpoints to manage load balancing configurations, routing policies, and health checks for a pool of nodes. It supports various load-balancing algorithms and enables predictive analysis for dynamic weight adjustments.

## Usage
This API is designed to be used within a Next.js application and can handle requests related to load balancer settings, node health metrics, and routing policies. The API communicates with Supabase for data storage and Redis for caching and real-time updates.

## Parameters / Props

### LoadBalancerConfig
- **id**: `string` (UUID) - Unique identifier for the load balancer.
- **name**: `string` - Descriptive name for the load balancer.
- **algorithm**: `'round_robin' | 'weighted_round_robin' | 'least_connections' | 'ip_hash' | 'predictive'` - Load balancing strategy.
- **health_check_interval**: `number` - Interval for health checks in milliseconds.
- **failure_threshold**: `number` - Number of failed health checks before marking a node unhealthy.
- **recovery_threshold**: `number` - Number of successful health checks before marking a node healthy again.
- **sticky_sessions**: `boolean` - Whether to maintain session stickiness.
- **created_at**: `string` - Timestamp of creation.
- **updated_at**: `string` - Timestamp of the last update.

### NodeMetrics
- **node_id**: `string` (UUID) - Unique identifier for the node.
- **cpu_usage**: `number` - Current CPU usage percentage.
- **memory_usage**: `number` - Current memory usage percentage.
- **active_connections**: `number` - Number of active connections to the node.
- **response_time**: `number` - Average response time in milliseconds.
- **error_rate**: `number` - Percentage of erroneous responses.
- **throughput**: `number` - Requests processed per second.
- **health_status**: `'healthy' | 'degraded' | 'unhealthy'` - Current health status of the node.
- **timestamp**: `string` - Timestamp of the metrics report.

### RoutingPolicy
- **id**: `string` (UUID) - Unique identifier for the routing policy.
- **load_balancer_id**: `string` (UUID) - Associated load balancer.
- **node_id**: `string` (UUID) - Node affected by the policy.
- **weight**: `number` - Weight for the node in load balancing.
- **max_connections**: `number` - Maximum permissible connections to this node.
- **backup**: `boolean` - Indicates if this node is a backup.
- **enabled**: `boolean` - Status of the policy.
- **priority**: `number` - Priority of the policy.

### PredictiveAnalysis
- **node_id**: `string` (UUID) - Node being analyzed.
- **predicted_load**: `number` - Expected load based on analysis.
- **confidence**: `number` - Confidence level of the prediction.
- **recommendation**: `'increase_weight' | 'decrease_weight' | 'maintain' | 'remove'` - Suggested action based on analysis.
- **factors**: `string[]` - Factors influencing the prediction.

## Return Values
The API returns JSON responses based on the request type and the data being queried or modified. Standard error handling responses include:
- 400 Bad Request - For validation errors.
- 404 Not Found - When specified resources don't exist.
- 500 Internal Server Error - For unexpected server errors.

## Examples
### Load Balancer Creation
```json
{
  "name": "Main Load Balancer",
  "algorithm": "weighted_round_robin",
  "health_check_interval": 5000,
  "failure_threshold": 5,
  "recovery_threshold": 2,
  "sticky_sessions": true
}
```

### Node Health Metrics Query
```json
{
  "node_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Policy Update
```json
{
  "load_balancer_id": "123e4567-e89b-12d3-a456-426614174001",
  "algorithm": "least_connections",
  "health_check_interval": 10000,
  "failure_threshold": 3,
  "recovery_threshold": 1
}
```

This documentation provides a comprehensive overview of the API's capabilities and usage for effective load balancing management.