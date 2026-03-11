# Deploy Spatial Audio Processing Service

# CR AudioViz AI Spatial Audio Processing Service

## Purpose
The Spatial Audio Processing Service is a real-time microservice designed for 3D spatial audio processing within CRAIverse environments. It supports dynamic acoustics, sound occlusion, and multisource audio channel management.

## Usage
To deploy the Spatial Audio Processing Service, ensure that Node.js and the required dependencies are installed. The service listens for WebSocket and HTTP requests on a defined port, enabling real-time audio processing and communication with other services.

### Starting the Service
```bash
npm install
npm start
```

## Parameters / Props

### `ServiceConfig`
This interface defines the configuration parameters for the service.

- `port: number` — The port on which the service will listen.
- `redisUrl: string` — Redis server URL for caching and state management.
- `natsUrl: string` — NATS server URL for messaging.
- `supabaseUrl: string` — Supabase URL for database management.
- `supabaseKey: string` — Supabase API key for authentication.
- `corsOrigins: string[]` — Allowed CORS origins for API requests.
- `metricsPort: number` — Port for exposing Prometheus metrics.
- `maxConnections: number` — Maximum number of concurrent connections.
- `audioSampleRate: number` — Sample rate for audio processing.
- `audioBufferSize: number` — Size of audio buffer for processing.

### `ServiceMetrics`
This interface tracks service performance metrics.

- `activeConnections: Gauge<string>` — Gauge for current active connections.
- `audioProcessingLatency: Histogram<string>` — Histogram for latency in audio processing.
- `messagesProcessed: Counter<string>` — Counter for processed messages.
- `errorsTotal: Counter<string>` — Counter for total errors encountered.
- `spatialCalculations: Counter<string>` — Counter for spatial calculations performed.
- `voiceChatSessions: Gauge<string>` — Gauge for active voice chat sessions.

### `HealthStatus`
This interface represents the health status of the service.

- `status: 'healthy' | 'unhealthy'` — Current health status.
- `timestamp: number` — Timestamp of the health check.
- `services: { redis: boolean; nats: boolean; supabase: boolean; webrtc: boolean; }` — Status of dependent services.
- `metrics: { activeConnections: number; averageLatency: number; uptime: number; }` — Various metrics for monitoring the service's performance.

## Return Values
The service provides system health checks and metrics through its API endpoints, responding with details about connectivity and performance.

## Examples

### Health Check Endpoint
To check the service health:
```
GET /health
```
Returns:
```json
{
  "status": "healthy",
  "timestamp": 1616148785,
  "services": {
    "redis": true,
    "nats": true,
    "supabase": true,
    "webrtc": true
  },
  "metrics": {
    "activeConnections": 42,
    "averageLatency": 120.5,
    "uptime": 3600
  }
}
```

### Metrics Endpoint
To retrieve metrics:
```
GET /metrics
```
Exposes metrics in Prometheus format.

### WebSocket Connection
Establish a WebSocket connection to the service:
```javascript
const socket = new WebSocket('ws://localhost:PORT');
```

This service is a key component for developers looking to integrate advanced audio functionalities into their applications, particularly in interactive 3D environments.