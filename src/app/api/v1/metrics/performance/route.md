# Build Real-Time Performance Metrics API

```markdown
# Real-Time Performance Metrics API

## Purpose
The Real-Time Performance Metrics API provides an endpoint to track and aggregate performance metrics for different services within your application. It enables monitoring of critical performance indicators such as response times, throughput, and error rates. Additionally, it allows setting alert thresholds for performance metrics, helping maintain the health of your application.

## Usage
This API is utilized within a Next.js application using server-side code. The API expects authentication via a `PERFORMANCE_API_KEY` and retrieves performance data from a PostgreSQL database (via Supabase) and from a Redis store.

## Parameters/Props
The following environmental variables must be set:
- **SUPABASE_URL** (string): The URL for the Supabase instance.
- **SUPABASE_SERVICE_ROLE_KEY** (string): Service role key for accessing Supabase.
- **REDIS_URL** (string): The URL for the Redis instance.
- **PERFORMANCE_API_KEY** (string): A secret key for authenticating API requests.

### PerformanceMetric Interface
Represents individual performance metrics:
- `id` (string): Unique identifier for the metric.
- `service` (string): Name of the service being monitored.
- `endpoint` (string): The endpoint of the service.
- `method` (string): The HTTP method (GET, POST, etc.) used.
- `response_time` (number): Time taken to respond (in ms).
- `throughput` (number): Requests handled per time unit.
- `error_rate` (number): Percentage of requests that resulted in an error.
- `status_code` (number): HTTP status code returned.
- `timestamp` (string): Time at which the metric was recorded.
- `user_id` (string, optional): Identifier for the user (if applicable).
- `region` (string): Geographical region of the service.
- `version` (string): Version of the service.

### AggregatedMetrics Interface
Contains aggregated performance metrics:
- `service` (string): Name of the service.
- Various metrics representing averages, counts, and rates.

### AlertThreshold Interface
Defines thresholds for triggering alerts based on performance:
- `id`, `service`, `metric_type`, `threshold_value`, `comparison`, `window_minutes`, `severity`, `enabled`, `created_by`.

### Alert Interface
Captures an alert generated for a threshold breach:
- `id`, `threshold_id`, `service`, `metric_type`, `current_value`, `threshold_value`, `severity`, `message`.

## Return Values
The API returns performance data in structured formats including:
- Individual performance metrics (PerformanceMetric)
- Aggregated performance metrics (AggregatedMetrics)
- Alerts triggered based on defined thresholds (Alert)

## Examples
### Fetching Performance Metrics
```typescript
const response = await fetch('/api/v1/metrics/performance', {
  headers: {
    'Authorization': `Bearer ${PERFORMANCE_API_KEY}`
  }
});
const metrics = await response.json();
console.log(metrics);
```

### Setting Alert Thresholds
```typescript
const threshold = {
  service: 'myService',
  metric_type: 'response_time',
  threshold_value: 200,
  comparison: 'gt',
  window_minutes: 15,
  severity: 'high',
  enabled: true,
  created_by: 'admin'
};

const alertResponse = await fetch('/api/v1/metrics/alerts/thresholds', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PERFORMANCE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(threshold)
});
const alertResult = await alertResponse.json();
console.log(alertResult);
```
```