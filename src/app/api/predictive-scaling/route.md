# Build Predictive Auto-Scaling API

# Predictive Auto-Scaling API Documentation

## Purpose
The Predictive Auto-Scaling API allows users to create and manage auto-scaling policies for their services based on predictive metrics. It provides functionality to set scaling policies, ingest service metrics, and forecast scaling needs.

## Usage
This API handles requests for predictive scaling operations. It utilizes Supabase for data storage and Redis for caching and message passing. The API validates input using Zod schemas before processing any requests.

## Endpoints
### 1. Create Scaling Policy
- **Method:** POST
- **Endpoint:** `/api/predictive-scaling/policies`
- **Description:** Creates a new scaling policy.

#### Parameters/Props
- `name` (string): Name of the scaling policy (1-100 characters).
- `service` (string): Service identifier (required).
- `minInstances` (number): Minimum instances (1-1000).
- `maxInstances` (number): Maximum instances (1-10000).
- `targetCPU` (number): Target CPU utilization (10-90%).
- `targetMemory` (number): Target memory utilization (10-90%).
- `predictionWindow` (number): Prediction window in minutes (5-1440).
- `scaleUpThreshold` (number): Threshold for scaling up (0.1-1.0).
- `scaleDownThreshold` (number): Threshold for scaling down (0.1-1.0).
- `cooldownPeriod` (number): Cooldown period in seconds (60-3600).
- `enabled` (boolean): Is the policy active?
- `tags` (object, optional): Key-value pairs for tagging the policy.

#### Return Values
- Returns the created scaling policy object, including a generated `id`, `createdAt`, and `updatedAt` timestamps.

### 2. Submit Service Metrics
- **Method:** POST
- **Endpoint:** `/api/predictive-scaling/metrics`
- **Description:** Submits service metrics for processing.

#### Parameters/Props
- `service` (string): Service identifier (required).
- `timestamp` (number): The time of the metrics submission (Unix timestamp).
- `metrics` (object): Metrics object containing:
  - `cpu` (number): CPU percentage (0-100).
  - `memory` (number): Memory percentage (0-100).
  - `requestsPerSecond` (number): Incoming requests per second.
  - `responseTime` (number): Average response time.
  - `errorRate` (number): Error rate (0-1).
  - `activeConnections` (number): Number of active connections.
  - `queueLength` (number): Length of the request queue.
  - `instanceCount` (number): Current instance count (minimum 1).

#### Return Values
- Returns a confirmation message upon successful submission of metrics.

### 3. Forecast Scaling Needs
- **Method:** POST
- **Endpoint:** `/api/predictive-scaling/forecast`
- **Description:** Forecasts scaling needs based on historical metrics for a given service.

#### Parameters/Props
- `service` (string): Service identifier (required).
- `horizon` (number): Forecast horizon in minutes (5-1440).
- `confidence` (number, optional): Confidence level (0.8-0.99, defaults to 0.95).

#### Return Values
- Returns forecast data detailing predicted scaling needs.

## Example Usage
```javascript
// Create a scaling policy
const createPolicy = async () => {
  const response = await fetch('/api/predictive-scaling/policies', {
    method: 'POST',
    body: JSON.stringify({
      name: 'High Traffic Policy',
      service: 'web-server',
      minInstances: 2,
      maxInstances: 10,
      targetCPU: 75,
      targetMemory: 75,
      predictionWindow: 30,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.2,
      cooldownPeriod: 300,
      enabled: true,
      tags: { environment: 'production' },
    }),
  });
  const policy = await response.json();
  console.log(policy);
};
```

This API facilitates effective auto-scaling based on predictive analysis, allowing businesses to adapt resources according to workload dynamically.